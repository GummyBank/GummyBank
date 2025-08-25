import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  serverTimestamp,
  runTransaction
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

// Normaliza el ID del documento (MAYÚSCULAS, sin espacios ni símbolos)
const toId = s => (s || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

// === METAS DE BÓVEDAS ===
const metas = { madera: 25, cristal: 100, plateada: 250, dorada: 500 };

// === CONTADORES (lee tamaño de colección por ahora) ===
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

// =====================
//  REGISTRO CON MODAL
// =====================

// Abre el modal y guarda la bóveda elegida
window.registrarCodigo = function (boveda) {
  if (!["madera", "cristal", "plateada", "dorada"].includes(boveda)) {
    alert("Bóveda inválida.");
    return;
  }
  const sel = document.getElementById("boveda-seleccionada");
  if (sel) sel.value = boveda;

  const modal = document.getElementById("modal-registro");
  const ov = document.getElementById("overlay-registro");
  if (modal && ov) {
    modal.style.display = "block";
    ov.style.display = "block";
  }
};

// Cierra el modal de registro
window.cerrarModalRegistro = function () {
  const modal = document.getElementById("modal-registro");
  const ov = document.getElementById("overlay-registro");
  if (modal && ov) {
    modal.style.display = "none";
    ov.style.display = "none";
  }
  const form = document.getElementById("form-registro");
  if (form) form.reset();
};

// Manejo del submit del modal
const form = document.getElementById("form-registro");
if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const codigo = toId(document.getElementById("codigo")?.value);
    const telefono = (document.getElementById("telefono")?.value || "").trim();
    const boveda = document.getElementById("boveda-seleccionada")?.value;

    if (!/^[A-Z0-9]{8}$/.test(codigo || "")) return alert("Código inválido.");
    // Tus reglas aceptan 8–15, tú validas 10. Bien.
    if (!/^\d{10}$/.test(telefono || "")) return alert("Teléfono inválido (10 dígitos).");
    if (!["madera", "cristal", "plateada", "dorada"].includes(boveda)) return alert("Bóveda inválida.");

    try {
      const codigoRef  = doc(db, "codigos", codigo);
      const destinoRef = doc(collection(db, boveda), codigo);

      // Transacción: o todo o nada
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(codigoRef);
        if (!snap.exists()) throw new Error("NO_EXISTE");

        const data = snap.data() || {};
        const estadoActual = (data.estado || "").toLowerCase();
        if (estadoActual === "usado") throw new Error("YA_USADO");

        // === IMPORTANTE ===
        // Cumple EXACTAMENTE las reglas del flujo A (bóvedas):
        // Solo estos 4 campos y tipos correctos.
        tx.update(codigoRef, {
          estado: "usado",
          telefono,              // string 8–15
          boveda,                // una de las 4
          registradoAt: serverTimestamp()
        });

        // Crear registro en la colección de la bóveda
        // Requisitos de reglas: codigo==docId, registrado (timestamp o string) y telefono string
        tx.set(destinoRef, {
          codigo,
          telefono,
          registrado: serverTimestamp()
        });
      });

      // UI
      agregarTarjeta(boveda, codigo, telefono);
      await cargarContadores();
      cerrarModalRegistro();

      document.getElementById("customModal").style.display = "block";
      document.getElementById("overlay").style.display = "block";
    } catch (err) {
      console.error(err);
      let msg = "No se pudo registrar el código. Verifica los datos e inténtalo de nuevo.";
      if (err?.message === "NO_EXISTE") msg = "Este código no existe.";
      if (err?.message === "YA_USADO") msg = "Este código ya fue usado.";
      alert(msg);
    }
  });
}

// Cierra modal de éxito
window.closeModal = function () {
  document.getElementById("customModal").style.display = "none";
  document.getElementById("overlay").style.display = "none";
};

// =====================
//  RANKING DE ESCUELAS
// =====================
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

  // Pinta “Última actualización”
  const updEl = document.getElementById("ranking-updated");
  const ts = datos.actualizado?.toDate ? datos.actualizado.toDate() : null;
  if (updEl && ts) {
    const fmt = new Intl.DateTimeFormat("es-MX", { dateStyle: "short", timeStyle: "short" }).format(ts);
    updEl.textContent = `Última actualización: ${fmt}`;
  } else if (updEl) {
    updEl.textContent = "";
  }

  // Lista ordenada
  const lista = Object.entries(datos)
    .filter(([k]) => ["tec", "prepa1", "cehum", "upefim"].includes(k))
    .map(([id, gomitas]) => ({ id, nombre: nombres[id] || id, gomitas }))
    .sort((a, b) => b.gomitas - a.gomitas);

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

// =====================
//  TARJETAS EN PANTALLA
// =====================
function agregarTarjeta(boveda, codigo, telefono) {
  const contenedor = document.getElementById(`tarjetas-${boveda}`);
  if (!contenedor) return;
  const tarjeta = document.createElement("div");
  tarjeta.classList.add("card-codigo");
  tarjeta.innerHTML = `<strong>Código:</strong> ${codigo}<br><strong>Teléfono:</strong> ${telefono}`;
  contenedor.prepend(tarjeta);
}
window.agregarTarjeta = agregarTarjeta;

// =====================
//  ADMIN "LIGHT"
// =====================
const lockIcon = document.getElementById("lock-icon");
if (lockIcon) {
  lockIcon.addEventListener("click", () => {
    const usuario = prompt("Usuario:");
    if (usuario == null) return;
    const contrasena = prompt("Contraseña:");
    if (contrasena == null) return;

    if (usuario === "admin" && contrasena === "1234") {
      sessionStorage.setItem("auth", "true");
      window.location.href = "admin.html";
    } else if (usuario === "panel" && contrasena === "12345") {
      sessionStorage.setItem("ventas_auth", "true");
      window.location.href = "ventas.html";
    } else if (usuario === "vendedor" && contrasena === "123456") {
      sessionStorage.setItem("vendedor_auth", "true");
      window.location.href = "premios.html";
    } else if (usuario === "registroven" && contrasena === "1234567") {
      sessionStorage.setItem("registro_auth", "true");
      window.location.href = "registro-premios.html";
    } else {
      alert("Acceso denegado. Usuario o contraseña incorrectos.");
    }
  });
}

// =====================
//  MODAL INFO
// =====================
const infoIcon = document.querySelector(".bi-info-circle");
if (infoIcon) {
  infoIcon.addEventListener("click", () => {
    document.getElementById("infoModal").style.display = "block";
    document.getElementById("overlay-info").style.display = "block";
  });
}
window.cerrarInfoModal = function () {
  document.getElementById("infoModal").style.display = "none";
  document.getElementById("overlay-info").style.display = "none";
};
