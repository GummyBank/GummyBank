<script type="module">
/* ========= MEGA 5x5 - LÓGICA (solo JS, diseño intacto) ========= */
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc, collection,
  runTransaction, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

/* ---------------- Config Firebase ---------------- */
const MG_IG_URL = (window.IG_URL || "https://instagram.com/tu_pagina");
const MG_firebaseConfig = window.firebaseConfig || {
  apiKey: "AIzaSyAJJgDg5SUPvvHgPtDNhIy1f1fiGpBHBw",
  authDomain: "registro-gomitas.firebaseapp.com",
  projectId: "registro-gomitas",
  storageBucket: "registro-gomitas.appspot.com",
  messagingSenderId: "435485731864",
  appId: "1:435485731864:web:43dff09753a4c9d507e76d",
  measurementId: "G-20KEW71X9G"
};
const MG_app = getApps().length ? getApp() : initializeApp(MG_firebaseConfig);
const MG_db  = getFirestore(MG_app);

/* ---------------- Parámetros del juego ----------------
   Si cambias el tamaño del tablero:
   - MG_TOTAL = número de casillas
   - En CSS: #MG-board -> grid-template-columns:repeat(N,...)
------------------------------------------------------- */
const MG_TOTAL = 25; // 5x5
const MG_COUNTS = { p1000: 1, p500: 1, p200: 2, p50: 4, gomita: 9 };
/* Umbrales: los NUEVOS aparecen después de 100 tiros:
   - p1000 y p50 son nuevos -> 100
   Los existentes se quedan igual que estaban. */
const MG_THRESH = { p1000: 100000, p500: 100000, p200: 10000, p50: 5, gomita: 3 };

/* ----------------- Referencias en DB ----------------- */
const MG_controlRef = doc(MG_db, "mega7x7_meta", "control"); // contadores globales
const MG_playsCol   = collection(MG_db, "mega7x7_plays");    // jugadas

/* ---------------- Utilidades ---------------- */
const MG_toId = s => (s||"").trim().toUpperCase().replace(/[^A-Z0-9]/g,"");
const MG_svg  = s => 'data:image/svg+xml;utf8,' + encodeURIComponent(s.trim());
const MG_IMG = {
  HIDDEN: MG_svg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="18" fill="#111827"/><text x="50%" y="56%" text-anchor="middle" dominant-baseline="middle" font-family="system-ui,Segoe UI,Roboto" font-size="68" fill="#9fb0c9">?</text></svg>`),
  NADA  : MG_svg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="18" fill="#1b2332"/><path d="M30 30 L90 90 M90 30 L30 90" stroke="#d1d5db" stroke-width="14" stroke-linecap="round"/></svg>`),
  GOMITA: "img/gomita.png",
  P200  : MG_svg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="18" fill="#0b3a54"/><circle cx="60" cy="60" r="38" fill="#0ea5e9"/><text x="50%" y="56%" text-anchor="middle" dominant-baseline="middle" font-family="system-ui,Segoe UI,Roboto" font-size="42" fill="#e6fffa">$200</text></svg>`),
  P500  : MG_svg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="18" fill="#14532d"/><circle cx="60" cy="60" r="40" fill="#22c55e"/><text x="50%" y="56%" text-anchor="middle" dominant-baseline="middle" font-family="system-ui,Segoe UI,Roboto" font-size="44" fill="#e6fffa">$500</text></svg>`),
  P1000 : MG_svg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="18" fill="#064e3b"/><circle cx="60" cy="60" r="40" fill="#0e9f6e"/><text x="50%" y="56%" text-anchor="middle" dominant-baseline="middle" font-family="system-ui,Segoe UI,Roboto" font-size="40" fill="#e6fffa">$1000</text></svg>`),
  P50   : MG_svg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="18" fill="#1e293b"/><circle cx="60" cy="60" r="36" fill="#94a3b8"/><text x="50%" y="56%" text-anchor="middle" dominant-baseline="middle" font-family="system-ui,Segoe UI,Roboto" font-size="46" fill="#0b1220">$50</text></svg>`)
};
/* ← IMPORTANTE: ahora manejamos 'HIDDEN' para que muestre el '?' */
const MG_icon = (k) => {
  switch (k) {
    case 'HIDDEN': return MG_IMG.HIDDEN;
    case 'p1000' : return MG_IMG.P1000;
    case 'p500'  : return MG_IMG.P500;
    case 'p200'  : return MG_IMG.P200;
    case 'p50'   : return MG_IMG.P50;
    case 'gomita': return MG_IMG.GOMITA;
    default      : return MG_IMG.NADA;
  }
};

/* ---------------- DOM ---------------- */
const MG_board = document.getElementById("MG-board");
const MG_status= document.getElementById("MG-status");
const MG_code1 = document.getElementById("MG-code1");
const MG_code2 = document.getElementById("MG-code2");
const MG_goBtn = document.getElementById("MG-validar");

const MG_modal = document.getElementById("MG-modal");
const MG_cardM = document.getElementById("MG-card-modal");
const MG_tModal= document.getElementById("MG-title-modal");
const MG_msg   = document.getElementById("MG-msg");
const MG_cta   = document.getElementById("MG-cta");
const MG_ok    = document.getElementById("MG-ok");
const MG_figure= document.getElementById("MG-figure");

const MG_pModal= document.getElementById("MG-phone");
const MG_pIn   = document.getElementById("MG-phone-input");
const MG_pOk   = document.getElementById("MG-phone-ok");
const MG_pCancel=document.getElementById("MG-phone-cancel");
const MG_pErr  = document.getElementById("MG-phone-error");
const MG_canvas= document.getElementById("MG-canvas");

/* ---------------- Estado ---------------- */
let MG_ready=false, MG_codes=null, MG_tel=null, MG_picked=false;

/* ---------------- Helpers UI ---------------- */
function MG_setIcon(btn, kind){
  let alt = 'Sin premio';
  if (kind === 'HIDDEN') alt = 'Oculto';
  else if (kind === 'p1000') alt = '$1000';
  else if (kind === 'p500')  alt = '$500';
  else if (kind === 'p200')  alt = '$200';
  else if (kind === 'p50')   alt = '$50';
  else if (kind === 'gomita')alt = 'Gomitas';

  btn.innerHTML = `<img class="MG-cell-img" alt="${alt}" src="${MG_icon(kind)}">`;
  btn.setAttribute('aria-label', alt);
}
function MG_setLooks(btn, kind){
  btn.classList.remove('MG-looks-1500','MG-looks-500','MG-looks-200','MG-looks-gomita','MG-looks-nada','MG-1500','MG-500','MG-200');
  if(kind==='p1000') btn.classList.add('MG-looks-1500','MG-1500'); // reutiliza estilos del antiguo 1500
  else if(kind==='p500') btn.classList.add('MG-looks-500','MG-500');
  else if(kind==='p200' || kind==='p50') btn.classList.add('MG-looks-200','MG-200'); // 50 hereda look de 200
  else if(kind==='gomita') btn.classList.add('MG-looks-gomita');
  else btn.classList.add('MG-looks-nada');
}
function MG_paint(msg,color){ MG_status.textContent=msg; MG_status.style.color=color||"#9fb0c9"; }

/* badges opcionales, si no existen no hace nada */
function MG_badges(ok1, ok2){
  const b1 = document.getElementById('MG-b1');
  const b2 = document.getElementById('MG-b2');
  if (!b1 || !b2) return;
  b1.classList.remove('ok','err'); b2.classList.remove('ok','err');
  if (ok1 !== undefined) b1.classList.add(ok1 ? 'ok' : 'err');
  if (ok2 !== undefined) b2.classList.add(ok2 ? 'ok' : 'err');
  b1.textContent = ok1 ? 'Código #1 ✓' : 'Código #1';
  b2.textContent = ok2 ? 'Código #2 ✓' : 'Código #2';
}

/* ---------------- Vitrina inicial ---------------- */
MG_makeVitrine();
function MG_makeVitrine(){
  const pool=['p1000','p500'];
  for(let i=0;i<MG_COUNTS.p200;i++)   pool.push('p200');
  for(let i=0;i<MG_COUNTS.p50;i++)    pool.push('p50');
  for(let i=0;i<MG_COUNTS.gomita;i++) pool.push('gomita');
  for(let i=pool.length;i<MG_TOTAL;i++) pool.push('nada');
  for(let i=pool.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [pool[i],pool[j]]=[pool[j],pool[i]]; }
  MG_board.innerHTML='';
  pool.forEach(k=>{ const b=document.createElement('button'); MG_setIcon(b,k); MG_setLooks(b,k); b.disabled=true; MG_board.appendChild(b); });
  MG_paint("Necesitas 2 códigos válidos para jugar.", "#9fb0c9");
}

/* ---------------- Click “Validar y jugar” ---------------- */
MG_goBtn.addEventListener("click", async ()=>{
  const c1 = MG_toId(MG_code1.value), c2 = MG_toId(MG_code2.value);
  if(!c1 || !c2){ MG_paint("Ingresa los 2 códigos.","#ff6b6b"); MG_lock(); return; }
  if(c1===c2){ MG_paint("Los códigos deben ser distintos.","#ff6b6b"); MG_lock(); return; }

  try{
    const ok1 = await MG_checkCode(c1);
    const ok2 = await MG_checkCode(c2);
    if(!ok1 || !ok2){ MG_badges(false,false); MG_paint("Código inválido o ya usado.","#ff6b6b"); MG_lock(); return; }
    MG_badges(true,true);

    try{ MG_tel = await MG_phoneAsk(); }
    catch(_){ MG_paint("Participación cancelada.","#fca5a5"); return; }

    MG_codes = { c1, c2 };
    MG_paint("Tienes 1 intento. Mezclando...","#3fb950");
    await MG_flipShuffle();
  }catch(e){ console.error(e); MG_paint("Error al validar.","#ff6b6b"); }
});

/* ---------------- Preparar tablero real ---------------- */
function MG_lock(){ [...MG_board.children].forEach(b=>b.disabled=true); MG_ready=false; }
function MG_unlock(){ [...MG_board.children].forEach(b=>b.disabled=false); MG_ready=true; }

async function MG_flipShuffle(){
  const bs=[...MG_board.children];
  await Promise.all(bs.map((b,i)=>new Promise(res=>{
    setTimeout(()=>{
      MG_setIcon(b,'HIDDEN'); // ← muestra "?"
      b.classList.remove('MG-looks-1500','MG-looks-500','MG-looks-200','MG-looks-gomita','MG-looks-nada','MG-1500','MG-500','MG-200');
      b.style.background="linear-gradient(135deg,#0b0f18,#0f172a)"; b.style.borderColor="#2b3b58";
      res();
    }, i*20);
  })));
  await MG_realPool();
  bs.forEach((b,i)=>{ setTimeout(()=>{ b.classList.add("MG-is-shuffling"); setTimeout(()=>b.classList.remove("MG-is-shuffling"),650); }, i*10); });
  MG_unlock(); MG_ready=true; MG_picked=false;
  MG_paint("Códigos validados. Elige una casilla.","#3fb950");
}

/* ---------------- Control en Firestore ---------------- */
async function MG_getControl(){                             // Función asíncrona que garantiza y lee el documento de control global.

 /* ---------------- Control en Firestore (safe init) ---------------- */
async function MG_getControl(){
  // 1) Leer primero
  const snap = await getDoc(MG_controlRef);

  // 2) Si NO existe, inicializa una sola vez
  if (!snap.exists()) {
    await setDoc(MG_controlRef, {
      since1000: 0, since500: 0, since200: 0, since50: 0, sinceGomita: 0,
      wins1000: 0,  wins500: 0,  wins200: 0,  wins50: 0,  winsGomita: 0,
      totalPlays: 0,
      updatedAt: serverTimestamp()
    });
    return {
      since1000:0, since500:0, since200:0, since50:0, sinceGomita:0,
      wins1000:0, wins500:0, wins200:0, wins50:0, winsGomita:0,
      totalPlays:0
    };
  }

  // 3) Si SÍ existe, NO resetees. Solo normaliza y, si faltara algo, complétalo sin pisar valores.
  const d = snap.data() || {};
  const patch = {};
  if (d.since1000 == null)  patch.since1000 = 0;
  if (d.since500  == null)  patch.since500  = 0;
  if (d.since200  == null)  patch.since200  = 0;
  if (d.since50   == null)  patch.since50   = 0;
  if (d.sinceGomita == null)patch.sinceGomita = 0;

  if (d.wins1000  == null)  patch.wins1000  = 0;
  if (d.wins500   == null)  patch.wins500   = 0;
  if (d.wins200   == null)  patch.wins200   = 0;
  if (d.wins50    == null)  patch.wins50    = 0;
  if (d.winsGomita== null)  patch.winsGomita= 0;

  if (d.totalPlays== null)  patch.totalPlays= 0;

  // Escribe SOLO lo faltante y el updatedAt
  await setDoc(MG_controlRef, { ...patch, updatedAt: serverTimestamp() }, { merge:true });

  // 4) Devuelve contadores normalizados (números)
  return {
    since1000:+(d.since1000 ?? 0),
    since500:+(d.since500 ?? 0),
    since200:+(d.since200 ?? 0),
    since50:+(d.since50 ?? 0),
    sinceGomita:+(d.sinceGomita ?? 0),
    wins1000:+(d.wins1000 ?? 0),
    wins500:+(d.wins500 ?? 0),
    wins200:+(d.wins200 ?? 0),
    wins50:+(d.wins50 ?? 0),
    winsGomita:+(d.winsGomita ?? 0),
    totalPlays:+(d.totalPlays ?? 0)
  };
}                                    // merge:true asegura que solo completa campos faltantes y no borra existentes.

  const s = await getDoc(MG_controlRef);                    // Lee el snapshot actual del documento de control.
  const d = s.exists() ? (s.data() || {}) : {};             // Si existe, extrae sus datos; si no, usa objeto vacío para evitar undefined.

  return {                                                  // Devuelve un objeto “normalizado” solo con números (usa + para convertir).
    since1000:+(d.since1000||0),                            // Asegura número: si la propiedad no existe, usa 0.
    since500:+(d.since500||0),
    since200:+(d.since200||0),
    since50:+(d.since50||0),
    sinceGomita:+(d.sinceGomita||0),

    wins1000:+(d.wins1000||0),                              // Totales de premios otorgados, también normalizados.
    wins500:+(d.wins500||0),
    wins200:+(d.wins200||0),
    wins50:+(d.wins50||0),
    winsGomita:+(d.winsGomita||0),

    totalPlays:+(d.totalPlays||0)                           // Total de jugadas registradas.
  };
}

async function MG_realPool(){                               // Construye el “pool” de premios real para este tablero.
  const c = await MG_getControl();                          // Obtiene contadores/estadísticas actuales desde Firestore.

  const en = {                                              // Flags de habilitación por umbral (true si ya se alcanzó el mínimo).
    p1000 : c.since1000  >= MG_THRESH.p1000,                // Habilita $1000 si los tiros desde el último >= umbral.
    p500  : c.since500   >= MG_THRESH.p500,                 // Habilita $500 según su umbral.
    p200  : c.since200   >= MG_THRESH.p200,                 // Habilita $200 según su umbral.
    p50   : c.since50    >= MG_THRESH.p50,                  // Habilita $50 según su umbral.
    gomita: c.sinceGomita>= MG_THRESH.gomita                // Habilita gomitas según su umbral.
  };

  const pool=[];                                            // Arreglo final con el contenido de cada casilla (tamaño = MG_TOTAL).

  if(en.p1000) pool.push('p1000');                          // Inserta 1 premio $1000 si está habilitado.
  if(en.p500)  pool.push('p500');                           // Inserta 1 premio $500 si está habilitado.

  for(let i=0;i<(en.p200?MG_COUNTS.p200:0);i++)             // Inserta N premios $200 si están habilitados…
    pool.push('p200');                                      // …N proviene de MG_COUNTS.p200.

  for(let i=0;i<(en.p50?MG_COUNTS.p50:0);i++)               // Inserta N premios $50 si están habilitados…
    pool.push('p50');                                       // …N proviene de MG_COUNTS.p50.

  for(let i=0;i<(en.gomita?MG_COUNTS.gomita:0);i++)         // Inserta N “gomita” si están habilitadas…
    pool.push('gomita');                                    // …N proviene de MG_COUNTS.gomita.

  for(let i=pool.length;i<MG_TOTAL;i++) pool.push('nada');  // Completa hasta MG_TOTAL con “nada” para llenar el tablero.

  for(let i=pool.length-1;i>0;i--){                         // Barajado Fisher–Yates para distribuir premios aleatoriamente.
    const j=(Math.random()*(i+1))|0;                        // Índice aleatorio entero entre 0 e i.
    [pool[i],pool[j]]=[pool[j],pool[i]];                    // Intercambia posiciones i y j.
  }

  [...MG_board.children].forEach((b,idx)=>{                 // Asigna el contenido a cada botón/casilla del tablero.
    b.dataset.MGprize = pool[idx];                          // Guarda el premio real en data-attribute (para usar al revelar).
    MG_setIcon(b,'HIDDEN');                                 // Muestra el ícono de “oculto” (el signo ?), no el premio real.
    b.disabled=false;                                       // Habilita la casilla para que pueda clicarse.
    b.onclick=()=>MG_onPick(b);                             // Asocia el handler de click que gestiona la selección.
    b.style.background="linear-gradient(135deg,#0b0f18,#0f172a)"; // Resetea background base visual.
    b.style.borderColor="#2b3b58";                          // Resetea color de borde base.
  });

  MG_board.dataset.fake1000  = String(!en.p1000);           // Flags para el “reveal” visual: si NO estaba habilitado…
  MG_board.dataset.fake500   = String(!en.p500);            // …queda “true” y el reveal puede mostrar premios “falsos”
  MG_board.dataset.fake200   = String(!en.p200);            // …solo de forma visual para completar la vitrina objetivo.
  MG_board.dataset.fake50    = String(!en.p50);             // Estas flags no afectan el resultado final, solo la animación.
  MG_board.dataset.fakeGomita= String(!en.gomita);
}                                                           // Fin de MG_realPool


/* ---------------- Click en casilla ---------------- */
async function MG_onPick(btn){
  if(!MG_ready || !MG_codes || MG_picked) return;
  MG_picked=true; MG_lock();

  const cand = btn.dataset.MGprize;
  await MG_reveal(btn, cand);

  try{
    await MG_persist(MG_codes.c1, MG_codes.c2, MG_tel, cand);
  }catch(e){
    console.error(e);
    MG_paint("No se pudo registrar la jugada.","#fca5a5");
  }

  await MG_revealRest(btn);

  if(cand==='p1000'){ MG_confetti('gold');  MG_open('success','p1000'); }
  else if(cand==='p500'){ MG_confetti('gold'); MG_open('success','p500'); }
  else if(cand==='p200'){ MG_confetti('gold'); MG_open('success','p200'); }
  else if(cand==='p50'){ MG_confetti('gold'); MG_open('success','p50'); }
  else if(cand==='gomita'){ MG_confetti('purple'); MG_open('warn','gomita'); }
  else MG_open('neutral','nada');
}

function MG_reveal(btn,kind){
  return new Promise(res=>{
    btn.classList.add('MG-is-flipping');
    setTimeout(()=>{
      MG_setIcon(btn,kind); MG_setLooks(btn,kind);
      btn.classList.remove('MG-is-flipping'); btn.classList.add('MG-pop');
      setTimeout(()=>{ btn.classList.remove('MG-pop'); res(); },160);
    },160);
  });
}

/* Revelado del resto: asegura 1×$1000, 1×$500, 2×$200, 3×$50 y 7×gomita cuando no estén habilitados */
function MG_revealRest(chosen){
  const bs=[...MG_board.children];
  const avail = bs.filter(b => b !== chosen);

  const countReal = k => bs.filter(b => b.dataset.MGprize === k).length;
  const take = (n) => { const out=[]; for(let i=0;i<n && avail.length;i++){ const j=(Math.random()*avail.length)|0; out.push(avail.splice(j,1)[0]); } return out; };

  const fakes = [];
  if (MG_board.dataset.fake1000 === "true" && countReal('p1000') === 0) fakes.push({k:'p1000', bs: take(1)});
  if (MG_board.dataset.fake500  === "true" && countReal('p500')  === 0) fakes.push({k:'p500',  bs: take(1)});

  if (MG_board.dataset.fake200  === "true"){
    const need200 = Math.max(0, MG_COUNTS.p200 - countReal('p200'));
    if (need200 > 0) fakes.push({k:'p200',  bs: take(need200)});
  }
  if (MG_board.dataset.fake50 === "true"){
    const need50 = Math.max(0, MG_COUNTS.p50 - countReal('p50'));
    if (need50 > 0) fakes.push({k:'p50',  bs: take(need50)});
  }
  if (MG_board.dataset.fakeGomita === "true"){
    const needG = Math.max(0, MG_COUNTS.gomita - countReal('gomita'));
    if (needG > 0) fakes.push({k:'gomita', bs: take(needG)});
  }

  let t=110;
  const ps=[];
  for(const b of bs){
    if(b===chosen) continue;
    ps.push(new Promise(r=>{
      setTimeout(()=>{
        const fk = fakes.find(x => x.bs.includes(b));
        if (fk){ MG_setIcon(b,fk.k); MG_setLooks(b,fk.k); }
        else { const k=b.dataset.MGprize; MG_setIcon(b,k); MG_setLooks(b,k); }
        r();
      }, t);
      t += 45;
    }));
  }
  return Promise.all(ps);
}

/* ---------------- Validación de códigos ---------------- */
async function MG_checkCode(codeRaw){
  const code = MG_toId(codeRaw);
  const ref  = doc(MG_db,"codigos",code);
  const s    = await getDoc(ref);
  if(!s.exists()) return false;
  const d = s.data()||{};
  if((d.estado||"").toLowerCase()==="usado") return false;
  return true;
}

/* ---------------- Persistencia + contadores ---------------- */
async function MG_persist(c1,c2,phone,rawPrize){
  const r1   = doc(MG_db,"codigos",MG_toId(c1));
  const r2   = doc(MG_db,"codigos",MG_toId(c2));
  const play = doc(MG_playsCol);

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

  await runTransaction(MG_db, async (tx)=>{
    const cSnap = await tx.get(MG_controlRef);
    const cData = cSnap.exists() ? (cSnap.data()||{}) : {
      since1000:0, since500:0, since200:0, since50:0, sinceGomita:0,
      wins1000:0, wins500:0, wins200:0, wins50:0, winsGomita:0, totalPlays:0
    };

    const s1 = await tx.get(r1), s2 = await tx.get(r2);
    if(!s1.exists() || !s2.exists()) throw new Error("Código no existe");
    const d1=s1.data()||{}, d2=s2.data()||{};
    if((d1.estado||"").toLowerCase()==="usado" || (d2.estado||"").toLowerCase()==="usado")
      throw new Error("Código ya usado");

    const elig = {
      p1000:+(cData.since1000||0)>=MG_THRESH.p1000,
      p500 :+(cData.since500 ||0)>=MG_THRESH.p500,
      p200 :+(cData.since200 ||0)>=MG_THRESH.p200,
      p50  :+(cData.since50  ||0)>=MG_THRESH.p50,
      gomita:+(cData.sinceGomita||0)>=MG_THRESH.gomita
    };

    const final = cascade(rawPrize, elig);

    tx.set(play,{
      codigo1:MG_toId(c1), codigo2:MG_toId(c2), telefono:phone,
      rawPrize, finalPrize:final, createdAt:serverTimestamp()
    });

    tx.set(r1,{ estado:"usado", usadoEn:"MegaJuego5x5", usadoAt:serverTimestamp(), telefono:phone, resultado:final },{ merge:true });
    tx.set(r2,{ estado:"usado", usadoEn:"MegaJuego5x5", usadoAt:serverTimestamp(), telefono:phone, resultado:final },{ merge:true });

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

    tx.set(MG_controlRef, next, { merge:true });
  });
}

/* ---------------- Modal resultado ---------------- */
function MG_open(variant,kind){
  MG_figure.innerHTML=""; MG_cardM.classList.remove('success','warn','neutral'); if(variant) MG_cardM.classList.add(variant);
  const im=document.createElement('img'); im.src=MG_icon(kind); im.alt=kind; MG_figure.appendChild(im);

  if(kind==='p1000'){
    MG_tModal.innerHTML=`<div class="MG-headline"><span class="md">¡PREMIO MAYOR!</span><br><span class="xl MG-accent">$1000</span></div>`;
    MG_msg.innerHTML = `<div style="text-align:center"><span style="color:#fde68a;font-weight:800">TOMA CAPTURA DE PANTALLA</span><br><span>Envíala por DM en Instagram.</span></div>`;
    MG_cta.style.display='inline-flex'; MG_cta.href=MG_IG_URL; MG_cta.textContent='Abrir Instagram';
  } else if(kind==='p500'){
    MG_tModal.innerHTML=`<div class="MG-headline"><span class="md">¡GANASTE</span> <span class="md MG-accent">$500!</span></div>`;
    MG_msg.innerHTML = `<div style="text-align:center"><span style="color:#fde68a;font-weight:800">TOMA CAPTURA DE PANTALLA</span><br><span>DM para reclamar.</span></div>`;
    MG_cta.style.display='inline-flex'; MG_cta.href=MG_IG_URL;
  } else if(kind==='p200'){
    MG_tModal.innerHTML=`<div class="MG-headline"><span class="md">¡GANASTE</span> <span class="md MG-accent">$200!</span></div>`;
    MG_msg.innerHTML = `<div style="text-align:center"><span style="color:#fde68a;font-weight:800">TOMA CAPTURA DE PANTALLA</span><br><span>DM para reclamar.</span></div>`;
    MG_cta.style.display='inline-flex'; MG_cta.href=MG_IG_URL;
  } else if(kind==='p50'){
    MG_tModal.innerHTML=`<div class="MG-headline"><span class="md">¡GANASTE</span> <span class="md MG-accent">$50!</span></div>`;
    MG_msg.innerHTML = `<div style="text-align:center"><span>Presenta la captura para canjear.</span></div>`;
    MG_cta.style.display='inline-flex'; MG_cta.href=MG_IG_URL;
  } else if(kind==='gomita'){
    MG_tModal.innerHTML=`<div class="MG-headline"><span class="md">¡GOMITAS</span> <span class="md MG-accent-purple">GANADAS!</span></div>`;
    MG_msg.innerHTML = `<div style="text-align:center"><span style="color:#fde68a;font-weight:800">TOMA CAPTURA DE PANTALLA</span><br><span>DM para canjear.</span></div>`;
    MG_cta.style.display='inline-flex'; MG_cta.href=MG_IG_URL;
  } else {
    MG_tModal.innerHTML=`<div class="MG-headline"><span class="md">SIN PREMIO</span><br><span class="xl">ESTA VEZ</span></div>`;
    MG_msg.innerHTML = `<div style="text-align:center"><span>Sigue participando con más códigos.</span></div>`;
    MG_cta.style.display='none';
  }

  MG_modal.style.display='flex'; MG_ok.focus();
}
function MG_close(){
  MG_modal.style.display='none';
  MG_code1.value=''; MG_code2.value='';
  MG_codes=null; MG_tel=null; MG_ready=false;
  MG_badges(); MG_paint('Ingresa 2 códigos para jugar.','#9fb0c9');
}
MG_ok.addEventListener('click',MG_close);
MG_modal.addEventListener('click',e=>{ if(e.target===MG_modal) MG_close(); });
window.addEventListener('keydown',e=>{ if(MG_modal.style.display==='flex'&&(e.key==='Escape'||e.key==='Enter')) MG_close(); });

/* ---------------- Teléfono (modal pequeño) ---------------- */
function MG_validPhone(v){ const d=(v||'').replace(/\D/g,''); return d.length>=8 && d.length<=15 ? d : null; }
function MG_phoneOpen(){ MG_pErr.textContent=''; MG_pIn.value=''; MG_pModal.style.display='flex'; setTimeout(()=>MG_pIn.focus(),0); }
function MG_phoneClose(){ MG_pModal.style.display='none'; }
function MG_phoneAsk(){
  return new Promise((res,rej)=>{
    MG_phoneOpen();
    const ok=()=>{ const v=MG_validPhone(MG_pIn.value); if(!v){MG_pErr.textContent='Ingresa un teléfono válido (8 a 15 dígitos).'; return;} MG_phoneClose(); res(v); };
    const cancel=()=>{ MG_phoneClose(); rej(new Error('cancelado')); };
    MG_pOk.onclick=ok; MG_pCancel.onclick=cancel;
    MG_pModal.onclick=e=>{ if(e.target===MG_pModal) cancel(); };
    const h=e=>{ if(MG_pModal.style.display==='flex'&&e.key==='Enter') ok(); if(MG_pModal.style.display==='flex'&&e.key==='Escape') cancel(); };
    window.addEventListener('keydown',h,{once:true});
  });
}

/* ---------------- Confeti (sobre el header) ---------------- */
function MG_confetti(pal='gold'){
  const ctx = MG_canvas.getContext('2d');
  const r   = MG_canvas.getBoundingClientRect();
  MG_canvas.width  = r.width * devicePixelRatio;
  MG_canvas.height = r.height * devicePixelRatio;
  ctx.scale(devicePixelRatio,devicePixelRatio);

  const cols = pal==='gold' ? ["#ffd700","#ffb300","#ff7a00","#fff2a8"]
                            : ["#9b5cf7","#7c3aed","#c084fc","#e9d5ff"];

  const pcs = Array.from({length:120},()=>({
    x:Math.random()*r.width, y:-20-Math.random()*60,
    w:6+Math.random()*6, h:8+Math.random()*10,
    vx:-1+Math.random()*2, vy:2+Math.random()*2.5,
    rot:Math.random()*Math.PI, vr:-0.22+Math.random()*0.44,
    color:cols[(Math.random()*cols.length)|0]
  }));

  let run=true; const start=performance.now();
  function tick(t){
    if(!run) return;
    const el=t-start;
    ctx.clearRect(0,0,r.width,r.height);
    for(const p of pcs){
      p.x+=p.vx; p.y+=p.vy; p.rot+=p.vr; p.vy+=0.02;
      ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot);
      ctx.fillStyle=p.color; ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h); ctx.restore();
    }
    if(el<2400) requestAnimationFrame(tick);
    else { run=false; ctx.clearRect(0,0,r.width,r.height); }
  }
  requestAnimationFrame(tick);
}
</script>

