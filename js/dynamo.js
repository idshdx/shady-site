;(function(){
    function initDynamo(el){
        if (el._inited) return;
        el._inited = true;

        const delay    = parseInt(el.dataset.delay, 10) || 3000;
        const speed    = parseInt(el.dataset.speed, 10) || 350;
        const lines    = (el.dataset.lines || '').split(el.dataset.delimiter || ',');
        const callback = typeof window[el.dataset.callback] === 'function'
            ? window[el.dataset.callback]
            : () => {};
        const centered = el. dataset.center === 'true';

        // Basic styles
        el.innerHTML = '';
        el.style.position = 'relative';
        el.style.overflow = 'hidden';
        el.style.display = 'inline-block';
        el.style.verticalAlign = 'bottom';
        if (centered) el.style.textAlign = 'center';

        // Create individual line divs
        lines.forEach((txt, i) => {
            const d = document.createElement('div');
            d.textContent = txt.trim();
            d.style.margin = '0';
            d.style.transition = `margin-top ${speed}ms ease`;
            if (i === 0) d.dataset.trigger = 'true';
            el.appendChild(d);
        });

        const getChildren = () => Array.from(el.children);
        const height = el.firstElementChild.getBoundingClientRect().height;
        el.style.height = height + 'px';

        function animate(){
            const first = el.firstElementChild;
            first.style.marginTop = `-${height}px`;

            // After transition ends, move first to end and reset margin
            first.addEventListener('transitionend', function onEnd(){
                first.removeEventListener('transitionend', onEnd);
                first.style.transition = 'none';
                first.style.marginTop = '0';
                el.appendChild(first);
                // Force reflow then restore transition
                void first.offsetHeight;
                first.style.transition = `margin-top ${speed}ms ease`;

                if (first.dataset.trigger === 'true') callback();
            });
        }

        setInterval(animate, delay);
    }

    document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('.dynamo').forEach(initDynamo);
    });

    window.dynamoInit = initDynamo;
})();