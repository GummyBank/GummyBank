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
    canvas.style.height = '150px';
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
  
    const width = canvas.width / scale;
    const height = canvas.height / scale;
    const progress = llenados / meta;
  
    ctx.clearRect(0, 0, width, height);
  
    // Glow exterior (bóveda brillante)
    ctx.save();
    const glowPulse = 0.3 + 0.2 * Math.sin(Date.now() / 500); // cambia cada segundo
    ctx.shadowColor = `rgba(255, 215, 0, ${glowPulse})`;
    ctx.shadowBlur = 40;
    ctx.fillStyle = "#222";
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  
    // Nivel del líquido
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
  
    // Gradiente dorado con brillo pulsante
    const t = Date.now() / 1000;
    const goldShift = Math.sin(t * 2) * 0.1;
  
    const gradient = ctx.createLinearGradient(0, liquidHeight, 0, height);
    gradient.addColorStop(0, `hsl(45, 100%, ${60 + goldShift * 20}%)`);
    gradient.addColorStop(0.5, `hsl(43, 95%, ${55 + goldShift * 15}%)`);
    gradient.addColorStop(1, `hsl(39, 90%, ${45 + goldShift * 10}%)`);
    ctx.fillStyle = gradient;
    ctx.fill();
  
    // Burbujas animadas que suben
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
  
    // Porcentaje flotante
    ctx.shadowBlur = 0;
    ctx.font = `${Math.max(14, height * 0.12)}px Arial`;
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.fillText((progress * 100).toFixed(1) + "%", width / 2, liquidHeight - 10);

  }
  
  
  function actualizarUI() {
    ruedas.forEach(rueda => {
      const meta = rueda.meta;
      const llenados = Math.min(totalRegistrados, meta);
      const canvas = document.getElementById(rueda.id);
  
      if (!canvas) return; // Evita errores si falta el canvas
  
      drawLiquid(rueda.id, llenados, meta);
  
      const vault = canvas.closest(".vault");
      const span = vault?.querySelector(".count");
      const barra = vault?.querySelector(".progress-bar");
  
      if (span) span.textContent = llenados;
      if (barra) barra.style.setProperty("--percent", (llenados / meta * 100) + "%");
    });
  
    const lista = document.getElementById("lista-codigos");
    lista.innerHTML = codigosRegistrados.map(c => `<li>${c}</li>`).join('');
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
  
  function registrarCodigo() {
    const nuevoCodigo = prompt("Ingresa tu código:");
  
    if (nuevoCodigo && !codigosRegistrados.includes(nuevoCodigo)) {
      codigosRegistrados.push(nuevoCodigo);
      totalRegistrados++;
  
      showModal();
      actualizarUI();
    } else {
      alert("Código inválido o ya registrado.");
    }
  }
  
  // Inicializar ruletas
  window.onload = function() {
    actualizarUI();
    loopAnimacion(); // iniciar animación LED
  };
  
  window.registrarCodigo = registrarCodigo;
  window.closeModal = closeModal;
  

  function crearLluviaImagen() {
    const img = document.createElement("img");
    img.src = "./img/gomita.png"; // ← pon el nombre exacto aquí
    img.className = "gomita";
    img.style.left = Math.random() * window.innerWidth + "px";
    img.style.animationDuration = (2 + Math.random() * 3) + "s";
  
    document.getElementById("lluvia-container").appendChild(img);
  
    setTimeout(() => img.remove(), 6000);
  }
  
  // Lluvia continua cada 250ms
  setInterval(crearLluviaImagen, 250);
  