// ===== Sesión / modal / toasts =====
const INACTIVITY_MS = 15*60*1000, WARN_BEFORE_MS = 60*1000;
let idleTimer, warnTimer;
const $modal  = document.getElementById("confirmModal");
const $title  = document.getElementById("confirmTitle");
const $msg    = document.getElementById("confirmMsg");
const $okBtn  = document.getElementById("okBtn");
const $canBtn = document.getElementById("cancelBtn");
const $toasts = document.getElementById("toasts");

function toast(txt, kind="ok"){ const t=document.createElement("div"); t.className=`toast ${kind==="err"?"err":"ok"}`; t.textContent=txt; $toasts.appendChild(t); setTimeout(()=>t.remove(), 3200); }
function doLogout(){ try{ sessionStorage.removeItem("ventas_auth"); sessionStorage.removeItem("auth"); } finally { location.replace("index.html"); } }
function resetIdle(){ clearTimeout(idleTimer); clearTimeout(warnTimer); warnTimer=setTimeout(openIdleWarn, Math.max(0,INACTIVITY_MS-WARN_BEFORE_MS)); idleTimer=setTimeout(doLogout, INACTIVITY_MS); }
function openIdleWarn(){ openConfirm("Sesión por expirar","Se cerrará en 60 segundos por inactividad. ¿Deseas continuar?","Seguir en sesión","Cerrar ahora",()=>resetIdle(),()=>doLogout(),true); }
["click","keydown","mousemove","touchstart","scroll","wheel","visibilitychange"].forEach(e=>addEventListener(e,()=>{ if(document.visibilityState==="visible") resetIdle(); },{passive:true}));
resetIdle();
document.getElementById("logoutBtn").addEventListener("click",()=>openConfirm("Cerrar sesión","¿Seguro que quieres salir?","Cerrar sesión","Cancelar",()=>doLogout(),()=>{},false));

function openConfirm(t,m,ok,cancel,onOk,onCancel,invert){
  $title.textContent=t; $msg.textContent=m; $okBtn.textContent=ok||"OK"; $canBtn.textContent=cancel||"Cancelar";
  $okBtn.className="btn danger"; $canBtn.className="btn gray"; $modal.style.display="flex";
  const close=()=>{ $modal.style.display="none"; $okBtn.onclick=null; $canBtn.onclick=null; };
  const wrap=fn=>()=>{ try{ fn&&fn(); } finally{ close(); } };
  if(invert){ $okBtn.onclick=wrap(onCancel); $canBtn.onclick=wrap(onOk); } else { $okBtn.onclick=wrap(onOk); $canBtn.onclick=wrap(onCancel); }
}

// ===== Firebase =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import {
  getFirestore, collection, doc, setDoc, getDoc, getDocs, onSnapshot,
  updateDoc, query, orderBy, enableIndexedDbPersistence, increment, serverTimestamp, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey:"AIzaSyAJJgDg5SUPvvHgPtDNhIy1f1fiGpBHBw",
  authDomain:"registro-gomitas.firebaseapp.com",
  projectId:"registro-gomitas",
  storageBucket:"registro-gomitas.appspot.com",
  messagingSenderId:"435485731864",
  appId:"1:435485731864:web:43dff09753a4c9d507e76d",
  measurementId:"G-20KEW71X9G"
};
const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);
enableIndexedDbPersistence(db).catch(()=>{});

// ===== Util =====
const MX=new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN",maximumFractionDigits:0});
const fmt=v=>MX.format(v||0), num=v=>Number(v)||0;
function isoWeekForDate(d){ const t=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())); const day=(t.getUTCDay()+6)%7; t.setUTCDate(t.getUTCDate()-day+3); const firstThu=new Date(Date.UTC(t.getUTCFullYear(),0,4)); const w=1+Math.round(((t-firstThu)/86400000-3+((firstThu.getUTCDay()+6)%7))/7); const y=t.getUTCFullYear(); return `${y}-W${String(w).padStart(2,"0")}`;}
function defaultWeek(){ return isoWeekForDate(new Date()); }
function safeName(obj, fallbackId){
  const n = obj?.nombre;
  return (typeof n === "string" && n.trim()) ? n.trim() : String(fallbackId || "Escuela");
}

// ===== Claves reservadas (no son escuelas) =====
const RESERVED_KEYS = new Set(["createdAt","updatedAt","note","_meta"]);
const DEFAULT_SCHOOLS = { escuelaA:"Escuela A", escuelaB:"Escuela B", escuelaC:"Escuela C", escuelaD:"Escuela D" };
const schoolEntriesFrom = (obj)=> Object.entries(obj||{}).filter(([k,v])=> typeof v==="string" && !RESERVED_KEYS.has(k));
const schoolMapFrom = (obj)=>{ const m={}; for(const [k,v] of schoolEntriesFrom(obj)) m[k]=v; return m; };

// ===== Refs UI =====
const $week = document.getElementById("weekInput");
const $weekLabel = document.getElementById("weekLabelInput");
const $sel = document.getElementById("schoolSelect");
const $btnCreateWeek = document.getElementById("btnCreateWeek");
const $btnEnsureSchools = document.getElementById("btnEnsureSchools");

const $asig=document.getElementById("inpAsignadas");
const $vend=document.getElementById("inpVendidas");
const $precio=document.getElementById("inpPrecio");
const $goms=document.getElementById("inpGomitas");
const $prem$=document.getElementById("inpPremioDinero");
const $gasto=document.getElementById("inpGastos");

const $btnAsignar = document.getElementById("btnAsignar");
const $btnVender  = document.getElementById("btnVender");
const $btnPremiar = document.getElementById("btnPremiar");
const $btnGasto   = document.getElementById("btnGasto");

const $addAsignadasToBatch = document.getElementById("addAsignadasToBatch");
const $addVentasToBatch    = document.getElementById("addVentasToBatch");
const $addPremiosToBatch   = document.getElementById("addPremiosToBatch");
const $addGastoToBatch     = document.getElementById("addGastoToBatch");
const $btnAddAll           = document.getElementById("btnAddAll");
const $btnClearAll         = document.getElementById("btnClearAll");
const $cartList            = document.getElementById("cartList");
const $cartCount           = document.getElementById("cartCount");

const $tbody = document.getElementById("tbodySemana");
const $totalesSemana = document.getElementById("totalesSemana");
const $toggleEdit = document.getElementById("toggleEdit");
const $btnSaveEdits = document.getElementById("btnSaveEdits");
const $btnCancelEdits = document.getElementById("btnCancelEdits");

const $weeksList = document.getElementById("weeksList");
const $searchWeek = document.getElementById("searchWeek");

const $catalogo = document.getElementById("escuelasCatalogo");
const $btnSyncNombresSemana = document.getElementById("btnSyncNombresSemana");
const $btnAddSchoolGlobal = document.getElementById("btnAddSchoolGlobal");

// ===== Constantes de negocio =====
const COSTO_GOMITA = 11.80;
const COSTO_INVERSION = 11.80;
const PAGO_VEND = 5.0;

// ===== Paths =====
function colSemanas(){ return collection(db,"ventasSemanas"); }
function docSemana(weekKey){ return doc(colSemanas(), weekKey); }
function colEscuelas(weekKey){ return collection(docSemana(weekKey),"escuelas"); }
function docEscuela(weekKey, escuelaId){ return doc(colEscuelas(weekKey), escuelaId); }
function docCatEscuelas(){ return doc(collection(db,"config"), "catalogoEscuelas"); }

// ===== Estado =====
let currentWeek = defaultWeek();
let currentNames = {};
let unsubSemana = null;
let lastSelectedSchool = null;
let editMode = false;
let editSnapshot = null;
const batch = [];
const charts = { bar:null, pie:null, line:null };
let rowsCache = [];

// ===== Catálogo global =====
async function loadCatalog(){
  const snap = await getDoc(docCatEscuelas());
  currentNames = snap.exists()? snap.data() : {};
  renderCatalog();
  fillSchoolSelect();
}
function renderCatalog(){
  $catalogo.innerHTML="";
  const entries = schoolEntriesFrom(currentNames);
  const ids = entries.length ? entries.map(([id])=>id) : Object.keys(DEFAULT_SCHOOLS);
  ids.forEach(id=>{
    const val=(currentNames[id] && typeof currentNames[id]==="string") ? currentNames[id] : DEFAULT_SCHOOLS[id] || id;
    const card=document.createElement("div");
    card.className="card";
    card.innerHTML=`
      <h3>${id}</h3>
      <label class="field"><span>Nombre visible</span><input data-id="${id}" value="${val}"/></label>
      <div class="row">
        <button class="btn saveName">Guardar</button>
        <button class="btn gray delName">Eliminar</button>
      </div>
    `;
    card.querySelector(".saveName").addEventListener("click", async ()=>{
      const v=String(card.querySelector("input").value||"").trim() || id;
      await saveCatalogName(id,v);
      toast("Escuela guardada");
    });
    card.querySelector(".delName").addEventListener("click", ()=>{
      openConfirm("Eliminar escuela del catálogo", `Se quitará "${val}" del catálogo global. No borra datos históricos.`, "Eliminar", "Cancelar",
        async ()=>{
          delete currentNames[id];
          await setDoc(docCatEscuelas(), { ...currentNames, updatedAt: serverTimestamp() });
          renderCatalog(); fillSchoolSelect();
          toast("Escuela eliminada");
        }, ()=>{}, false);
    });
    $catalogo.appendChild(card);
  });
}
async function saveCatalogName(id, name){
  if(RESERVED_KEYS.has(id)) return toast("Ese id está reservado","err");
  currentNames[id]=String(name);
  await setDoc(docCatEscuelas(), { [id]: String(name), updatedAt: serverTimestamp() }, { merge:true });
  fillSchoolSelect();
}
$btnAddSchoolGlobal.addEventListener("click", ()=>{
  const id = prompt("ID interno de la escuela (sin espacios, ej. escuelaE):");
  if(!id || /\s/.test(id) || RESERVED_KEYS.has(id)) return toast("ID inválido o reservado","err");
  const name = prompt("Nombre visible:");
  if(!name) return;
  currentNames[id]=String(name);
  setDoc(docCatEscuelas(), { [id]: String(name), updatedAt: serverTimestamp() }, { merge:true }).then(()=>{
    renderCatalog(); fillSchoolSelect(); toast("Escuela creada");
  });
});
$btnSyncNombresSemana.addEventListener("click", async ()=>{
  const pairs = schoolEntriesFrom(currentNames);
  for(const [id,visible] of pairs){
    const ref = docEscuela(currentWeek, id);
    const s = await getDoc(ref);
    if(s.exists()) await updateDoc(ref, { nombre: String(visible || id), updatedAt: serverTimestamp() });
  }
  toast("Nombres sincronizados a la semana");
});

// ===== Semana =====
$week.value = defaultWeek();
$btnCreateWeek.addEventListener("click", async ()=>{
  currentWeek = $week.value || defaultWeek();
  await ensureWeek(currentWeek, $weekLabel.value?.trim());
  await ensureSchools(currentWeek);
  await cleanupWeekBadDocs(currentWeek);
  subToWeek(currentWeek);
  toast("Semana lista");
});
$btnEnsureSchools.addEventListener("click", async ()=>{
  await ensureSchools(currentWeek);
  await cleanupWeekBadDocs(currentWeek);
  toast("Escuelas aseguradas");
});
$week.addEventListener("change", ()=>{
  currentWeek = $week.value || defaultWeek();
  subToWeek(currentWeek);
});

async function ensureWeek(weekKey, label){
  const ref = docSemana(weekKey);
  const d   = await getDoc(ref);
  if(d.exists()){
    if(label !== undefined) await updateDoc(ref, { label: String(label||""), updatedAt: serverTimestamp() });
  } else {
    await setDoc(ref, { createdAt: serverTimestamp(), label: String(label||""), updatedAt: serverTimestamp() });
  }
}
async function ensureSchools(weekKey){
  const namesMap = Object.keys(schoolMapFrom(currentNames)).length ? schoolMapFrom(currentNames) : DEFAULT_SCHOOLS;
  for(const id of Object.keys(namesMap)){
    const ref = docEscuela(weekKey, id);
    const s = await getDoc(ref);
    if(!s.exists()){
      await setDoc(ref, {
        nombre: String(namesMap[id]), asignadas:0, vendidas:0, precio:25, gomitas:0, premiosDinero:0, gastosVar:0,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp()
      });
    }
  }
}

// Limpieza de basura creada por claves reservadas
async function cleanupWeekBadDocs(weekKey){
  const esc = await getDocs(colEscuelas(weekKey));
  const ops = [];
  esc.forEach(d=>{ if(RESERVED_KEYS.has(d.id)) ops.push(deleteDoc(docEscuela(weekKey, d.id))); });
  if(ops.length) await Promise.all(ops);
}

// ===== Select escuelas =====
function fillSchoolSelect(){
  const namesMap = Object.keys(schoolMapFrom(currentNames)).length ? schoolMapFrom(currentNames) : DEFAULT_SCHOOLS;
  const keep = lastSelectedSchool || Object.keys(namesMap)[0];
  $sel.innerHTML="";
  for(const id of Object.keys(namesMap)){
    const opt=document.createElement("option");
    opt.value=id; opt.textContent=String(namesMap[id] || id);
    if(id===keep) opt.selected=true;
    $sel.appendChild(opt);
  }
}

// ===== Cálculo =====
function computeRow(r){
  const asignadas=Math.max(0,num(r.asignadas));
  const vendidas =Math.max(0,num(r.vendidas));
  const precio   =Math.max(0,Number(r.precio)||0);
  const gomitas  =Math.max(0,num(r.gomitas));
  const premDin  =Math.max(0,num(r.premiosDinero));
  const gastos   =Math.max(0,num(r.gastosVar));

  const restantes=Math.max(asignadas - vendidas, 0);
  const inversion=asignadas * COSTO_INVERSION;
  const pagoVend =vendidas * PAGO_VEND;

  let total = vendidas * precio;
  total -= gomitas * COSTO_GOMITA;
  total -= premDin;
  if(total < 0) total = 0;

  const neta = total - inversion - gastos - pagoVend;
  const gomitasMoney = gomitas * COSTO_GOMITA;

  return { asignadas, vendidas, precio, gomitas, premDin, gastos, restantes, inversion, pagoVend, total, neta, gomitasMoney };
}

// ===== Registro instantáneo =====
document.getElementById("btnAsignar").onclick = ()=>regAsignadas();
document.getElementById("btnVender").onclick  = ()=>regVentas();
document.getElementById("btnPremiar").onclick = ()=>regPremios();
document.getElementById("btnGasto").onclick   = ()=>regGasto();

async function regAsignadas(id = $sel.value, qty = num($asig.value)){
  qty = Math.max(0, Math.floor(qty)); if(!qty) return;
  await ensureWeek(currentWeek);
  await updateDoc(docEscuela(currentWeek,id), { asignadas: increment(qty), updatedAt: serverTimestamp() })
    .catch(async ()=> setDoc(docEscuela(currentWeek,id), baseDoc({ asignadas: qty })));
  lastSelectedSchool = id; $asig.value = 0; toast("Asignadas registradas");
}
async function regVentas(id = $sel.value, sold = num($vend.value), price = Number($precio.value)){
  sold = Math.max(0, Math.floor(sold)); price = Math.max(0, price||0); if(!sold && !price) return;
  await ensureWeek(currentWeek);
  const data = { updatedAt: serverTimestamp() };
  if(sold) data.vendidas = increment(sold);
  if(price) data.precio   = price;
  await updateDoc(docEscuela(currentWeek,id), data)
    .catch(async ()=> setDoc(docEscuela(currentWeek,id), baseDoc({ vendidas: sold||0, precio: price||25 })));
  lastSelectedSchool = id; $vend.value=0; toast("Ventas registradas");
}
async function regPremios(id = $sel.value, g = num($goms.value), dinero = num($prem$.value)){
  g = Math.max(0, Math.floor(g)); dinero = Math.max(0, Math.floor(dinero)); if(!g && !dinero) return;
  await ensureWeek(currentWeek);
  const data = { updatedAt: serverTimestamp() };
  if(g){ data.gomitas = increment(g); data.asignadas = increment(-g); }
  if(dinero){ data.premiosDinero = increment(dinero); }
  await updateDoc(docEscuela(currentWeek,id), data)
    .catch(async ()=> setDoc(docEscuela(currentWeek,id), baseDoc({ asignadas:-g, gomitas:g||0, premiosDinero:dinero||0 })));
  lastSelectedSchool = id; $goms.value=0; $prem$.value=0; toast("Premios registrados");
}
async function regGasto(id = $sel.value, gv = num($gasto.value)){
  gv = Math.max(0, Math.floor(gv)); if(!gv) return;
  await ensureWeek(currentWeek);
  await updateDoc(docEscuela(currentWeek,id), { gastosVar: increment(gv), updatedAt: serverTimestamp() })
    .catch(async ()=> setDoc(docEscuela(currentWeek,id), baseDoc({ gastosVar: gv })));
  lastSelectedSchool = id; $gasto.value=0; toast("Gasto registrado");
}
function baseDoc(overrides){
  return { nombre:"Escuela", asignadas:0, vendidas:0, precio:25, gomitas:0, premiosDinero:0, gastosVar:0, ...overrides, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
}

// ===== Carrito de registros =====
document.getElementById("addAsignadasToBatch").onclick = ()=>pushBatch({type:"asignadas", id:$sel.value, qty:num($asig.value)});
document.getElementById("addVentasToBatch").onclick    = ()=>pushBatch({type:"ventas", id:$sel.value, sold:num($vend.value), price:Number($precio.value)});
document.getElementById("addPremiosToBatch").onclick   = ()=>pushBatch({type:"premios", id:$sel.value, g:num($goms.value), dinero:num($prem$.value)});
document.getElementById("addGastoToBatch").onclick     = ()=>pushBatch({type:"gasto", id:$sel.value, gv:num($gasto.value)});

document.getElementById("btnAddAll").onclick = async ()=>{
  if(batch.length===0) return toast("Carrito vacío","err");
  for(const it of batch){
    if(it.type==="asignadas") await regAsignadas(it.id, it.qty);
    if(it.type==="ventas")    await regVentas(it.id, it.sold, it.price);
    if(it.type==="premios")   await regPremios(it.id, it.g, it.dinero);
    if(it.type==="gasto")     await regGasto(it.id, it.gv);
  }
  batch.length=0; renderCart(); toast("Carrito registrado");
};
document.getElementById("btnClearAll").onclick = ()=>{ batch.length=0; renderCart(); };

function pushBatch(it){
  const valid = (it.type==="asignadas" && it.qty>0)
             || (it.type==="ventas" && (it.sold>0 || it.price>0))
             || (it.type==="premios" && (it.g>0 || it.dinero>0))
             || (it.type==="gasto" && it.gv>0);
  if(!valid) return;
  batch.push(it); renderCart(); toast("Agregado al carrito");
}
function renderCart(){
  $cartCount.textContent = batch.length;
  $cartList.innerHTML="";
  batch.forEach((it,i)=>{
    const li=document.createElement("li");
    li.textContent = JSON.stringify(it);
    const b=document.createElement("button"); b.textContent="Quitar"; b.className="btn gray"; b.style.marginLeft="8px";
    b.onclick=()=>{ batch.splice(i,1); renderCart(); };
    li.appendChild(b); $cartList.appendChild(li);
  });
}

// ===== Edición absoluta =====
$toggleEdit.onchange = ()=>{
  editMode = $toggleEdit.checked;
  $btnSaveEdits.disabled = !editMode;
  $btnCancelEdits.disabled = !editMode;
  renderSemana(rowsCache);
  if(editMode){ editSnapshot = JSON.parse(JSON.stringify(rowsCache)); }
};
$btnCancelEdits.onclick = ()=>{
  editMode=false; $toggleEdit.checked=false; $btnSaveEdits.disabled=true; $btnCancelEdits.disabled=true;
  renderSemana(rowsCache=editSnapshot||rowsCache);
};
$btnSaveEdits.onclick = async ()=>{
  if(!editMode) return;
  const updates = [];
  $tbody.querySelectorAll("tr").forEach(tr=>{
    const id = tr.dataset.id;
    const read = k => Number(tr.querySelector(`[data-k="${k}"]`)?.value ?? 0);
    const v = {
      asignadas: read("asignadas"),
      vendidas:  read("vendidas"),
      precio:    Number(tr.querySelector(`[data-k="precio"]`)?.value ?? 25),
      gomitas:   read("gomitas"),
      premiosDinero: read("premiosDinero"),
      gastosVar: read("gastosVar")
    };
    updates.push(updateDoc(docEscuela(currentWeek,id), { ...v, updatedAt: serverTimestamp() }));
  });
  try{
    await Promise.all(updates);
    toast("Cambios guardados");
    editMode=false; $toggleEdit.checked=false; $btnSaveEdits.disabled=true; $btnCancelEdits.disabled=true;
  }catch(e){ toast("No se pudo guardar: "+(e?.message||"Error"),"err"); }
};

// ===== Render semana =====
function renderSemana(rows){
  rowsCache = rows;
  const keepSel = lastSelectedSchool || $sel.value;

  $tbody.innerHTML="";
  const acc = { inv:0, gas:0, pago:0, prem:0, goms:0, total:0, neta:0 };

  rows.forEach(r=>{
    const c = computeRow(r);
    acc.inv+=c.inversion; acc.gas+=c.gastos; acc.pago+=c.pagoVend; acc.prem+=c.premDin + c.gomitasMoney; acc.goms+=c.gomitas; acc.total+=c.total; acc.neta+=c.neta;

    const tr=document.createElement("tr");
    tr.dataset.id=r.id;
    tr.innerHTML = editMode ? rowEditHTML(r, c) : rowReadHTML(r, c);
    $tbody.appendChild(tr);
  });

  $totalesSemana.innerHTML = `
    <div>Total ventas: <b>${fmt(acc.total)}</b></div>
    <div>Inversión: <b>${fmt(acc.inv)}</b></div>
    <div>Gastos var: <b>${fmt(acc.gas)}</b></div>
    <div>Pago vendedor: <b>${fmt(acc.pago)}</b></div>
    <div>Premios: <b>${fmt(acc.prem)} (${acc.goms} gomitas)</b></div>
    <div>Ganancia neta: <b class="${acc.neta>=0?'ok':'bad'}">${fmt(acc.neta)}</b></div>
  `;

  drawWeekCharts(rows);

  if(keepSel){ lastSelectedSchool = keepSel; [...$sel.options].forEach(o=>{ if(o.value===keepSel) o.selected=true; }); }
}
function rowReadHTML(r, c){
  return `
    <td data-label="Escuela">${safeName(r,r.id)}</td>
    <td data-label="Asignadas" class="num">${c.asignadas}</td>
    <td data-label="Vendidas" class="num">${c.vendidas}</td>
    <td data-label="Restantes" class="num">${c.restantes}</td>
    <td data-label="Precio" class="num">${c.precio}</td>
    <td data-label="Gomitas" class="num">${c.gomitas}</td>
    <td data-label="Gomitas $" class="num">${fmt(c.gomitasMoney)}</td>
    <td data-label="Premio $" class="num">${fmt(c.premDin)}</td>
    <td data-label="Gastos var" class="num">${fmt(c.gastos)}</td>
    <td data-label="Inversión" class="num">${fmt(c.inversion)}</td>
    <td data-label="Pago vendedor" class="num">${fmt(c.pagoVend)}</td>
    <td data-label="Total ventas" class="num">${fmt(c.total)}</td>
    <td data-label="Neta" class="num ${c.neta>=0?'ok':'bad'}">${fmt(c.neta)}</td>
  `;
}
function rowEditHTML(r, c){
  const cell = (label, k, val, step="1") => `<td data-label="${label}" class="num"><input data-k="${k}" type="number" step="${step}" value="${val}"/></td>`;
  return `
    <td data-label="Escuela">${safeName(r,r.id)}</td>
    ${cell("Asignadas","asignadas",c.asignadas)}
    ${cell("Vendidas","vendidas",c.vendidas)}
    <td data-label="Restantes" class="num">${c.restantes}</td>
    ${cell("Precio","precio",c.precio,"0.5")}
    ${cell("Gomitas","gomitas",c.gomitas)}
    <td data-label="Gomitas $" class="num">${fmt(c.gomitasMoney)}</td>
    ${cell("Premio $","premiosDinero",c.premDin)}
    ${cell("Gastos var","gastosVar",c.gastos)}
    <td data-label="Inversión" class="num">${fmt(c.inversion)}</td>
    <td data-label="Pago vendedor" class="num">${fmt(c.pagoVend)}</td>
    <td data-label="Total ventas" class="num">${fmt(c.total)}</td>
    <td data-label="Neta" class="num ${c.neta>=0?'ok':'bad'}">${fmt(c.neta)}</td>
  `;
}

// ===== Subscripción a semana (saneo + filtro) =====
async function subToWeek(weekKey){
  if(unsubSemana){ unsubSemana(); unsubSemana=null; }

  // etiqueta
  const wsnap = await getDoc(docSemana(weekKey));
  $weekLabel.value = wsnap.exists()? String(wsnap.data().label||"") : "";

  // limpia basura antes de suscribirse
  await cleanupWeekBadDocs(weekKey);

  unsubSemana = onSnapshot(query(colEscuelas(weekKey), orderBy("nombre","asc")), snap=>{
    const rows=[];
    snap.forEach(d=>{
      const x=d.data();
      // ignora por si alguien metió otra basura en caliente
      if(RESERVED_KEYS.has(d.id)) return;
      rows.push({
        id:d.id,
        nombre: safeName({ nombre: x.nombre }, d.id),
        asignadas:x.asignadas||0, vendidas:x.vendidas||0, precio:x.precio||25,
        gomitas:x.gomitas||0, premiosDinero:x.premiosDinero||0, gastosVar:x.gastosVar||0
      });
    });
    renderSemana(rows);
    renderWeeksList();
  });
}

// ===== Semanas creadas =====
async function renderWeeksList(){
  const all = await getDocs(colSemanas());
  const arr = [];
  all.forEach(d=>arr.push({ id:d.id, ...d.data() }));
  arr.sort((a,b)=> a.id.localeCompare(b.id));

  const q = ($searchWeek.value||"").trim().toLowerCase();
  const f = q ? arr.filter(x => x.id.toLowerCase().includes(q) || (String(x.label||"")).toLowerCase().includes(q)) : arr;

  $weeksList.innerHTML="";
  for(const w of f){
    const card=document.createElement("div");
    card.className="week-card";
    card.innerHTML=`
      <div class="meta"><b>${w.id}</b><span>${String(w.label||"(sin etiqueta)")}</span></div>
      <div class="name-row">
        <input class="wkLabel" placeholder="Nueva etiqueta" value="${String(w.label||"")}"/>
        <button class="btn saveLbl">Guardar</button>
      </div>
      <div class="row">
        <button class="btn openWeek">Abrir</button>
        <button class="btn gray delWeek">Eliminar</button>
      </div>
    `;
    card.querySelector(".openWeek").onclick = ()=>{
      $week.value = w.id; currentWeek = w.id; subToWeek(w.id);
      scrollTo("Resultados de la semana");
    };
    card.querySelector(".saveLbl").onclick = async ()=>{
      const v = String(card.querySelector(".wkLabel").value||"").trim();
      await updateDoc(docSemana(w.id), { label: v, updatedAt: serverTimestamp() });
      toast("Etiqueta guardada");
    };
    card.querySelector(".delWeek").onclick = ()=>{
      openConfirm("Eliminar semana", `Se eliminará ${w.id} y sus escuelas. Esta acción no se puede deshacer.`, "Eliminar", "Cancelar",
        async ()=>{
          const esc = await getDocs(colEscuelas(w.id));
          const ops = [];
          esc.forEach(e=> ops.push(deleteDoc(docEscuela(w.id, e.id))));
          await Promise.all(ops);
          await deleteDoc(docSemana(w.id));
          toast("Semana eliminada");
          if(currentWeek===w.id){ currentWeek=defaultWeek(); $week.value=currentWeek; subToWeek(currentWeek); }
          renderWeeksList();
        }, ()=>{}, false);
    };
    $weeksList.appendChild(card);
  }
}
function scrollTo(text){
  const h2=[...document.querySelectorAll(".panel h2")].find(x=>x.textContent.trim()===text);
  if(h2) h2.scrollIntoView({behavior:"smooth", block:"start"});
}

// ===== Gráficas (labels saneados) =====
function drawWeekCharts(rows){
  const labels = rows.map(r=> safeName(r, r.id));
  const netas  = rows.map(r=> computeRow(r).neta);

  if(!charts.bar){
    charts.bar = new Chart(document.getElementById("barSemana"), {
      type:"bar",
      data:{ labels, datasets:[{ label:"Ganancia neta", data: netas }]},
      options:{ responsive:true, plugins:{legend:{display:false}}, scales:{ y:{ ticks:{ callback:v=>v.toLocaleString("es-MX")+" MXN" }}} }
    });
  } else {
    charts.bar.data.labels = labels; charts.bar.data.datasets[0].data = netas; charts.bar.update();
  }

  const acc = rows.reduce((a,r)=>{ const c=computeRow(r);
    a.inv+=c.inversion; a.gas+=c.gastos; a.pago+=c.pagoVend; a.prem+=c.premDin + c.gomitasMoney; a.ut+=Math.max(c.neta,0);
    return a;
  },{inv:0,gas:0,pago:0,prem:0,ut:0});
  const pieLabels = ["Inversión","Gastos var","Pago vendedor","Premios","Utilidad"];
  const pieData = [acc.inv, acc.gas, acc.pago, acc.prem, acc.ut];

  if(!charts.pie){
    charts.pie = new Chart(document.getElementById("pieSemana"), {
      type:"pie",
      data:{ labels: pieLabels, datasets:[{ data: pieData }]},
      options:{ responsive:true, plugins:{ legend:{ position:"bottom" }}}
    });
  } else {
    charts.pie.data.labels = pieLabels; charts.pie.data.datasets[0].data = pieData; charts.pie.update();
  }
}

async function renderLineAll(){
  const all = await getDocs(colSemanas());
  const ids = []; all.forEach(d=>ids.push(d.id));
  ids.sort();
  const labels=[], data=[];
  for(const wk of ids){
    const escSnap = await getDocs(colEscuelas(wk));
    let sum=0;
    escSnap.forEach(e=>{
      const x=e.data();
      const c=computeRow({ asignadas:x.asignadas||0, vendidas:x.vendidas||0, precio:x.precio||25, gomitas:x.gomitas||0, premiosDinero:x.premiosDinero||0, gastosVar:x.gastosVar||0 });
      sum+=c.neta;
    });
    labels.push(wk); data.push(Math.max(0,sum));
  }
  if(!charts.line){
    charts.line = new Chart(document.getElementById("lineSemanas"), {
      type:"line",
      data:{ labels, datasets:[{ label:"Neta total por semana", data }]},
      options:{ responsive:true, plugins:{legend:{position:"bottom"}}, scales:{ y:{ ticks:{ callback:v=>v.toLocaleString("es-MX")+" MXN" }}} }
    });
  } else {
    charts.line.data.labels=labels; charts.line.data.datasets[0].data=data; charts.line.update();
  }
}

// ===== Boot =====
async function boot(){
  currentWeek = $week.value || defaultWeek();
  await loadCatalog();
  await ensureWeek(currentWeek);
  await ensureSchools(currentWeek);
  await cleanupWeekBadDocs(currentWeek);
  subToWeek(currentWeek);
  renderWeeksList();
  renderLineAll();
}
boot();
