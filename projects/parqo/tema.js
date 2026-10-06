// Tema scelto (chiaro/scuro), applicato subito prima di disegnare la pagina: niente lampo bianco.
try { const t = localStorage.getItem('tema'); if (t) document.documentElement.dataset.theme = t; } catch { /* memoria del browser non disponibile */ }
