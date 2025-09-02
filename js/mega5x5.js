// ========= LÓGICA MEGA 5x5 (botón + tablero metálico, sin brillo de colores) =========

import {
  doc, getDoc, setDoc, collection,
  runTransaction, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
import { db } from "./firebaseClient.js";

// ====== Config ======
const IG_URL = window.IG_URL || "https://instagram.com/tu_pagina";
const MG_IG_URL = IG_URL;

const MG_TOTAL  = 25; // 5x5
const MG_COUNTS = { p1000: 1, p500: 1, p200: 2, p50: 4, gomita: 9 };
const MG_THRESH = { p1000: 100000, p500: 100000, p200: 10000, p50: 9, gomita: 4 };

// Imagen para el estado "oculto" (puedes sobreescribir con window.MG_HIDDEN_IMG antes del script)
const MG_HIDDEN_IMG = window.MG_HIDDEN_IMG || "img/casilla-oculta.png";

const MG_controlRef = doc(db, "mega7x7_meta", "control");
const MG_playsCol   = collection(db, "mega7x7_plays");

// ====== Utils / assets ======
const MG_toId = s => (s||"").trim().toUpperCase().replace(/[^A-Z0-9]/g,"");
const MG_svg  = s => 'data:image/svg+xml;utf8,' + encodeURIComponent(s.trim());
const MG_IMG_GOMITA = "img/gomita.png";

// Íconos solo para modales
const MG_IMG = {
  HIDDEN: MG_HIDDEN_IMG, // ahora es imagen externa
  NADA  : MG_svg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="18" fill="#111827"/><path d="M30 30 L90 90 M90 30 L30 90" stroke="#cbd5e1" stroke-width="14" stroke-linecap="round"/></svg>`),
  P200  : MG_svg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="18" fill="#0b3a54"/><circle cx="60" cy="60" r="38" fill="#0ea5e9"/><text x="50%" y="56%" text-anchor="middle" dominant-baseline="middle" font-family="system-ui,Segoe UI,Roboto" font-size="42" fill="#e6fffa">$200</text></svg>`),
  P500  : MG_svg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="18" fill="#14532d"/><circle cx="60" cy="60" r="40" fill="#22c55e"/><text x="50%" y="56%" text-anchor="middle" dominant-baseline="middle" font-family="system-ui,Segoe UI,Roboto" font-size="44" fill="#e6fffa">$500</text></svg>`),
  P1000 : MG_svg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="18" fill="#064e3b"/><circle cx="60" cy="60" r="40" fill="#0e9f6e"/><text x="50%" y="56%" text-anchor="middle" dominant-baseline="middle" font-family="system-ui,Segoe UI,Roboto" font-size="40" fill="#e6fffa">$1000</text></svg>`),
  P50   : MG_svg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="18" fill="#1e293b"/><circle cx="60" cy="60" r="36" fill="#94a3b8"/><text x="50%" y="56%" text-anchor="middle" dominant-baseline="middle" font-family="system-ui,Segoe UI,Roboto" font-size="46" fill="#0b1220">$50</text></svg>`)
};
const MG_icon = k => k==='HIDDEN'?MG_IMG.HIDDEN:
                     k==='p1000'?MG_IMG.P1000:
                     k==='p500'?MG_IMG.P500:
                     k==='p200'?MG_IMG.P200:
                     k==='p50'?MG_IMG.P50:
                     k==='gomita'?MG_IMG_GOMITA:MG_IMG.NADA;

/* =================== CSS INYECTADO =================== */
/* Tablero metálico. Ojo: width 100% para encajar en tu #MG-board-box */
const MG_CSS_BOARD = `
  /* el tablero jamás excede el ancho de pantalla */
  #MG-board{
    display:grid;
    grid-template-columns:repeat(5,1fr);
    gap: clamp(6px, 1.8vw, 14px);
    width: min(92vw, 620px);
    max-width: 100%;
    margin: 0 auto;
    padding: clamp(8px, 2.2vw, 16px);
    border-radius: 24px;
    position: relative;
    background:
      radial-gradient(800px 420px at -10% -20%, rgba(56,189,248,.06), transparent 60%),
      radial-gradient(800px 420px at 110% 120%, rgba(217,70,239,.06), transparent 60%),
      linear-gradient(160deg,#0f172a 0%, #0b1220 40%, #111827 100%);
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,.14),
      inset 0 -10px 30px rgba(0,0,0,.35),
      0 18px 36px rgba(0,0,0,.38);
    border: 1px solid rgba(0,0,0,.38);
    isolation:isolate;
  }
  #MG-board::before{
    content:""; position:absolute; inset:6px; border-radius:20px;
    box-shadow:
      inset 0 0 0 1px rgba(0,0,0,.45),
      inset 0 12px 24px rgba(0,0,0,.35),
      inset 0 -8px 14px rgba(255,255,255,.06);
    pointer-events:none;
  }
  #MG-board::after{
    content:""; position:absolute; inset:-2px; border-radius:26px;
    box-shadow: 0 0 0 2px rgba(255,255,255,.05), 0 8px 24px rgba(0,0,0,.45);
    pointer-events:none;
  }
  #MG-board .screw{
    position:absolute; width:14px; height:14px; border-radius:50%;
    background: radial-gradient(circle at 30% 30%, #fff 0 15%, #9aa3ad 40%, #4b525a 70%, #14171a 100%);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.28), inset 0 -1px 0 rgba(0,0,0,.4);
    z-index: 3;
  }
  #MG-board .screw.tl{ left:10px; top:10px }
  #MG-board .screw.tr{ right:10px; top:10px }
  #MG-board .screw.bl{ left:10px; bottom:10px }
  #MG-board .screw.br{ right:10px; bottom:10px }

  /* apretamos un poco en teléfonos muy estrechos */
  @media (max-width: 380px){
    #MG-board{ gap:5px; padding:8px; border-radius:20px; }
  }
`;

/* Botón metálico + contenido */
const MG_CSS_METAL = `
  .metal-btn{
    position:relative; width:100%; aspect-ratio:1/1;
    border-radius:18px; cursor:pointer; overflow:hidden; user-select:none; isolation:isolate;
    border:1px solid rgba(0,0,0,.35) !important;
    background:
      radial-gradient(120% 140% at 50% 35%, rgba(255,255,255,.10) 0%, rgba(255,255,255,0) 55%),
      linear-gradient(160deg, #2b313a 0%, #404957 44%, #616a77 100%) !important;
    box-shadow:
      0 1px 0 rgba(255,255,255,.05) inset,
      0 -2px 6px rgba(0,0,0,.45) inset,
      0 10px 18px rgba(0,0,0,.35),
      0 1px 0 rgba(255,255,255,.06) !important;
    transition: transform .12s ease, box-shadow .12s ease, filter .12s ease;
    display:grid; place-items:center;
  }
  .metal-btn:hover{
    filter:brightness(1.04);
    box-shadow:
      0 1px 0 rgba(255,255,255,.05) inset,
      0 -2px 6px rgba(0,0,0,.5) inset,
      0 0 14px rgba(56,189,248,.10),
      0 0 18px rgba(168,85,247,.10),
      0 12px 22px rgba(0,0,0,.34) !important;
  }
  .metal-btn:active{ transform:translateY(2px); box-shadow: 0 1px 0 rgba(255,255,255,.04) inset, 0 -1px 10px rgba(0,0,0,.55) inset, 0 6px 12px rgba(0,0,0,.28) !important; }
  .metal-btn.is-disabled{ opacity:.65; cursor:not-allowed; }

  .metal-btn .grain{
    position:absolute; inset:0; border-radius:18px; z-index:0; opacity:.12;
    background-image:url("data:image/svg+xml;utf8, <svg xmlns='http://www.w3.org/2000/svg' width='60' height='60' viewBox='0 0 60 60'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/><feComponentTransfer><feFuncA type='table' tableValues='0 0 .7 0'/></feComponentTransfer></filter><rect width='100%' height='100%' filter='url(%23n)' /></svg>");
    background-size:110px 110px; mix-blend-mode:overlay;
  }

  .metal-btn .content{
    position:relative; z-index:2; width:100%; height:100%;
    display:flex; align-items:center; justify-content:center; text-align:center;
    padding: 6%;
    border-radius:12px; background:transparent; line-height:1; font-weight:800;
  }

  /* Imagen genérica dentro de la casilla */
  .metal-btn .content img{
    display:block; width:100%; height:100%;
    object-fit: cover; border-radius:12px;
  }

  /* GOMITA: un poco más pequeña para no "salirse" del look metálico */
  .metal-btn .content img.gomy{
    width:66%; height:auto; object-fit:contain;
  }

  /* Chips y montos cuando se revela */
  .chip{
    --chip-h: clamp(22px, 6.2vw, 34px);
    --chip-fz: clamp(10px, 3.0vw, 14px);
    display:flex; align-items:center; justify-content:center;
    box-sizing:border-box;
    height:var(--chip-h); padding:0 clamp(6px, 2vw, 10px);
    max-width:68%; overflow:hidden; white-space:nowrap;
    border-radius:999px;
    border:1px solid rgba(255,255,255,.26);
    color:#eef3fb; letter-spacing:.2px; font-size:var(--chip-fz); font-weight:900;
    background: linear-gradient(180deg, rgba(255,255,255,.14), rgba(255,255,255,.05) 72%);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.20), inset 0 -1px 6px rgba(0,0,0,.28), 0 2px 10px rgba(0,0,0,.18);
    backdrop-filter: blur(1.2px);
  }
  .chip.money{
    --chip-h: clamp(24px, 6.6vw, 36px);
    --chip-fz: clamp(11px, 3.2vw, 15px);
    padding: 0 clamp(7px, 2.2vw, 11px);
    max-width: 66%;
  }

  .x{ font-size: clamp(18px, 6.6vw, 24px); font-weight: 900; color:#e6ebf4; opacity:.95; }

  /* COLORES POR PREMIO */
  .MG-looks-1500{
    background: linear-gradient(160deg,#1a2520 0%, #243a2f 50%, #2f6a54 100%) !important;
    border-color:#2f6a54 !important;
    box-shadow: 0 1px 0 rgba(255,255,255,.06) inset, 0 -2px 6px rgba(0,0,0,.45) inset, 0 12px 22px rgba(0,0,0,.28), 0 0 14px rgba(234,179,8,.12) !important;
  }
  .MG-looks-500{
    background: linear-gradient(160deg,#17251f 0%, #1f352a 50%, #2b5c46 100%) !important;
    border-color:#2b5c46 !important;
    box-shadow: 0 1px 0 rgba(255,255,255,.06) inset, 0 -2px 6px rgba(0,0,0,.45) inset, 0 12px 22px rgba(0,0,0,.28), 0 0 12px rgba(16,185,129,.10) !important;
  }
  .MG-looks-200{
    background: linear-gradient(160deg,#172033 0%, #1a2b45 50%, #274b72 100%) !important;
    border-color:#274b72 !important;
    box-shadow: 0 1px 0 rgba(255,255,255,.06) inset, 0 -2px 6px rgba(0,0,0,.45) inset, 0 12px 22px rgba(0,0,0,.28), 0 0 12px rgba(56,189,248,.12) !important;
  }
  .MG-looks-50{
    background: linear-gradient(160deg,#2b2f37 0%, #353b44 50%, #4c5561 100%) !important;
    border-color:#4c5561 !important;
    box-shadow: 0 1px 0 rgba(255,255,255,.06) inset, 0 -2px 6px rgba(0,0,0,.45) inset, 0 12px 20px rgba(0,0,0,.26) !important;
  }
  .MG-looks-gomita{
    background: linear-gradient(160deg,#281b3b 0%, #35265a 50%, #5a3fa1 100%) !important;
    border-color:#6b4bc5 !important;
    box-shadow: 0 1px 0 rgba(255,255,255,.06) inset, 0 -2px 6px rgba(0,0,0,.45) inset, 0 12px 22px rgba(0,0,0,.28), 0 0 14px rgba(168,85,247,.14) !important;
  }
  .MG-looks-nada{
    background: linear-gradient(160deg,#2f343a 0%, #3c434c 50%, #59616b 100%) !important;
    border-color:#3a414a !important;
    box-shadow: 0 1px 0 rgba(255,255,255,.06) inset, 0 -2px 6px rgba(0,0,0,.45) inset, 0 12px 20px rgba(0,0,0,.26) !important;
  }

  @media (max-width: 420px){
    .metal-btn .content{ padding: 7%; }
    .metal-btn .content img.gomy{ width:64%; }
  }
  @media (max-width: 360px){
    .metal-btn .content{ padding: 8%; }
    .metal-btn .content img.gomy{ width:60%; }
  }
    
/* ===================== FIX MONTOS (no más $10 ni $20 recortados) ===================== */

/* Más espacio interno para que el chip no choque con el borde */
.metal-btn .content{
  padding: 9% !important;
  display:flex; align-items:center; justify-content:center;
}

/* Pill blanco auto-ajustable, sin recortes */
.chip.money{
  display:inline-flex; align-items:center; justify-content:center;
  box-sizing:border-box;

  /* Alto estable y ancho por contenido; NADA de min-width obligatorio */
  height: clamp(24px, 18%, 34px);
  padding: 0 clamp(12px, 4.4vw, 18px);
  max-width: 90%;
  border-radius: 999px;
  overflow: visible;         /* <- clave para no cortar dígitos largos */
  white-space: nowrap;       /* una sola línea siempre */

  font-weight: 900;
  font-size: clamp(12px, 4.4vw, 18px);
  letter-spacing: .2px;
  line-height: 1;
  font-variant-numeric: tabular-nums;   /* números consistentes */

  color:#0b1220;
  background: linear-gradient(180deg, #ffffff, #e9eef7 78%);
  border: 1px solid rgba(255,255,255,.85);
  box-shadow:
    0 1px 0 rgba(255,255,255,.95) inset,
    0 -2px 8px rgba(0,0,0,.20) inset,
    0 4px 14px rgba(0,0,0,.28);
  text-shadow: 0 1px 0 rgba(255,255,255,.6);
}

/* Igualamos el pill en todos los fondos para que no cambie color ni contraste */
.MG-looks-1500 .chip.money,
.MG-looks-500  .chip.money,
.MG-looks-200  .chip.money,
.MG-looks-50   .chip.money{
  background: linear-gradient(180deg, #ffffff, #e9eef7 78%) !important;
  color:#0b1220 !important;
  border-color: rgba(255,255,255,.85) !important;
}

/* Sin premio: X limpia y centrada */
.x{
  font-size: clamp(16px, 5vw, 22px) !important;
  color:#e6ebf4 !important;
  opacity:.92; text-shadow: 0 1px 0 rgba(0,0,0,.28);
}

/* Móviles pequeños: un pelín más compacto, pero sin cortar números largos */
@media (max-width: 420px){
  .metal-btn .content{ padding: 10% !important; }
  .chip.money{
    height: clamp(22px, 20%, 32px);
    padding: 0 clamp(10px, 5vw, 16px);
    font-size: clamp(11px, 4.8vw, 16px);
    max-width: 92%;
  }
}

/* ===================== MODAL CON MÁS NEÓN · VIBE ELECTRÓNICA ===================== */

#MG-modal{
  position: fixed; inset: 0; z-index: 9999;
  display: none; align-items: center; justify-content: center;
  background:
    radial-gradient(1200px 800px at 50% -10%, rgba(0,191,255,.10), transparent 60%),
    radial-gradient(900px 600px at 50% 110%, rgba(255,91,247,.08), transparent 60%),
    linear-gradient(180deg, rgba(0,0,0,.55), rgba(0,0,0,.7));
  backdrop-filter: blur(7px) saturate(110%);
}

/* Tarjeta principal */
#MG-card-modal{
  position: relative;
  width: min(92vw, 460px);
  max-height: 90vh;
  border-radius: 24px;
  padding: 18px 16px 16px;
  background:
    radial-gradient(140% 120% at 50% 0%, rgba(255,255,255,.06), transparent 60%),
    linear-gradient(180deg, rgba(16,20,29,.96), rgba(12,16,24,.95));
  border: 1px solid rgba(60,90,120,.5);
  box-shadow:
    0 22px 60px rgba(0,0,0,.55),
    inset 0 1px 0 rgba(255,255,255,.05);
  color: #e7ecf3;
  display: grid; gap: 14px;
  overflow: hidden;
}

/* Doble halo neón animado */
#MG-card-modal::before,
#MG-card-modal::after{
  content:""; position:absolute; inset:-2px; border-radius: 26px; z-index:-1;
  background: conic-gradient(from 0deg, #00f7ff, #5bffb0, #9dfcfe, #ff5bf7, #00f7ff);
  filter: blur(10px) saturate(125%);
  opacity:.28;
  animation: neonSpin 10s linear infinite;
}
#MG-card-modal::after{
  inset:-6px; opacity:.18; filter: blur(18px) saturate(140%);
  animation-duration: 14s;
}
@keyframes neonSpin{ to{ transform: rotate(360deg); } }

/* Patrón de ecualizador muy suave al fondo */
#MG-card-modal .mg-eq{
  position:absolute; inset:0; z-index:0; opacity:.12; pointer-events:none;
  display:grid; grid-template-columns: repeat(24, 1fr); align-items:end; gap:6px;
  padding: 10px;
}
#MG-card-modal .mg-eq span{
  display:block; width:100%; height:18%;
  background: linear-gradient(180deg, rgba(0,191,255,.9), transparent);
  border-radius:4px 4px 0 0;
  animation: eqDance 2s ease-in-out infinite;
}
#MG-card-modal .mg-eq span:nth-child(odd){ animation-duration: 1.6s }
#MG-card-modal .mg-eq span:nth-child(3n){ animation-duration: 1.9s }
#MG-card-modal .mg-eq span:nth-child(5n){ animation-duration: 1.7s }
@keyframes eqDance{
  0%,100%{ height:16% } 25%{ height:62% } 50%{ height:34% } 75%{ height:78% }
}

/* Contenido del modal por encima de efectos */
#MG-figure, #MG-title-modal, #MG-msg, #MG-cta, #MG-ok{ position:relative; z-index:1; }

#MG-figure{
  display:grid; place-items:center;
  height: 160px; border-radius: 16px;
  background: linear-gradient(180deg, rgba(255,255,255,.04), rgba(0,0,0,.08));
  box-shadow: inset 0 1px 0 rgba(255,255,255,.04);
}
#MG-figure img{ max-width: 128px; width: 60%; height:auto; display:block; }

#MG-title-modal{ text-align:center; font-weight:800; line-height:1.2; text-shadow: 0 0 22px rgba(0,191,255,.30); }
#MG-title-modal .xl{ font-size: clamp(24px, 6.5vw, 36px); }
#MG-title-modal .md{ font-size: clamp(16px, 4.6vw, 20px); }
.MG-accent{ color:#9ef7ff; }
.MG-accent-purple{ color:#d7b6ff; }

#MG-msg{ text-align:center; color:#c9d8ea; font-size: 14px; }

/* Botones con neón */
#MG-cta, #MG-ok{
  appearance:none; border:0; border-radius:14px;
  padding:12px 14px; font-size:15px; font-weight:700; width:100%;
  cursor:pointer; transition: transform .05s ease, filter .2s ease, box-shadow .2s ease;
}
#MG-cta{
  display:none;
  background: linear-gradient(180deg, #00bfff, #1f6feb);
  color:#061018;
  box-shadow: 0 12px 30px rgba(0,191,255,.35), 0 0 26px rgba(0,191,255,.30);
}
#MG-cta:hover{ filter:brightness(1.07) }
#MG-cta:active{ transform: translateY(1px) }

#MG-ok{
  background: linear-gradient(180deg, rgba(255,255,255,.08), rgba(0,0,0,.06));
  color:#e7ecf3; border:1px solid rgba(60,90,120,.55);
  box-shadow: 0 10px 24px rgba(0,0,0,.35), 0 0 18px rgba(168,85,247,.20);
}
#MG-ok:hover{ filter:brightness(1.05) }
#MG-ok:active{ transform: translateY(1px) }

#MG-card-modal.success{ box-shadow: 0 22px 60px rgba(0,0,0,.55), 0 0 46px rgba(34,197,94,.22) inset, inset 0 1px 0 rgba(255,255,255,.05); }
#MG-card-modal.warn   { box-shadow: 0 22px 60px rgba(0,0,0,.55), 0 0 46px rgba(168,85,247,.24) inset, inset 0 1px 0 rgba(255,255,255,.05); }
#MG-card-modal.neutral{ box-shadow: 0 22px 60px rgba(0,0,0,.55), 0 0 40px rgba(148,163,184,.20) inset, inset 0 1px 0 rgba(255,255,255,.05); }

@media (max-width: 420px){
  #MG-card-modal{ width: min(94vw, 480px); padding: 16px 14px 14px; border-radius: 22px; }
  #MG-figure{ height: 140px; }
}
/* ===== NÚMEROS PEQUEÑOS Y CENTRADOS ===== */

.metal-btn .content{
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  padding: 0 !important;          /* nada de espacio raro */
  width: 100% !important;
  height: 100% !important;
}

/* El pill del monto ahora centrado exacto */
.chip.money{
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto;                 /* centra horizontal */
  
  height: clamp(20px, 16%, 26px) !important;
  padding: 0 clamp(6px, 2.8vw, 10px) !important;
  font-size: clamp(10px, 3vw, 13px) !important;
  
  border-radius: 999px;
  background: linear-gradient(180deg, #ffffff, #e9eef7 78%);
  color: #0b1220;
  font-weight: 900;
  line-height: 1;
  white-space: nowrap;
  max-width: 80% !important;
  overflow: visible;
}

/* Ajuste especial para $1000 */
.MG-1500 .chip.money{
  font-size: clamp(9px, 2.8vw, 12px) !important;
  padding: 0 clamp(5px, 2.4vw, 5px) !important;
  max-width: 90% !important;
}

/* La X de "sin premio" igual centrada y más chica */
.x{
  font-size: clamp(40px, 4vw, 18px) !important;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}
  /* ===== COLORES PERSONALIZADOS POR PREMIO ===== */

/* $1000 → dorado */
.MG-1500 .chip.money{
  background: linear-gradient(180deg, #ffe259, #ffa751) !important;
  color: #201200 !important;
  border: 1px solid rgba(255,215,0,.8) !important;
  text-shadow: 0 1px 0 rgba(255,255,255,.5);
}

/* $500 → verde esmeralda */
.MG-500 .chip.money{
  background: linear-gradient(180deg, #5efc82, #21ba45) !important;
  color: #052d13 !important;
  border: 1px solid rgba(34,197,94,.8) !important;
  text-shadow: 0 1px 0 rgba(255,255,255,.5);
}

/* $200 → azul brillante */
.MG-200 .chip.money{
  background: linear-gradient(180deg, #67e8f9, #0284c7) !important;
  color: #041c2a !important;
  border: 1px solid rgba(56,189,248,.8) !important;
  text-shadow: 0 1px 0 rgba(255,255,255,.5);
}

/* $50 → plateado */
.MG-50 .chip.money{
  background: linear-gradient(180deg, #f4f4f5, #9ca3af) !important;
  color: #111827 !important;
  border: 1px solid rgba(156,163,175,.8) !important;
  text-shadow: 0 1px 0 rgba(255,255,255,.5);
}

/* Ajuste para que todos sigan centrados y chiquitos */
.chip.money{
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto;
  height: clamp(20px, 16%, 26px) !important;
  padding: 0 clamp(6px, 2.8vw, 10px) !important;
  font-size: clamp(10px, 3vw, 13px) !important;
  font-weight: 900;
  line-height: 1;
  border-radius: 999px;
  white-space: nowrap;
  max-width: 80% !important;
}
`;

/* ========== DOM cache ========= */
let MG_board, MG_status, MG_code1, MG_code2, MG_goBtn;
let MG_modal, MG_cardM, MG_tModal, MG_msg, MG_cta, MG_ok, MG_figure;
let MG_pModal, MG_pIn, MG_pOk, MG_pCancel, MG_pErr, MG_canvas;

function MG_cacheDom(){
  MG_board  = document.getElementById("MG-board");
  MG_status = document.getElementById("MG-status");
  MG_code1  = document.getElementById("MG-code1");
  MG_code2  = document.getElementById("MG-code2");
  MG_goBtn  = document.getElementById("MG-validar");

  MG_modal  = document.getElementById("MG-modal");
  MG_cardM  = document.getElementById("MG-card-modal");
  MG_tModal = document.getElementById("MG-title-modal");
  MG_msg    = document.getElementById("MG-msg");
  MG_cta    = document.getElementById("MG-cta");
  MG_ok     = document.getElementById("MG-ok");
  MG_figure = document.getElementById("MG-figure");

  MG_pModal  = document.getElementById("MG-phone");
  MG_pIn     = document.getElementById("MG-phone-input");
  MG_pOk     = document.getElementById("MG-phone-ok");
  MG_pCancel = document.getElementById("MG-phone-cancel");
  MG_pErr    = document.getElementById("MG-phone-error");
  MG_canvas  = document.getElementById("MG-canvas");
}

/* ===== Modal wiring a prueba de sustos ===== */
function MG_wireModalClose(){
  MG_cacheDom();

  if (MG_ok && !MG_ok._wiredClose) {
    MG_ok.type = "button";
    MG_ok.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      MG_close();
    });
    MG_ok._wiredClose = true;
  }
  if (MG_modal && !MG_modal._wiredBackdrop) {
    MG_modal.addEventListener('click', (e) => {
      if (e.target === MG_modal) MG_close();
    });
    MG_modal._wiredBackdrop = true;
  }
  if (!document._mgDelegation) {
    document.addEventListener('click', (e) => {
      const t = e.target;
      if (t && t.id === 'MG-ok') {
        e.preventDefault();
        e.stopPropagation();
        MG_close();
      }
    }, true);
    document._mgDelegation = true;
  }
  if (!window._mgKeyClose) {
    window.addEventListener('keydown', (e) => {
      if (!MG_modal) return;
      const open = MG_modal.style.display && MG_modal.style.display !== 'none';
      if (!open) return;
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault();
        MG_close();
      }
    });
    window._mgKeyClose = true;
  }
}

/* ========== Estado ========= */
let MG_ready=false, MG_codes=null, MG_tel=null, MG_picked=false;

/* ========== Inyección de estilos ========= */
function MG_injectStyle(id, css){
  if (document.getElementById(id)) return;
  const s=document.createElement("style");
  s.id=id; s.textContent=css; document.head.appendChild(s);
}
function MG_decorateBoard(){
  if (!MG_board || MG_board._decorated) return;
  ["tl","tr","bl","br"].forEach(p=>{
    const s = document.createElement("i");
    s.className = "screw " + p;
    MG_board.appendChild(s);
  });
  MG_board._decorated = true;
}

/* ========== Helpers UI ========= */
function MG_makeMetal(btn){
  if (!btn.classList.contains('metal-btn')){
    btn.classList.add('metal-btn');
    btn.innerHTML = `<span class="grain" aria-hidden="true"></span><span class="content"></span>`;
  }
}

function MG_setIcon(btn, kind){
  MG_makeMetal(btn);
  const content = btn.querySelector('.content');

  let alt='Sin premio';
  if (kind==='HIDDEN') alt='Oculto';
  else if (kind==='p1000') alt='$1000';
  else if (kind==='p500')  alt='$500';
  else if (kind==='p200')  alt='$200';
  else if (kind==='p50')   alt='$50';
  else if (kind==='gomita')alt='Gomitas';

  if (kind === 'HIDDEN'){
    // Imagen que se adapta a la casilla
    content.innerHTML = `<img class="hidden-cover" src="${MG_HIDDEN_IMG}" alt="Oculto">`;
  } else if (kind === 'gomita'){
    content.innerHTML = `<img class="gomy" alt="Gomita" src="${MG_IMG_GOMITA}">`;
  } else if (kind === 'p1000'){
    content.innerHTML = `<span class="chip money">$1000</span>`;
  } else if (kind === 'p500'){
    content.innerHTML = `<span class="chip money">$500</span>`;
  } else if (kind === 'p200'){
    content.innerHTML = `<span class="chip money">$200</span>`;
  } else if (kind === 'p50'){
    content.innerHTML = `<span class="chip money">$50</span>`;
  } else {
    content.innerHTML = `<span class="x">×</span>`;
  }
  btn.setAttribute('aria-label', alt);
}

function MG_setLooks(btn, kind){
  btn.classList.remove(
    'MG-looks-1500','MG-looks-500','MG-looks-200','MG-looks-50','MG-looks-gomita','MG-looks-nada',
    'MG-1500','MG-500','MG-200','MG-50'
  );

  if      (kind==='p1000') { btn.classList.add('MG-looks-1500','MG-1500'); }
  else if (kind==='p500')  { btn.classList.add('MG-looks-500','MG-500'); }
  else if (kind==='p200')  { btn.classList.add('MG-looks-200','MG-200'); }
  else if (kind==='p50')   { btn.classList.add('MG-looks-50','MG-50'); }
  else if (kind==='gomita'){ btn.classList.add('MG-looks-gomita'); }
  else                     { btn.classList.add('MG-looks-nada'); }
}
function MG_paint(msg,color){ if(MG_status){ MG_status.textContent=msg; MG_status.style.color=color||"#9fb0c9"; } }
function MG_lock(){   if(!MG_board) return; [...MG_board.children].forEach(b=>{ if(!b.classList.contains('screw')) b.disabled=true; });  MG_ready=false; }
function MG_unlock(){ if(!MG_board) return; [...MG_board.children].forEach(b=>{ if(!b.classList.contains('screw')) b.disabled=false; }); MG_ready=true;  }

/* ========== Vitrina inicial ========= */
function MG_makeVitrine(){
  if (!MG_board) return;
  const pool=['p1000','p500'];
  for(let i=0;i<MG_COUNTS.p200;i++)   pool.push('p200');
  for(let i=0;i<MG_COUNTS.p50;i++)    pool.push('p50');
  for(let i=0;i<MG_COUNTS.gomita;i++) pool.push('gomita');
  for(let i=pool.length;i<MG_TOTAL;i++) pool.push('nada');
  for(let i=pool.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [pool[i],pool[j]]=[pool[j],pool[i]]; }

  MG_board.innerHTML='';
  pool.forEach(k=>{
    const b=document.createElement('button');
    b.type='button';
    MG_setIcon(b,k);
    MG_setLooks(b,k);
    b.disabled=true;
    MG_board.appendChild(b);
  });
  MG_paint("Necesitas 2 códigos válidos para jugar.", "#9fb0c9");
}

/* ========== Validar y jugar ========= */
async function MG_onValidate(){
  const c1 = MG_toId(MG_code1.value), c2 = MG_toId(MG_code2.value);
  if(!c1 || !c2){ MG_paint("Ingresa los 2 códigos.","#ff6b6b"); MG_lock(); return; }
  if(c1===c2){ MG_paint("Los códigos deben ser distintos.","#ff6b6b"); MG_lock(); return; }

  try{
    const ok1 = await MG_checkCode(c1);
    const ok2 = await MG_checkCode(c2);
    if(!ok1 || !ok2){ MG_paint("Código inválido o ya usado.","#ff6b6b"); MG_lock(); return; }

    try{ MG_tel = await MG_phoneAsk(); }
    catch(_){ MG_paint("Participación cancelada.","#fca5a5"); return; }

    MG_codes = { c1, c2 };
    MG_paint("Tienes 1 intento. Mezclando...","#3fb950");
    await MG_flipShuffle();
  }catch(e){ console.error(e); MG_paint("Error al validar.","#ff6b6b"); }
}

/* ========== Flip + shuffle + pool real ========= */
async function MG_flipShuffle(){
  const bs=[...MG_board.children].filter(x=>!x.classList.contains('screw'));
  await Promise.all(bs.map((b,i)=>new Promise(res=>{
    setTimeout(()=>{ MG_setIcon(b,'HIDDEN'); b.classList.remove('MG-looks-1500','MG-looks-500','MG-looks-200','MG-looks-gomita','MG-looks-nada','MG-1500','MG-500','MG-200'); res(); }, i*18);
  })));
  await MG_realPool();
  bs.forEach((b,i)=>{ setTimeout(()=>{ b.classList.add("MG-is-shuffling"); setTimeout(()=>b.classList.remove("MG-is-shuffling"),650); }, i*10); });
  MG_unlock(); MG_ready=true; MG_picked=false;
  MG_paint("Códigos validados. Elige una casilla.","#3fb950");
}

/* ========== Control global Firestore ========= */
async function MG_getControl(){
  const snap = await getDoc(MG_controlRef);
  if (!snap.exists()) {
    await setDoc(MG_controlRef, {
      since1000: 0, since500: 0, since200: 0, since50: 0, sinceGomita: 0,
      wins1000: 0,  wins500: 0,  wins200: 0,  wins50: 0,  winsGomita: 0,
      totalPlays: 0, updatedAt: serverTimestamp()
    });
    return { since1000:0, since500:0, since200:0, since50:0, sinceGomita:0, wins1000:0, wins500:0, wins200:0, wins50:0, winsGomita:0, totalPlays:0 };
  }
  const d = snap.data() || {};
  const patch = {};
  if (d.since1000   == null) patch.since1000   = 0;
  if (d.since500    == null) patch.since500    = 0;
  if (d.since200    == null) patch.since200    = 0;
  if (d.since50     == null) patch.since50     = 0;
  if (d.sinceGomita == null) patch.sinceGomita = 0;
  if (d.wins1000    == null) patch.wins1000    = 0;
  if (d.wins500     == null) patch.wins500     = 0;
  if (d.wins200     == null) patch.wins200     = 0;
  if (d.wins50      == null) patch.wins50      = 0;
  if (d.winsGomita  == null) patch.winsGomita  = 0;
  if (d.totalPlays  == null) patch.totalPlays  = 0;
  if (Object.keys(patch).length) await setDoc(MG_controlRef, { ...patch, updatedAt: serverTimestamp() }, { merge:true });
  return {
    since1000:+(d.since1000 ?? 0), since500:+(d.since500 ?? 0), since200:+(d.since200 ?? 0),
    since50:+(d.since50 ?? 0), sinceGomita:+(d.sinceGomita ?? 0),
    wins1000:+(d.wins1000 ?? 0), wins500:+(d.wins500 ?? 0), wins200:+(d.wins200 ?? 0),
    wins50:+(d.wins50 ?? 0), winsGomita:+(d.winsGomita ?? 0), totalPlays:+(d.totalPlays ?? 0)
  };
}

/* ========== Pool real + handlers ========= */
async function MG_realPool(){
  const c = await MG_getControl();
  const en = {
    p1000 : c.since1000   >= MG_THRESH.p1000,
    p500  : c.since500    >= MG_THRESH.p500,
    p200  : c.since200    >= MG_THRESH.p200,
    p50   : c.since50     >= MG_THRESH.p50,
    gomita: c.sinceGomita >= MG_THRESH.gomita
  };
  const pool=[];
  if (en.p1000) pool.push('p1000');
  if (en.p500)  pool.push('p500');
  for (let i=0;i<(en.p200?MG_COUNTS.p200:0);i++)   pool.push('p200');
  for (let i=0;i<(en.p50?MG_COUNTS.p50:0);i++)     pool.push('p50');
  for (let i=0;i<(en.gomita?MG_COUNTS.gomita:0);i++) pool.push('gomita');
  for (let i=pool.length;i<MG_TOTAL;i++) pool.push('nada');
  for (let i=pool.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [pool[i],pool[j]]=[pool[j],pool[i]]; }

  [...MG_board.children].filter(x=>!x.classList.contains('screw')).forEach((b,idx)=>{
    b.dataset.MGprize = pool[idx];
    MG_setIcon(b,'HIDDEN');
    b.disabled=false;
    b.onclick=()=>MG_onPick(b);
  });

  MG_board.dataset.fake1000   = String(!en.p1000);
  MG_board.dataset.fake500    = String(!en.p500);
  MG_board.dataset.fake200    = String(!en.p200);
  MG_board.dataset.fake50     = String(!en.p50);
  MG_board.dataset.fakeGomita = String(!en.gomita);
}

/* ========== Click en casilla ========= */
async function MG_onPick(btn){
  if(!MG_ready || !MG_codes || MG_picked) return;
  MG_picked=true; MG_lock();

  const cand = btn.dataset.MGprize;
  await MG_reveal(btn, cand);

  try{ await MG_persist(MG_codes.c1, MG_codes.c2, MG_tel, cand); }
  catch(e){ console.error(e); MG_paint("No se pudo registrar la jugada.","#fca5a5"); }

  await MG_revealRest(btn);

  if      (cand==='p1000'){ MG_confetti('gold');  MG_open('success','p1000'); }
  else if (cand==='p500') { MG_confetti('gold');  MG_open('success','p500');  }
  else if (cand==='p200') { MG_confetti('gold');  MG_open('success','p200');  }
  else if (cand==='p50')  { MG_confetti('gold');  MG_open('success','p50');   }
  else if (cand==='gomita'){ MG_confetti('purple'); MG_open('warn','gomita'); }
  else                     { MG_open('neutral','nada'); }
}
function MG_reveal(btn,kind){
  return new Promise(res=>{
    btn.classList.add('MG-is-flipping');
    setTimeout(()=>{
      MG_setIcon(btn,kind); MG_setLooks(btn,kind);
      btn.classList.remove('MG-is-flipping'); btn.classList.add('MG-pop');
      setTimeout(()=>{ btn.classList.remove('MG-pop'); res(); },160);
    },160);
  });
}
function MG_revealRest(chosen){
  const bs=[...MG_board.children].filter(x=>!x.classList.contains('screw'));
  const avail = bs.filter(b => b !== chosen);
  const countReal = k => bs.filter(b => b.dataset.MGprize === k).length;
  const take = (n) => { const out=[]; for(let i=0;i<n && avail.length;i++){ const j=(Math.random()*avail.length)|0; out.push(avail.splice(j,1)[0]); } return out; };

  const fakes = [];
  if (MG_board.dataset.fake1000 === "true" && countReal('p1000') === 0) fakes.push({k:'p1000', bs: take(1)});
  if (MG_board.dataset.fake500  === "true" && countReal('p500')  === 0) fakes.push({k:'p500',  bs: take(1)});
  if (MG_board.dataset.fake200  === "true"){
    const need200 = Math.max(0, MG_COUNTS.p200 - countReal('p200'));
    if (need200 > 0) fakes.push({k:'p200',  bs: take(need200)});
  }
  if (MG_board.dataset.fake50 === "true"){
    const need50 = Math.max(0, MG_COUNTS.p50 - countReal('p50'));
    if (need50 > 0) fakes.push({k:'p50',  bs: take(need50)});
  }
  if (MG_board.dataset.fakeGomita === "true"){
    const needG = Math.max(0, MG_COUNTS.gomita - countReal('gomita'));
    if (needG > 0) fakes.push({k:'gomita', bs: take(needG)});
  }

  let t=110;
  const ps=[];
  for(const b of bs){
    if(b===chosen) continue;
    ps.push(new Promise(r=>{
      setTimeout(()=>{
        const fk = fakes.find(x => x.bs.includes(b));
        if (fk){ MG_setIcon(b,fk.k); MG_setLooks(b,fk.k); }
        else { const k=b.dataset.MGprize; MG_setIcon(b,k); MG_setLooks(b,k); }
        r();
      }, t);
      t += 45;
    }));
  }
  return Promise.all(ps);
}

/* ========== Validación códigos ========= */
async function MG_checkCode(codeRaw){
  const code = MG_toId(codeRaw);
  const ref  = doc(db,"codigos",code);
  const s    = await getDoc(ref);
  if(!s.exists()) return false;
  const d = s.data()||{};
  if((d.estado||"").toLowerCase()==="usado") return false;
  return true;
}

/* ========== Persistencia + contadores ========= */
async function MG_persist(c1,c2,phone,rawPrize){
  const r1   = doc(db,"codigos",MG_toId(c1));
  const r2   = doc(db,"codigos",MG_toId(c2));
  const play = doc(MG_playsCol);
  const cascade=(cand,elig)=>{
    switch(cand){
      case 'p1000': return elig.p1000 ? 'p1000' : elig.p500 ? 'p500' : elig.p200 ? 'p200' : elig.p50 ? 'p50' : elig.gomita ? 'gomita' : 'nada';
      case 'p500' : return elig.p500  ? 'p500'  : elig.p200 ? 'p200' : elig.p50 ? 'p50' : elig.gomita ? 'gomita' : 'nada';
      case 'p200' : return elig.p200  ? 'p200'  : elig.p50 ? 'p50' : elig.gomita ? 'gomita' : 'nada';
      case 'p50'  : return elig.p50   ? 'p50'   : elig.gomita ? 'gomita' : 'nada';
      case 'gomita':return elig.gomita? 'gomita': 'nada';
      default:      return 'nada';
    }
  };
  await runTransaction(db, async (tx)=>{
    const cSnap = await tx.get(MG_controlRef);
    const cData = cSnap.exists() ? (cSnap.data()||{}) : {
      since1000:0, since500:0, since200:0, since50:0, sinceGomita:0,
      wins1000:0, wins500:0, wins200:0, wins50:0, winsGomita:0, totalPlays:0
    };
    const s1 = await tx.get(r1), s2 = await tx.get(r2);
    if(!s1.exists() || !s2.exists()) throw new Error("Código no existe");
    const d1=s1.data()||{}, d2=s2.data()||{};
    if((d1.estado||"").toLowerCase()==="usado" || (d2.estado||"").toLowerCase()==="usado")
      throw new Error("Código ya usado");

    const elig = {
      p1000:+(cData.since1000||0)>=MG_THRESH.p1000,
      p500 :+(cData.since500 ||0)>=MG_THRESH.p500,
      p200 :+(cData.since200 ||0)>=MG_THRESH.p200,
      p50  :+(cData.since50  ||0)>=MG_THRESH.p50,
      gomita:+(cData.sinceGomita||0)>=MG_THRESH.gomita
    };
    const final = cascade(rawPrize, elig);

    tx.set(play,{ codigo1:MG_toId(c1), codigo2:MG_toId(c2), telefono:phone, rawPrize, finalPrize:final, createdAt:serverTimestamp() });
    tx.set(r1,{ estado:"usado", usadoEn:"MegaJuego5x5", usadoAt:serverTimestamp(), telefono:phone, resultado:final },{ merge:true });
    tx.set(r2,{ estado:"usado", usadoEn:"MegaJuego5x5", usadoAt:serverTimestamp(), telefono:phone, resultado:final },{ merge:true });

    const next = {
      since1000:   final==='p1000' ? 0 : +(cData.since1000||0)+1,
      since500 :   final==='p500'  ? 0 : +(cData.since500 ||0)+1,
      since200 :   final==='p200'  ? 0 : +(cData.since200 ||0)+1,
      since50  :   final==='p50'   ? 0 : +(cData.since50  ||0)+1,
      sinceGomita: final==='gomita'? 0 : +(cData.sinceGomita||0)+1,
      wins1000:   (cData.wins1000  ||0) + (final==='p1000'?1:0),
      wins500 :   (cData.wins500   ||0) + (final==='p500' ?1:0),
      wins200 :   (cData.wins200   ||0) + (final==='p200' ?1:0),
      wins50  :   (cData.wins50    ||0) + (final==='p50'  ?1:0),
      winsGomita: (cData.winsGomita||0) + (final==='gomita'?1:0),
      totalPlays: (cData.totalPlays||0) + 1,
      updatedAt: serverTimestamp()
    };
    tx.set(MG_controlRef, next, { merge:true });
  });
}

/* ========== Modales + confeti ========= */
function MG_open(variant,kind){
  MG_figure.innerHTML=""; MG_cardM.classList.remove('success','warn','neutral'); if(variant) MG_cardM.classList.add(variant);
  const im=document.createElement('img'); im.src=MG_icon(kind); im.alt=kind; MG_figure.appendChild(im);
  if(kind==='p1000'){
    MG_tModal.innerHTML=`<div class="MG-headline"><span class="md">¡PREMIO MAYOR!</span><br><span class="xl MG-accent">$1000</span></div>`;
    MG_msg.innerHTML = `<div style="text-align:center"><span style="color:#fde68a;font-weight:800">TOMA CAPTURA DE PANTALLA</span><br><span>Envíala por DM en Instagram.</span></div>`;
    MG_cta.style.display='inline-flex'; MG_cta.href=MG_IG_URL; MG_cta.textContent='Abrir Instagram';
  } else if(kind==='p500'){
    MG_tModal.innerHTML=`<div class="MG-headline"><span class="md">¡GANASTE</span> <span class="md MG-accent">$500!</span></div>`;
    MG_msg.innerHTML = `<div style="text-align:center"><span style="color:#fde68a;font-weight:800">TOMA CAPTURA DE PANTALLA</span><br><span>DM para reclamar.</span></div>`;
    MG_cta.style.display='inline-flex'; MG_cta.href=MG_IG_URL;
  } else if(kind==='p200'){
    MG_tModal.innerHTML=`<div class="MG-headline"><span class="md">¡GANASTE</span> <span class="md MG-accent">$200!</span></div>`;
    MG_msg.innerHTML = `<div style="text-align:center"><span style="color:#fde68a;font-weight:800">TOMA CAPTURA DE PANTALLA</span><br><span>DM para reclamar.</span></div>`;
    MG_cta.style.display='inline-flex'; MG_cta.href=MG_IG_URL;
  } else if(kind==='p50'){
    MG_tModal.innerHTML=`<div class="MG-headline"><span class="md">¡GANASTE</span> <span class="md MG-accent">$50!</span></div>`;
    MG_msg.innerHTML = `<div style="text-align:center"><span>Presenta la captura para canjear.</span></div>`;
    MG_cta.style.display='inline-flex'; MG_cta.href=MG_IG_URL;
  } else if(kind==='gomita'){
    MG_tModal.innerHTML=`<div class="MG-headline"><span class="md">¡GOMITAS</span> <span class="md MG-accent-purple">GANADAS!</span></div>`;
    MG_msg.innerHTML = `<div style="text-align:center"><span style="color:#fde68a;font-weight:800">TOMA CAPTURA DE PANTALLA</span><br><span>DM para canjear.</span></div>`;
    MG_cta.style.display='inline-flex'; MG_cta.href=MG_IG_URL;
  } else {
    MG_tModal.innerHTML=`<div class="MG-headline"><span class="md">SIN PREMIO</span><br><span class="xl">ESTA VEZ</span></div>`;
    MG_msg.innerHTML = `<div style="text-align:center"><span>Sigue participando con más códigos.</span></div>`;
    MG_cta.style.display='none';
  }
  MG_modal.style.display='flex'; MG_ok?.focus();
}
function MG_close(){ MG_modal.style.display='none'; MG_code1.value=''; MG_code2.value=''; MG_codes=null; MG_tel=null; MG_ready=false; MG_paint('Ingresa 2 códigos para jugar.','#9fb0c9'); }
function MG_validPhone(v){ const d=(v||'').replace(/\D/g,''); return d.length>=8 && d.length<=15 ? d : null; }
function MG_phoneOpen(){ MG_pErr.textContent=''; MG_pIn.value=''; MG_pModal.style.display='flex'; setTimeout(()=>MG_pIn.focus(),0); }
function MG_phoneClose(){ MG_pModal.style.display='none'; }
function MG_phoneAsk(){
  return new Promise((res,rej)=>{
    MG_phoneOpen();
    const ok=()=>{ const v=MG_validPhone(MG_pIn.value); if(!v){MG_pErr.textContent='Ingresa un teléfono válido (8 a 15 dígitos).'; return;} MG_phoneClose(); res(v); };
    const cancel=()=>{ MG_phoneClose(); rej(new Error('cancelado')); };
    MG_pOk.onclick=ok; MG_pCancel.onclick=cancel;
    MG_pModal.onclick=e=>{ if(e.target===MG_pModal) cancel(); };
    const h=e=>{ if(MG_pModal.style.display==='flex'&&e.key==='Enter') ok(); if(MG_pModal.style.display==='flex'&&e.key==='Escape') cancel(); };
    window.addEventListener('keydown',h,{once:true});
  });
}

/* ========== Confeti ========= */
function MG_confetti(pal='gold'){
  if (!MG_canvas) return;
  const ctx = MG_canvas.getContext('2d'); if(!ctx) return;
  const r = MG_canvas.getBoundingClientRect();
  MG_canvas.width  = r.width * devicePixelRatio;
  MG_canvas.height = r.height * devicePixelRatio;
  ctx.scale(devicePixelRatio,devicePixelRatio);
  const cols = pal==='gold' ? ["#ffd700","#ffb300","#ff7a00","#fff2a8"] : ["#9b5cf7","#7c3aed","#c084fc","#e9d5ff"];
  const pcs = Array.from({length:120},()=>({ x:Math.random()*r.width, y:-20-Math.random()*60, w:6+Math.random()*6, h:8+Math.random()*10, vx:-1+Math.random()*2, vy:2+Math.random()*2.5, rot:Math.random()*Math.PI, vr:-0.22+Math.random()*0.44, color:cols[(Math.random()*cols.length)|0] }));
  let run=true; const start=performance.now();
  function tick(t){
    if(!run) return; const el=t-start;
    ctx.clearRect(0,0,r.width,r.height);
    for(const p of pcs){ p.x+=p.vx; p.y+=p.vy; p.rot+=p.vr; p.vy+=0.02; ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot); ctx.fillStyle=p.color; ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h); ctx.restore(); }
    if(el<2400) requestAnimationFrame(tick); else { run=false; ctx.clearRect(0,0,r.width,r.height); }
  }
  requestAnimationFrame(tick);
}

/* ========== Boot ========= */
function MG_hasCells(el){
  return el && [...el.children].some(node => !node.classList?.contains?.('screw'));
}
function MG_forceInitialState(){
  if (MG_modal)  MG_modal.style.display='none';
  if (MG_pModal) MG_pModal.style.display='none';
  if (MG_board && !MG_hasCells(MG_board)) MG_makeVitrine();
  MG_paint?.('Ingresa 2 códigos para jugar.', '#9fb0c9');
}
function MG_boot(){
  MG_injectStyle("MG-board-css", MG_CSS_BOARD);
  MG_injectStyle("MG-metal-css", MG_CSS_METAL);
  MG_cacheDom();
  MG_wireModalClose();

  // Importante: primero crea casillas, luego atornilla el marco
  MG_forceInitialState();
  MG_decorateBoard();

  if (MG_goBtn && !MG_goBtn._wired){ MG_goBtn.addEventListener('click', MG_onValidate); MG_goBtn._wired=true; }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', MG_boot);
else MG_boot();

// Reintento por si el DOM llegó después
setTimeout(()=>{
  MG_cacheDom();
  MG_wireModalClose();
  const b = document.getElementById('MG-board');
  if (b && !MG_hasCells(b)) { MG_forceInitialState(); MG_decorateBoard(); }
}, 300);
