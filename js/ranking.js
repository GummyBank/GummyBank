// Este archivo asume que firebaseClient.js ya inicializó Firebase
// y exporta `db` (Firestore). No lo rompas.
import { db } from "./firebaseClient.js";
import {
  collection, query, orderBy, limit, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

const col = collection(db, "rankingVentas");
const q = query(col, orderBy("score", "desc"), limit(200));

const topPodio = document.getElementById("topPodio");
const listado  = document.getElementById("listado");

function renderTop(top3){
  topPodio.innerHTML = "";
  const medals = [
    {cls:"m1", place:1, prize:"$500"},
    {cls:"m2", place:2, prize:"$200"},
    {cls:"m3", place:3, prize:"$100"},
  ];

  medals.forEach((m, i) => {
    const d = top3[i];
    const card = document.createElement("div");
    card.className = "top-card";

    if(d){
      card.innerHTML = `
        <div class="medal ${m.cls}">${m.place}</div>
        <div>
          <div class="user">${d.username ?? "—"}</div>
          <div class="school"><i class="bi bi-building"></i> ${d.escuela ?? "—"}</div>
          <div class="prize">Premio: ${m.prize}</div>
        </div>
        <div class="score"><i class="bi bi-trophy"></i> ${Number(d.score ?? 0)}</div>
      `;
    } else {
      card.innerHTML = `
        <div class="medal ${m.cls}">${m.place}</div>
        <div>
          <div class="user">—</div>
          <div class="school">&nbsp;</div>
          <div class="prize">Premio: ${m.prize}</div>
        </div>
        <div class="score">0</div>
      `;
    }

    topPodio.appendChild(card);
  });
}

// Lista desde el 4.º lugar hacia abajo
function renderList(items){
  listado.innerHTML = "";

  // Cortamos los 3 primeros para que se queden solo en el podio
  const rest = items.slice(3);

  rest.forEach((d, i) => {
    const rankNumber = i + 4; // 4, 5, 6, ...
    const row = document.createElement("div");
    row.className = "row";

    row.innerHTML = `
      <div class="rank">${rankNumber}</div>
      <div class="uname">
        ${d.username ?? "—"} <span class="school">· ${d.escuela ?? "—"}</span>
      </div>
      <div class="rscore">${Number(d.score ?? 0)}</div>
    `;

    listado.appendChild(row);
  });
}

onSnapshot(q, snap => {
  const arr = [];
  snap.forEach(doc => arr.push(doc.data()));

  // Podio: intenta tomar hasta 3, aunque haya menos registros
  renderTop([arr[0], arr[1], arr[2]]);

  // Lista: a partir del 4
  renderList(arr);
});
