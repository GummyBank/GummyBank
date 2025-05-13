
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

// Configuración de Firebase (usa tu propia si es diferente)
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

// NUEVO: Contadores por bóveda
const registrosPorBoveda = {
  cristal: 0,
  plateada: 0,
  dorada: 0
};

const ruedas = [
  { id: "canvas-cristal", meta: 100, clave: "cristal" },
  { id: "canvas-plateada", meta: 250, clave: "plateada" },
  { id: "canvas-dorada", meta: 500, clave: "dorada" }
];

function getRandomColor(seed = 0) {
  const hue = (seed * 137.5) % 360;
  return `hsl(${hue}, 85%, 60%)`;
}

let bordeTime = 0;

function drawLiquid(canvasId, llenados, meta) {
  const canvas = document.getElementById(canvasId);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const scale = window.devicePixelRatio || 1;
  canvas.width = 400 * scale;
  canvas.height = 200 * scale;
  canvas.style.width = '100%';
  canvas.style.height = '150px';
  ctx.setTransform(scale, 0, 0, scale, 0, 0);

  const width = canvas.width / scale;
  const height = canvas.height / scale;
  const progress = llenados / meta;

  ctx.clearRect(0, 0, width, height);
  ctx.save();
  const glowPulse = 0.3 + 0.2 * Math.sin(Date.now() / 500);

  if (canvasId.includes("cristal")) {
    ctx.shadowColor = `rgba(0, 255, 255, ${glowPulse})`;
  } else if (canvasId.includes("plateada")) {
    ctx.shadowColor = `rgba(200, 200, 200, ${glowPulse})`;
  } else {
    ctx.shadowColor = `rgba(255, 215, 0, ${glowPulse})`;
  }

  ctx.shadowBlur = 40;
  ctx.fillStyle = "#222";
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  const liquidHeight = height * (1 - progress);
  const waveAmplitude = 6;
  const waveLength = 50;
  const now = Date.now() / 300;

  ctx.beginPath();
  ctx.moveTo(0, liquidHeight);
  for (let x = 0; x <= width; x++) {
    const y = waveAmplitude * Math.sin((x / waveLength) + now) + liquidHeight;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.closePath();

  const t = Date.now() / 1000;
  const shift = Math.sin(t * 2) * 0.1;
  let gradient = ctx.createLinearGradient(0, liquidHeight, 0, height);

  if (canvasId.includes("cristal")) {
    gradient.addColorStop(0, `hsl(190, 100%, ${60 + shift * 20}%)`);
    gradient.addColorStop(0.5, `hsl(185, 95%, ${55 + shift * 15}%)`);
    gradient.addColorStop(1, `hsl(180, 90%, ${50 + shift * 10}%)`);
  } else if (canvasId.includes("plateada")) {
    gradient.addColorStop(0, `hsl(0, 0%, ${75 + shift * 10}%)`);
    gradient.addColorStop(0.5, `hsl(0, 0%, ${65 + shift * 10}%)`);
    gradient.addColorStop(1, `hsl(0, 0%, ${55 + shift * 10}%)`);
  } else {
    gradient.addColorStop(0, `hsl(45, 100%, ${60 + shift * 20}%)`);
    gradient.addColorStop(0.5, `hsl(43, 95%, ${55 + shift * 15}%)`);
    gradient.addColorStop(1, `hsl(39, 90%, ${45 + shift * 10}%)`);
  }

  ctx.fillStyle = gradient;
  ctx.fill();

  const bubbleCount = 10;
  const bubbleTime = Date.now() / 800;
  for (let i = 0; i < bubbleCount; i++) {
    const bubbleX = (i * 37 + bubbleTime * 25 + Math.sin(i + t) * 5) % width;
    const bubbleY = height - ((bubbleTime * 30 + i * 15) % (height - liquidHeight));
    const radius = 1.5 + Math.sin(t + i) * 1;

    ctx.beginPath();
    ctx.arc(bubbleX, bubbleY, radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${0.1 + 0.1 * Math.sin(t + i)})`;
    ctx.shadowColor = "rgba(255, 255, 255, 0.4)";
    ctx.shadowBlur = 8;
    ctx.fill();
  }

  ctx.shadowBlur = 0;
  ctx.font = `${Math.max(14, height * 0.12)}px Arial`;
  ctx.fillStyle = "white";
  ctx.textAlign = "center";
  ctx.fillText((progress * 100).toFixed(1) + "%", width / 2, liquidHeight - 10);
}

async function actualizarConteoDesdeFirebase() {
  for (let rueda of ruedas) {
    const snap = await getDocs(collection(db, rueda.clave));
    registrosPorBoveda[rueda.clave] = snap.size;
  }
}

function actualizarUI() {
  ruedas.forEach(rueda => {
    const meta = rueda.meta;
    const llenados = Math.min(registrosPorBoveda[rueda.clave], meta);
    const canvas = document.getElementById(rueda.id);

    if (!canvas) return;

    drawLiquid(rueda.id, llenados, meta);

    const vault = canvas.closest(".vault");
    const span = vault?.querySelector(".count");
    const barra = vault?.querySelector(".progress-bar");

    if (span) span.textContent = llenados;
    if (barra) barra.style.setProperty("--percent", (llenados / meta * 100) + "%");
  });
}

function showModal() {
  document.getElementById("overlay").style.display = "block";
  document.getElementById("customModal").style.display = "block";
}

function closeModal() {
  document.getElementById("overlay").style.display = "none";
  document.getElementById("customModal").style.display = "none";
}

async function loopAnimacion() {
  await actualizarConteoDesdeFirebase();
  actualizarUI();
  requestAnimationFrame(loopAnimacion);
}

window.onload = function () {
  loopAnimacion();
};

window.closeModal = closeModal;

function crearLluviaImagen() {
  const img = document.createElement("img");
  img.src = "./img/gomita.png";
  img.className = "gomita";
  img.style.left = Math.random() * window.innerWidth + "px";
  img.style.animationDuration = (2 + Math.random() * 3) + "s";

  document.getElementById("lluvia-container").appendChild(img);

  setTimeout(() => img.remove(), 6000);
}

setInterval(crearLluviaImagen, 250);
