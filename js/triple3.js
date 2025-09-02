// ============ TRIPLE 3 (look 5x5) · JS ESM ============
// Requiere firebaseClient.js exportando `db`
import { db } from "./firebaseClient.js";
import {
  doc, getDoc, runTransaction, serverTimestamp,
  collection, setDoc
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

/* ======================= Config ======================= */
const CFG = {
  codesCol: "codigos",
  playsCol: "triple3_plays",
  metaDocPath: "triple3_meta/counters",
  gameTag: "Triple3",
  igUrl: (window.IG_URL || "https://instagram.com/tu_pagina"),

  // Imágenes
  IMG_HIDDEN: "img/casilla-oculta.png",
  IMG_GOMI:   "img/gomitas.jpg",

  // Preview antes de validar
  preview: ["$300","10pts","Gomitas"],

  // Duraciones / tiempos
  mixMs: 2200,         // mezcla visible (>=2s)
  revealDelayMs: 300,  // micro-pausa tras el click antes de revelar
  revealGapMs: 260,    // separación entre revelaciones
  modalAfterMs: 420    // espera final antes de abrir el modal
};

/* ======================= Helpers ======================= */
const $ = id => document.getElementById(id);
const keyToLabel = k => (k==="P300"?"$300":k==="GOMI"?"Gomitas":"10pts");
function shuffleInPlace(arr){ for(let i=arr.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [arr[i],arr[j]]=[arr[j],arr[i]]; } }
const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));

/* ===== Halos de preview (solo en estado frontal) ===== */
function tagPreview(cell, label){
  cell.classList.remove('tri-prev-gold','tri-prev-blue','tri-prev-purple');
  if(label === '$300')      cell.classList.add('tri-prev-gold');
  else if(label === '10pts')cell.classList.add('tri-prev-blue');
  else                      cell.classList.add('tri-prev-purple');
}

/* ======================= CSS INYECTADO (escopado a #TRI-board) ======================= */
(function injectCSS(){
  const ID = "TRI-metal-css";
  if (document.getElementById(ID)) return;
  const css = `
/* ========== Botón metálico ========== */
#TRI-board .tri-cell{ position:relative; border-radius:18px; overflow:hidden; }
#TRI-board .tri-btn{
  position:relative; width:100%; aspect-ratio:1/1; border-radius:18px;
  cursor:pointer; overflow:hidden; user-select:none; isolation:isolate;
  border:1px solid rgba(0,0,0,.35) !important;
  background:
    radial-gradient(120% 140% at 50% 35%, rgba(255,255,255,.10) 0%, rgba(255,255,255,0) 55%),
    linear-gradient(160deg, #2b313a 0%, #404957 44%, #616a77 100%) !important;
  box-shadow:
    0 1px 0 rgba(255,255,255,.05) inset,
    0 -2px 6px rgba(0,0,0,.45) inset,
    0 10px 18px rgba(0,0,0,.35),
    0 1px 0 rgba(255,255,255,.06) !important;
  transition: transform .12s ease, box-shadow .12s ease, filter .12s ease;
  display:grid; place-items:center;
}
#TRI-board .tri-btn:hover{
  filter:brightness(1.04);
  box-shadow:
    0 1px 0 rgba(255,255,255,.05) inset,
    0 -2px 6px rgba(0,0,0,.5) inset,
    0 0 14px rgba(56,189,248,.10),
    0 0 18px rgba(168,85,247,.10),
    0 12px 22px rgba(0,0,0,.34) !important;
}
#TRI-board .tri-btn.is-disabled{ opacity:.65; pointer-events:none; }

#TRI-board .tri-btn .grain{
  position:absolute; inset:0; border-radius:18px; z-index:0; opacity:.12;
  background-image:url("data:image/svg+xml;utf8, <svg xmlns='http://www.w3.org/2000/svg' width='60' height='60' viewBox='0 0 60 60'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/><feComponentTransfer><feFuncA type='table' tableValues='0 0 .7 0'/></feComponentTransfer></filter><rect width='100%' height='100%' filter='url(%23n)' /></svg>");
  background-size:110px 110px; mix-blend-mode:overlay;
}
#TRI-board .tri-btn .content{
  position:relative; z-index:2; width:100%; height:100%;
  display:flex; align-items:center; justify-content:center; text-align:center;
  padding: 6%; border-radius:12px;
}

/* Contenido imagen a cover */
#TRI-board .tri-btn .content img{
  display:block; width:100%; height:100%; object-fit:cover; border-radius:12px;
}

/* ========== Pills (dinero y puntos) ========== */
#TRI-board .tri-chip{
  display:flex; align-items:center; justify-content:center; line-height:1; text-align:center;
  height: var(--tri-chip-h, clamp(30px, 24%, 44px));
  max-width: 90%;
  padding: 0 var(--tri-chip-pad-x, clamp(12px, 5.2vw, 20px));
  border-radius:999px; white-space:nowrap; font-weight:900;
  font-size: var(--tri-chip-fz, clamp(14px, 5.2vw, 22px));
  border:1px solid rgba(255,255,255,.85);
  background: linear-gradient(180deg, #ffffff, #e9eef7 78%);
  color:#0b1220;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.95), inset 0 -2px 8px rgba(0,0,0,.20), 0 4px 14px rgba(0,0,0,.28);
  animation: triPulse 2.6s ease-in-out infinite, triBlinkText 1.05s ease-in-out infinite;
}
#TRI-board .tri-chip.blue{
  background: linear-gradient(180deg, #67e8f9, #0284c7);
  color:#041c2a; border-color: rgba(56,189,248,.85);
}
#TRI-board .tri-chip.gold{
  background: linear-gradient(180deg, #ffdf6b, #f59e0b);
  color:#201200; border-color: rgba(234,179,8,.85);
  box-shadow: 0 0 22px rgba(234,179,8,.40), 0 8px 20px rgba(0,0,0,.30), inset 0 1px 0 rgba(255,255,255,.65);
}

/* Parpadeo suave del texto */
@keyframes triBlinkText{
  0%,100%{ text-shadow: none; filter:brightness(1) }
  50%{ text-shadow: 0 0 10px rgba(255,255,255,.85), 0 0 22px rgba(255,255,255,.55); filter:brightness(1.06) }
}
@keyframes triPulse{
  0%,100%{ transform: scale(1); box-shadow: inset 0 1px 0 rgba(255,255,255,.95), inset 0 -2px 8px rgba(0,0,0,.20), 0 4px 14px rgba(0,0,0,.28); }
  50%    { transform: scale(1.04); box-shadow: 0 0 24px rgba(255,255,255,.35), 0 8px 26px rgba(0,0,0,.34); }
}

/* ========== Flip 3D ========== */
#TRI-board .tri-inner{ position:relative; width:100%; height:100%; transform-style:preserve-3d; transition: transform .5s ease; }
#TRI-board .tri-face{ position:absolute; inset:0; backface-visibility:hidden; margin:0; padding:0; }
#TRI-board .tri-face.front{ transform: rotateY(0); }
#TRI-board .tri-face.back{ transform: rotateY(180deg); }
#TRI-board .tri-cell.flipped .tri-inner{ transform: rotateY(180deg); }

/* Overlays al revelar (negro o morado) */
#TRI-board .tri-face.back::before{
  content:""; position:absolute; inset:0; border-radius:12px; z-index:1; opacity:0;
  transition: opacity .28s ease, background .28s ease, box-shadow .28s ease;
}
#TRI-board .tri-theme-dark .tri-face.back::before{
  background:#0b0f17; opacity:1;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.05), inset 0 -8px 24px rgba(0,0,0,.35);
}
#TRI-board .tri-theme-gomi .tri-face.back::before{
  background:#3a1a6f; opacity:1;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.06), 0 0 22px rgba(168,85,247,.35);
}

/* Micro animación de revelación */
#TRI-board .tri-reveal .tri-inner{ animation: triRevealFlip .45s ease; }
@keyframes triRevealFlip{
  0%{ transform: rotateY(180deg) rotateX(12deg) scale(.96); }
  100%{ transform: rotateY(180deg) rotateX(0deg) scale(1); }
}

/* ========== “Knobs” para tamaños rápidos ========== */
#TRI-board{
  --tri-chip-h: clamp(30px, 24%, 44px);
  --tri-chip-fz: clamp(14px, 5.2vw, 22px);
  --tri-chip-pad-x: clamp(12px, 5.2vw, 20px);
  --tri-gomi-scale: 1.12;
}
#TRI-board .tri-btn .content{ padding: 6% !important; }

/* Gomitas grandes pero contenidas */
#TRI-board .tri-btn .content img[alt="Gomitas"]{
  width: 100% !important; height: 100% !important; object-fit: contain !important;
  transform: scale(var(--tri-gomi-scale)); transform-origin:center;
  filter: drop-shadow(0 10px 24px rgba(0,0,0,.40)) drop-shadow(0 0 22px rgba(168,85,247,.20));
}

/* Halos del preview */
#TRI-board .tri-prev-gold .tri-face.front{ box-shadow: 0 0 0 1px rgba(255,255,255,.18) inset, 0 0 18px rgba(255,215,0,.20), 0 14px 30px rgba(0,0,0,.35); }
#TRI-board .tri-prev-blue .tri-face.front{ box-shadow: 0 0 0 1px rgba(255,255,255,.18) inset, 0 0 18px rgba(56,189,248,.20), 0 14px 30px rgba(0,0,0,.35); }
#TRI-board .tri-prev-purple .tri-face.front{ box-shadow: 0 0 0 1px rgba(255,255,255,.18) inset, 0 0 20px rgba(168,85,247,.22), 0 14px 30px rgba(0,0,0,.35); }

/* Mezcla con jitter SOLO en el tablero */
#TRI-board .tri-jitter{ transition: transform .12s ease; }

@media (max-width: 420px){
  #TRI-board{
    --tri-chip-h: clamp(28px, 22%, 40px);
    --tri-chip-fz: clamp(13px, 4.8vw, 20px);
    --tri-gomi-scale: 1.08;
  }
}
`;
  const s = document.createElement("style");
  s.id = ID;
  s.textContent = css;
  document.head.appendChild(s);
})();

/* ======================= DOM refs ======================= */
const board     = $("TRI-board");
const btnPlay   = $("tri-play");
const input1    = $("tri-code1");
const input2    = $("tri-code2");
const input3    = $("tri-code3");

const modal       = $("tri-modal");
const modalTitle  = $("tri-modal-title");
const modalResult = $("tri-result");
const btnOk       = $("tri-ok");
const btnAgain    = $("tri-again");
const btnClose    = $("tri-close");

const phoneDlg   = $("tri-phone");
const phoneInput = $("tri-phone-input");
const phoneOk    = $("tri-phone-ok");
const phoneClose = $("tri-phone-close");

/* ======================= Estado ======================= */
let activeCells = [];      // botones en orden DOM
let currentMapping = null; // ["P300","P10","GOMI"] respecto a activeCells
let unlocked = false;
let roundReady = false;
let validatedCodes = null;
let phoneNumber = null;
let justPlayedId = null;

/* ======================= Construcción de casillas ======================= */
function setHidden(contentEl){
  contentEl.innerHTML = `<img src="${CFG.IMG_HIDDEN}" alt="Oculto">`;
}
function setPrize(contentEl, label){
  if(label === "Gomitas"){
    contentEl.innerHTML = `<img src="${CFG.IMG_GOMI}" alt="Gomitas">`;
  }else if(label === "10pts"){
    contentEl.innerHTML = `<span class="tri-chip blue">10 pts</span>`;
  }else{
    // $300 -> dorado
    contentEl.innerHTML = `<span class="tri-chip gold">$300</span>`;
  }
}
function setFace(faceContentEl, label){ setPrize(faceContentEl, label); }

function makeButton(i){
  const cell = document.createElement("button");
  cell.type = "button";
  cell.className = "tri-cell tri-btn";
  cell.innerHTML = `
    <span class="grain" aria-hidden="true"></span>
    <div class="tri-inner">
      <div class="tri-face front"><div class="content"></div></div>
      <div class="tri-face back"><div class="content"></div></div>
    </div>
  `;
  const label = CFG.preview[i] || "10pts";
  setFace(cell.querySelector(".front .content"), label);
  tagPreview(cell, label);
  setHidden(cell.querySelector(".back .content"));
  cell.addEventListener("click", () => onPick(cell));
  return cell;
}

function resetBoard(){
  if(!board) return;
  board.innerHTML = "";
  activeCells.length = 0;
  for(let i=0;i<3;i++){
    const b = makeButton(i);
    b.disabled = true;
    board.appendChild(b);
    activeCells.push(b);
  }
  currentMapping = null;
  roundReady = false;
}
resetBoard();

/* ======================= Mezcla ======================= */
function reorderKeepMapping(){
  const pair = activeCells.map((el,i)=>({el, key: currentMapping? currentMapping[i] : null}));
  shuffleInPlace(pair);
  board.innerHTML = "";
  activeCells = [];
  const newMap = [];
  for(const p of pair){
    board.appendChild(p.el);
    activeCells.push(p.el);
    if(currentMapping) newMap.push(p.key);
  }
  if(currentMapping) currentMapping = newMap;
}
async function mixFor(ms){
  const end = performance.now() + ms;
  while(performance.now() < end){
    activeCells.forEach(c=>{
      c.classList.add("tri-jitter");
      const tx=(Math.random()-0.5)*18, ty=(Math.random()-0.5)*18, r=(Math.random()-0.5)*8;
      c.style.transform=`translate(${tx}px,${ty}px) rotate(${r}deg)`;
      setTimeout(()=>{ c.style.transform="translate(0,0) rotate(0deg)"; }, 110);
    });
    reorderKeepMapping();
    await sleep(140);
  }
}

/* ======================= Flow helpers ======================= */
function flipAllToBack(){
  activeCells.forEach(c=>c.classList.add("flipped"));
}
function coverAllBacks(){
  activeCells.forEach(c=>setHidden(c.querySelector(".back .content")));
}
function themeCell(cell,label){
  cell.classList.remove("tri-theme-dark","tri-theme-gomi","tri-reveal");
  if(label==="Gomitas") cell.classList.add("tri-theme-gomi");
  else cell.classList.add("tri-theme-dark");
  cell.classList.add("tri-reveal");
  setTimeout(()=>cell.classList.remove("tri-reveal"), 520);
}

/* ======================= Backend ======================= */
async function validateCodesOnly(c1,c2,c3){
  const codes = [c1,c2,c3].map(s=>(s||"").trim().toUpperCase());
  if(codes.some(s=>s.length<3)) throw new Error("Ingresa los 3 códigos.");
  for(const code of codes){
    const ref = doc(db, CFG.codesCol, code);
    const snap = await getDoc(ref);
    if(!snap.exists()) throw new Error("Código no válido: " + code);
    const d=snap.data()||{};
    if((d.estado||"").toLowerCase()==="usado") throw new Error("Código ya usado: " + code);
  }
  return codes;
}
async function lockAndLogCodes(codes, phone){
  const metaRef = doc(db, CFG.metaDocPath);
  const refs = codes.map(c=>doc(db, CFG.codesCol, c));
  const { isUnlocked, playId, nextCount } = await runTransaction(db, async tx=>{
    // LECTURAS
    const metaSnap = await tx.get(metaRef);
    const meta = metaSnap.exists()? metaSnap.data():{ totalPlays:0 };
    const codeSnaps = [];
    for(const r of refs){ codeSnaps.push({ref:r, snap:await tx.get(r)}); }
    for(const {ref,snap} of codeSnaps){
      if(!snap.exists()) throw new Error("Código no válido: " + ref.id);
      const d=snap.data()||{};
      if((d.estado||"").toLowerCase()==="usado") throw new Error("Código ya usado: " + ref.id);
    }
    // ESCRITURAS
    const nextCount = (meta.totalPlays||0)+1;
    const isUnlocked = (nextCount % 100 === 0);
    tx.set(metaRef,{ totalPlays: nextCount, updatedAt: serverTimestamp() },{ merge:true });
    for(const {ref} of codeSnaps){
      tx.set(ref,{ estado:"usado", usadoEn: CFG.gameTag, telefono: phone, usadoAt: serverTimestamp() },{ merge:true });
    }
    const preId = (crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now())+Math.random().toString(16).slice(2);
    const playRef = doc(collection(db, CFG.playsCol), preId);
    tx.set(playRef,{ createdAt: serverTimestamp(), codes, unlocked: isUnlocked, phone, result:null, pickIndex:null });
    return { isUnlocked, playId: preId, nextCount };
  });
  return { isUnlocked, playId, nextCount };
}

/* ======================= Preparar ronda ======================= */
async function setupRound(unlockedFlag){
  unlocked = unlockedFlag;

  // Mapping real (para logging)
  currentMapping = unlocked ? (()=>{ const k=["P300","P10","GOMI"]; shuffleInPlace(k); return k; })()
                            : ["P10","P10","P10"];

  // 1) Voltear a dorso oculto
  coverAllBacks();
  flipAllToBack();

  // 2) Micro pausa + mezcla visible >= 2s
  await sleep(520);
  await mixFor(CFG.mixMs);

  // 3) Listas para elegir
  activeCells.forEach(c=>c.disabled=false);
  roundReady = true;
}

/* ======================= Revelación ======================= */
function revealChosen(idx){
  const cell = activeCells[idx];
  const backContent = cell.querySelector(".back .content");
  const key = currentMapping[idx];
  const label = keyToLabel(key);
  setPrize(backContent, label);
  themeCell(cell, label);
}
function revealOne(i){
  const cell = activeCells[i];
  const backContent = cell.querySelector(".back .content");
  const label = keyToLabel(currentMapping[i]);
  setPrize(backContent, label);
  themeCell(cell, label);
}
async function revealOthersSequential(idx){
  const order = [0,1,2].filter(n=>n!==idx);
  for(const i of order){
    await sleep(CFG.revealGapMs);
    // Si la ronda estaba bloqueada, “simulamos” mayores
    if(!unlocked){
      const fake = (i===order[0]) ? "$300" : "Gomitas";
      const el = activeCells[i].querySelector(".back .content");
      setPrize(el, fake);
      themeCell(activeCells[i], fake);
    }else{
      revealOne(i);
    }
  }
}

/* ======================= Click en una casilla ======================= */
async function onPick(cell){
  if(!roundReady) return;
  const idx = activeCells.indexOf(cell);
  if(idx<0) return;

  roundReady = false;
  activeCells.forEach((c,k)=>{ if(k!==idx) c.classList.add("is-disabled"); });

  // pequeña pausa -> revela elegida -> revela otras -> modal
  await sleep(CFG.revealDelayMs);
  revealChosen(idx);
  await revealOthersSequential(idx);
  await sleep(CFG.modalAfterMs);

  const key = currentMapping[idx];
  const msg = key==="P300" ? "¡Felicidades, te llevas $300!"
            : key==="GOMI" ? "¡Ganaste una bolsa de gomitas!"
            : "Obtuviste 10 pts.";
  if(modalTitle) modalTitle.innerHTML = key==="P300" ? "🎉 Premio mayor" : key==="GOMI" ? "🍬 Dulce victoria" : "✨ Suma puntos";
  if(modalResult) modalResult.innerHTML =
    `${msg}<br><br><strong>TOMA CAPTURA DE PANTALLA</strong><br>` +
    `Envíala por DM en Instagram para reclamar: <a href="${CFG.igUrl}" target="_blank" rel="noopener">${CFG.igUrl}</a>`;
  if(btnAgain) btnAgain.style.display="none";
  if(btnOk) btnOk.textContent="OK";
  if(modal && !modal.open) modal.showModal();

  try{
    if(justPlayedId){
      await setDoc(doc(db, CFG.playsCol, justPlayedId), {
        result: key,
        pickIndex: idx,
        revealed: currentMapping,
        finishedAt: serverTimestamp()
      }, { merge:true });
    }
  }catch(e){ console.warn("No se pudo cerrar la jugada:", e); }
}

/* ======================= Flujo UI ======================= */
if(btnPlay){
  btnPlay.addEventListener("click", async ()=>{
    validatedCodes=null; phoneNumber=null; justPlayedId=null;
    btnPlay.disabled=true;
    try{
      const codes = await validateCodesOnly(input1.value,input2.value,input3.value);
      validatedCodes = codes;
      if(phoneInput) phoneInput.value="";
      if(phoneDlg && !phoneDlg.open) phoneDlg.showModal();
    }catch(err){
      if(modalTitle) modalTitle.textContent = "⚠️ No se pudo jugar";
      if(modalResult) modalResult.textContent = err.message || "Error desconocido.";
      if(btnAgain) btnAgain.style.display="inline";
      if(btnOk) btnOk.textContent="OK";
      if(modal && !modal.open) modal.showModal();
    }finally{ btnPlay.disabled=false; }
  });
}
if(phoneClose) phoneClose.addEventListener("click", ()=>phoneDlg.close());
if(phoneOk){
  phoneOk.addEventListener("click", async ()=>{
    const val = (phoneInput.value||"").replace(/\D/g,"");
    if(val.length<8 || val.length>15){ phoneInput.focus(); phoneInput.select(); return; }
    if(!validatedCodes){ return; }
    phoneNumber=val; phoneDlg.close();

    btnPlay && (btnPlay.disabled=true);
    try{
      const { isUnlocked, playId, nextCount } = await lockAndLogCodes(validatedCodes, phoneNumber);
      justPlayedId = playId;
      await setupRound(isUnlocked);

      const hint = $("tri-hint");
      if(hint){
        hint.textContent = isUnlocked
          ? `Ronda desbloqueada (#${nextCount}): premios activos.`
          : `Tirada #${nextCount}. Los premios mayores se activan cada 100.`;
      }
    }catch(err){
      if(modalTitle) modalTitle.textContent = "⚠️ No se pudo jugar";
      if(modalResult) modalResult.textContent = err.message || "Error desconocido.";
      if(btnAgain) btnAgain.style.display="inline";
      if(btnOk) btnOk.textContent="OK";
      if(modal && !modal.open) modal.showModal();
    }finally{ btnPlay && (btnPlay.disabled=false); }
  });
}
if(btnOk)    btnOk.addEventListener("click", ()=>modal && modal.close());
if(btnClose) btnClose.addEventListener("click", ()=>modal && modal.close());
if(btnAgain){
  btnAgain.addEventListener("click", ()=>{
    modal && modal.close();
    input1.value=""; input2.value=""; input3.value="";
    validatedCodes=null; phoneNumber=null; justPlayedId=null;
    resetBoard();
  });
}
