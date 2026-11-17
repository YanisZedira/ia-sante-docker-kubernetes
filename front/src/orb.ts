// Orbe de particules de l'ouverture, façon nébuleuse : des milliers de points ronds et fins,
// répartis dans une sphère qui tourne lentement autour du ruban. La moitié arrière est dessinée
// DERRIÈRE le ruban, la moitié avant DEVANT : le ruban flotte vraiment à l'intérieur.
// Au passage de la souris (ou du doigt), les points s'écartent puis reviennent en douceur.
const PALETTE: [number, number, number][] = [[217, 70, 126], [170, 69, 217], [217, 104, 69], [240, 150, 185], [196, 160, 235]];

function sprite([r, g, b]: [number, number, number]) {
  // un point rond au bord doux, pré-rendu une fois
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const x = c.getContext("2d")!;
  const grad = x.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
  grad.addColorStop(0.45, `rgba(${r},${g},${b},.85)`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
  x.fillStyle = grad;
  x.fillRect(0, 0, 32, 32);
  return c;
}

export function initOrb(host: HTMLElement) {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const back = document.createElement("canvas"), front = document.createElement("canvas");
  back.className = "orb orb--back"; front.className = "orb orb--front";
  back.setAttribute("aria-hidden", "true"); front.setAttribute("aria-hidden", "true");
  host.prepend(back);
  host.append(front);
  const bctx = back.getContext("2d")!, fctx = front.getContext("2d")!;
  const sprites = PALETTE.map(sprite);
  const N = matchMedia("(max-width: 700px)").matches ? 1600 : 2800;

  // points dans une coquille sphérique (plus dense vers la surface), tailles très variées
  const base = new Float32Array(N * 3), off = new Float32Array(N * 2), vel = new Float32Array(N * 2);
  const col = new Uint8Array(N), size = new Float32Array(N), tw = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    const r = 0.62 + Math.pow(Math.random(), 0.45) * 0.42;
    base[i * 3] = s * Math.cos(th) * r; base[i * 3 + 1] = u * r; base[i * 3 + 2] = s * Math.sin(th) * r;
    col[i] = Math.random() < 0.5 ? 0 : Math.random() < 0.5 ? 1 : 2 + Math.floor(Math.random() * 3);
    size[i] = Math.random() < 0.92 ? 0.6 + Math.random() * 1.0 : 1.6 + Math.random() * 1.6;
    tw[i] = Math.random() * Math.PI * 2;
  }

  let W = 0, H = 0, dpr = 1, R = 0;
  const fit = () => {
    W = back.clientWidth; H = back.clientHeight;
    dpr = Math.min(devicePixelRatio || 1, 2);
    R = Math.min(W, H) * 0.34;
    for (const c of [back, front]) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
  };
  fit();
  new ResizeObserver(fit).observe(back);

  let px = -9999, py = -9999, active = false, tiltX = 0, tiltY = 0, tx = 0, ty = 0;
  addEventListener("pointermove", (e: PointerEvent) => {
    const b = back.getBoundingClientRect();
    const sx = W / b.width, sy = H / b.height; // corrige une éventuelle mise à l'échelle CSS
    px = (e.clientX - b.left) * sx; py = (e.clientY - b.top) * sy;
    active = px > 0 && py > 0 && px < W && py < H;
    tx = active ? (px / W - 0.5) * 0.6 : 0; ty = active ? (py / H - 0.5) * 0.6 : 0;
  }, { passive: true });

  let angle = 0, raf = 0, visible = true, last = performance.now(), t = 0;
  const frame = (now: number) => {
    const dt = Math.min(48, now - last) / 16.67; last = now; t += dt;
    angle += 0.0018 * dt;
    tiltX += (tx - tiltX) * 0.04 * dt; tiltY += (ty - tiltY) * 0.04 * dt;
    const ca = Math.cos(angle + tiltX), sa = Math.sin(angle + tiltX), cb = Math.cos(0.35 + tiltY), sb = Math.sin(0.35 + tiltY);
    for (const c of [bctx, fctx]) { c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H); }
    const cx = W / 2, cy = H / 2, rad = R * 0.55, rad2 = rad * rad;
    for (let i = 0; i < N; i++) {
      const x0 = base[i * 3], y0 = base[i * 3 + 1], z0 = base[i * 3 + 2];
      const x1 = x0 * ca + z0 * sa, z1 = -x0 * sa + z0 * ca;
      const y1 = y0 * cb - z1 * sb, z2 = y0 * sb + z1 * cb;
      const persp = 2.4 / (2.4 - z2);
      let sx = cx + x1 * R * persp, sy = cy + y1 * R * persp;
      let vx = vel[i * 2], vy = vel[i * 2 + 1], ox = off[i * 2], oy = off[i * 2 + 1];
      if (active) {
        const dx = sx + ox - px, dy = sy + oy - py, d2 = dx * dx + dy * dy;
        if (d2 < rad2) { const d = Math.sqrt(d2) || 1, f = (1 - d / rad) ** 2 * 5; vx += (dx / d) * f * dt; vy += (dy / d) * f * dt; }
      }
      vx += -ox * 0.03 * dt; vy += -oy * 0.03 * dt; vx *= 0.88; vy *= 0.88;
      ox += vx * dt; oy += vy * dt;
      vel[i * 2] = vx; vel[i * 2 + 1] = vy; off[i * 2] = ox; off[i * 2 + 1] = oy;
      sx += ox; sy += oy;
      const depth = (z2 + 1.05) / 2.1;               // 0 au fond, 1 devant
      const twinkle = 0.75 + 0.25 * Math.sin(t * 0.05 + tw[i]);
      const a = (0.12 + depth * 0.78) * twinkle;
      const s = size[i] * (0.55 + depth * 0.85) * persp;
      const ctx = z2 < 0 ? bctx : fctx;
      // devant le ruban, les points s'effacent au centre pour le laisser voir
      let fade = 1;
      if (z2 >= 0) { const dd = Math.hypot(sx - cx, sy - cy) / (R * 0.8); fade = Math.min(1, Math.max(0.12, dd * dd)); }
      ctx.globalAlpha = a * fade;
      ctx.drawImage(sprites[col[i]], sx - s, sy - s, s * 2, s * 2);
    }
    bctx.globalAlpha = fctx.globalAlpha = 1;
    if (!reduce && visible) raf = requestAnimationFrame(frame);
  };
  const start = () => { cancelAnimationFrame(raf); last = performance.now(); raf = requestAnimationFrame(frame); };
  new IntersectionObserver((en) => { visible = en[0].isIntersecting && !document.hidden; if (visible && !reduce) start(); }).observe(host);
  document.addEventListener("visibilitychange", () => { visible = !document.hidden; if (visible && !reduce) start(); });
  requestAnimationFrame(frame);
}
