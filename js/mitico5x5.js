// ========= LÓGICA MITICO 5x5 (hasta 7 códigos) =========
// Todo separado por prefijo MT_ para no chocar con "mega"

import {
  doc, getDoc, setDoc, collection,
  runTransaction, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
import { db } from "./firebaseClient.js";

// ====== Config ======
const IG_URL = window.IG_URL || "https://instagram.com/tu_pagina";
const MT_IG_URL = IG_URL;

const MT_TOTAL  = 25; // 5x5
const MT_COUNTS = { p1000: 1, p500: 1, p200: 3, p50: 3, gomita: 8 };
const MT_THRESH = { p1000: 100000, p500: 100000, p200: 10000, p50: 8, gomita: 5 };

// Imagen de “oculto”
const MT_HIDDEN_IMG = window.MT_HIDDEN_IMG || "img/casilla-oculta.png";

// Colecciones exclusivas de MÍTICO
const MT_controlRef = doc(db, "mitico_meta", "control");
const MT_playsCol   = collection(db, "mitico_plays");

// Límite de códigos por juego
const MT_MAX_CODES = 7;

// ====== Utils / assets ======
const MT_toId = s => (s||"").trim().toUpperCase().replace(/[^A-Z0-9]/g,"");
const MT_svg  = s => 'data:image/svg+xml;utf8,' + encodeURIComponent(s.trim());
const MT_IMG_GOMITA = "img/gomita.png";

const MT_IMG = {
  HIDDEN: MT_HIDDEN_IMG,
  NADA  : MT_svg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="18" fill="#111827"/><path d="M30 30 L90 90 M90 30 L30 90" stroke="#cbd5e1" stroke-width="14" stroke-linecap="round"/></svg>`),
  P200  : MT_svg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="18" fill="#0b3a54"/><circle cx="60" cy="60" r="38" fill="#0ea5e9"/><text x="50%" y="56%" text-anchor="middle" dominant-baseline="middle" font-family="system-ui,Segoe UI,Roboto" font-size="42" fill="#e6fffa">$200</text></svg>`),
  P500  : MT_svg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="18" fill="#14532d"/><circle cx="60" cy="60" r="40" fill="#22c55e"/><text x="50%" y="56%" text-anchor="middle" dominant-baseline="middle" font-family="system-ui,Segoe UI,Roboto" font-size="44" fill="#e6fffa">$500</text></svg>`),
  P1000 : MT_svg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="18" fill="#064e3b"/><circle cx="60" cy="60" r="40" fill="#0e9f6e"/><text x="50%" y="56%" text-anchor="middle" dominant-baseline="middle" font-family="system-ui,Segoe UI,Roboto" font-size="40" fill="#e6fffa">$1000</text></svg>`),
  P50   : MT_svg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="18" fill="#1e293b"/><circle cx="60" cy="60" r="36" fill="#94a3b8"/><text x="50%" y="56%" text-anchor="middle" dominant-baseline="middle" font-family="system-ui,Segoe UI,Roboto" font-size="46" fill="#0b1220">$50</text></svg>`)
};
const MT_icon = k => k==='HIDDEN'?MT_IMG.HIDDEN:
                     k==='p1000'?MT_IMG.P1000:
                     k==='p500'?MT_IMG.P500:
                     k==='p200'?MT_IMG.P200:
                     k==='p50'?MT_IMG.P50:
                     k==='gomita'?MT_IMG_GOMITA:MT_IMG.NADA;

/* ========== DOM cache ========= */
let MT_board, MT_status, MT_goBtn;
let MT_modal, MT_cardM, MT_tModal, MT_msg, MT_cta, MT_ok, MT_figure;
let MT_pModal, MT_pIn, MT_pOk, MT_pCancel, MT_pErr, MT_canvas;

/* Intentos restantes según códigos */
let MT_ready=false, MT_codesLocked=false, MT_attempts=0, MT_tel=null, MT_revealed=0;

/* ========== Helpers generales ========= */
function MT_cacheDom(){
  MT_board  = document.getElementById("MT-board");
  MT_status = document.getElementById("MT-status");
  MT_goBtn  = document.getElementById("MT-validar");

  MT_modal  = document.getElementById("MT-modal");
  MT_cardM  = document.getElementById("MT-card-modal");
  MT_tModal = document.getElementById("MT-title-modal");
  MT_msg    = document.getElementById("MT-msg");
  MT_cta    = document.getElementById("MT-cta");
  MT_ok     = document.getElementById("MT-ok");
  MT_figure = document.getElementById("MT-figure");

  MT_pModal  = document.getElementById("MT-phone");
  MT_pIn     = document.getElementById("MT-phone-input");
  MT_pOk     = document.getElementById("MT-phone-ok");
  MT_pCancel = document.getElementById("MT-phone-cancel");
  MT_pErr    = document.getElementById("MT-phone-error");
  MT_canvas  = document.getElementById("MT-canvas");
}
function MT_paint(msg,color){ if(MT_status){ MT_status.textContent=msg; MT_status.style.color=color||"#9fb0c9"; } }
function MT_lock(){   if(!MT_board) return; [...MT_board.children].forEach(b=>{ if(!b.classList.contains('screw')) b.disabled=true; });  MT_ready=false; }
function MT_unlock(){ if(!MT_board) return; [...MT_board.children].forEach(b=>{ if(!b.classList.contains('screw')) b.disabled=false; }); MT_ready=true;  }
function MT_injectStyle(id, css){
  if (document.getElementById(id)) return;
  const s=document.createElement("style");
  s.id=id; s.textContent=css; document.head.appendChild(s);
}
function MT_decorateBoard(){
  if (!MT_board || MT_board._decorated) return;
  ["tl","tr","bl","br"].forEach(p=>{
    const s = document.createElement("i");
    s.className = "screw " + p;
    MT_board.appendChild(s);
  });
  MT_board._decorated = true;
}

/* ===== Modal close ===== */
function MT_wireModalClose(){
  MT_cacheDom();

  if (MT_ok && !MT_ok._wiredClose) {
    MT_ok.type = "button";
    MT_ok.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      MT_closeModal();
    });
    MT_ok._wiredClose = true;
  }
  if (MT_modal && !MT_modal._wiredBackdrop) {
    MT_modal.addEventListener('click', (e) => {
      if (e.target === MT_modal) MT_closeModal();
    });
    MT_modal._wiredBackdrop = true;
  }
  if (!window._mtKeyClose) {
    window.addEventListener('keydown', (e) => {
      if (!MT_modal) return;
      const open = MT_modal.style.display && MT_modal.style.display !== 'none';
      if (!open) return;
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault();
        MT_closeModal();
      }
    });
    window._mtKeyClose = true;
  }
}

/* ========== UI helpers ========= */
function MT_makeMetal(btn){
  if (!btn.classList.contains('metal-btn')){
    btn.classList.add('metal-btn');
    btn.innerHTML = `<span class="grain" aria-hidden="true"></span><span class="content"></span>`;
  }
}
function MT_setIcon(btn, kind){
  MT_makeMetal(btn);
  const content = btn.querySelector('.content');
  if (kind === 'HIDDEN'){
    content.innerHTML = `<img class="hidden-cover" src="${MT_HIDDEN_IMG}" alt="Oculto">`;
  } else if (kind === 'gomita'){
    content.innerHTML = `<img class="gomy" alt="Gomita" src="${MT_IMG_GOMITA}">`;
  } else if (kind === 'p1000'){
    content.innerHTML = `<span class="chip money">$1000</span>`;
  } else if (kind === 'p500'){
    content.innerHTML = `<span class="chip money">$500</span>`;
  } else if (kind === 'p200'){
    content.innerHTML = `<span class="chip money">$200</span>`;
  } else if (kind === 'p50'){
    content.innerHTML = `<span class="chip money">$50</span>`;
  } else {
    content.innerHTML = `<span class="x">×</span>`;
  }
  btn.setAttribute('aria-label', kind);
}
function MT_setLooks(btn, kind){
  btn.classList.remove(
    'MT-looks-1500','MT-looks-500','MT-looks-200','MT-looks-50','MT-looks-gomita','MT-looks-nada',
    'MT-1500','MT-500','MT-200','MT-50'
  );
  if      (kind==='p1000') { btn.classList.add('MT-looks-1500','MT-1500'); }
  else if (kind==='p500')  { btn.classList.add('MT-looks-500','MT-500'); }
  else if (kind==='p200')  { btn.classList.add('MT-looks-200','MT-200'); }
  else if (kind==='p50')   { btn.classList.add('MT-looks-50','MT-50'); }
  else if (kind==='gomita'){ btn.classList.add('MT-looks-gomita'); }
  else                     { btn.classList.add('MT-looks-nada'); }
}

/* ========== Vitrina inicial ========= */
function MT_makeVitrine(){
  if (!MT_board) return;
  const pool=['p1000','p500'];
  for(let i=0;i<MT_COUNTS.p200;i++)   pool.push('p200');
  for(let i=0;i<MT_COUNTS.p50;i++)    pool.push('p50');
  for(let i=0;i<MT_COUNTS.gomita;i++) pool.push('gomita');
  for(let i=pool.length;i<MT_TOTAL;i++) pool.push('nada');
  for(let i=pool.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [pool[i],pool[j]]=[pool[j],pool[i]]; }

  MT_board.innerHTML='';
  pool.forEach(k=>{
    const b=document.createElement('button');
    b.type='button';
    MT_setIcon(b,k);
    MT_setLooks(b,k);
    b.disabled=true;
    MT_board.appendChild(b);
  });
  MT_paint(`Ingresa hasta ${MT_MAX_CODES} códigos válidos para jugar.`, "#9fb0c9");
}

/* ========= Leer hasta 7 códigos de inputs =========
   Soporta ids MT-code1..MT-code7 o inputs con clase .MT-code
*/
function MT_collectCodes(){
  const list = [];
  for(let i=1;i<=MT_MAX_CODES;i++){
    const el = document.getElementById(`MT-code${i}`);
    if (el) list.push(el.value);
  }
  if (list.length===0){
    document.querySelectorAll('.MT-code').forEach(inp=>list.push(inp.value));
  }
  const clean = list.map(MT_toId).filter(Boolean);
  // únicos
  return [...new Set(clean)].slice(0, MT_MAX_CODES);
}

/* ========== Validar y bloquear códigos (una sola vez) ========= */
async function MT_onValidate(){
  const codes = MT_collectCodes();
  if(codes.length === 0){ MT_paint("Ingresa al menos 1 código.", "#ff6b6b"); MT_lock(); return; }
  if(codes.length > MT_MAX_CODES){ MT_paint(`Máximo ${MT_MAX_CODES} códigos.`, "#ff6b6b"); MT_lock(); return; }

  try{
    // Verifica existencia y “no usado”, y márcalos como usados en una transacción
    await MT_lockCodesTx(codes);

    // Teléfono
    try{ MT_tel = await MT_phoneAsk(); }
    catch(_){ MT_paint("Participación cancelada.","#fca5a5"); return; }

    MT_attempts = codes.length;
    MT_codesLocked = true;
    MT_revealed = 0;

    MT_paint(`Códigos verificados. Tienes ${MT_attempts} intento(s). Mezclando...`, "#3fb950");
    await MT_flipShuffle();
  }catch(e){
    console.error(e);
    MT_paint(e?.message || "Error al validar.", "#ff6b6b");
  }
}

/* ========== Transacción: bloquear códigos (usadoEn: Mitico5x5) ========= */
async function MT_lockCodesTx(codes){
  // Primero un chequeo rápido para dar mensajes decentes
  for(const c of codes){
    const s = await getDoc(doc(db,"codigos",c));
    if(!s.exists()) throw new Error(`Código ${c} no existe.`);
    const d=s.data()||{};
    if((d.estado||"").toLowerCase()==="usado") throw new Error(`Código ${c} ya usado.`);
  }

  await runTransaction(db, async (tx)=>{
    for(const c of codes){
      const ref = doc(db,"codigos", c);
      const snap = await tx.get(ref);
      if(!snap.exists()) throw new Error(`Código ${c} no existe.`);
      const d = snap.data()||{};
      if((d.estado||"").toLowerCase()==="usado") throw new Error(`Código ${c} ya usado.`);
    }
    for(const c of codes){
      const ref = doc(db,"codigos", c);
      tx.set(ref, {
        estado: "usado",
        usadoEn: "Mitico5x5",
        usadoAt: serverTimestamp(),
        telefono: MT_tel || null
      }, { merge:true });
    }
  });
}

/* ========== Flip + shuffle + pool real ========= */
async function MT_flipShuffle(){
  const bs=[...MT_board.children].filter(x=>!x.classList.contains('screw'));
  await Promise.all(bs.map((b,i)=>new Promise(res=>{
    setTimeout(()=>{ MT_setIcon(b,'HIDDEN');
      b.classList.remove('MT-looks-1500','MT-looks-500','MT-looks-200','MT-looks-gomita','MT-looks-nada','MT-1500','MT-500','MT-200'); res();
    }, i*18);
  })));
  await MT_realPool();
  bs.forEach((b,i)=>{ setTimeout(()=>{ b.classList.add("MT-is-shuffling"); setTimeout(()=>b.classList.remove("MT-is-shuffling"),650); }, i*10); });
  MT_unlock(); MT_ready=true;
  MT_paint(`Elige ${MT_attempts} casilla(s).`, "#3fb950");
}

/* ========== Control global (umbral) ========= */
async function MT_getControl(){
  const snap = await getDoc(MT_controlRef);
  if (!snap.exists()) {
    await setDoc(MT_controlRef, {
      since1000: 0, since500: 0, since200: 0, since50: 0, sinceGomita: 0,
      wins1000: 0,  wins500: 0,  wins200: 0,  wins50: 0,  winsGomita: 0,
      totalPlays: 0, updatedAt: serverTimestamp()
    });
    return { since1000:0, since500:0, since200:0, since50:0, sinceGomita:0, wins1000:0, wins500:0, wins200:0, wins50:0, winsGomita:0, totalPlays:0 };
  }
  const d = snap.data() || {};
  const patch = {};
  ["since1000","since500","since200","since50","sinceGomita","wins1000","wins500","wins200","wins50","winsGomita","totalPlays"].forEach(k=>{
    if (d[k] == null) patch[k]=0;
  });
  if (Object.keys(patch).length) await setDoc(MT_controlRef, { ...patch, updatedAt: serverTimestamp() }, { merge:true });
  return {
    since1000:+(d.since1000 ?? 0), since500:+(d.since500 ?? 0), since200:+(d.since200 ?? 0),
    since50:+(d.since50 ?? 0), sinceGomita:+(d.sinceGomita ?? 0),
    wins1000:+(d.wins1000 ?? 0), wins500:+(d.wins500 ?? 0), wins200:+(d.wins200 ?? 0),
    wins50:+(d.wins50 ?? 0), winsGomita:+(d.winsGomita ?? 0), totalPlays:+(d.totalPlays ?? 0)
  };
}

/* ========== Pool real + handlers ========= */
async function MT_realPool(){
  const c = await MT_getControl();
  const en = {
    p1000 : c.since1000   >= MT_THRESH.p1000,
    p500  : c.since500    >= MT_THRESH.p500,
    p200  : c.since200    >= MT_THRESH.p200,
    p50   : c.since50     >= MT_THRESH.p50,
    gomita: c.sinceGomita >= MT_THRESH.gomita
  };
  const pool=[];
  if (en.p1000) pool.push('p1000');
  if (en.p500)  pool.push('p500');
  for (let i=0;i<(en.p200?MT_COUNTS.p200:0);i++)   pool.push('p200');
  for (let i=0;i<(en.p50?MT_COUNTS.p50:0);i++)     pool.push('p50');
  for (let i=0;i<(en.gomita?MT_COUNTS.gomita:0);i++) pool.push('gomita');
  for (let i=pool.length;i<MT_TOTAL;i++) pool.push('nada');
  for (let i=pool.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [pool[i],pool[j]]=[pool[j],pool[i]]; }

  [...MT_board.children].filter(x=>!x.classList.contains('screw')).forEach((b,idx)=>{
    b.dataset.MTprize = pool[idx];
    MT_setIcon(b,'HIDDEN');
    b.disabled=false;
    b.onclick=()=>MT_onPick(b);
  });

  MT_board.dataset.fake1000   = String(!en.p1000);
  MT_board.dataset.fake500    = String(!en.p500);
  MT_board.dataset.fake200    = String(!en.p200);
  MT_board.dataset.fake50     = String(!en.p50);
  MT_board.dataset.fakeGomita = String(!en.gomita);
}

/* ========== Click en casilla (múltiples intentos) ========= */
async function MT_onPick(btn){
  if(!MT_ready || !MT_codesLocked || MT_attempts<=0) return;

  // un pick
  MT_attempts -= 1;
  MT_revealed += 1;
  MT_lock();

  const cand = btn.dataset.MTprize;
  await MT_reveal(btn, cand);

  try{
    // Persistir este premio individual con cascada
    await MT_persistPrize(MT_tel, cand);
  }catch(e){
    console.error(e);
    MT_paint("No se pudo registrar la jugada.","#fca5a5");
  }

  // Confeti + modal por pick
  if      (cand==='p1000'){ MT_confetti('gold');  MT_open('success','p1000'); }
  else if (cand==='p500') { MT_confetti('gold');  MT_open('success','p500');  }
  else if (cand==='p200') { MT_confetti('gold');  MT_open('success','p200');  }
  else if (cand==='p50')  { MT_confetti('gold');  MT_open('success','p50');   }
  else if (cand==='gomita'){ MT_confetti('purple'); MT_open('warn','gomita'); }
  else                     { MT_open('neutral','nada'); }

  if (MT_attempts > 0){
    MT_unlock();
    MT_paint(`Te quedan ${MT_attempts} intento(s).`, "#9fb0c9");
  } else {
    await MT_revealRest(btn);
    MT_ready=false;
    MT_paint("Intentos agotados. Gracias por jugar.", "#9fb0c9");
  }
}

function MT_reveal(btn,kind){
  return new Promise(res=>{
    btn.classList.add('MT-is-flipping');
    setTimeout(()=>{
      MT_setIcon(btn,kind); MT_setLooks(btn,kind);
      btn.classList.remove('MT-is-flipping'); btn.classList.add('MT-pop');
      setTimeout(()=>{ btn.classList.remove('MT-pop'); res(); },160);
    },160);
  });
}

function MT_revealRest(chosen){
  const bs=[...MT_board.children].filter(x=>!x.classList.contains('screw'));
  const avail = bs.filter(b => b !== chosen);
  const countReal = k => bs.filter(b => b.dataset.MTprize === k).length;
  const take = (n) => { const out=[]; for(let i=0;i<n && avail.length;i++){ const j=(Math.random()*avail.length)|0; out.push(avail.splice(j,1)[0]); } return out; };

  const fakes = [];
  if (MT_board.dataset.fake1000 === "true" && countReal('p1000') === 0) fakes.push({k:'p1000', bs: take(1)});
  if (MT_board.dataset.fake500  === "true" && countReal('p500')  === 0) fakes.push({k:'p500',  bs: take(1)});
  if (MT_board.dataset.fake200  === "true"){
    const need200 = Math.max(0, MT_COUNTS.p200 - countReal('p200'));
    if (need200 > 0) fakes.push({k:'p200',  bs: take(need200)});
  }
  if (MT_board.dataset.fake50 === "true"){
    const need50 = Math.max(0, MT_COUNTS.p50 - countReal('p50'));
    if (need50 > 0) fakes.push({k:'p50',  bs: take(need50)});
  }
  if (MT_board.dataset.fakeGomita === "true"){
    const needG = Math.max(0, MT_COUNTS.gomita - countReal('gomita'));
    if (needG > 0) fakes.push({k:'gomita', bs: take(needG)});
  }

  let t=110;
  const ps=[];
  for(const b of bs){
    if(b===chosen) continue;
    ps.push(new Promise(r=>{
      setTimeout(()=>{
        const fk = fakes.find(x => x.bs.includes(b));
        if (fk){ MT_setIcon(b,fk.k); MT_setLooks(b,fk.k); }
        else { const k=b.dataset.MTprize; MT_setIcon(b,k); MT_setLooks(b,k); }
        r();
      }, t);
      t += 45;
    }));
  }
  return Promise.all(ps);
}

/* ========== Persistencia por pick (cascada) ========= */
async function MT_persistPrize(phone, rawPrize){
  const cascade=(cand,elig)=>{
    switch(cand){
      case 'p1000': return elig.p1000 ? 'p1000' : elig.p500 ? 'p500' : elig.p200 ? 'p200' : elig.p50 ? 'p50' : elig.gomita ? 'gomita' : 'nada';
      case 'p500' : return elig.p500  ? 'p500'  : elig.p200 ? 'p200' : elig.p50 ? 'p50' : elig.gomita ? 'gomita' : 'nada';
      case 'p200' : return elig.p200  ? 'p200'  : elig.p50 ? 'p50' : elig.gomita ? 'gomita' : 'nada';
      case 'p50'  : return elig.p50   ? 'p50'   : elig.gomita ? 'gomita' : 'nada';
      case 'gomita':return elig.gomita? 'gomita': 'nada';
      default:      return 'nada';
    }
  };

  await runTransaction(db, async (tx)=>{
    const cSnap = await tx.get(MT_controlRef);
    const cData = cSnap.exists() ? (cSnap.data()||{}) : {
      since1000:0, since500:0, since200:0, since50:0, sinceGomita:0,
      wins1000:0, wins500:0, wins200:0, wins50:0, winsGomita:0, totalPlays:0
    };

    const elig = {
      p1000:+(cData.since1000||0)>=MT_THRESH.p1000,
      p500 :+(cData.since500 ||0)>=MT_THRESH.p500,
      p200 :+(cData.since200 ||0)>=MT_THRESH.p200,
      p50  :+(cData.since50  ||0)>=MT_THRESH.p50,
      gomita:+(cData.sinceGomita||0)>=MT_THRESH.gomita
    };
    const final = cascade(rawPrize, elig);

    // Registrar jugada individual
    const play = doc(MT_playsCol);
    tx.set(play,{
      telefono: phone || null,
      rawPrize,
      finalPrize: final,
      createdAt: serverTimestamp()
    });

    // Actualizar contadores
    const next = {
      since1000:   final==='p1000' ? 0 : +(cData.since1000||0)+1,
      since500 :   final==='p500'  ? 0 : +(cData.since500 ||0)+1,
      since200 :   final==='p200'  ? 0 : +(cData.since200 ||0)+1,
      since50  :   final==='p50'   ? 0 : +(cData.since50  ||0)+1,
      sinceGomita: final==='gomita'? 0 : +(cData.sinceGomita||0)+1,
      wins1000:   (cData.wins1000  ||0) + (final==='p1000'?1:0),
      wins500 :   (cData.wins500   ||0) + (final==='p500' ?1:0),
      wins200 :   (cData.wins200   ||0) + (final==='p200' ?1:0),
      wins50  :   (cData.wins50    ||0) + (final==='p50'  ?1:0),
      winsGomita: (cData.winsGomita||0) + (final==='gomita'?1:0),
      totalPlays: (cData.totalPlays||0) + 1,
      updatedAt: serverTimestamp()
    };
    tx.set(MT_controlRef, next, { merge:true });
  });
}

/* ========== Modales + confeti ========= */
function MT_open(variant,kind){
  MT_figure.innerHTML=""; MT_cardM.classList.remove('success','warn','neutral'); if(variant) MT_cardM.classList.add(variant);
  const im=document.createElement('img'); im.src=MT_icon(kind); im.alt=kind; MT_figure.appendChild(im);

  if(kind==='p1000'){
    MT_tModal.innerHTML=`<div class="MT-headline"><span class="md">¡PREMIO MAYOR!</span><br><span class="xl MT-accent">$1000</span></div>`;
    MT_msg.innerHTML = `<div style="text-align:center"><span style="color:#fde68a;font-weight:800">TOMA CAPTURA DE PANTALLA</span><br><span>Envíala por DM.</span></div>`;
    MT_cta.style.display='inline-flex'; MT_cta.href=MT_IG_URL; MT_cta.textContent='Abrir Instagram';
  } else if(kind==='p500'){
    MT_tModal.innerHTML=`<div class="MT-headline"><span class="md">¡GANASTE</span> <span class="md MT-accent">$500!</span></div>`;
    MT_msg.innerHTML = `<div style="text-align:center"><span>DM para reclamar.</span></div>`;
    MT_cta.style.display='inline-flex'; MT_cta.href=MT_IG_URL;
  } else if(kind==='p200'){
    MT_tModal.innerHTML=`<div class="MT-headline"><span class="md">¡GANASTE</span> <span class="md MT-accent">$200!</span></div>`;
    MT_msg.innerHTML = `<div style="text-align:center"><span>DM para reclamar.</span></div>`;
    MT_cta.style.display='inline-flex'; MT_cta.href=MT_IG_URL;
  } else if(kind==='p50'){
    MT_tModal.innerHTML=`<div class="MT-headline"><span class="md">¡GANASTE</span> <span class="md MT-accent">$50!</span></div>`;
    MT_msg.innerHTML = `<div style="text-align:center"><span>Presenta captura para canjear.</span></div>`;
    MT_cta.style.display='inline-flex'; MT_cta.href=MT_IG_URL;
  } else if(kind==='gomita'){
    MT_tModal.innerHTML=`<div class="MT-headline"><span class="md">¡GOMITAS</span> <span class="md MT-accent-purple">GANADAS!</span></div>`;
    MT_msg.innerHTML = `<div style="text-align:center"><span>DM para canjear.</span></div>`;
    MT_cta.style.display='inline-flex'; MT_cta.href=MT_IG_URL;
  } else {
    MT_tModal.innerHTML=`<div class="MT-headline"><span class="md">SIN PREMIO</span><br><span class="xl">ESTA VEZ</span></div>`;
    MT_msg.innerHTML = `<div style="text-align:center"><span>Sigue participando con más códigos.</span></div>`;
    MT_cta.style.display='none';
  }
  MT_modal.style.display='flex'; MT_ok?.focus();
}
function MT_closeModal(){ MT_modal.style.display='none'; }
function MT_validPhone(v){ const d=(v||'').replace(/\D/g,''); return d.length>=8 && d.length<=15 ? d : null; }
function MT_phoneOpen(){ MT_pErr.textContent=''; MT_pIn.value=''; MT_pModal.style.display='flex'; setTimeout(()=>MT_pIn.focus(),0); }
function MT_phoneClose(){ MT_pModal.style.display='none'; }
function MT_phoneAsk(){
  return new Promise((res,rej)=>{
    MT_phoneOpen();
    const ok=()=>{ const v=MT_validPhone(MT_pIn.value); if(!v){MT_pErr.textContent='Ingresa un teléfono válido (8 a 15 dígitos).'; return;} MT_phoneClose(); res(v); };
    const cancel=()=>{ MT_phoneClose(); rej(new Error('cancelado')); };
    MT_pOk.onclick=ok; MT_pCancel.onclick=cancel;
    MT_pModal.onclick=e=>{ if(e.target===MT_pModal) cancel(); };
    const h=e=>{ if(MT_pModal.style.display==='flex'&&e.key==='Enter') ok(); if(MT_pModal.style.display==='flex'&&e.key==='Escape') cancel(); };
    window.addEventListener('keydown',h,{once:true});
  });
}

/* ========== Confeti ========= */
function MT_confetti(pal='gold'){
  if (!MT_canvas) return;
  const ctx = MT_canvas.getContext('2d'); if(!ctx) return;
  const r = MT_canvas.getBoundingClientRect();
  MT_canvas.width  = r.width * devicePixelRatio;
  MT_canvas.height = r.height * devicePixelRatio;
  ctx.scale(devicePixelRatio,devicePixelRatio);
  const cols = pal==='gold' ? ["#ffd700","#ffb300","#ff7a00","#fff2a8"] : ["#9b5cf7","#7c3aed","#c084fc","#e9d5ff"];
  const pcs = Array.from({length:120},()=>({ x:Math.random()*r.width, y:-20-Math.random()*60, w:6+Math.random()*6, h:8+Math.random()*10, vx:-1+Math.random()*2, vy:2+Math.random()*2.5, rot:Math.random()*Math.PI, vr:-0.22+Math.random()*0.44, color:cols[(Math.random()*cols.length)|0] }));
  let run=true; const start=performance.now();
  function tick(t){
    if(!run) return; const el=t-start;
    ctx.clearRect(0,0,r.width,r.height);
    for(const p of pcs){ p.x+=p.vx; p.y+=p.vy; p.rot+=p.vr; p.vy+=0.02; ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot); ctx.fillStyle=p.color; ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h); ctx.restore(); }
    if(el<2400) requestAnimationFrame(tick); else { run=false; ctx.clearRect(0,0,r.width,r.height); }
  }
  requestAnimationFrame(tick);
}

/* ========== Boot ========= */
function MT_hasCells(el){
  return el && [...el.children].some(node => !node.classList?.contains?.('screw'));
}
function MT_forceInitialState(){
  if (MT_modal)  MT_modal.style.display='none';
  if (MT_pModal) MT_pModal.style.display='none';
  if (MT_board && !MT_hasCells(MT_board)) MT_makeVitrine();
  MT_paint?.(`Ingresa 1 a ${MT_MAX_CODES} códigos para jugar.`, '#9fb0c9');
}
function MT_boot(){
  // Los estilos se inyectan desde CSS, pero si quieres inyectar desde JS puedes traerlos aquí
  MT_cacheDom();
  MT_wireModalClose();

  MT_forceInitialState();
  MT_decorateBoard();

  if (MT_goBtn && !MT_goBtn._wired){ MT_goBtn.addEventListener('click', MT_onValidate); MT_goBtn._wired=true; }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', MT_boot);
else MT_boot();

setTimeout(()=>{
  MT_cacheDom();
  MT_wireModalClose();
  const b = document.getElementById('MT-board');
  if (b && !MT_hasCells(b)) { MT_forceInitialState(); MT_decorateBoard(); }
}, 300);
