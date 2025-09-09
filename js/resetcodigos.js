// ========== RESET CODIGOS ==========
import { db } from "./firebaseClient.js";
import {
  collection, query, where, getDocs, writeBatch
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

async function resetCodigos() {
  try {
    const q = query(collection(db, "codigos"), where("estado", "==", "usado"));
    const snap = await getDocs(q);

    if (snap.empty) {
      alert("No hay códigos en estado 'usado'.");
      return;
    }

    const batch = writeBatch(db);
    snap.forEach(docSnap => {
      batch.update(docSnap.ref, { estado: "activo" });
    });

    await batch.commit();
    alert(`Se actualizaron ${snap.size} códigos a 'activo'.`);
  } catch (err) {
    console.error("Error al resetear códigos:", err);
    alert("Error al resetear, revisa la consola.");
  }
}

// ★★ ESTA ES LA CLAVE ★★
window.resetCodigos = resetCodigos;
