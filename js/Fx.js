
(() => {
  // ======= CONFIG =======
  const CONFIG = {
    bpm: 128,
    fogColors: ['black','black','black'], // si quieres glow, usa colores neón aquí
    laserColors: ['#00f7ff','#ff5bf7','#9dfcfe','#5bffb0'],
    lasers: 10,
    strobeIntensity: 0.65,
    fogSpeed: 0.09,
    laserSweepSpeed: 1.1,
    noise: 1.0
  };

  // ======= Canvas =======
  const canvas = document.getElementById('fx');
  const ctx = canvas.getContext('2d');
  let W, H, DPR;
  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = canvas.width  = Math.floor(innerWidth  * DPR);
    H = canvas.height = Math.floor(innerHeight * DPR);
    canvas.style.width  = innerWidth  + 'px';
    canvas.style.height = innerHeight + 'px';
  }
  addEventListener('resize', resize);
  resize();

  // ======= Utils =======
  const R = (a,b)=> Math.random()*(b-a)+a;
  const TAU = Math.PI*2;

  // Noise 1D simple
  const nsize = 512, p = new Array(nsize).fill(0).map(()=>Math.random());
  const n1 = x => {
    const i = Math.floor(x)%nsize, f = x - Math.floor(x);
    const a = p[(i+nsize)%nsize], b = p[(i+1+nsize)%nsize];
    const t = f*f*(3-2*f); return a*(1-t)+b*t;
  };

  // ======= Entidades =======
  const blobs = CONFIG.fogColors.map((c,i)=>({
    x:R(0.2,0.8), y:R(0.25,0.75), r:R(0.28,0.45), col:c, ph:R(0,1000)+i*33
  }));

  const lasers = Array.from({length:CONFIG.lasers}, (_,i)=>({
    base:i/CONFIG.lasers, amp:R(0.18,0.5), sp:R(0.8,1.4)*CONFIG.laserSweepSpeed,
    w:R(2.5,5)*DPR, col:CONFIG.laserColors[i%CONFIG.laserColors.length],
    tilt:R(-0.4,0.4)
  }));

  // ======= Beat =======
  let last = performance.now(), acc = 0;
  const beatDur = 60000/CONFIG.bpm; // ms por beat
  let beat = 0, running = true;

  // ======= Helpers =======
  function rgba(hex,a=1){
    const c=hex.replace('#',''); const n=parseInt(c,16);
    const r=(c.length===3?((n>>8)&0xF)*17:(n>>16)&255);
    const g=(c.length===3?((n>>4)&0xF)*17:(n>>8)&255);
    const b=(c.length===3? (n&0xF)*17: (n)&255);
    return `rgba(${r},${g},${b},${a})`;
  }

  function fog(now){
    // si fogColors son negros, esto prácticamente no se ve; déjalo por si luego cambias colores
    ctx.globalCompositeOperation = 'screen';
    for(const b of blobs){
      const nx = n1(b.ph*0.003 + now*CONFIG.fogSpeed*0.0008) - 0.5;
      const ny = n1(b.ph*0.004 + now*CONFIG.fogSpeed*0.0007) - 0.5;
      const pul = 1 + 0.06*Math.sin(now*0.001 + b.ph);
      const x=(b.x+nx*0.18)*W, y=(b.y+ny*0.18)*H, r=b.r*Math.max(W,H)*pul;

      const g = ctx.createRadialGradient(x,y,r*0.08, x,y,r);
      g.addColorStop(0, rgba(b.col, 0.95));
      g.addColorStop(1, rgba(b.col, 0));
      ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,r,0,TAU); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function beams(now){
    lasers.forEach((L,i)=>{
      const ph = Math.sin(now*0.001*L.sp + i)*0.5+0.5;
      const cx = (L.base + L.amp*(ph-0.5))*W;
      const angle = L.tilt + (ph-0.5)*0.5;
      const w = L.w*(0.7 + 0.6*beat);
      const wob = (n1(i*9.1 + now*0.002)-0.5) * CONFIG.noise * 80 * DPR;

      ctx.save(); ctx.translate(cx, H*0.5); ctx.rotate(angle);

      const grad = ctx.createLinearGradient(0,-H,0,H);
      grad.addColorStop(0, rgba(L.col,0));
      grad.addColorStop(0.5, rgba(L.col,0.98));
      grad.addColorStop(1, rgba(L.col,0));
      ctx.fillStyle = grad; ctx.globalCompositeOperation='screen';

      ctx.beginPath();
      ctx.moveTo(-w, -H + wob);
      ctx.lineTo( w, -H - wob);
      ctx.lineTo( w,  H + wob);
      ctx.lineTo(-w,  H - wob);
      ctx.closePath(); ctx.fill();

      ctx.shadowBlur = 26*DPR; ctx.shadowColor = rgba(L.col,.9);
      ctx.strokeStyle = rgba(L.col,.35); ctx.lineWidth = 1*DPR; ctx.stroke();

      ctx.restore(); ctx.globalCompositeOperation='source-over';
    });
  }

  function strobe(){
    if(beat > 0.96){
      ctx.fillStyle = `rgba(255,255,255,${CONFIG.strobeIntensity})`;
      ctx.fillRect(0,0,W,H);
    }
  }

  // ======= Loop =======
  function tick(now){
    if(!running) { requestAnimationFrame(tick); return; }
    const dt = now - last; last = now;
    acc += dt; beat = (acc % beatDur) / beatDur;

    // limpiar con desvanecido para conservar estelas
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0,0,W,H);

    fog(now);     // casi invisible con negro, pero listo por si cambias
    beams(now);
    strobe();

    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // Botón pausar/seguir
  document.getElementById('toggle').addEventListener('click', ()=>{
    running = !running;
    if(running) last = performance.now();
  });
})();
