// js/mines.game.js — 5x6, “Jackpot” arriba con monto, leyenda sin monto,
// jackpot sube $25 por tirada, fila 4 y 5 siempre explotan,
// “desbloqueo” visual: gomitas cada 10 y jackpot a las 500.
// IIFE async al final para correr sin type="module".

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, runTransaction } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

/* ================= Firebase ================= */
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

/* ================= Config del juego ================= */
const ROWS = 5;
const COLS = 6;
const MINES_PER_ROW = 2;
const PREVIEW_SHOW_ICONS = true;

/* ================= Reglas de bloqueo/forzado ================= */
const JACKPOT_START = 500;
const JACKPOT_INC   = 25;
const JACKPOT_UNLOCK_AT = 500;   // solo visual

const GOMI_UNLOCK_EVERY = 10;    // solo visual

// Imposibles:
const FORCE_BOMB_ON_ROW4 = true; // nunca ganan gomitas
const FORCE_BOMB_ON_ROW5 = true; // nunca ganan jackpot

/* ================= Estado jackpot y desbloqueos ================= */
let jackpotValue = JACKPOT_START;
let unlockJackpotActive = false;
let unlockGomiActive    = false;

/* ================= Premios (leyenda) ================= */
// El paso 5 SOLO dice "Jackpot" (sin monto). El monto va arriba en el título.
const PRIZES = [
  { step:1, type:"pts",     label:"+1 punto",   payload:{ points:1 } },
  { step:2, type:"pts",     label:"+3 puntos",  payload:{ points:3 } },
  { step:3, type:"pts",     label:"+10 puntos", payload:{ points:10 } },
  { step:4, type:"gomi",    label:"+1 gomitas", payload:{ gomitas:1 } },
  { step:5, type:"jackpot", label:"Jackpot",    payload:()=>({ cash: jackpotValue }) }
];

/* ================= POPUPS (limpios) ================= */
const POPUP_CSS = `
.mx-pop{position:fixed;inset:0;display:none;place-items:center;z-index:9999}
.mx-pop.show{display:grid}
.mx-pop::before{content:"";position:absolute;inset:0;background:rgba(10,14,20,.55);backdrop-filter:blur(2px)}
.mx-pop .mx-dialog{position:relative;z-index:1;width:min(92vw,440px);border-radius:16px;padding:16px 16px 18px;background:#0e141b;border:1px solid rgba(255,255,255,.08);color:#e7ecf3;animation:mxPopIn .18s ease-out;box-shadow:none!important}
@keyframes mxPopIn{from{transform:scale(.96);opacity:.7}to{transform:scale(1);opacity:1}}
.mx-pop .mx-title{display:flex;align-items:center;justify-content:space-between;font-weight:900;font-size:18px;margin:0 0 12px 0}
.mx-pop .mx-badge{padding:.34em .8em;border-radius:999px;border:1px solid rgba(255,255,255,.6);background:#fff;color:#0b1220;font-weight:900;font-size:12px}
.mx-pop .mx-sub{color:#9fb0c9;font-size:13px;margin:0 0 14px}
.mx-pop .mx-actions{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:4px}
@media(max-width:380px){.mx-pop .mx-actions{grid-template-columns:1fr}}
.mx-pop .mx-btn{width:100%;padding:12px;border-radius:12px;font-weight:900;cursor:pointer;border:1px solid rgba(255,255,255,.18);background:#1f2937;color:#e5eefb}
.mx-pop .mx-btn.mx-cta{background:#f5c542;color:#2b1e00;border:1px solid #d9a3000e}
.mx-pop .mx-close{position:absolute;top:10px;right:12px;background:transparent;border:0;color:#a8b5c9;font-size:18px;cursor:pointer}
.mx-pop .mx-close:hover{color:#fff}
`;
function ensurePopupHost(){
  if (!document.getElementById("mx-pop-css")){
    const st=document.createElement("style"); st.id="mx-pop-css"; st.textContent=POPUP_CSS; document.head.appendChild(st);
  }
  let host=document.getElementById("mx-pop-host");
  if (!host){ host=document.createElement("div"); host.id="mx-pop-host"; document.body.appendChild(host); }
  return host;
}
function showPopup({ title, badge=null, sub=null, ctaText="Cerrar", onCta=null, extraBtn=null }){
  const host=ensurePopupHost();
  const wrap=document.createElement("div");
  wrap.className="mx-pop show";
  wrap.innerHTML=`
    <div class="mx-dialog">
      <button class="mx-close" aria-label="Cerrar">×</button>
      <div class="mx-title">
        <span>${title}</span>
        ${badge?`<span class="mx-badge">${badge}</span>`:""}
      </div>
      ${sub?`<div class="mx-sub">${sub}</div>`:""}
      <div class="mx-actions">
        ${extraBtn?`<button class="mx-btn" data-extra>${extraBtn.text}</button>`:""}
        <button class="mx-btn mx-cta" data-cta>${ctaText}</button>
      </div>
    </div>`;
  host.appendChild(wrap);
  const close=()=>wrap.remove();
  wrap.addEventListener("click",e=>{ if(e.target===wrap) close(); });
  wrap.querySelector(".mx-close").addEventListener("click",close);
  wrap.querySelector("[data-cta]").addEventListener("click",()=>{onCta&&onCta();close();});
  if(extraBtn){ wrap.querySelector("[data-extra]")?.addEventListener("click",()=>{ extraBtn.onClick&&extraBtn.onClick(); close(); }); }
}
const captureHintText = (extra="") => `¡Felicidades! ${extra} `;
function showStepPopup(step,label){
  const sub = `${captureHintText(`Superaste el paso ${step}.`)} Puedes continuar o retirarte cuando prefieras.`;
  showPopup({
    title:`Paso ${step} superado`,
    badge: typeof label==="function" ? label() : label,
    sub,
    ctaText:"Seguir jugando",
    extraBtn:{ text:"Retirarme", onClick:()=>{ if(bestStep>0) endGame("cashout",{silentPopup:true}); } }
  });
}
function showFinalPopup(finalPrize,reason){
  if(reason==="mina"){
    showPopup({title:"Mina activada",badge:"Sin premio",sub:"Ni modo. Intenta de nuevo.",ctaText:"Cerrar"});
    return;
  }
  const label = finalPrize ? (typeof finalPrize.label==="function"?finalPrize.label():finalPrize.label) : "Sin premio";
  const ttl   = reason==="completo"?"¡Te retiraste!":"¡Felicidades! Ganaste";
  const extra = reason==="completo" ? "" : "Toma una Captura y mandala a la pagina de Instagram  y reclama tu ";
  const sub = finalPrize ? captureHintText(`${extra} Premio: <b>${label}</b>.`) : "Cosas que pasan.";
  showPopup({title:ttl,badge:label,sub,ctaText:"Cerrar"});
}

/* ================= Timing ================= */
let lastRevealAt=0, stepTimer=null, finalTimer=null;
const cancelTimers=()=>{ if(stepTimer){clearTimeout(stepTimer);stepTimer=null;} if(finalTimer){clearTimeout(finalTimer);finalTimer=null;} };
const afterReveal=(ms,cb)=> setTimeout(cb, Math.max(0, ms - (Date.now()-lastRevealAt)));

/* ================= BD ================= */
async function checkCode(code){
  const ref = doc(db, "codigos", code);
  const sp = await getDoc(ref);
  if (!sp.exists()) return { ok:false, reason:"NO_EXISTE" };
  if ((sp.data()?.estado||"").toLowerCase()==="usado") return { ok:false, reason:"EN_USO" };
  return { ok:true };
}

// Marca código y actualiza contadores. NO otorga nada.
// Devuelve flags de desbloqueo únicamente.
async function consumeCodeForMines(code, phone){
  const ref = doc(db, "codigos", code);
  await updateDoc(ref, { estado:"usado", telefono:phone, juego:"MINES", usadoEn:new Date().toISOString() })
  .catch(async e=>{ const re=await getDoc(ref); if(!re.exists()) throw new Error("NO_EXISTE"); throw e; });

  const countersRef = doc(db, "minas_meta", "counters");
  const { total, pick, idxInBlock, jackpot } = await runTransaction(db, async tx=>{
    const sp = await tx.get(countersRef);
    let total=0, pick=1, pickBlock=-1, jackpot=JACKPOT_START;
    if (sp.exists()){
      const d=sp.data();
      total   = Number(d.total||0);
      pick    = Number(d.pick||1);
      pickBlock = Number(d.pickBlock??-1);
      jackpot = Number(d.jackpot||JACKPOT_START);
    }
    total += 1;

    // legado por bloques de 8 (lo mantengo por si lo usas en analítica)
    const blockIndex = Math.floor((total-1)/8);
    const idxInBlock = ((total-1)%8)+1;
    if (pickBlock!==blockIndex){
      pick = ((Math.random()*8)|0)+1;
      pickBlock = blockIndex;
    }

    // Jackpot sube cada tirada
    jackpot = jackpot + JACKPOT_INC;

    tx.set(countersRef, { total, pick, pickBlock, jackpot }, { merge:true });
    return { total, pick, idxInBlock, jackpot };
  });

  jackpotValue = jackpot;

  // Flags visuales de desbloqueo
  unlockJackpotActive = ( (await getDoc(doc(db,"minas_meta","counters")) ).data()?.total || 0 ) >= JACKPOT_UNLOCK_AT;
  unlockGomiActive    = ( (await getDoc(doc(db,"minas_meta","counters")) ).data()?.total || 0 ) % GOMI_UNLOCK_EVERY === 0;

  return { totalMeta: { total: undefined, pick, idxInBlock, jackpot } };
}

// Carga/Inicializa counters
async function loadCounters(){
  const countersRef = doc(db, "minas_meta", "counters");
  const sp = await getDoc(countersRef);
  if (sp.exists()){
    const d = sp.data();
    jackpotValue = typeof d.jackpot === "number" ? d.jackpot : JACKPOT_START;
    const total  = Number(d.total||0);
    unlockJackpotActive = total >= JACKPOT_UNLOCK_AT;
    unlockGomiActive    = (total % GOMI_UNLOCK_EVERY) === 0;
  } else {
    await setDoc(countersRef, { total:0, pick:1, pickBlock:-1, jackpot:JACKPOT_START }, { merge:true });
    jackpotValue = JACKPOT_START;
    unlockJackpotActive = false;
    unlockGomiActive    = false;
  }
}

/* ================= UI refs ================= */
const $ = s=>document.querySelector(s);
const statusEl = $("#mx-status");
const boardEl  = $("#MX-board");
const legendEl = $("#mx-legend");
const codeEl   = $("#mx-code");
const playBtn  = $("#mx-play");
const cashBtn  = $("#mx-cashout");
const setStatus = t => statusEl && (statusEl.textContent=t);

// Título superior: "Jackpot $XXXX"
function setGameHeader(){
  const n =
    document.querySelector("[data-game-title]") ||
    document.querySelector(".mx-game-title") ||
    document.querySelector(".mx-mines h1") ||
    document.querySelector("h1");
  if (n) n.textContent = `Jackpot $${jackpotValue}`;
}

// Leyenda de premios (paso 5 solo “Jackpot”)
function renderLegend(){
  if (!legendEl) return;
  legendEl.style.setProperty("--rows", ROWS);
  legendEl.innerHTML = "";
  PRIZES.forEach(p=>{
    const div=document.createElement("div");
    div.className="mx-step";
    div.textContent = typeof p.label==="function" ? p.label() : p.label;
    // Marcadores de "desbloqueo" visuales
    if (p.type==="jackpot" && !unlockJackpotActive) div.classList.add("locked");
    if (p.type==="gomi"    && !unlockGomiActive)    div.classList.add("locked");
    legendEl.appendChild(div);
  });
}
function updateJackpotUI(){ setGameHeader(); renderLegend(); }

/* ================= Estado del juego ================= */
let activeRow=0, bestStep=0;
let grid=[];

/* ================= Tablero ================= */
function makeCell(r,c){
  const el=document.createElement("button");
  el.type="button"; el.className="mx-cell"; el.disabled=true;
  el.dataset.row=r; el.dataset.col=c;
  el.addEventListener("click", onCellClick);
  return el;
}
function buildBoard({ preview=false } = {}){
  boardEl.style.setProperty("--cols", COLS);
  boardEl.style.setProperty("--rows", ROWS);
  boardEl.innerHTML=""; 
  grid=[];

  const root = document.querySelector(".mx-mines");
  root?.classList.toggle("mx-preview", preview);

  for (let r=1; r<=ROWS; r++){
    const mines = new Set();
    while (mines.size < Math.min(MINES_PER_ROW, COLS)){
      mines.add(1 + ((Math.random()*COLS)|0));
    }
    for (let c=1; c<=COLS; c++){
      const el = makeCell(r,c);
      boardEl.appendChild(el);
      const isMineReal = mines.has(c);

      if (preview){
        if (PREVIEW_SHOW_ICONS) el.classList.add(isMineReal ? "mine" : "gift");
        el.disabled = true;
      } else {
        grid.push({ row:r, col:c, isMine:isMineReal, el, revealed:false });
      }
    }
  }

  bestStep = 0;
  activeRow = preview ? 0 : 1;

  if (!preview){ activateRow(1); root?.classList.add("mx-ready"); }
  else root?.classList.remove("mx-ready");

  renderLegend();
}
function activateRow(r){
  grid.forEach(t=>{
    t.el.classList.remove("active","chosen");
    if(t.row===r){ t.el.disabled=false; t.el.classList.add("active"); }
    else t.el.disabled=true;
  });
}
function revealRow(r, { clicked=null, exploded=false } = {}){
  grid.forEach(t=>{
    if(t.row!==r) return;
    if(clicked && t===clicked){
      if(exploded){ t.el.classList.add("boom","mine"); }
      else{ t.el.classList.add("good","chosen","gift"); }
    }else{
      if(t.isMine) t.el.classList.add("mine");
      else t.el.classList.add("gift");
    }
    t.el.disabled=true;
    t.revealed=true;
  });
}

/* ================= Juego ================= */
async function onCellClick(e){
  const el=e.currentTarget;
  const r=Number(el.dataset.row);
  const cell=grid.find(t=>t.row===r && t.el===el);
  if(!cell || cell.revealed || r!==activeRow) return;

  // Imposibles: fila 4 y 5
  if ((FORCE_BOMB_ON_ROW4 && r===4) || (FORCE_BOMB_ON_ROW5 && r===5)){
    cell.isMine = true;
  }

  cell.revealed = true;

  if(cell.isMine){
    revealRow(r, { clicked:cell, exploded:true });
    lastRevealAt = Date.now();
    endGame("mina", { silentPopup:true });
    return;
  }

  revealRow(r, { clicked:cell, exploded:false });
  bestStep = Math.max(bestStep, r);
  if (cashBtn) cashBtn.disabled = bestStep<1;

  lastRevealAt = Date.now();

  if (r === ROWS){
    cancelTimers();
    endGame("completo", { silentPopup:true });
    return;
  }

  activeRow = r + 1;
  activateRow(activeRow);
  setStatus(`Paso ${r} superado. Siguiente: ${PRIZES[r]?.label||""}`);

  cancelTimers();
  const stepPrize = PRIZES[bestStep-1];
  stepTimer = afterReveal(1500, ()=>{
    if (activeRow === r+1) showStepPopup(bestStep, stepPrize?.label || "");
  });
}

/* ================= Premio final / Fin ================= */
function computeFinalPrize(){
  if(bestStep<=0) return null;
  let p = PRIZES[bestStep-1];
  if (!p) return null;

  // Bloqueos visuales: si no está desbloqueado, degrada al anterior
  if (p.type==="gomi"    && !unlockGomiActive)    p = PRIZES[bestStep-2] || null;
  if (p.type==="jackpot" && !unlockJackpotActive) p = PRIZES[bestStep-2] || null;

  if (!p) return null;
  return {
    step: p.step,
    type: p.type,
    label: typeof p.label==="function" ? p.label() : p.label,
    payload: typeof p.payload==="function" ? p.payload() : p.payload
  };
}
async function endGame(reason, { silentPopup=false } = {}){
  grid.forEach(t=>t.el.disabled=true);
  document.querySelector(".mx-mines")?.classList.remove("mx-ready");
  if (cashBtn) cashBtn.disabled = true;

  const finalPrize = computeFinalPrize();
  const msg = finalPrize ? `Tu premio: ${finalPrize.label}` : "Sin premio esta vez";
  setStatus(
    reason==="completo" ? `¡Tablero completo! ${msg}` :
    reason==="cashout"  ? `Te retiraste. ${msg}` :
                          `Boom. ${msg}`
  );

  cancelTimers();
  if (!silentPopup) showFinalPopup(finalPrize, reason);
  else finalTimer = afterReveal(2000, ()=> showFinalPopup(finalPrize, reason));

  try{
    const code=(codeEl?.value||"").trim().toUpperCase();
    const dref=doc(collection(db,"mines_plays"));
    await setDoc(dref,{
      ts:new Date().toISOString(),
      code,
      bestStep,
      reason,
      jackpotValueAtPlay: jackpotValue,
      unlockJackpotActive,
      unlockGomiActive,
      prize: finalPrize ? {
        step: finalPrize.step,
        type: finalPrize.type,
        label: finalPrize.label,
        payload: finalPrize.payload
      } : null
    });
  }catch(_){}
}

/* ================= Entradas ================= */
function toggleBtn(){
  const code=(codeEl?.value||"").trim().toUpperCase();
  if (playBtn) playBtn.disabled = (code.length!==8);
}
codeEl?.addEventListener("input", toggleBtn);

playBtn?.addEventListener("click", async ()=>{
  const code=(codeEl?.value||"").trim().toUpperCase();
  if(code.length!==8) return;

  try{
    playBtn.disabled=true; codeEl.disabled=true;
    setStatus("Validando código…");
    const st=await checkCode(code);
    if(!st.ok){ setStatus(st.reason==="NO_EXISTE"?"El código no existe.":"Ese código ya fue usado."); resetInputs(); return; }

    const tel=await askPhone();
    if(!tel){ setStatus("Operación cancelada."); resetInputs(); return; }

    setStatus("Registrando…");
    await consumeCodeForMines(code, tel); // actualiza jackpotValue y flags

    updateJackpotUI(); // título con monto y leyenda con locks
    setStatus("Preparando tablero…");
    flipAllOnce();
    setTimeout(()=>shuffleChildren(boardEl),180);
    setTimeout(()=>{
      buildBoard({ preview:false });
      setStatus("Elige una casilla de la fila 1");
    },420);
  }catch(_){
    setStatus("No se pudo validar. Intenta otra vez.");
    resetInputs();
  }
});

cashBtn?.addEventListener("click", ()=>{
  if(bestStep>0){
    lastRevealAt = Date.now();
    cancelTimers();
    endGame("cashout", { silentPopup:true });
  }
});
function resetInputs(){ if(playBtn) playBtn.disabled=false; if(codeEl) codeEl.disabled=false; }

/* ================= Teléfono ================= */
function askPhone(){
  return new Promise((resolve)=>{
    const dlg=$("#MG-phone"), input=$("#MG-phone-input"), ok=$("#MG-phone-ok"),
          cancel=$("#MG-phone-cancel"), err=$("#MG-phone-error");
    if(!dlg||!input||!ok){
      const tel=window.prompt("Ingresa tu número (8 a 15 dígitos):")||"";
      const clean=tel.replace(/\D+/g,"");
      resolve(clean.length>=8 && clean.length<=15 ? clean : null); return;
    }
    dlg.style.display="grid"; input.value=""; if(err) err.textContent="";
    setTimeout(()=>input.focus(),30);
    const onOk=()=>{ const clean=(input.value||"").replace(/\D+/g,"");
      if(clean.length<8||clean.length>15){ if(err) err.textContent="Ingresa de 8 a 15 dígitos."; return; }
      cleanup(); dlg.style.display="none"; resolve(clean);
    };
    const onCancel=()=>{ cleanup(); dlg.style.display="none"; resolve(null); };
    function cleanup(){ ok.removeEventListener("click",onOk); cancel&&cancel.removeEventListener("click",onCancel); }
    ok.addEventListener("click",onOk); cancel&&cancel.addEventListener("click",onCancel);
  });
}

/* ================= Utilidades visuales ================= */
function flipAllOnce(){ grid.forEach(t=>{ t.el.classList.add("shuffle"); setTimeout(()=>t.el.classList.remove("shuffle"), 480); }); }
function shuffleChildren(node){ const children=[...node.children]; for(let i=children.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; node.insertBefore(children[j], children[i]); } }

/* ================= Arranque (IIFE async) ================= */
(async function init(){
  try{
    ensurePopupHost();
    await loadCounters();
    updateJackpotUI();
    buildBoard({ preview:true });
    renderLegend();
    toggleBtn();
    setStatus("Valida tu código para jugar");
  }catch(e){ console.error("Init error:", e); }
})();
