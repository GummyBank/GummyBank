import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

// === CONFIGURACIÓN FIREBASE ===
const firebaseConfig = {
  apiKey: "AIzaSyAJJgDg5SUPvvHgPtDNhIy1f1fiGpBHBw",
  authDomain: "registro-gomitas.firebaseapp.com",
  projectId: "registro-gomitas",
  storageBucket: "registro-gomitas.appspot.com",
  messagingSenderId: "435485731864",
  appId: "1:435485731864:web:43dff09753a4c9d507e76d",
  measurementId: "G-20KEW71X9G"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// === METAS DE BÓVEDAS ===
const metas = {
  madera: 25,
  cristal: 100,
  plateada: 250,
  dorada: 500
};

// === CONTADOR DE CÓDIGOS EN CADA BÓVEDA ===
async function cargarContadores() {
  for (const boveda in metas) {
    const ref = collection(db, boveda);
    const snap = await getDocs(ref);
    const cantidad = snap.size;

    const contador = document.querySelector(`.vault.${boveda} .count`);
    if (contador) contador.textContent = cantidad;
  }
}
cargarContadores();

// === REGISTRO DE CÓDIGOS ===
window.registrarCodigo = async function (boveda) {
  const codigo = prompt("Ingresa tu código (8 caracteres):")?.trim().toUpperCase();
  if (!codigo || codigo.length !== 8) return alert("Código inválido.");

  const telefono = prompt("Ingresa tu número de teléfono:")?.trim();
  if (!telefono || telefono.length < 8) return alert("Teléfono inválido.");

  if (!["madera", "cristal", "plateada", "dorada"].includes(boveda)) {
    return alert("Bóveda inválida.");
  }

  const codigoRef = doc(db, "codigos", codigo);
  const codigoSnap = await getDoc(codigoRef);

  if (!codigoSnap.exists()) return alert("Este código no existe.");
  if (codigoSnap.data().estado === "usado") return alert("Este código ya fue usado.");

  await updateDoc(codigoRef, {
    estado: "usado",
    telefono: telefono,
    boveda: boveda
  });

  const destinoRef = doc(collection(db, boveda), codigo);
  await setDoc(destinoRef, {
    codigo: codigo,
    telefono: telefono,
    registrado: new Date().toISOString()
  });

  agregarTarjeta(boveda, codigo, telefono);
  cargarContadores(); // Refrescar el contador visual
  document.getElementById("customModal").style.display = "block";
  document.getElementById("overlay").style.display = "block";
};

window.closeModal = function () {
  document.getElementById("customModal").style.display = "none";
  document.getElementById("overlay").style.display = "none";
};

// === RANKING DE ESCUELAS ===
const nombres = {
  tec: "Tecnológico de Pachuca",
  prepa1: "Preparatoria No. 1",
  cehum: "CEHUM",
  upefim: "UPEFIM"
};

async function cargarRanking() {
  const ref = doc(db, "ranking", "actual");
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const datos = snap.data();
  const lista = Object.entries(datos).map(([id, gomitas]) => ({
    id,
    nombre: nombres[id] || id,
    gomitas
  }));

  lista.sort((a, b) => b.gomitas - a.gomitas);

  const contenedor = document.getElementById("ranking-container");
  contenedor.innerHTML = "";

  lista.forEach((escuela, i) => {
    const div = document.createElement("div");
    div.className = `ranking-card escuela-${escuela.id}`;
    div.innerHTML = `${i === 0 ? "🏆 " : ""}${escuela.nombre}  –  <strong>${escuela.gomitas}</strong> bolsas`;
    contenedor.appendChild(div);
  });
}
cargarRanking();

// === MOSTRAR TARJETAS DE CÓDIGOS ===
function agregarTarjeta(boveda, codigo, telefono) {
  const contenedor = document.getElementById(`tarjetas-${boveda}`);
  if (!contenedor) return;

  const tarjeta = document.createElement("div");
  tarjeta.classList.add("card-codigo");
  tarjeta.innerHTML = `
    <strong>Código:</strong> ${codigo}<br>
    <strong>Teléfono:</strong> ${telefono}
  `;
  contenedor.prepend(tarjeta);
}
window.agregarTarjeta = agregarTarjeta;

// === INICIO DE SESIÓN ADMIN ===
document.getElementById("lock-icon").addEventListener("click", () => {
  const usuario = prompt("Usuario:");
  const contrasena = prompt("Contraseña:");

  if (usuario === "admin" && contrasena === "1234") {
    sessionStorage.setItem("auth", "true");
    window.location.href = "admin.html";
  } else {
    alert("Acceso denegado. Usuario o contraseña incorrectos.");
  }
});

// === INSTRUCCIONES ===
document.querySelector(".bi-info-circle").addEventListener("click", () => {
  document.getElementById("infoModal").style.display = "block";
  document.getElementById("overlay-info").style.display = "block";
});

window.cerrarInfoModal = function () {
  document.getElementById("infoModal").style.display = "none";
  document.getElementById("overlay-info").style.display = "none";
};
