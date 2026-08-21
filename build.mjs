// Generic static-site build: copy web assets to dist/ (excluding dev junk
// and backups) and minify .html / .css / .js in place. Safe for Direct
// Upload to Cloudflare Pages.
import fs from 'node:fs';
import path from 'node:path';
import { minify as htmlMinify } from 'html-minifier-terser';
import CleanCSS from 'clean-css';
import { minify as jsMinify } from 'terser';

const root = process.cwd();
const dist = path.join(root, 'dist');

// Files / dirs that must never be deployed.
const EXCLUDE = new Set([
  '.git', '.idea', 'node_modules', 'dist', '.wrangler', '.cache',
  'package.json', 'package-lock.json', 'build.mjs',
  'CNAME', '.nojekyll', '.gitignore',
  'LICENSE', 'LICENSE.txt', 'LICENSE.md',
  '.editorconfig', '.gitattributes',
]);

// Skip backup / throwaway artifacts (e.g. desk2.gif.bak, report-2.json).
const isJunk = (rel) => {
  const base = path.basename(rel).toLowerCase();
  if (base.endsWith('.bak') || base.endsWith('.bak2') || base.endsWith('.backup')) return true;
  if (rel.split(path.sep).length === 1 && (base.endsWith('.log') ||
      /^(lighthouse|.*-report|-report-)/i.test(base))) return true;
  return false;
};

function listAssets(srcDir, relDir, acc) {
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    if (EXCLUDE.has(entry.name)) continue;
    const rel = path.join(relDir, entry.name);
    if (entry.isDirectory()) listAssets(path.join(srcDir, entry.name), rel, acc);
    else if (!isJunk(rel)) acc.push({ src: path.join(srcDir, entry.name), rel });
  }
  return acc;
}

const HTML_OPTS = {
  collapseWhitespace: true,
  removeComments: true,
  removeRedundantAttributes: true,
  removeEmptyAttributes: true,
  removeScriptTypeAttributes: true,
  removeStyleLinkTypeAttributes: true,
  useShortDoctype: true,
  minifyCSS: true,   // minifies inline <style> (e.g. <noscript>) safely
  minifyJS: false,   // external .js minified separately; leaves inline handlers intact
  caseSensitive: true,
  keepClosingSlash: true,
};

async function minifyTree(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) { await minifyTree(p); continue; }
    const ext = path.extname(entry.name).toLowerCase();
    if (!['.html', '.css', '.js'].includes(ext)) continue;
    const raw = fs.readFileSync(p, 'utf8');
    try {
      let out = raw;
      if (ext === '.html') out = await htmlMinify(raw, HTML_OPTS);
      else if (ext === '.css') out = new CleanCSS({ level: 2 }).minify(raw).styles;
      else if (ext === '.js') out = (await jsMinify(raw, { compress: true, mangle: true })).code;
      fs.writeFileSync(p, out);
    } catch (e) {
      console.warn(`! skip minify (kept original): ${p}\n  ${e.message}`);
    }
  }
}

function dirSize(dir) {
  let total = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) total += dirSize(p);
    else total += fs.statSync(p).size;
  }
  return total;
}

const assets = listAssets(root, '.', []);
const sourceBytes = assets.reduce((s, a) => s + fs.statSync(a.src).size, 0);

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
for (const a of assets) {
  const dst = path.join(dist, a.rel);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(a.src, dst);
}
await minifyTree(dist);
const after = dirSize(dist);

console.log(`\n✓ Built dist/ for ${path.basename(root)}`);
console.log(`  source assets: ${(sourceBytes / 1024).toFixed(1)} KB across ${assets.length} files`);
console.log(`  dist total:     ${(after / 1024).toFixed(1)} KB`);
console.log(`  reduction:      ${sourceBytes ? (100 * (1 - after / sourceBytes)).toFixed(1) : 0}%\n`);
