// /js/firebaseClient.js
import { initializeApp, getApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

// Si quieres sobreescribir desde tu HTML, define window.firebaseConfig antes de cargar módulos
const firebaseConfig = window.firebaseConfig || {
  apiKey: "AIzaSyAJJgDg5SUPvvHgPtDNhIy1f1fiGpBHBw",
  authDomain: "registro-gomitas.firebaseapp.com",
  projectId: "registro-gomitas",
  storageBucket: "registro-gomitas.appspot.com",
  messagingSenderId: "435485731864",
  appId: "1:435485731864:web:43dff09753a4c9d507e76d",
  measurementId: "G-20KEW71X9G"
};

// Robusto contra “app/no-app” y contra doble init
const app = (() => {
  try { return getApp(); }              // si ya existe, úsalo
  catch { return initializeApp(firebaseConfig); } // si no, créalo
})();

export const db = getFirestore(app);
export default app;
