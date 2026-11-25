// Depth-of-field product carousel: centre item sharp, sides shrink, blur and fade.
// Every drag frame recalculates translate/scale/blur/opacity per item (no CSS transitions).
window.NSFlow = {
  mount(root, items, { onOpen, render } = {}) {
    // items: [{ id, title, kicker, price, img, word }]
    root.classList.add('flow');
    root.innerHTML = `<div class="flow-word" aria-hidden="true"></div>
      <div class="flow-stage" tabindex="0" role="listbox" aria-label="Products, drag or use arrow keys">${items.map((it, i) => `
        <div class="flow-item" role="option" data-i="${i}"><div class="flow-pic" data-pic="${it.id}">${it.img ? `<img src="${it.img}" alt="" draggable="false">` : ''}</div></div>`).join('')}</div>
      <div class="flow-info"><button class="flow-arrow" data-d="-1" aria-label="Previous">←</button>
        <div class="flow-meta"><span class="flow-kicker"></span><b class="flow-title"></b><span class="flow-price"></span></div>
        <button class="flow-arrow" data-d="1" aria-label="Next">→</button></div>
      <div class="flow-dots">${items.map((_, i) => `<button data-dot="${i}" aria-label="Item ${i + 1}"></button>`).join('')}</div>
      <button class="btn lime flow-cta">View &amp; add +</button>`;
    const stage = root.querySelector('.flow-stage'), els = [...root.querySelectorAll('.flow-item')], dots = [...root.querySelectorAll('[data-dot]')];
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let cur = 0, target = 0, drag = null, raf = null, lastShown = -1;
    const spacing = () => Math.min(stage.clientWidth * 0.3, 300);
    function layout() {
      const sp = spacing();
      els.forEach((el, i) => {
        const o = i - cur, a = Math.abs(o);
        const s = Math.max(0.64, 1 - a * 0.18), blur = Math.min(6.5, a * 3.25), op = a > 2 ? Math.max(0, 1 - (a - 2)) : 1;
        el.style.transform = `translate3d(${o * sp}px,${a * 10}px,0) translateX(-50%) scale(${s})`;
        el.style.filter = blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : 'none';
        el.style.opacity = op; el.style.zIndex = 100 - Math.round(a * 10);
        el.setAttribute('aria-selected', String(Math.round(cur) === i));
      });
      const k = Math.max(0, Math.min(items.length - 1, Math.round(cur)));
      if (k !== lastShown) {
        lastShown = k; const it = items[k];
        root.querySelector('.flow-kicker').textContent = it.kicker; root.querySelector('.flow-title').textContent = it.title;
        root.querySelector('.flow-price').textContent = it.price; root.querySelector('.flow-word').textContent = it.word;
        dots.forEach((d, i) => d.classList.toggle('on', i === k));
      }
    }
    function tick() {
      if (!drag) { const d = target - cur; cur = Math.abs(d) < 0.001 || reduced ? target : cur + d * 0.16; }
      layout();
      raf = (drag || Math.abs(target - cur) > 0.001) ? requestAnimationFrame(tick) : null;
    }
    const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };
    const go = i => { target = Math.max(0, Math.min(items.length - 1, i)); kick(); };
    stage.addEventListener('pointerdown', e => { drag = { x: e.clientX, start: cur, moved: false }; stage.setPointerCapture(e.pointerId); kick(); });
    stage.addEventListener('pointermove', e => { if (!drag) return; const dx = e.clientX - drag.x; if (Math.abs(dx) > 4) drag.moved = true; cur = Math.max(-0.4, Math.min(items.length - 0.6, drag.start - dx / spacing())); });
    const end = e => {
      if (!drag) return; const moved = drag.moved; drag = null;
      if (!moved) { const el = e.target.closest('.flow-item'); if (el) { const i = +el.dataset.i; i === Math.round(cur) ? onOpen?.(items[i]) : go(i); return; } }
      go(Math.round(cur));
    };
    stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end);
    stage.addEventListener('keydown', e => { if (e.key === 'ArrowRight') go(Math.round(target) + 1); if (e.key === 'ArrowLeft') go(Math.round(target) - 1); if (e.key === 'Enter') onOpen?.(items[Math.round(target)]); });
    root.querySelectorAll('.flow-arrow').forEach(b => b.onclick = () => go(Math.round(target) + +b.dataset.d));
    dots.forEach(b => b.onclick = () => go(+b.dataset.dot));
    root.querySelector('.flow-cta').onclick = () => onOpen?.(items[Math.round(target)]);
    addEventListener('resize', layout);
    go(Math.min(1, items.length - 1)); cur = target; layout();
    return {
      setImage(id, url) { root.querySelectorAll(`[data-pic="${id}"]`).forEach(p => { if (!p.querySelector('img')) p.insertAdjacentHTML('afterbegin', `<img src="${url}" alt="" draggable="false">`); }); },
    };
  },
};
