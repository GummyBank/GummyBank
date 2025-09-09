// js/memorama.game.js (v2)
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, collection, runTransaction
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

/* ===== Firebase (usa tu mismo proyecto) ===== */
const firebaseConfig = {
  apiKey: "AIzaSyAJJgDg5SUPvvHgPtDNhIy1f1fiGpBHBw",
  authDomain: "registro-gomitas.firebaseapp.com",
  projectId: "registro-gomitas",
  storageBucket: "registro-gomitas.appspot.com",
  messagingSenderId: "435485731864",
  appId: "1:435485731864:web:43dff09753a4c9d507e76d",
  measurementId: "G-20KEW71X9G"
};
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db  = getFirestore(app);
// 8 colores (uno por cada par del mazo)
const PAIR_COLOR_CLASSES = ['c0','c1','c2','c3','c4','c5','c6','c7'];
function colorClassFor(card){
  const n = parseInt(card.pairId, 10);
  return isNaN(n) ? 'c0' : PAIR_COLOR_CLASSES[n % PAIR_COLOR_CLASSES.length];
}

/* ===== Helpers BD ===== */
async function checkCode(code) {
  const ref = doc(db, "codigos", code);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { ok:false, reason:"NO_EXISTE" };
  if ((snap.data()?.estado||"").toLowerCase() === "usado") return { ok:false, reason:"EN_USO" };
  return { ok:true, data:snap.data() };
}

/** Marca el código y maneja bloque de 8 para $50 (una jugada aleatoria por bloque) */
async function consumeCode(code, phone){
  // Marca código usado
  const ref = doc(db, "codigos", code);
  await updateDoc(ref, {
    estado: "usado",
    telefono: phone,
    juego: "MEMOGUMMY",
    usadoEn: new Date().toISOString()
  }).catch(async e=>{
    const recheck = await getDoc(ref);
    if (!recheck.exists()) throw new Error("NO_EXISTE");
    throw e;
  });

  // Contador global y elección aleatoria dentro del bloque de 8
  const countersRef = doc(db, "counters", "memogummy");
  const { total, unlock50, idxInBlock, pick } = await runTransaction(db, async (tx) => {
    const snap = await tx.get(countersRef);
    let total = 0;
    let pick = 1;
    let pickBlock = -1;

    if (snap.exists()) {
      const d = snap.data();
      total     = Number(d.total || 0);
      pick      = Number(d.pick || 1);
      pickBlock = Number(d.pickBlock ?? -1);
    }

    total += 1;
    const blockIndex = Math.floor((total - 1) / 8);     // 0,1,2...
    const idxInBlock = ((total - 1) % 8) + 1;           // 1..8

    if (pickBlock !== blockIndex) {
      pick = ((Math.random() * 8) | 0) + 1;             // 1..8
      pickBlock = blockIndex;
    }

    const unlock50 = (idxInBlock === pick);
    tx.set(countersRef, { total, pick, pickBlock }, { merge: true });
    return { total, unlock50, idxInBlock, pick };
  });

  // Guarda jugada
  const dref = doc(collection(db, "memogummy"), code);
  await setDoc(dref, {
    codigo: code,
    telefono: phone,
    registrado: new Date().toISOString(),
    playIndex: total,
    unlock50,
    idxInBlock,
    pick
  });

  return { unlock50 };
}

/* ================== UI ================== */
const $ = s => document.querySelector(s);
const boardEl = $("#MEM-board");
const msgEl   = $("#mem-msg");
const codeEl  = $("#mem-code");
const playBtn = $("#mem-play");

function setStatus(t, cls){ msgEl.textContent=t; msgEl.className="status"+(cls?(" "+cls):""); }
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [a[i],a[j]]=[a[j],a[i]]; } }
const sleep = ms=>new Promise(r=>setTimeout(r,ms));

/* ================== CONFIG DIFICULTAD ================== */
/* Probabilidad de sabotear el EMPATE para premios permitidos (gomitas y puntos).
   0.85 = difícil; baja si quieres hacerlo más fácil. */
const GUMMY_SABOTAGE = 0.1;

/* ================== DECK ================== */
/** NUEVO set (8 pares = 16 cartas):
 *  - 1 par de gomitas
 *  - 1 par 10 PTS
 *  - 1 par 5  PTS
 *  - 1 par 3  PTS
 *  - 1 par $50 (solo se puede ganar si unlock50Active)
 *  - 1 par $200 (NUNCA permite match)
 *  - 1 par $500 (NUNCA permite match)
 *  - 1 par $1000 (NUNCA permite match)
 */
const basePairs = [
  {kind:'money'},                               // Gomitas (1 par)
  {kind:'pts', txt:'10 PTS', cls:'blue'},      // Puntos sí pueden empatar (difícil)
  {kind:'pts', txt:'5 PTS',  cls:'blue'},
  {kind:'pts', txt:'3 PTS',  cls:'blue'},
  {kind:'amt', txt:'$50',   cls:'blue'},       // Solo cuando unlock50Active
  {kind:'amt', txt:'$200',  cls:'blue'},       // Nunca empatan
  {kind:'amt', txt:'$500',  cls:'blue'},       // Nunca empatan
  {kind:'amt', txt:'$1000', cls:'gold'}        // Nunca empatan
]; // 8 tipos -> 16 cartas

let cells=[], cards=[], valid=false, remaining=0;
let firstPick=null, busy=false, unlock50Active=false;

function cardKey(c){ return JSON.stringify({ kind:c.kind, txt:c.txt, cls:c.cls, pairId:c.pairId }); }

function paintBack(el, card){
  const content = el.querySelector(".back .content");
  content.innerHTML = "";
  el.classList.remove("theme-dark","reveal");

  const colorCls = colorClassFor(card);

  if (card.kind === 'money'){
    // Gomita con halo del color de la pareja
    content.innerHTML = `
      <div>
        <img class="mm-gomy" src="img/gomita.png" alt="Gomita">
      </div>`;
    el.classList.add("theme-gomi");
  } else if (card.kind === 'pts') {
    // Puntos → chip del color de la pareja
    const label = String(card.txt||'PTS');
    content.innerHTML = `
      <div class="chip mem-chip ${colorCls}">
        <span class="value">${label}</span>
      </div>`;
    el.classList.add("theme-dark");
  } else {
    // Cantidades $ → chip del color de la pareja
    const val = String(card.txt).replace('$','');
    content.innerHTML = `
      <div class="chip mem-chip ${colorCls}">
        <span class="sign">$</span><span class="value">${val}</span>
      </div>`;
    el.classList.add("theme-dark");
  }

  el.classList.add("reveal");
  setTimeout(()=>el.classList.remove("reveal"), 480);
}



function revealTile(el, card){ el.classList.add("flipped"); el._flipped = true; paintBack(el, card); el._cardKey = cardKey(card); }
function coverTile(el){ el.classList.remove("flipped"); el._flipped = false; }

/** Construye mazo con pairId interno para que solo empate el par correcto */
function buildDeck(){
  const defs = basePairs.map((p, i) => ({ ...p, pairId: `${i}` })); // 0..7
  const deck = defs.flatMap(def => [
    JSON.parse(JSON.stringify({ ...def, side:'A' })),
    JSON.parse(JSON.stringify({ ...def, side:'B' }))
  ]);
  shuffle(deck);
  return deck;
}

function attachDeckToCells(deck, revealAll){
  cells.forEach((btn, i) => {
    btn._card = deck[i];
    btn._cardKey = cardKey(deck[i]);
    if (revealAll) revealTile(btn, btn._card);
  });
}
function reorderAllCells(){
  const arr = [...cells];
  shuffle(arr);
  arr.forEach(node => boardEl.appendChild(node));
}

/* ===== Preview SIEMPRE visible ===== */
function showPreview(){
  renderBoard(16);
  cards = buildDeck();
  attachDeckToCells(cards, true); // premios visibles
  setStatus("Valida tu código para jugar :)");
}

/* ===== Modal ===== */
function ensureMemModal(){
  if (document.getElementById('mem-modal')) return;
  const wrap = document.createElement('div');
  wrap.innerHTML = `
  <style>
    #mem-modal-ov{position:fixed;inset:0;background:rgba(0,0,0,.6);backdrop-filter:blur(6px);display:none;z-index:10060}
    #mem-modal{
      position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);
      width:min(92vw,420px);padding:22px 18px;border-radius:20px;color:#e7ecf3;
      background: radial-gradient(120% 120% at 10% -10%, rgba(255,255,255,.13), transparent 40%),
                  linear-gradient(180deg, rgba(255,255,255,.18), rgba(0,0,0,.45));
      background-color:rgba(18,23,35,.85);border:1px solid rgba(39,48,65,.35);
      box-shadow:0 24px 60px rgba(0,0,0,.5);text-align:center;display:none;z-index:10070;
    }
    #mem-modal .btn{border:0;border-radius:14px;padding:12px 14px;cursor:pointer;font-weight:900;
      background:linear-gradient(90deg,#6ae5ff,#3c79ff);color:#061018;width:100%;}
    #mem-modal .title{margin:6px 0 8px;font-weight:900}
    #mem-modal .msg{margin:0 0 12px;color:#9fb0c9;white-space:pre-wrap}

    /* ================== PRIZE BOX · LOOK METÁLICO ================== */
/* Paleta base */
:root{
  --muted:#a9c6e6;
  --accent:#5ee8ff;
  --panel-bd:#0d1b2e;
}

/* Layout básico */
body{margin:0;background:transparent;color:#eaf6ff;font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,'Helvetica Neue',Arial,'Noto Sans',sans-serif}
.wrap{max-width:980px;margin:24px auto;padding:0 16px}

/* Título corto con fondo negro */
.hero{text-align:center;margin:14px 0 18px}
.neon-wrap{display:inline-block;background:#000;border:2px solid rgba(80,180,255,.9);border-radius:24px;padding:14px 22px;box-shadow:0 12px 26px rgba(0,0,0,.35),0 0 12px rgba(80,180,255,.7),inset 0 0 18px rgba(94,232,255,.22)}
.neon{margin:0;font-weight:1000;letter-spacing:.08em;font-size:clamp(36px,9vw,72px);color:#5ee8ff;text-shadow:0 0 18px rgba(94,232,255,.95),0 0 36px rgba(94,232,255,.55)}
.sub{margin-top:8px;color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.14em}

/* Contenedor glass */
.group{background:rgba(10,16,28,.52);border:1px solid rgba(32,74,120,.55);border-radius:26px;padding:20px;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);box-shadow:0 18px 50px rgba(0,0,0,.55)}
.group-inner{display:grid;gap:18px}

/* Panel tablero */
.panel-board{background:#000;border:1px solid var(--panel-bd);border-radius:20px;padding:18px}

/* Panel controles (códigos+botón) */
.panel-ctrl{background:linear-gradient(180deg,rgba(6,10,18,.78),rgba(8,14,26,.78));border:1px solid var(--panel-bd);border-radius:20px;padding:16px}

/* ====== Caja de códigos estilo otro minijuego ====== */
.codebox{position:relative;background:linear-gradient(180deg,rgba(6,10,18,.78),rgba(8,14,26,.78));border:1px solid #11243f;border-radius:16px;padding:12px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.06),0 10px 26px rgba(0,0,0,.35)}
.codebox::after{content:"";position:absolute;inset:-1px;border-radius:18px;box-shadow:0 0 0 1px rgba(255,255,255,.18),0 0 20px rgba(140,210,255,.22),0 0 34px rgba(120,200,255,.18);pointer-events:none;animation:memNeonPulse 4s ease-in-out infinite}
.input-wrap{position:relative;margin:6px 0}
.hint{position:absolute;left:14px;top:10px;font-size:12px;font-weight:800;color:#a9c6e6;text-shadow:0 0 6px rgba(94,232,255,.25)}
.code-input{width:100%;background:rgba(8,12,22,.9);border:1px solid #1a375e;border-radius:12px;color:#e3f7ff;font-weight:900;letter-spacing:.08em;padding:28px 14px 12px 14px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.04);transition:box-shadow .15s ease,border-color .15s ease,transform .05s ease}
.code-input:focus{outline:none;border-color:#58d8ff;box-shadow:0 0 0 2px rgba(94,232,255,.28),inset 0 0 12px rgba(94,232,255,.12)}

/* ====== Botón CTA con gradiente, halo y sweep ====== */
.btn{display:block;width:100%;margin-top:12px;padding:16px;border-radius:14px;border:0;cursor:pointer;font-size:20px;font-weight:1000;color:#031018;background:linear-gradient(90deg,#6ae5ff,#3c79ff);position:relative;overflow:hidden;box-shadow:0 0 0 2px rgba(255,255,255,.14),0 14px 30px rgba(60,121,255,.35),0 0 18px rgba(94,232,255,.25)}
.btn::before{content:"";position:absolute;inset:0;border-radius:14px;box-shadow:0 0 0 2px rgba(255,255,255,.18),inset 0 0 10px rgba(255,255,255,.10);pointer-events:none}
.btn::after{content:"";position:absolute;top:-30%;bottom:-30%;width:35%;left:-20%;background:linear-gradient(115deg,rgba(255,255,255,0) 0%,rgba(255,255,255,.7) 50%,rgba(255,255,255,0) 100%);transform:skewX(-20deg);filter:blur(8px);animation:memSweep 3.6s ease-in-out infinite;pointer-events:none}
.btn:hover{box-shadow:0 0 0 2px rgba(255,255,255,.2),0 18px 36px rgba(60,121,255,.50),0 0 22px rgba(94,232,255,.40)}
.btn:disabled{opacity:.55;filter:saturate(.7);cursor:not-allowed}

/* Status */
.status{margin-top:10px;text-align:center;font-size:14px;color:var(--muted)}
.success{color:var(--accent)} .error{color:#ff6b6b}

/* ================== Tablero metálico (escopado a #MEM-board) ================== */
#MEM-board{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}

/* Botón metálico */
#MEM-board .mem-cell{position:relative;border-radius:18px;overflow:hidden}
#MEM-board .mem-btn{
  position:relative;width:100%;aspect-ratio:1/1;border-radius:18px;cursor:pointer;overflow:hidden;user-select:none;isolation:isolate;
  border:1px solid rgba(0,0,0,.35) !important;
  background:
    radial-gradient(120% 140% at 50% 35%, rgba(255,255,255,.10) 0%, rgba(255,255,255,0) 55%),
    linear-gradient(160deg,#2b313a 0%,#404957 44%,#616a77 100%) !important;
  box-shadow:0 1px 0 rgba(255,255,255,.05) inset,0 -2px 6px rgba(0,0,0,.45) inset,0 10px 18px rgba(0,0,0,.35),0 1px 0 rgba(255,255,255,.06) !important;
  transition:transform .12s ease, box-shadow .12s ease, filter .12s ease;
  display:grid;place-items:center;
}
#MEM-board .mem-btn:hover{
  filter:brightness(1.04);
  box-shadow:0 1px 0 rgba(255,255,255,.05) inset,0 -2px 6px rgba(0,0,0,.5) inset,0 0 14px rgba(56,189,248,.10),0 0 18px rgba(168,85,247,.10),0 12px 22px rgba(0,0,0,.34) !important;
}
#MEM-board .mem-btn.is-disabled{opacity:.65;pointer-events:none}

/* Grain */
#MEM-board .grain{
  position:absolute;inset:0;border-radius:18px;z-index:0;opacity:.12;
  background-image:url("data:image/svg+xml;utf8, <svg xmlns='http://www.w3.org/2000/svg' width='60' height='60' viewBox='0 0 60 60'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/><feComponentTransfer><feFuncA type='table' tableValues='0 0 .7 0'/></feComponentTransfer></filter><rect width='100%' height='100%' filter='url(%23n)' /></svg>");
  background-size:110px 110px;mix-blend-mode:overlay;
}
#MEM-board .content{position:relative;z-index:2;width:100%;height:100%;display:flex;align-items:center;justify-content:center;text-align:center;padding:6%;border-radius:12px}

/* Chips de premio */
#MEM-board .chip{
  display:flex;align-items:center;justify-content:center;line-height:1;text-align:center;
  height:clamp(30px,24%,44px);max-width:90%;padding:0 clamp(12px,5.2vw,20px);
  border-radius:999px;white-space:nowrap;font-weight:900;font-size:clamp(10px,5.2vw,2px);
  border:1px solid rgba(255,255,255,.85);
  background:linear-gradient(180deg,#ffffff,#e9eef7 78%);color:#0b1220;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.95),inset 0 -2px 8px rgba(0,0,0,.20),0 4px 14px rgba(0,0,0,.28);
  animation:chipPulse 2.6s ease-in-out infinite, chipBlink 1.05s ease-in-out infinite;
}
#MEM-board .chip.blue{background:linear-gradient(180deg,#67e8f9,#0284c7);color:#041c2a;border-color:rgba(56,189,248,.85)}
#MEM-board .chip.gold{background:linear-gradient(180deg,#ffdf6b,#f59e0b);color:#201200;border-color:rgba(234,179,8,.85);box-shadow:0 0 22px rgba(234,179,8,.40),0 8px 20px rgba(0,0,0,.30),inset 0 1px 0 rgba(255,255,255,.65)}

/* Flip 3D */
#MEM-board .mem-inner{position:relative;width:100%;height:100%;transform-style:preserve-3d;transition:transform .5s ease}
#MEM-board .face{position:absolute;inset:0;backface-visibility:hidden;margin:0;padding:0;border-radius:12px}
#MEM-board .face.front{transform:rotateY(0)}
#MEM-board .face.back{transform:rotateY(180deg)}
#MEM-board .mem-cell.flipped .mem-inner{transform:rotateY(180deg)}

/* Frontal: X metálica */
#MEM-board .face.front{display:flex;align-items:center;justify-content:center;color:#c8d1de;font-weight:900;font-size:clamp(22px,4.2vw,36px)}

/* Back overlays por tema */
#MEM-board .face.back::before{content:"";position:absolute;inset:0;border-radius:12px;z-index:1;opacity:0;transition:opacity .28s ease, background .28s ease, box-shadow .28s ease}
#MEM-board .theme-dark .face.back::before{background:#0b0f17;opacity:1;box-shadow:inset 0 0 0 1px rgba(255,255,255,.05), inset 0 -8px 24px rgba(0,0,0,.35)}
#MEM-board .theme-gomi .face.back::before{background:#3a1a6f;opacity:1;box-shadow:inset 0 0 0 1px rgba(255,255,255,.06),0 0 22px rgba(168,85,247,.35)}

/* Revelación micro */
#MEM-board .reveal .mem-inner{animation:revealFlip .45s ease}
@keyframes revealFlip{0%{transform:rotateY(180deg) rotateX(12deg) scale(.96)}100%{transform:rotateY(180deg) rotateX(0deg) scale(1)}}

/* Mezcla visible con jitter */
#MEM-board .jitter{transition:transform .12s ease}

/* Animaciones chips */
@keyframes chipBlink{0%,100%{text-shadow:none;filter:brightness(1)}50%{text-shadow:0 0 10px rgba(255,255,255,.85),0 0 22px rgba(255,255,255,.55);filter:brightness(1.06)}}
@keyframes chipPulse{0%,100%{transform:scale(1);box-shadow:inset 0 1px 0 rgba(255,255,255,.95),inset 0 -2px 8px rgba(0,0,0,.20),0 4px 14px rgba(0,0,0,.28)}50%{transform:scale(1.04);box-shadow:0 0 24px rgba(255,255,255,.35),0 8px 26px rgba(0,0,0,.34)}}

/* Halos de contenedor */
@keyframes memNeonPulse{0%,100%{filter:drop-shadow(0 0 0 rgba(255,255,255,0))}50%{filter:drop-shadow(0 0 14px rgba(255,255,255,.7))}}
@keyframes memSweep{0%{opacity:.0;transform:translateX(-120%) skewX(-20deg)}10%{opacity:.9}60%{opacity:.3}100%{opacity:0;transform:translateX(120%) skewX(-20deg)}}

@media (max-width:480px){
  #MEM-board{gap:12px}
}

  /* ===== GummyBank: Topbar negra, sin bordes, glow blanco pulsante ===== */

  header .gb-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    width: 100%;
    padding: 10px 14px;
    background: #000 !important;
    /* negro real */
    color: #fff !important;
    border-radius: 0 !important;
    /* sin esquinas */
    border: none !important;
    position: relative;
    isolation: isolate;
    z-index: 50;

    /* pulso de luz */
    box-shadow:
      0 0 10px rgba(255, 255, 255, .22),
      0 10px 26px rgba(255, 255, 255, .10);
    animation: gbTopbarGlow 1.6s ease-in-out infinite;
  }

  /* mata cualquier overlay previo que la ensucie */
  header .gb-topbar::before,
  header .gb-topbar::after {
    content: none !important;
  }

  /* marca izquierda */
  header .gb-left .gb-brand {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: #ffffff !important;
    text-decoration: none !important;
    font-weight: 600;
  }

  header .gb-left .gb-brand:visited {
    color: #ffffff !important;
  }

  /* icono IG y textos */
  header .gb-left .bi {
    font-size: 22px;
    color: #ffffff !important;
    text-shadow: 0 0 10px rgba(255, 255, 255, .65);
  }

  header .gb-brand-text {
    color: #ffffff;
  }

  /* acciones derechas */
  header .gb-actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  header .gb-actions .bi {
    font-size: 20px;
    color: #ffffff !important;
    text-shadow: 0 0 10px rgba(255, 255, 255, .65);
    transition: transform .15s ease, text-shadow .15s ease;
  }

  header .gb-actions .bi:hover {
    transform: translateY(-1px);
    text-shadow: 0 0 14px rgba(255, 255, 255, .85);
  }

  /* candado/persona */
  #lock-icon.gb-lock {
    font-size: 20px;
    color: #ffffff !important;
    text-shadow: 0 0 10px rgba(255, 255, 255, .65);
  }
/* Dinero = VERDE */
#MEM-board .chip.money{
  background: linear-gradient(180deg,#34d399,#059669);
  color: #052012;
  border-color: rgba(16,185,129,.85);
  box-shadow: 0 0 18px rgba(16,185,129,.35),
              0 6px 18px rgba(0,0,0,.28),
              inset 0 1px 0 rgba(255,255,255,.65);
  
}
.chip.money{
font-size: clamp(10px, 3vw, 0px) !important;
}
/* Puntos = AZUL */
#MEM-board .chip.points{
  background: linear-gradient(180deg,#60a5fa,#2563eb);
  color: #041325;
  border-color: rgba(59,130,246,.85);
  box-shadow: 0 0 18px rgba(59,130,246,.35),
              0 6px 18px rgba(0,0,0,.28),
              inset 0 1px 0 rgba(255,255,255,.65);
}

  /* animaciones del glow */
  @keyframes gbTopbarGlow {

    0%,
    100% {
      box-shadow:
        0 0 10px rgba(255, 255, 255, .22),
        0 10px 26px rgba(255, 255, 255, .10);
    }

    50% {
      box-shadow:
        0 0 28px rgba(255, 255, 255, .70),
        0 0 40px rgba(255, 255, 255, .28);
    }
  }

  /* responsive suave */
  @media (max-width:420px) {
    header .gb-topbar {
      padding: 8px 12px;
    }

    header .gb-left .bi {
      font-size: 20px;
    }
  }
    /* ====== Colores personalizados para las parejas ====== */
.chip.gomita   { background: linear-gradient(180deg,#f472b6,#ec4899); color:#fff; } /* rosa */
.chip.puntos10 { background: linear-gradient(180deg,#34d399,#059669); color:#fff; } /* verde */
.chip.puntos5  { background: linear-gradient(180deg,#60a5fa,#2563eb); color:#fff; } /* azul */
.chip.puntos3  { background: linear-gradient(180deg,#facc15,#ca8a04); color:#000; } /* amarillo */
.chip.p50      { background: linear-gradient(180deg,#a78bfa,#7c3aed); color:#fff; } /* morado */
/* ===== Paleta por pareja (c0..c7) ===== */
/* Aplica tanto a chips (premios/pts) como al contenedor de gomitas (mm-token) */
#MEM-board .chip.c0, #MEM-board .mm-token.c0 { 
  background: linear-gradient(180deg,#f97316,#ea580c); color:#1f0d02; 
  border-color: rgba(234,88,12,.85); box-shadow: 0 0 18px rgba(234,88,12,.35), 0 6px 18px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.65);
}
#MEM-board .chip.c1, #MEM-board .mm-token.c1 { 
  background: linear-gradient(180deg,#facc15,#ca8a04); color:#201a04; 
  border-color: rgba(202,138,4,.85); box-shadow: 0 0 18px rgba(202,138,4,.35), 0 6px 18px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.65);
}
#MEM-board .chip.c2, #MEM-board .mm-token.c2 { 
  background: linear-gradient(180deg,#34d399,#059669); color:#052012; 
  border-color: rgba(16,185,129,.85); box-shadow: 0 0 18px rgba(16,185,129,.35), 0 6px 18px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.65);
}
#MEM-board .chip.c3, #MEM-board .mm-token.c3 { 
  background: linear-gradient(180deg,#60a5fa,#2563eb); color:#051225; 
  border-color: rgba(59,130,246,.85); box-shadow: 0 0 18px rgba(59,130,246,.35), 0 6px 18px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.65);
}
#MEM-board .chip.c4, #MEM-board .mm-token.c4 { 
  background: linear-gradient(180deg,#a78bfa,#7c3aed); color:#170931; 
  border-color: rgba(124,58,237,.85); box-shadow: 0 0 18px rgba(124,58,237,.35), 0 6px 18px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.65);
}
#MEM-board .chip.c5, #MEM-board .mm-token.c5 { 
  background: linear-gradient(180deg,#f472b6,#ec4899); color:#2a0b1f; 
  border-color: rgba(236,72,153,.85); box-shadow: 0 0 18px rgba(236,72,153,.35), 0 6px 18px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.65);
}
#MEM-board .chip.c6, #MEM-board .mm-token.c6 { 
  background: linear-gradient(180deg,#22d3ee,#0891b2); color:#03181d; 
  border-color: rgba(8,145,178,.85); box-shadow: 0 0 18px rgba(8,145,178,.35), 0 6px 18px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.65);
}
#MEM-board .chip.c7, #MEM-board .mm-token.c7 { 
  background: linear-gradient(180deg,#ef4444,#b91c1c); color:#220505; 
  border-color: rgba(185,28,28,.85); box-shadow: 0 0 18px rgba(185,28,28,.35), 0 6px 18px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.65);
}

/* Ajustes visuales para mm-token (gomitas) para que el color se note */
#MEM-board .mm-token{
  display:flex; align-items:center; justify-content:center;
  width: 88%; height: 78%;
  border-radius: 14px; padding: 8px;
}
#MEM-board .mm-token img.mm-gomy{ width: 68%; height: auto; filter: drop-shadow(0 6px 16px rgba(0,0,0,.35)); }



  </style>
  <div id="mem-modal-ov"></div>
  <div id="mem-modal">
    <h3 class="title">Resultado</h3>
    <p class="msg">Gracias por jugar</p>
    <button id="mem-ok" class="btn">Cerrar</button>
  </div>`;
  document.body.appendChild(wrap);
  const ov = document.getElementById('mem-modal-ov');
  const md = document.getElementById('mem-modal');
  const ok = document.getElementById('mem-ok');
  const close = ()=>{ ov.style.display='none'; md.style.display='none'; };
  ok.addEventListener('click', close);
  ov.addEventListener('click', close);
}
function openMemModal({title, msg}){
  ensureMemModal();
  const ov = document.getElementById('mem-modal-ov');
  const md = document.getElementById('mem-modal');
  md.querySelector('.title').textContent = title || "Fin del intento";
  md.querySelector('.msg').textContent   = msg   || "Gracias por jugar.";
  ov.style.display='block';
  md.style.display='block';
}

/* ===== Render tablero ===== */
function cellHTML(){
  return `
  <button type="button" class="mem-cell mem-btn" style="pointer-events:auto">
    <span class="grain" aria-hidden="true"></span>
    <div class="mem-inner">
      <div class="face front"><div class="content"></div></div>
      <div class="face back"><div class="content"></div></div>
    </div>
  </button>`;
}
function renderBoard(n=16){
  boardEl.innerHTML = "";
  cells = [];
  const frag = document.createDocumentFragment();
  for(let i=0;i<n;i++){
    const wrap = document.createElement("div");
    wrap.innerHTML = cellHTML();
    const btn = wrap.firstElementChild;
    btn._flipped = false;
    btn.addEventListener("click", ()=>onFlip(btn));
    cells.push(btn);
    frag.appendChild(btn);
  }
  boardEl.appendChild(frag);
}

/* ====== DIFICULTAD en el segundo flip ======
   - $1000/$500/$200: NUNCA permitir pareja (si iba a empatar, rompemos el par).
   - $50: solo permitir pareja si unlock50Active === true (1 jugada aleatoria por bloque de 8).
   - Gomitas y Puntos: permitir con baja probabilidad (1 - GUMMY_SABOTAGE).
*/
function coerceSecondIfNeeded(secondCard, firstCard){
  if (!firstCard || !secondCard) return secondCard;

  const wouldMatch = (cardKey(firstCard) === cardKey(secondCard));
  if (!wouldMatch) return secondCard;

  if (secondCard.kind === 'money' || secondCard.kind === 'pts'){
    // Permitidos pero difíciles
    if (Math.random() < GUMMY_SABOTAGE){
      return { ...secondCard, pairId: `${secondCard.pairId}-broken-${Math.random()}` };
    }
    return secondCard; // se permite ganar
  }

  if (secondCard.kind === 'amt'){
    const amount = String(secondCard.txt || '').replace('$','');

    if (amount === '50'){
      // $50 solo si está activo el desbloqueo para esta jugada
      if (unlock50Active) return secondCard;
      return { ...secondCard, pairId: `${secondCard.pairId}-locked50` };
    }

    // $200, $500, $1000 => JAMÁS permitir pareja
    return { ...secondCard, pairId: `${secondCard.pairId}-blocked-high` };
  }

  return secondCard;
}

/* ===== Gameplay ===== */
async function onFlip(cell){
  if(!valid || remaining<=0 || cell._flipped || busy) return;

  if (!firstPick){
    // Primer flip
    revealTile(cell, cell._card);
    firstPick = cell;
    remaining--;
    return;
  }

  // Segundo flip
  cell._card = coerceSecondIfNeeded(cell._card, firstPick._card);
  revealTile(cell, cell._card);
  remaining--;

  busy = true;
  await sleep(120);

  const isMatch = (cardKey(firstPick._card) === cardKey(cell._card));

  if (isMatch){
    // Mensajes claros según lo ganado
    const c = cell._card;
    if (c.kind === 'money'){
      openMemModal({ title:"¡Felicidades, ganaste!", msg:"🎉 Bolsa de gomitas" });
    } else if (c.kind === 'pts'){
      openMemModal({ title:"¡Felicidades, ganaste!", msg:`🎉 ${c.txt}` });
    } else if (c.kind === 'amt' && String(c.txt).includes('50')){
      openMemModal({ title:"¡Felicidades, ganaste!", msg:"🎉 $50" });
    } else {
      // Por diseño nunca deberíamos caer aquí con $200/$500/$1000
      openMemModal({ title:"¡Par encontrado!", msg:"¡Bien jugado!" });
    }
  } else {
    openMemModal({ title:"Sin premio", msg:"Vuelve a intentarlo con otro código." });
  }

  // Termina intento: revela todo para transparencia
  for (const el of cells){ if (!el._flipped) revealTile(el, el._card); }
  valid = false;
  setStatus("Ingresa un nuevo código para volver a jugar.");
  playBtn.disabled = false; codeEl.disabled = false;
  firstPick = null; busy = false;
}

/* ===== Teléfono ===== */
function askPhone(){
  return new Promise((resolve)=>{
    const dlg = document.getElementById("MG-phone");
    const input = document.getElementById("MG-phone-input");
    const ok = document.getElementById("MG-phone-ok");
    const cancel = document.getElementById("MG-phone-cancel") || document.getElementById("MG-phone-close");
    const err = document.getElementById("MG-phone-error");

    if (!dlg || !input || !ok) {
      const tel = window.prompt("Ingresa tu número (8 a 15 dígitos):") || "";
      const clean = tel.replace(/\D+/g,"");
      resolve(clean.length>=8 && clean.length<=15 ? clean : null);
      return;
    }

    dlg.style.display = "grid";
    input.value = "";
    err && (err.textContent = "");
    setTimeout(()=>input.focus(), 50);

    const onOk = ()=>{
      const clean = (input.value||"").replace(/\D+/g,"");
      if (clean.length < 8 || clean.length > 15){
        err && (err.textContent = "Ingresa de 8 a 15 dígitos.");
        return;
      }
      cleanup(); dlg.style.display = "none"; resolve(clean);
    };
    const onCancel = ()=>{ cleanup(); dlg.style.display = "none"; resolve(null); };
    const onEnter = (e)=>{ if (e.key === "Enter") onOk(); };

    function cleanup(){
      ok.removeEventListener("click", onOk);
      cancel && cancel.removeEventListener("click", onCancel);
      input.removeEventListener("keydown", onEnter);
    }

    ok.addEventListener("click", onOk);
    cancel && cancel.addEventListener("click", onCancel);
    input.addEventListener("keydown", onEnter);
  });
}

/* ===== Handlers ===== */
function toggleBtn(){
  const code = (codeEl.value||"").trim().toUpperCase();
  playBtn.disabled = !(code.length===8) || valid;
}
codeEl.addEventListener('input', toggleBtn);

playBtn.addEventListener('click', async ()=>{
  if (valid) return;
  const code = (codeEl.value||"").trim().toUpperCase();

  if (code.length !== 8){
    setStatus("El código debe tener 8 caracteres.", "error");
    return;
  }

  try{
    playBtn.disabled = true; codeEl.disabled = true;
    setStatus("Validando código…");

    const st = await checkCode(code);
    if (!st.ok){
      setStatus(st.reason==="NO_EXISTE" ? "El código no existe." : "Ese código ya fue usado.", "error");
      playBtn.disabled = false; codeEl.disabled = false;
      return;
    }

    const tel = await askPhone();
    if (!tel){
      setStatus("Operación cancelada.", "error");
      playBtn.disabled = false; codeEl.disabled = false;
      return;
    }

    setStatus("Registrando jugada…");
    const { unlock50 } = await consumeCode(code, tel);
    unlock50Active = !!unlock50;

    setStatus(unlock50Active
      ? "Código validado. ¡Esta ronda podría ganar $50! Mezclando…"
      : "Código validado. Mezclando…", "success");

    // Tablero real
    cells.forEach(coverTile);
    await sleep(250);
    cards = buildDeck();
    attachDeckToCells(cards, false);
    reorderAllCells();

    valid = true;
    remaining = 2;
    firstPick = null;
    setStatus("¡Listo! Tienes 2 tiros.");
  }catch(err){
    console.error(err);
    const msg = String(err?.message||err);
    if (msg.includes("NO_EXISTE")){
      setStatus("El código no existe.", "error");
    }else if (msg.includes("EN_USO")){
      setStatus("Ese código ya fue usado.", "error");
    }else{
      setStatus("No se pudo validar. Intenta de nuevo.", "error");
    }
    playBtn.disabled = false; codeEl.disabled = false;
  }
});

toggleBtn();
showPreview();
ensureMemModal();
