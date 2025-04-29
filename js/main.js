let totalRegistrados = 0;
const codigosRegistrados = [];

const ruedas = [
  { id: "canvas-cristal", meta: 100, rotation: 0 },
  { id: "canvas-plateada", meta: 250, rotation: 0 },
  { id: "canvas-dorada", meta: 500, rotation: 0 }
];

function drawWheel(canvasId, llenados, meta, rotation = 0) {
  const canvas = document.getElementById(canvasId);
  const ctx = canvas.getContext("2d");

  if (!ctx) return;

  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const radius = Math.min(centerX, centerY) - 10;
  const sliceAngle = (2 * Math.PI) / meta;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(rotation);

  for (let i = 0; i < meta; i++) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius, i * sliceAngle, (i + 1) * sliceAngle);
    ctx.closePath();
    ctx.fillStyle = i < llenados ? "#4caf50" : "#333";
    ctx.fill();
    ctx.strokeStyle = "#555";
    ctx.stroke();
  }

  ctx.restore();
}

function actualizarUI() {
  ruedas.forEach(rueda => {
    const meta = rueda.meta;
    const llenados = Math.min(totalRegistrados, meta);
    const canvas = document.getElementById(rueda.id);
    const span = canvas.closest(".vault").querySelector(".count");
    const barra = canvas.closest(".vault").querySelector(".progress-bar");

    drawWheel(rueda.id, llenados, meta, rueda.rotation);

    span.textContent = llenados;
    barra.style.setProperty("--percent", (llenados / meta * 100) + "%");
  });

  const lista = document.getElementById("lista-codigos");
  lista.innerHTML = codigosRegistrados.map(c => `<li>${c}</li>`).join('');
}

function animarGiro(rueda) {
  let rotacionInicial = rueda.rotation;
  let rotacionFinal = rotacionInicial + Math.random() * (Math.PI * 2) + Math.PI; // Gira entre 1.5 a 2.5 vueltas
  let duracion = 1000; // 1 segundo
  let inicio = null;

  function animar(timestamp) {
    if (!inicio) inicio = timestamp;
    const progreso = (timestamp - inicio) / duracion;
    if (progreso < 1) {
      rueda.rotation = rotacionInicial + (rotacionFinal - rotacionInicial) * easeOutCubic(progreso);
      actualizarUI();
      requestAnimationFrame(animar);
    } else {
      rueda.rotation = rotacionFinal % (Math.PI * 2); // Normalizamos
      actualizarUI();
    }
  }

  requestAnimationFrame(animar);
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function registrarCodigo() {
    const nuevoCodigo = prompt("Ingresa tu código:");
    
    if (nuevoCodigo && !codigosRegistrados.includes(nuevoCodigo)) {
      codigosRegistrados.push(nuevoCodigo);
      totalRegistrados++;
  
      // Mostrar ventana personalizada de éxito
      showModal();
  
      // Animar todas las ruedas
      ruedas.forEach(animarGiro);
  
      // Actualizar progreso
      actualizarUI();
    } else {
      alert("Código inválido o ya registrado.");
    }
  }
  

function showModal() {
    document.getElementById("overlay").style.display = "block";
    document.getElementById("customModal").style.display = "block";
  }
  
  function closeModal() {
    document.getElementById("overlay").style.display = "none";
    document.getElementById("customModal").style.display = "none";
  }
  

// Inicializar ruletas
window.onload = function() {
  actualizarUI();
};
