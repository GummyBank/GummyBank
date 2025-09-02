// ========= LÓGICA (UN SOLO MÓDULO) =========

// Importa Firestore SOLO UNA VEZ con todo lo que usas
import {
  doc, getDoc, setDoc, collection, runTransaction,
  serverTimestamp, writeBatch
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

// Importa el db ya inicializado (RUTA RELATIVA, NO / ABSOLUTO)
import { db } from "./firebaseClient.js";

// Config
const IG_URL = window.IG_URL || "https://instagram.com/tu_pagina";

// util
const toId = s => (s || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

// Constantes del juego
const TOTAL_CASILLAS = 36, PREMIO_GOMITA = 6, PREMIO_DINERO = 2;
const PREMIO_NADA = TOTAL_CASILLAS - PREMIO_GOMITA - PREMIO_DINERO;

// Jackpot control
const JACKPOT_MIN_ATTEMPTS = 200;
let jackpotEnabled = false;
const jackpotRef = doc(db, "minijuego_meta", "jackpot");

async function ensureJackpotDoc() {
  await setDoc(jackpotRef, { sinceLastWin: 0 }, { merge: true });
}
async function readJackpotMeta() {
  const snap = await getDoc(jackpotRef);
  const d = snap.exists() ? (snap.data() || {}) : {};
  return { sinceLastWin: Number(d.sinceLastWin || 0) };
}
async function canEnableJackpot() {
  await ensureJackpotDoc();
  const { sinceLastWin } = await readJackpotMeta();
  return sinceLastWin >= JACKPOT_MIN_ATTEMPTS;
}

const $board=document.getElementById("board"),
      $status=document.getElementById("codigo-status"),
      $codigoInput=document.getElementById("codigo-input"),
      $validarBtn=document.getElementById("validar-btn"),
      $modal=document.getElementById("mini-modal"),
      $modalCard=document.getElementById("mini-modal-card"),
      $modalTitle=document.getElementById("mini-modal-title"),
      $modalMsg=document.getElementById("mini-modal-msg"),
      $modalOk=document.getElementById("mini-modal-ok"),
      $modalFigure=document.getElementById("mini-modal-figure"),
      $modalCta=document.getElementById("modal-cta"),
      $phoneModal=document.getElementById("phone-modal"),
      $phoneInput=document.getElementById("phone-input"),
      $phoneOk=document.getElementById("phone-ok"),
      $phoneCancel=document.getElementById("phone-cancel"),
      $phoneError=document.getElementById("phone-error"),
      $canvas=document.getElementById("miniCanvas");

let codigoValido=null, telefonoValido=null, juegoHabilitado=false, yaJugo=false;

const svgURI = s => 'data:image/svg+xml;utf8,' + encodeURIComponent(s.trim());
const IMG = {
  HIDDEN: svgURI(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="18" fill="#111827"/><text x="50%" y="56%" text-anchor="middle" dominant-baseline="middle" font-family="system-ui,Segoe UI,Roboto" font-size="64" fill="#9fb0c9">?</text></svg>`),
  X: svgURI(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="18" fill="#1b2332"/><path d="M30 30 L90 90 M90 30 L30 90" stroke="#d1d5db" stroke-width="14" stroke-linecap="round"/></svg>`),
  GOMITA: 'img/gomita.png',
  P200: svgURI(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="18" fill="#064e3b"/><circle cx="60" cy="60" r="36" fill="#0e9f6e"/><text x="50%" y="56%" text-anchor="middle" dominant-baseline="middle" font-family="system-ui,Segoe UI,Roboto" font-size="38" fill="#e6fffa">$200</text></svg>`)
};

function setIcon(btn, kind){
  const alt = kind==='P200' ? '$200' : kind==='GOMITA' ? 'Gomitas' : kind==='X' ? 'Sin premio' : 'Oculto';
  btn.innerHTML = `<img class="cell-img" alt="${alt}" src="${IMG[kind]}">`;
  btn.setAttribute('aria-label', alt);
}
function setRevealStyles(btn, premio){
  btn.classList.remove('prize-200','prize-gomita','prize-nada');
  if(premio==='200') btn.classList.add('prize-200');
  else if(premio==='gomita') btn.classList.add('prize-gomita');
  else btn.classList.add('prize-nada');
}

// Estado inicial: vitrina (puede mostrar $200 de utilería)
mostrarPremiosIniciales();

$validarBtn.addEventListener("click",async()=>{
  const code=toId($codigoInput.value);
  if(!code){pintarStatus("Ingresa un código válido.","#ff6b6b");bloquearTablero();return;}
  try{
    const esValido=await validarCodigoDisponible(code);
    if(!esValido){pintarStatus("Código inválido o ya usado.","#ff6b6b");bloquearTablero();return;}
    codigoValido=code; juegoHabilitado=true; yaJugo=false;
    try{ telefonoValido=await pedirTelefono(); }
    catch(_){ pintarStatus("Participación cancelada.","#fca5a5"); return; }

    // Checar si ya se habilita el $200 real
    jackpotEnabled = await canEnableJackpot();

    pintarStatus("Tienes un intento. Mezclando...","#3fb950");
    await animarVolteoYMezcla();
  }catch(e){console.error(e);pintarStatus("Error al validar.","#ff6b6b");}
});

// Vitrina inicial
function mostrarPremiosIniciales(){
  const fakeShowJackpot = Math.random() < 0.7; // 70% mostrar $200 visual
  const pool = [];
  if (fakeShowJackpot) pool.push("200");
  for (let i=0;i<PREMIO_GOMITA;i++) pool.push("gomita");
  for (let i=pool.length;i<TOTAL_CASILLAS;i++) pool.push("nada");
  for(let i=pool.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}

  $board.innerHTML="";
  pool.forEach(p=>{
    const btn=document.createElement("button");
    if(p==="200"){ setIcon(btn,'P200'); setRevealStyles(btn,'200'); }
    else if(p==="gomita"){ setIcon(btn,'GOMITA'); setRevealStyles(btn,'gomita'); }
    else{ setIcon(btn,'X'); setRevealStyles(btn,'nada'); }
    btn.disabled=true;
    $board.appendChild(btn);
  });
}

async function animarVolteoYMezcla(){
  const buttons=Array.from($board.children);
  await Promise.all(buttons.map((btn,i)=>new Promise(res=>{
    setTimeout(()=>{
      setIcon(btn,'HIDDEN');
      btn.classList.remove("prize-200","prize-gomita","prize-nada");
      btn.style.background="linear-gradient(135deg,#0e1420,#0b0f18)";
      btn.style.borderColor="#243041";
      res();
    },i*30);
  })));
  configurarPremiosRandom();
  buttons.forEach((btn,i)=>{setTimeout(()=>{btn.classList.add("is-shuffling");setTimeout(()=>btn.classList.remove("is-shuffling"),650);},i*12);});
  habilitarTablero();
  pintarStatus("Código validado. Elige una casilla.","#3fb950");
}

function bloquearTablero(){Array.from($board.children).forEach(btn=>btn.disabled=true);juegoHabilitado=false;}
function habilitarTablero(){Array.from($board.children).forEach(btn=>btn.disabled=false);juegoHabilitado=true;}

// Pool REAL: solo incluye $200 si el jackpot está habilitado
function configurarPremiosRandom(){
  const pool = [];
  const realDinero = jackpotEnabled ? PREMIO_DINERO : 0;
  for (let i=0;i<realDinero;i++) pool.push("200");
  for (let i=0;i<PREMIO_GOMITA;i++) pool.push("gomita");
  for (let i=pool.length;i<TOTAL_CASILLAS;i++) pool.push("nada");

  for(let i=pool.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}

  Array.from($board.children).forEach((btn,idx)=>{
    btn.dataset.premio=pool[idx];
    setIcon(btn,'HIDDEN');
    btn.disabled=false;
    btn.onclick=()=>onClickCasilla(btn);
    btn.style.background="linear-gradient(135deg,#0e1420,#0b0f18)";
    btn.style.borderColor="#243041";
  });
}

async function onClickCasilla(btn){
  if(!juegoHabilitado||!codigoValido||yaJugo)return;
  yaJugo=true;
  bloquearTablero();

  let premio=btn.dataset.premio;

  await revelarCasilla(btn, premio);

  try{
    await persistirResultado(codigoValido, telefonoValido, premio);
  }catch(e){
    console.error("No se pudo persistir el resultado:", e);
  }

  await revelarResto(btn);

  if (premio === "200") {
    lanzarConfeti("gold");
    openResultModal(null, null, "success", { type: "200" });
  } else if (premio === "gomita") {
    lanzarConfeti("purple");
    openResultModal(null, null, "warn", { type: "gomita" });
  } else {
    openResultModal(null, null, "neutral", { type: "nada" });
  }
}

function revelarCasilla(btn,premio){
  return new Promise(res=>{
    btn.classList.add("is-flipping");
    setTimeout(()=>{
      if(premio==="200"){ setIcon(btn,'P200'); setRevealStyles(btn,'200'); }
      else if(premio==="gomita"){ setIcon(btn,'GOMITA'); setRevealStyles(btn,'gomita'); }
      else { setIcon(btn,'X'); setRevealStyles(btn,'nada'); }
      btn.classList.remove("is-flipping");
      btn.classList.add("pop");
      setTimeout(()=>{btn.classList.remove("pop");res();},180);
    },180);
  });
}

// Revelado del resto: si NO hay $200 real y jackpot está deshabilitado,
// inyecta un $200 SOLO VISUAL en una celda que NO fue elegida.
function revelarResto(chosenBtn){
  const buttons=Array.from($board.children);
  const hasReal200 = buttons.some(b=>b.dataset.premio==='200');
  let fake200Btn = null;

  if(!hasReal200 && !jackpotEnabled){
    const others = buttons.filter(b=>b!==chosenBtn);
    fake200Btn = others[(Math.random()*others.length)|0];
  }

  let delay=120;
  const promises=[];
  for(const b of buttons){
    if(b===chosenBtn) continue;
    const premio=b.dataset.premio;

    promises.push(new Promise(r=>{
      setTimeout(()=>{
        if(fake200Btn && b===fake200Btn){
          // Mostrar $200 visual sin tocar dataset
          setIcon(b,'P200'); setRevealStyles(b,'200');
        }else if(premio==="200"){
          setIcon(b,'P200'); setRevealStyles(b,'200');
        }else if(premio==="gomita"){
          setIcon(b,'GOMITA'); setRevealStyles(b,'gomita');
        }else{
          setIcon(b,'X'); setRevealStyles(b,'nada');
        }
        r();
      }, delay);
      delay += 60;
    }));
  }
  return Promise.all(promises);
}

function pintarStatus(msg,color){$status.textContent=msg;$status.style.color=color||"#9fb0c9";}

async function validarCodigoDisponible(rawCode){
  const code = toId(rawCode);
  const ref=doc(db,"codigos",code);
  const snap=await getDoc(ref);
  if(!snap.exists())return false;
  const data=snap.data()||{};
  if((data.estado||"").toLowerCase()==="usado")return false;
  return true;
}

// Persistencia + contador de intentos del jackpot
async function persistirResultado(codeRaw, phone, premio){
  const code = toId(codeRaw);
  const playRef=doc(collection(db,"minijuego_plays"));
  const codeRef=doc(db,"codigos",code);

  await ensureJackpotDoc();

  await runTransaction(db, async (tx) => {
    const metaSnap = await tx.get(jackpotRef);
    const meta = metaSnap.exists() ? (metaSnap.data()||{}) : { sinceLastWin: 0 };
    const current = Number(meta.sinceLastWin||0);

    // Blindaje extremo: si llegara "200" antes del umbral, degradar a "gomita"
    let finalPremio = premio;
    if (premio === "200" && current < JACKPOT_MIN_ATTEMPTS) {
      finalPremio = "gomita";
    }

    // Escribe play
    tx.set(playRef, {
      codigo: code,
      telefono: phone,
      resultado: finalPremio,
      createdAt: serverTimestamp()
    });

    // Marca código como usado
    tx.set(codeRef, {
      estado:"usado",
      usadoEn:"MiniJuego",
      usadoAt:serverTimestamp(),
      telefono: phone,
      resultado: finalPremio === '200' ? '200' : (finalPremio === 'gomita' ? 'gomitas' : 'sin premio')
    }, { merge:true });

    // Actualiza meta
    if (finalPremio === "200") {
      tx.set(jackpotRef, { sinceLastWin: 0 }, { merge: true });
    } else {
      tx.set(jackpotRef, { sinceLastWin: current + 1 }, { merge: true });
    }
  });
}

// Registro en Bóvedas (igual que antes)
window.handleRegistroCodigo = async ({codigo, telefono, boveda})=>{
  const code = toId(codigo);
  if(!/^[A-Z0-9]{8}$/.test(code)) { alert("Código inválido."); return false; }
  if(!/^\d{10}$/.test(telefono||"")) { alert("Teléfono inválido (10 dígitos)."); return false; }
  if(!["madera","cristal","plateada","dorada"].includes(boveda)){ alert("Bóveda inválida."); return false; }

  const ref = doc(db,"codigos",code);
  const snap = await getDoc(ref);
  if(!snap.exists()){ alert("Este código no existe."); return false; }
  const data = snap.data() || {};
  if((data.estado||"").toLowerCase()==="usado"){ alert("Este código ya fue usado."); return false; }

  const batch = writeBatch(db);
  batch.set(ref, { estado:"usado", telefono, boveda, registradoAt: serverTimestamp() }, { merge:true });
  const destinoRef = doc(collection(db, boveda), code);
  batch.set(destinoRef, { codigo: code, telefono, boveda, registrado: serverTimestamp() });
  await batch.commit();

  try{
    const cont = document.getElementById(`tarjetas-${boveda}`);
    if(cont){
      const card = document.createElement("div");
      card.className = "card-codigo";
      card.innerHTML = `<strong>Código:</strong> ${code}<br><strong>Teléfono:</strong> ${telefono}`;
      cont.prepend(card);
    }
    const countEl = document.querySelector(`.vault.${boveda} .count`);
    if(countEl){ countEl.textContent = String(Number(countEl.textContent||"0") + 1); }
  }catch(_){}

  const okM = document.getElementById("customModal"), ov = document.getElementById("overlay");
  if(okM && ov){ okM.style.display="block"; ov.style.display="block"; }
  return true;
};

// Modal resultado
function openResultModal(_title,_msg,variant,{type}={}){
  $modalFigure.innerHTML = "";
  $modalCard.classList.remove('success','warn','neutral');
  if(variant) $modalCard.classList.add(variant);

  if(type==="gomita"){
    const im=document.createElement('img');
    im.src=IMG.GOMITA; im.alt="Gomitas";
    $modalFigure.appendChild(im);
  }else if(type==="200"){
    const im=document.createElement('img');
    im.src=IMG.P200; im.alt="$200";
    $modalFigure.appendChild(im);
  }

  if (type === "200") {
    $modalTitle.innerHTML = `
      <div class="headline">
        <span class="md">¡PREMIO MAYOR!</span><br>
        <span class="xl accent">$200</span>
      </div>
    `;
    $modalMsg.innerHTML = `
      <div class="msg">
        <span class="big">Te lo llevaste todo.</span>
        <span class="note warn">TOMA CAPTURA DE PANTALLA</span>
        <span class="note">Envíala por DM a nuestro Instagram para reclamar tu premio.</span>
      </div>
    `;
    $modalCta.style.display='inline-flex';
    $modalCta.href = IG_URL;
    $modalCta.textContent = 'Abrir Instagram';
  } else if (type === "gomita") {
    $modalTitle.innerHTML = `
      <div class="headline">
        <span class="md">¡GOMITAS</span> <span class="md accent-purple">GANADAS!</span>
      </div>
    `;
    $modalMsg.innerHTML = `
      <div class="msg">
        <span class="big">Dulce victoria.</span>
        <span class="note warn">TOMA CAPTURA DE PANTALLA</span>
        <span class="note">Mándala por DM en Instagram y reclama tus gomitas.</span>
      </div>
    `;
    $modalCta.style.display='inline-flex';
    $modalCta.href = IG_URL;
    $modalCta.textContent = 'Abrir Instagram';
  } else {
    $modalTitle.innerHTML = `
      <div class="headline">
        <span class="md">SIN PREMIO</span><br>
        <span class="xl">ESTA VEZ</span>
      </div>
    `;
    $modalMsg.innerHTML = `
      <div class="msg">
        <span class="big">Quizá la próxima tengas más suerte.</span>
        <span class="note">Sigue participando con más códigos que la próxima puede ser tuya.</span>
      </div>
    `;
    $modalCta.style.display='none';
  }

  $modal.style.display='flex';
  $modalOk.focus();
}
function closeResultModal(){
  $modal.style.display='none';
  $codigoInput.value='';
  codigoValido=null; telefonoValido=null;
  pintarStatus('Ingresa un código para jugar.','#9fb0c9');
}
$modalOk.addEventListener('click',closeResultModal);
$modal.addEventListener('click',(e)=>{if(e.target===$modal)closeResultModal();});
window.addEventListener('keydown',(e)=>{if($modal.style.display==='flex'&&(e.key==='Escape'||e.key==='Enter'))closeResultModal();});

// Teléfono
function validarTelefono(value){
  const digits=(value||'').replace(/\D/g,'');
  return digits.length>=8 && digits.length<=15 ? digits : null;
}
function abrirPhoneModal(){
  $phoneError.textContent='';
  $phoneInput.value='';
  $phoneModal.style.display='flex';
  setTimeout(()=>{$phoneInput.focus();},0);
}
function cerrarPhoneModal(){ $phoneModal.style.display='none'; }

function pedirTelefono(){
  return new Promise((resolve,reject)=>{
    abrirPhoneModal();

    const onOk=()=>{
      const v=validarTelefono($phoneInput.value);
      if(!v){ $phoneError.textContent='Ingresa un teléfono válido (8 a 15 dígitos).'; return; }
      cerrarPhoneModal(); resolve(v);
    };
    const onCancel=()=>{ cerrarPhoneModal(); reject(new Error('cancelado')); };

    $phoneOk.onclick=onOk;
    $phoneCancel.onclick=onCancel;
    $phoneModal.onclick=(e)=>{ if(e.target===$phoneModal) onCancel(); };

    const handler=(e)=>{
      if($phoneModal.style.display==='flex'&&e.key==='Enter') onOk();
      if($phoneModal.style.display==='flex'&&e.key==='Escape') onCancel();
    };
    window.addEventListener('keydown',handler,{once:true});
  });
}

// Confeti
function lanzarConfeti(palette='gold'){
  const ctx = $canvas.getContext('2d');
  const rect = $canvas.getBoundingClientRect();
  $canvas.width = rect.width * devicePixelRatio;
  $canvas.height = rect.height * devicePixelRatio;
  const scale = devicePixelRatio;
  ctx.scale(scale, scale);

  const colors = palette==='gold'
    ? ["#ffd700","#ffb300","#ff7a00","#fff2a8"]
    : ["#9b5cf7","#7c3aed","#c084fc","#e9d5ff"];
  const pieces = Array.from({length: 110}, ()=>({
    x: Math.random()*rect.width,
    y: -20 - Math.random()*60,
    w: 6+Math.random()*6,
    h: 8+Math.random()*10,
    vx: -1 + Math.random()*2,
    vy: 2 + Math.random()*2.5,
    rot: Math.random()*Math.PI,
    vr: -0.2 + Math.random()*0.4,
    color: colors[(Math.random()*colors.length)|0],
    life: 220 + Math.random()*120
  }));

  let running = true;
  const start = performance.now();
  function tick(t){
    if(!running) return;
    const elapsed = t - start;
    ctx.clearRect(0,0,rect.width,rect.height);
    for(const p of pieces){
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      p.vy += 0.02;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
      ctx.restore();
    }
    if(elapsed < 2600) requestAnimationFrame(tick);
    else { running=false; ctx.clearRect(0,0,rect.width,rect.height); }
  }
  requestAnimationFrame(tick);
}
