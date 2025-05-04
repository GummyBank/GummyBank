let totalRegistrados = 0;
const codigosRegistrados = [];

const ruedas = [
  { id: "canvas-cristal", meta: 100},
  { id: "canvas-plateada", meta: 250},
  { id: "canvas-dorada", meta: 500}
];

function getRandomColor(seed = 0) {
    const hue = (seed * 137.5) % 360; // ángulo base variado para colores distintos
    return `hsl(${hue}, 85%, 60%)`;
  }
  
  let bordeTime = 0; // para animación LED


  function drawLiquid(canvasId, llenados, meta) {
    const canvas = document.getElementById(canvasId);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
  
    const scale = window.devicePixelRatio || 1;
    canvas.width = 400 * scale;
    canvas.height = 200 * scale;
    canvas.style.width = '100%';
    canvas.style.height = 'auto';
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
  
    const width = canvas.width / scale;
    const height = canvas.height / scale;
    const progress = llenados / meta;
  
    ctx.clearRect(0, 0, width, height);
  
    // Fondo
    ctx.fillStyle = "#222";
    ctx.fillRect(0, 0, width, height);
  
    // Líquido animado
    const liquidHeight = height * (1 - progress);
    const waveAmplitude = 5;
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
  
    const gradient = ctx.createLinearGradient(0, liquidHeight, 0, height);
    gradient.addColorStop(0, "#00e5ff");
    gradient.addColorStop(1, "#00c853");
    ctx.fillStyle = gradient;
    ctx.fill();
  
    // ✅ Porcentaje flotante
    ctx.font = `${Math.max(14, height * 0.12)}px Arial`;
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.fillText(Math.round(progress * 100) + "%", width / 2, liquidHeight - 8);  
  }
  
function actualizarUI() {
  ruedas.forEach(rueda => {
    const meta = rueda.meta;
    const llenados = Math.min(totalRegistrados, meta);
    const canvas = document.getElementById(rueda.id);
    const span = canvas.closest(".vault").querySelector(".count");
    const barra = canvas.closest(".vault").querySelector(".progress-bar");

    drawLiquid(rueda.id, llenados, meta);

    span.textContent = llenados;
    barra.style.setProperty("--percent", (llenados / meta * 100) + "%");
  });

  const lista = document.getElementById("lista-codigos");
  lista.innerHTML = codigosRegistrados.map(c => `<li>${c}</li>`).join('');
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
  
  function loopAnimacion() {
    actualizarUI();
    requestAnimationFrame(loopAnimacion);
  }
  

// Inicializar ruletas
window.onload = function() {
  actualizarUI();
  loopAnimacion(); // iniciar animación LED
};

