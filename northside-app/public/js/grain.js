// Animated film grain overlay (same texture idea as the promo video)
(() => {
  try {
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); const d = x.createImageData(256, 256);
    for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    x.putImageData(d, 0, 0);
    const g = document.createElement('div'); g.className = 'grain'; g.setAttribute('aria-hidden', 'true'); g.style.backgroundImage = `url(${c.toDataURL()})`;
    document.body.appendChild(g);
  } catch { /* grain is decoration only */ }
})();
