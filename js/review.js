// review.js

// Firebase (ESM desde CDN)
import { initializeApp, getApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getFirestore, addDoc, collection, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

/* ---------------- Firebase: app secundaria segura ----------------
   - Si ya existe "gb-reviews", la usamos.
   - Si no, la creamos con tu config.
   Esto evita el error "app/duplicate-app" aunque ya exista
   otra app DEFAULT o cualquier otra inicializada por otros scripts.
------------------------------------------------------------------*/
const gbFirebaseConfig = {
  apiKey: "AIzaSyAJJgDg5SUPvvHgPtDNhIy1f1fiGpBHBw",
  authDomain: "registro-gomitas.firebaseapp.com",
  projectId: "registro-gomitas",
  storageBucket: "registro-gomitas.appspot.com",
  messagingSenderId: "435485731864",
  appId: "1:435485731864:web:43dff09753a4c9d507e76d"
};

let gbApp;
try {
  gbApp = getApp("gb-reviews");              // reutiliza si ya existe
} catch {
  gbApp = initializeApp(gbFirebaseConfig, "gb-reviews"); // crea secundaria
}
const gbDb = getFirestore(gbApp);

/* ---------------- DOM refs ---------------- */
const $form  = document.getElementById('grc-form');
const $tel   = document.getElementById('grc-tel');
const $txt   = document.getElementById('grc-txt');
const $send  = document.getElementById('grc-send');
const $msg   = document.getElementById('grc-msg');
const $count = document.getElementById('grc-count');

/* ---------------- Helpers ---------------- */
const onlyDigits = s => s.replace(/\D+/g,'');
const isPhoneOk  = v => /^\d{8,15}$/.test(v);
function toggleSubmit(){
  const ok = isPhoneOk($tel.value) && $txt.value.trim().length >= 5;
  $send.disabled = !ok;
}
function resetMsg(){ $msg.textContent = ""; $msg.style.color = ""; }

/* ---------------- Wiring UI ---------------- */
function boot(){
  if (!$form) return; // si no está en esta página, evita errores

  $tel.addEventListener('input', ()=>{
    const clean = onlyDigits($tel.value);
    if (clean !== $tel.value) $tel.value = clean;
    toggleSubmit();
  });

  $txt.addEventListener('input', ()=>{
    $count.textContent = `${$txt.value.length}/600`;
    toggleSubmit();
  });

  $form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    if ($send.disabled) return;

    $send.disabled = true;
    resetMsg();

    const payload = {
      telefono: $tel.value.trim(),
      resena: $txt.value.trim(),
      createdAt: serverTimestamp(),
      estado: "pendiente"
    };

    try{
      await addDoc(collection(gbDb, "resenas"), payload);
      $msg.textContent = "¡Gracias! Tu reseña fue registrada. Estás participando.";
      $msg.style.color = "var(--ok)";
      $form.reset();
      $count.textContent = "0/600";
      toggleSubmit();
    }catch(err){
      console.error(err);
      $msg.textContent = "No se pudo enviar. Intenta de nuevo.";
      $msg.style.color = "var(--err)";
    }finally{
      $send.disabled = false;
    }
  });

  // Estado inicial
  $count.textContent = "0/600";
  toggleSubmit();
}

// Arranque seguro por si lo cargas en el <head> por accidente
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
