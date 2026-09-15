/* ═══════════════════════════════════════════════════
   Angelo Lacatena — Portfolio Vol. 03
   Scena 3D · preloader · reveal · cursore · tilt
   ═══════════════════════════════════════════════════ */

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isTouch = window.matchMedia("(hover: none)").matches;

/* ── PRELOADER ── */
const loader = document.querySelector("[data-loader]");
const countEl = document.querySelector("[data-count]");
const barEl = document.querySelector("[data-bar]");

/* Le animazioni di ingresso girano solo durante "entering":
   al termine il titolo resta testo statico e non può sparire. */
document.body.classList.add("entering");
setTimeout(() => document.body.classList.remove("entering"), 6000);

if (loader && countEl && !reduceMotion) {
  document.body.classList.add("loading");
  let value = 0;
  const tick = () => {
    value += Math.max(1, Math.round((100 - value) / 12));
    if (value >= 100) value = 100;
    countEl.textContent = value;
    if (barEl) barEl.style.width = value + "%";
    if (value < 100) {
      setTimeout(tick, 35 + Math.random() * 60);
    } else {
      setTimeout(() => {
        loader.classList.add("done");
        document.body.classList.remove("loading");
        setTimeout(() => loader.remove(), 900);
      }, 300);
    }
  };
  tick();
} else if (loader) {
  loader.remove();
}

/* ── SCENA 3D (Three.js) ──
   Nube di particelle che si trasforma tra un icosaedro
   e un nodo toroidale; reagisce a puntatore e scroll. */
(() => {
  const canvas = document.querySelector("[data-gl]");
  if (!canvas || typeof THREE === "undefined") return;

  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const COUNT = isTouch ? 4200 : 7800;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(DPR);
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x07080d, 0.055);

  const camera = new THREE.PerspectiveCamera(
    50, window.innerWidth / window.innerHeight, 0.1, 100
  );
  camera.position.z = 11;

  /* — Campionamento delle superfici — */
  const sampleGeometry = (geo, n) => {
    const pos = geo.attributes.position;
    const out = new Float32Array(n * 3);
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    const idx = geo.index;
    const triCount = idx ? idx.count / 3 : pos.count / 3;
    for (let i = 0; i < n; i++) {
      const t = Math.floor(Math.random() * triCount);
      const i0 = idx ? idx.getX(t * 3) : t * 3;
      const i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
      const i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
      a.fromBufferAttribute(pos, i0);
      b.fromBufferAttribute(pos, i1);
      c.fromBufferAttribute(pos, i2);
      let u = Math.random(), v = Math.random();
      if (u + v > 1) { u = 1 - u; v = 1 - v; }
      out[i * 3]     = a.x + (b.x - a.x) * u + (c.x - a.x) * v;
      out[i * 3 + 1] = a.y + (b.y - a.y) * u + (c.y - a.y) * v;
      out[i * 3 + 2] = a.z + (b.z - a.z) * u + (c.z - a.z) * v;
    }
    return out;
  };

  const shapeA = sampleGeometry(new THREE.IcosahedronGeometry(3.4, 4), COUNT);
  const shapeB = sampleGeometry(new THREE.TorusKnotGeometry(2.5, 0.85, 220, 36), COUNT);

  const positions = new Float32Array(shapeA);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const sprite = (() => {
    const s = 64, cv = document.createElement("canvas");
    cv.width = cv.height = s;
    const ctx = cv.getContext("2d");
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.35, "rgba(200,206,255,0.7)");
    g.addColorStop(1, "rgba(138,148,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    const tex = new THREE.CanvasTexture(cv);
    return tex;
  })();

  const material = new THREE.PointsMaterial({
    size: isTouch ? 0.055 : 0.045,
    map: sprite,
    color: 0x9aa3ff,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });

  const points = new THREE.Points(geometry, material);
  scene.add(points);

  /* Struttura wireframe interna, appena percettibile */
  const wire = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(3.4, 1)),
    new THREE.LineBasicMaterial({ color: 0x8a94ff, transparent: true, opacity: 0.08 })
  );
  scene.add(wire);

  /* Polvere di fondo */
  const dustCount = 500;
  const dustPos = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount * 3; i++) dustPos[i] = (Math.random() - 0.5) * 34;
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    size: 0.03, map: sprite, color: 0x6b7099,
    transparent: true, opacity: 0.5, depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  scene.add(dust);

  /* — Interazione — */
  let mx = 0, my = 0, tmx = 0, tmy = 0;
  window.addEventListener("pointermove", (e) => {
    tmx = (e.clientX / window.innerWidth - 0.5) * 2;
    tmy = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  let scrollN = 0;
  const onScroll = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    scrollN = max > 0 ? window.scrollY / max : 0;
    const hero = window.innerHeight * 0.9;
    const fade = Math.max(0.14, 1 - window.scrollY / hero);
    const foot = Math.max(0, (window.scrollY - (max - hero)) / hero);
    canvas.style.opacity = Math.max(fade, 0.14 + foot * 0.8).toFixed(3);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  /* — Ciclo di rendering — */
  const clock = new THREE.Clock();
  let visible = true;
  document.addEventListener("visibilitychange", () => {
    visible = document.visibilityState === "visible";
  });

  const render = () => {
    requestAnimationFrame(render);
    if (!visible) return;

    const t = clock.getElapsedTime();

    /* Morphing ciclico A ↔ B (fermo se reduced motion) */
    const phase = reduceMotion ? 0 : (Math.sin(t * 0.18) + 1) / 2;
    const ease = phase * phase * (3 - 2 * phase);
    const arr = geometry.attributes.position.array;
    for (let i = 0; i < arr.length; i += 3) {
      arr[i]     = shapeA[i]     + (shapeB[i]     - shapeA[i])     * ease;
      arr[i + 1] = shapeA[i + 1] + (shapeB[i + 1] - shapeA[i + 1]) * ease;
      arr[i + 2] = shapeA[i + 2] + (shapeB[i + 2] - shapeA[i + 2]) * ease;
    }
    geometry.attributes.position.needsUpdate = true;

    /* Rotazione + parallasse del puntatore */
    mx += (tmx - mx) * 0.04;
    my += (tmy - my) * 0.04;

    const spin = reduceMotion ? 0 : t;
    points.rotation.y = spin * 0.12 + mx * 0.35 + scrollN * Math.PI * 1.2;
    points.rotation.x = spin * 0.05 + my * 0.25 + scrollN * 0.6;
    wire.rotation.copy(points.rotation);
    dust.rotation.y = spin * 0.02;

    /* La camera arretra leggermente con lo scroll */
    camera.position.z = 11 + scrollN * 4;
    camera.position.x = mx * 0.4;
    camera.position.y = -my * 0.4;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
  };
  render();
})();

/* ── REVEAL ALLO SCROLL ── */
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("in");
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
);
document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));

/* ── CONTATORI NUMERICI ── */
const counterObs = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    const el = entry.target;
    const target = parseInt(el.dataset.counter, 10);
    counterObs.unobserve(el);
    const fmt = (n) => n.toLocaleString("it-IT");
    if (reduceMotion || target === 0) { el.textContent = fmt(target); return; }
    let cur = 0;
    const step = () => {
      cur += Math.max(1, Math.round(target / 20));
      if (cur >= target) { el.textContent = fmt(target); return; }
      el.textContent = fmt(cur);
      setTimeout(step, 80);
    };
    step();
  });
}, { threshold: 0.5 });
document.querySelectorAll("[data-counter]").forEach((el) => counterObs.observe(el));

/* ── CURSORE CUSTOM ── */
const cursor = document.querySelector("[data-cursor]");
if (cursor && !isTouch && !reduceMotion) {
  let cx = -100, cy = -100, px = -100, py = -100;
  window.addEventListener("pointermove", (e) => { cx = e.clientX; cy = e.clientY; }, { passive: true });
  const loop = () => {
    px += (cx - px) * 0.18;
    py += (cy - py) * 0.18;
    cursor.style.left = px + "px";
    cursor.style.top = py + "px";
    requestAnimationFrame(loop);
  };
  loop();
  document.querySelectorAll("[data-view]").forEach((el) => {
    el.addEventListener("pointerenter", () => cursor.classList.add("on"));
    el.addEventListener("pointerleave", () => cursor.classList.remove("on"));
  });
} else if (cursor) {
  cursor.remove();
}

/* ── TILT 3D SULLE COVER ── */
if (!isTouch && !reduceMotion) {
  document.querySelectorAll(".tilt").forEach((el) => {
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      el.style.transform =
        `perspective(900px) rotateX(${(0.5 - y) * 7}deg) rotateY(${(x - 0.5) * 9}deg)`;
      el.style.setProperty("--gx", x * 100 + "%");
      el.style.setProperty("--gy", y * 100 + "%");
    });
    el.addEventListener("pointerleave", () => {
      el.style.transform = "perspective(900px) rotateX(0deg) rotateY(0deg)";
    });
  });
}

/* ── PULSANTI MAGNETICI ── */
if (!isTouch && !reduceMotion) {
  document.querySelectorAll(".magnetic").forEach((el) => {
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left - r.width / 2;
      const y = e.clientY - r.top - r.height / 2;
      el.style.transform = `translate(${x * 0.22}px, ${y * 0.28}px)`;
    });
    el.addEventListener("pointerleave", () => {
      el.style.transform = "translate(0, 0)";
    });
  });
}

/* ── NAV: sfondo + auto-hide ── */
const nav = document.querySelector("[data-nav]");
const progressBar = document.querySelector("[data-progress]");
let lastY = 0;
window.addEventListener("scroll", () => {
  const y = window.scrollY;
  if (nav) {
    nav.classList.toggle("solid", y > 40);
    nav.classList.toggle("hidden", y > lastY && y > 320);
  }
  if (progressBar) {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    progressBar.style.width = (max > 0 ? (y / max) * 100 : 0) + "%";
  }
  lastY = y;
}, { passive: true });

/* ── ADATTAMENTO PAROLA GIGANTE ("Collaboriamo") ──
   Su schermi stretti la parola sbordava oltre il viewport,
   creando scroll orizzontale. Qui viene misurata la larghezza
   reale del testo e, se supera lo spazio disponibile, il
   font-size viene ridotto in proporzione: la parola riempie
   la larghezza in modo preciso su qualsiasi telefono. */
(() => {
  const giant = document.querySelector(".contact-giant");
  const line = giant ? giant.querySelector(".giant-line") : null;
  const footer = document.querySelector(".contact");
  if (!giant || !line || !footer) return;

  const fit = () => {
    giant.style.fontSize = ""; // riparte dal valore del CSS (clamp)
    const fs = getComputedStyle(footer);
    const available =
      footer.clientWidth -
      parseFloat(fs.paddingLeft) -
      parseFloat(fs.paddingRight);
    const width = line.getBoundingClientRect().width;
    if (width > available && width > 0) {
      const base = parseFloat(getComputedStyle(giant).fontSize);
      giant.style.fontSize = (base * available / width).toFixed(2) + "px";
    }
  };

  fit();
  /* rimisura quando Clash Display finisce di caricarsi
     (le metriche del font di fallback sono diverse) */
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  let t;
  window.addEventListener("resize", () => {
    clearTimeout(t);
    t = setTimeout(fit, 120);
  }, { passive: true });
})();

/* ── TESTIMONIANZE: scroll orizzontale guidato dallo scroll verticale ──
   Contenuti reali, raccolti da conversazioni con i clienti: per
   aggiungere, correggere o riordinare una testimonianza è sufficiente
   modificare l'array `testimonials` qui sotto — il markup delle card
   viene generato da qui, un'unica fonte di verità.

   Su desktop (puntatore fine, nessun reduced-motion) la sezione resta
   "pinnata" tramite position:sticky mentre lo scroll verticale viene
   letto e tradotto in un translateX sul track (nessuno scroll-jacking:
   il browser continua a gestire lo scroll nativamente, si legge solo
   la posizione). Su touch o con prefers-reduced-motion attivo si passa
   a uno scroll orizzontale nativo con scroll-snap, senza alcun calcolo
   JS: è la variante più naturale e meno rischiosa su mobile. */
(() => {
  const testimonials = [
    {
      quote: "Ma è bellissimo adesso. Bravissimo!",
      author: "Stefano",
      role: "",
    },
    {
      quote: "Bravissimo. Molto bello il sito.",
      author: "Piera",
      role: "",
    },
    {
      quote: "Questo lavoro eccezionale che hai fatto sul sito dobbiamo passarlo anche sull'app. Spettacolo.",
      author: "Luca",
      role: "",
    },
    {
      quote: "Non va bene… va benissimo. Siete dei professionisti. Grazie.",
      author: "Marco",
      role: "",
    },
    {
      quote: "Ragazzo molto serio, ha concluso il progetto dato da me in solo 48 ore. Sono molto soddisfatto.",
      author: "David",
      role: "",
    },
  ];

  const section = document.querySelector("[data-testimonials]");
  const stage = document.querySelector("[data-testimonials-stage]");
  const track = document.querySelector("[data-testimonials-track]");
  const bar = document.querySelector("[data-testimonials-bar]");
  const currentEl = document.querySelector("[data-testimonials-current]");
  const totalEl = document.querySelector("[data-testimonials-total]");
  if (!section || !stage || !track) return;

  const total = testimonials.length;
  track.innerHTML = testimonials
    .map((t, i) => `
      <article class="testimonial-card">
        <p class="testimonial-index mono" aria-hidden="true">${String(i + 1).padStart(2, "0")}</p>
        <blockquote class="testimonial-quote"><p>“${t.quote}”</p></blockquote>
        <footer class="testimonial-meta">
          <cite class="testimonial-author">${t.author}</cite>
          ${t.role ? `<span class="testimonial-role mono">${t.role}</span>` : ""}
        </footer>
      </article>`)
    .join("");
  if (totalEl) totalEl.textContent = String(total).padStart(2, "0");

  const cards = Array.from(track.children);
  const useNative = isTouch || reduceMotion;
  section.classList.toggle("testimonials--native", useNative);

  if (useNative) {
    /* Variante nativa: il pin/translate via JS è disattivato, ma barra e
       contatore restano sincronizzati leggendo lo scrollLeft nativo del
       track (scroll-snap), così il progresso "01 — 04" resta vivo anche
       su touch invece di restare bloccato sul valore iniziale statico. */
    const updateNative = () => {
      const max = track.scrollWidth - track.clientWidth;
      const progress = max > 0 ? Math.min(1, Math.max(0, track.scrollLeft / max)) : 0;
      if (bar) bar.style.width = progress * 100 + "%";
      if (currentEl) currentEl.textContent = String(Math.round(progress * (total - 1)) + 1).padStart(2, "0");
    };
    let nTicking = false;
    track.addEventListener("scroll", () => {
      if (!nTicking) {
        nTicking = true;
        requestAnimationFrame(() => { nTicking = false; updateNative(); });
      }
    }, { passive: true });
    updateNative();
    return;
  }

  let distance = 0; // px orizzontali totali da percorrere
  let start = 0;    // offset verticale (documento) di inizio pin
  let span = 1;     // altezza di scroll verticale da tradurre in movimento

  const measure = () => {
    /* Il track parte dal bordo interno del padding sinistro dello stage:
       per far coincidere il bordo destro dell'ultima card con il margine
       destro (invece di fermarsi un padding troppo a destra, tagliando il
       testo) la distanza da percorrere deve includere anche il padding su
       entrambi i lati, non solo la differenza tra le larghezze. */
    const stagePad = parseFloat(getComputedStyle(stage).paddingLeft) || 0;
    distance = Math.max(0, track.scrollWidth - stage.clientWidth + stagePad * 2);
    section.style.height = `calc(100svh + ${distance}px)`;
    start = section.getBoundingClientRect().top + window.scrollY;
    span = Math.max(1, section.offsetHeight - window.innerHeight);
  };

  /* Frazioni di scroll "ferme" a inizio e fine: appena si entra nella
     sezione la prima card non deve scappare via subito, e appena l'ultima
     arriva a destinazione deve restare leggibile e completamente ferma
     prima che la sezione rilasci lo scroll verso "Profilo professionale"
     (altrimenti si rischia di fermarsi a metà transizione, con l'ultima
     card tagliata a bordo schermo). */
  const HOLD_START = 0.12;
  const HOLD_END = 0.12;

  let ticking = false;
  const update = () => {
    ticking = false;
    const raw = Math.min(1, Math.max(0, (window.scrollY - start) / span));
    let progress;
    if (raw <= HOLD_START) progress = 0;
    else if (raw >= 1 - HOLD_END) progress = 1;
    else progress = (raw - HOLD_START) / (1 - HOLD_START - HOLD_END);
    track.style.transform = `translate3d(${(-progress * distance).toFixed(1)}px,0,0)`;
    if (bar) bar.style.width = progress * 100 + "%";

    /* L'indice "attivo" (frazionario) segue linearmente il progresso:
       0 = prima card, total-1 = ultima. Usarlo anche per l'opacità (invece
       della distanza dal centro dello stage) garantisce che la prima e
       l'ultima card raggiungano sempre piena opacità: geometricamente non
       possono mai passare per il centro dello stage, essendo agli estremi
       della corsa orizzontale. */
    const activeFloat = progress * (total - 1);
    const activeIdx = Math.round(activeFloat);
    cards.forEach((card, i) => {
      const fade = 1 - Math.min(1, Math.abs(i - activeFloat)) * 0.55;
      card.style.opacity = fade.toFixed(2);
      card.style.transform = `scale(${(0.97 + fade * 0.03).toFixed(3)})`;
    });
    if (currentEl) currentEl.textContent = String(activeIdx + 1).padStart(2, "0");
  };

  const onScroll = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  };

  measure();
  update();
  window.addEventListener("scroll", onScroll, { passive: true });

  let resizeT;
  window.addEventListener("resize", () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => { measure(); update(); }, 150);
  }, { passive: true });

  if (window.ResizeObserver) {
    new ResizeObserver(() => { measure(); update(); }).observe(track);
  }
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => { measure(); update(); });
  }
})();
