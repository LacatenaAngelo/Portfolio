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
