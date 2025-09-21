// js/Fx.js — Casino minimal: paño + bokeh + glitter + naipes grandes.
// Responsivo, con “zonas seguras” para que el fondo no distraiga detrás de la UI.
(() => {
  const cvs = document.getElementById('fx');
  if (!cvs) return;
  const ctx = cvs.getContext('2d', { alpha: true });

  // Cap de DPI para móviles
  const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

  // ================== CONFIG DINÁMICA ==================
  function cfg() {
    const w = innerWidth;
    const small = w <= 420;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    return {
      reduce,
      maxFps: small ? 45 : 60,
      feltHue: 140,
      // densidades
      bokeh: small ? 16 : 24,
      glitter: small ? 22 : 34,
      suits: small ? 8 : 12,
      suitAlpha: 0.14,          // opacidad de naipes
      vignette: 0.35,
      // zonas a proteger
      safeSelectors: ['.hero', '#gb-promo', '#MG-board-box', '#MEM-board', '.tri-card'],
      safePad: 18,
      safeStrength: 0.55
    };
  }
  let CFG = cfg();

  // ================== ESTADO ==================
  let W = 0, H = 0, last = 0, anim = 0;
  let bokeh = [], glitz = [], suits = [];

  // ================== UTIL ==================
  function resize() {
    const w = innerWidth, h = innerHeight;
    cvs.width = Math.floor(w * DPR);
    cvs.height = Math.floor(h * DPR);
    cvs.style.width = w + 'px';
    cvs.style.height = h + 'px';
    W = cvs.width; H = cvs.height;
  }
  const R = (a,b) => a + Math.random() * (b - a);
  function circle(x,y,r){ ctx.moveTo(x+r,y); ctx.arc(x,y,r,0,Math.PI*2); }

  // ================== FONDO (PAÑO) ==================
  function drawFelt(){
    const g = ctx.createRadialGradient(W*0.5, H*0.6, 0, W*0.5, H*0.6, Math.max(W,H)*0.9);
    g.addColorStop(0, `hsla(${CFG.feltHue} 35% 12% / 1)`);
    g.addColorStop(1, `hsla(${CFG.feltHue} 45% 7% / 1)`);
    ctx.fillStyle = g; ctx.fillRect(0,0,W,H);

    // textura sutil
    ctx.globalAlpha = 0.06;
    for (let i=0;i<2;i++){
      const g2 = ctx.createRadialGradient(R(0,W), R(0,H), 0, R(0,W), R(0,H), R(200,520)*DPR);
      g2.addColorStop(0, `hsla(${CFG.feltHue} 30% 30% / 1)`);
      g2.addColorStop(1, `hsla(${CFG.feltHue} 40% 10% / 0)`);
      ctx.fillStyle = g2;
      ctx.beginPath(); circle(R(0,W), R(0,H), R(200,520)*DPR); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // viñeta
    const v = ctx.createRadialGradient(W/2, H/2, Math.min(W,H)*0.5, W/2, H/2, Math.max(W,H)*0.85);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, `rgba(0,0,0,${CFG.vignette})`);
    ctx.fillStyle = v; ctx.fillRect(0,0,W,H);
  }

  // ================== BOKEH (DESTELLOS GRANDES) ==================
  function makeBokeh(n){
    const arr = [];
    for (let i=0;i<n;i++){
      arr.push({
        x: R(0, W),
        y: R(0, H*0.9),
        r: R(40, 120) * DPR,              // radios grandes
        a: R(0, Math.PI*2),
        s: R(0.002, 0.005),               // velocidad de “pulso”
        drift: R(0.04, 0.10) * DPR * (Math.random()<0.5 ? -1 : 1),
        hue: R(35, 55),                   // cálidos
        alpha: R(0.06, 0.15)
      });
    }
    return arr;
  }
  function drawBokeh(o, t){
    const tw = (Math.sin(o.a + t*o.s) + 1) / 2; // 0..1
    const Rr = o.r * (0.8 + tw*0.25);
    const g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, Rr);
    g.addColorStop(0, `hsla(${o.hue} 80% 65% / ${o.alpha})`);
    g.addColorStop(1, `hsla(${o.hue} 80% 45% / 0)`);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = g; ctx.beginPath(); circle(o.x, o.y, Rr); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    o.x += o.drift;
    if (o.x < -Rr) o.x = W + Rr;
    if (o.x > W + Rr) o.x = -Rr;
  }

  // ================== GLITTER (PUNTOS DORADOS + GRANDES) ==================
  function makeGlitter(n){
    const arr = [];
    for (let i=0;i<n;i++){
      arr.push({
        x: R(0,W), y: R(0,H),
        r: R(1.2, 2.5) * DPR,             // más visibles
        a: R(0, Math.PI*2),
        v: R(0.02, 0.06),
        life: R(2,6), t: R(0,6)
      });
    }
    return arr;
  }
  function drawGlitter(g, dt){
    g.t += dt;
    if (g.t > g.life) { g.x = R(0,W); g.y = R(0,H); g.t = 0; }
    const tw = (Math.sin(g.a + performance.now()*0.006)+1)/2;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `hsla(48 90% 65% / ${0.2 + tw*0.6})`;
    ctx.beginPath(); circle(g.x, g.y, g.r*(0.8 + tw*0.8)); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    g.a += g.v;
  }

  // ================== NAIPES (GRANDES + HALO SUAVE) ==================
  function makeSuits(n){
    const arr = [], pool = ['spade','heart','club','diamond'];
    for (let i=0;i<n;i++){
      arr.push({
        type: pool[i % pool.length],
        x: R(0, W), y: R(0, H),
        s: R(28, 50) * DPR,               // más grandes
        rot: R(0, Math.PI*2), vr: R(-0.002, 0.002),
        vx: R(-0.06, 0.06) * DPR, vy: R(0.03, 0.08) * DPR,
        alpha: CFG.suitAlpha
      });
    }
    return arr;
  }
  function drawSuit(su){
    ctx.save();
    ctx.translate(su.x, su.y);
    ctx.rotate(su.rot);

    const s = su.s;
    // halo dorado muy sutil
    ctx.globalAlpha = su.alpha * 0.45;
    const halo = ctx.createRadialGradient(0, 0, s*0.6, 0, 0, s*1.4);
    halo.addColorStop(0, 'hsla(48 90% 60% / 0.25)');
    halo.addColorStop(1, 'hsla(48 90% 60% / 0)');
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = halo;
    ctx.beginPath(); circle(0, 0, s*1.35); ctx.fill();

    // figura
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = su.alpha;
    ctx.fillStyle = (su.type==='heart'||su.type==='diamond') ? 'hsla(0 80% 55% / 1)' : 'hsla(48 90% 60% / 1)';
    ctx.beginPath();
    switch(su.type){
      case 'heart':
        ctx.moveTo(0, s*0.3);
        ctx.bezierCurveTo(s*0.8, -s*0.5,  s*0.6, -s*1.2, 0, -s*0.5);
        ctx.bezierCurveTo(-s*0.6, -s*1.2, -s*0.8, -s*0.5, 0, s*0.3);
        break;
      case 'diamond':
        ctx.moveTo(0, -s);
        ctx.lineTo(s*0.75, 0);
        ctx.lineTo(0, s);
        ctx.lineTo(-s*0.75, 0);
        ctx.closePath();
        break;
      case 'spade':
        ctx.moveTo(0, -s);
        ctx.bezierCurveTo(s*0.9, -s*0.2, s*0.7, s*0.6, 0, s*0.2);
        ctx.bezierCurveTo(-s*0.7, s*0.6, -s*0.9, -s*0.2, 0, -s);
        break;
      case 'club':
        circle(0, -s*0.55, s*0.45);
        circle(s*0.45, -s*0.05, s*0.45);
        circle(-s*0.45, -s*0.05, s*0.45);
        break;
    }
    ctx.fill();
    ctx.restore();

    // movimiento leve
    su.rot += su.vr;
    su.x += su.vx; su.y += su.vy;

    // respawn al salir
    if (su.x < -100 || su.x > W+100 || su.y > H+100) {
      const rep = makeSuits(1)[0];
      Object.assign(su, rep);
    }
  }

  // ================== ZONAS SEGURAS ==================
  function maskSafe(){
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    const pad = CFG.safePad * DPR;
    for (const sel of CFG.safeSelectors){
      const el = document.querySelector(sel); if (!el) continue;
      const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
      const x = (r.left - pad) * DPR;
      const y = (r.top  - pad) * DPR;
      const w = (r.width  + 2*pad) * DPR;
      const h = (r.height + 2*pad) * DPR;
      const g = ctx.createRadialGradient(x+w/2, y+h/2, Math.min(w,h)*0.35, x+w/2, y+h/2, Math.max(w,h)*0.65);
      g.addColorStop(0, `rgba(0,0,0,${CFG.safeStrength})`);
      g.addColorStop(1, `rgba(0,0,0,0)`);
      ctx.fillStyle = g; ctx.fillRect(x,y,w,h);
    }
    ctx.restore();
  }

  // ================== LOOP ==================
  function start(){
    cancelAnimationFrame(anim);
    CFG = cfg();
    resize();
    drawFelt();

    if (CFG.reduce) return; // fondo estático

    bokeh = makeBokeh(CFG.bokeh);
    glitz = makeGlitter(CFG.glitter);
    suits = makeSuits(CFG.suits);
    last = 0;
    anim = requestAnimationFrame(loop);
  }

  function loop(ts){
    const minDelta = 1000 / CFG.maxFps;
    if (!last) last = ts;
    const d = ts - last;
    if (d < minDelta) { anim = requestAnimationFrame(loop); return; }
    last = ts;

    // “trail” suave
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(0,0,W,H);

    const t = ts * 0.001;
    for (const o of bokeh) drawBokeh(o, t);
    for (const g of glitz) drawGlitter(g, d * 0.001);
    for (const s of suits) drawSuit(s);

    maskSafe();
    anim = requestAnimationFrame(loop);
  }

  // Ahorro de batería y responsivo
  addEventListener('resize', ()=>{ clearTimeout(start._t); start._t = setTimeout(start, 150); });
  document.addEventListener('visibilitychange', ()=>{ if (document.hidden) cancelAnimationFrame(anim); else start(); });

  start();

  // API mínima para ajustar en vivo si quieres
  window.GB_FX = {
    setSuitAlpha(a){ for (const s of suits) s.alpha = a; },
    setSafeStrength(v){ CFG.safeStrength = Math.max(0, Math.min(1, v)); }
  };
})();
