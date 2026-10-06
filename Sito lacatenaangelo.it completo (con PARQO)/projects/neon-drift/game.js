/* ============================================================
   Neon Drift — game.js
   Loop di gioco principale. La progressione (skin, achievement,
   missioni, classifica, condivisione) vive in meta.js ed è
   esposta tramite l'oggetto globale `Meta`.
   ============================================================ */

const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");

const ui = {
  score: document.querySelector("#score"),
  level: document.querySelector("#level"),
  lives: document.querySelector("#lives"),
  energy: document.querySelector("#energyBar"),
  comboCell: document.querySelector("#comboCell"),
  comboValue: document.querySelector("#comboValue"),
  intro: document.querySelector("#introScreen"),
  end: document.querySelector("#endScreen"),
  endEyebrow: document.querySelector("#endEyebrow"),
  endTitle: document.querySelector("#endTitle"),
  endCopy: document.querySelector("#endCopy"),
  endRank: document.querySelector("#endRank"),
  endMissions: document.querySelector("#endMissions"),
  start: document.querySelector("#startButton"),
  retry: document.querySelector("#retryButton"),
  share: document.querySelector("#shareButton"),
  pause: document.querySelector("#pauseButton"),
  mute: document.querySelector("#muteButton"),
  hardcoreToggle: document.querySelector("#hardcoreToggle"),
  stormToggle: document.querySelector("#stormToggle"),
  skinStrip: document.querySelector("#skinStrip"),
  challengeBanner: document.querySelector("#challengeBanner"),
  challengeText: document.querySelector("#challengeText"),
  eventBanner: document.querySelector("#eventBanner"),
  eventBannerText: document.querySelector("#eventBannerText"),
  starsCount: document.querySelector("#starsCount"),
  toastStack: document.querySelector("#toastStack"),
  panelBackdrop: document.querySelector("#panelBackdrop"),
  boardList: document.querySelector("#boardList"),
  achvList: document.querySelector("#achvList"),
  missionList: document.querySelector("#missionList"),
  premiumPanel: document.querySelector("#premiumPanel"),
  premiumInput: document.querySelector("#premiumCodeInput"),
  premiumRedeem: document.querySelector("#premiumRedeemButton"),
  premiumBuyLink: document.querySelector("#premiumBuyLink"),
};

const colors = {
  paper: "#f4f2e8",
  muted: "rgba(244,242,232,.48)",
  lime: "#d8f35e",
  teal: "#19b4a5",
  ember: "#f0573f",
  gold: "#ffb23a",
  cobalt: "#4f74ff",
  purple: "#7d4dff",
};

const keys = new Set();
const pointer = { active: false, x: 0, y: 0, isTouch: false };

let w = 0;
let h = 0;
let dpr = 1;
let lastTime = 0;
let spawnTimer = 0;
let shardTimer = 0;
let shake = 0;
let audioMuted = false;
let audioContext;
let eventBannerTimer = null;

const STORM_MODIFIERS = ["rain", "snow", "blackout", "lightning", "invert", "traffic", "fire", "gravity"];
const STORM_LABELS = {
  rain: "🌧️ Pioggia",
  snow: "❄️ Neve",
  blackout: "🌑 Blackout",
  lightning: "⚡ Fulmini",
  invert: "🌈 Colori invertiti",
  traffic: "🚛 Traffico doppio",
  fire: "🔥 Strada in fiamme",
  gravity: "💜 Gravità ridotta",
};

const game = {
  state: "intro",
  mode: "classic",
  score: 0,
  level: 1,
  lives: 3,
  maxLives: 3,
  time: 0,
  speed: 330,
  energy: 100,
  phase: false,
  invincible: 0,
  combo: 0,
  maxCombo: 0,
  gemsCollected: 0,
  skin: null,
  flash: 0,
  flashColor: "255,255,255",
  player: { x: 0, y: 0, r: 18, trail: [] },
  obstacles: [],
  shards: [],
  particles: [],
  embers: [],
  stars: [],
  weather: [],
  storm: { enabled: false, active: null, timer: 0, interval: 30, lightningAt: 0 },
  boss: { nextScore: 500, active: false },
};

/* ---------------- setup / resize ---------------- */

function resize() {
  const rect = canvas.getBoundingClientRect();
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  w = rect.width;
  h = rect.height;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  if (!game.player.x) {
    game.player.x = Math.max(90, w * 0.2);
    game.player.y = h * 0.5;
  }

  seedStars();
}

function seedStars() {
  const count = Math.floor((w * h) / 11000);
  game.stars = Array.from({ length: count }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    z: Math.random() * 0.8 + 0.2,
  }));
}

function seedWeather(kind) {
  const count = kind === "snow" ? 70 : 110;
  game.weather = Array.from({ length: count }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    v: kind === "snow" ? 40 + Math.random() * 60 : 420 + Math.random() * 260,
    drift: Math.random() * 30 - 15,
    len: kind === "snow" ? 0 : 16 + Math.random() * 18,
    r: kind === "snow" ? 1.4 + Math.random() * 1.8 : 1,
  }));
}

/* ---------------- skin helpers ---------------- */

function currentSkinColors() {
  const skin = game.skin || Meta.getSelectedSkin();
  if (skin.colors.normal === "rainbow") {
    const hue = (game.time * 140) % 360;
    return {
      normal: `hsl(${hue}, 90%, 60%)`,
      phase: `hsl(${(hue + 140) % 360}, 90%, 65%)`,
    };
  }
  if (skin.colors.sparkle) {
    const shimmer = 0.5 + Math.sin(game.time * 6) * 0.5;
    const lightness = 76 + shimmer * 16;
    return { normal: `hsl(45, 85%, ${lightness}%)`, phase: "#ffffff" };
  }
  return skin.colors;
}

function renderSkinStrip() {
  const skins = Meta.getSkins();
  const selected = Meta.getSelectedSkin();
  ui.skinStrip.innerHTML = "";
  skins.forEach((skin) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "skin-swatch" + (skin.id === selected.id ? " is-selected" : "") + (!skin.unlocked ? " is-locked" : "");
    btn.title = skin.unlocked ? skin.name : `${skin.name} — ${skin.hint}`;
    const swatchColor =
      skin.colors.normal === "rainbow"
        ? "linear-gradient(135deg,#f0573f,#ffb23a,#d8f35e,#19b4a5,#4f74ff,#7d4dff)"
        : skin.colors.sparkle
          ? "linear-gradient(135deg,#ffe9b0,#ffffff,#ffcf4d)"
          : skin.colors.normal;
    const lockIcon = skin.premium ? "💎" : "🔒";
    btn.innerHTML = `<span class="swatch-dot" style="background:${swatchColor}"></span><span class="swatch-name">${skin.unlocked ? skin.name : lockIcon}</span>`;
    btn.addEventListener("click", () => {
      if (!skin.unlocked) {
        if (skin.premium) {
          openPremiumPanel();
        } else {
          toast(`🔒 ${skin.name}: ${skin.hint}`);
        }
        return;
      }
      Meta.setSelectedSkin(skin.id);
      renderSkinStrip();
    });
    ui.skinStrip.appendChild(btn);
  });
}

/* ---------------- toasts ---------------- */

function toast(message, duration = 3200) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  ui.toastStack.appendChild(el);
  requestAnimationFrame(() => el.classList.add("is-visible"));
  setTimeout(() => {
    el.classList.remove("is-visible");
    setTimeout(() => el.remove(), 320);
  }, duration);
}

function showEventBanner(text, duration = 2200) {
  ui.eventBannerText.textContent = text;
  ui.eventBanner.hidden = false;
  requestAnimationFrame(() => ui.eventBanner.classList.add("is-visible"));
  clearTimeout(eventBannerTimer);
  eventBannerTimer = setTimeout(() => {
    ui.eventBanner.classList.remove("is-visible");
    setTimeout(() => {
      ui.eventBanner.hidden = true;
    }, 260);
  }, duration);
}

/* ---------------- haptics ---------------- */

function vibrate(pattern) {
  if (navigator.vibrate) {
    try {
      navigator.vibrate(pattern);
    } catch (e) {
      /* ignora se non supportato */
    }
  }
}

/* ---------------- run lifecycle ---------------- */

function resetGame() {
  game.state = "running";
  game.mode = ui.hardcoreToggle.getAttribute("aria-pressed") === "true" ? "hardcore" : "classic";
  game.storm.enabled = ui.stormToggle.getAttribute("aria-pressed") === "true";
  game.storm.active = null;
  game.storm.timer = 0;
  game.boss = { nextScore: 500, active: false };
  game.skin = Meta.getSelectedSkin();

  const hardcore = game.mode === "hardcore";
  game.score = 0;
  game.level = 1;
  game.maxLives = hardcore ? 1 : 3;
  game.lives = game.maxLives;
  game.time = 0;
  game.speed = hardcore ? 420 : 330;
  game.energy = 100;
  game.phase = false;
  game.invincible = 0;
  game.combo = 0;
  game.maxCombo = 0;
  game.gemsCollected = 0;
  game.flash = 0;
  game.player = { x: Math.max(90, w * 0.2), y: h * 0.5, r: 18, trail: [] };
  game.obstacles = [];
  game.shards = [];
  game.particles = [];
  game.embers = [];
  game.weather = [];
  canvas.classList.remove("fx-invert");

  spawnTimer = 0;
  shardTimer = 0.7;
  shake = 0;

  ui.intro.classList.remove("is-visible");
  ui.end.classList.remove("is-visible");
  ui.comboCell.hidden = true;
  ui.pause.textContent = "Pausa";
  playTone(260, 0.12, "triangle", 0.06);
  playTone(520, 0.18, "sine", 0.05);

  if (hardcore) showEventBanner("☠️ MODALITÀ HARDCORE — una vita sola", 2400);
  else if (game.storm.enabled) showEventBanner("🌩️ NEON STORM ATTIVO", 2000);
}

function endGame() {
  game.state = "ended";
  game.phase = false;
  canvas.classList.remove("fx-invert");

  const result = Meta.reportRun({
    score: game.score,
    survivalSeconds: game.time,
    gemsCollected: game.gemsCollected,
    maxCombo: game.maxCombo,
    mode: game.mode,
  });

  ui.endEyebrow.textContent = game.mode === "hardcore" ? "Run Hardcore chiusa" : "Run chiusa";
  ui.endTitle.textContent = result.isNewBest ? "🔥 Nuovo record!" : "Bel drift.";
  ui.endCopy.textContent = `Score finale: ${Math.floor(game.score)} · Combo max: ${game.maxCombo}`;

  if (result.boardResult.qualifies) {
    ui.endRank.hidden = false;
    ui.endRank.textContent = `🏆 Sei entrato in classifica ${game.mode === "hardcore" ? "Hardcore" : "Classica"} locale — posizione #${result.boardResult.rank}`;
  } else {
    ui.endRank.hidden = true;
  }

  const missions = Meta.getMissionsState();
  ui.endMissions.hidden = false;
  ui.endMissions.innerHTML = missions
    .map(
      (m) =>
        `<li class="${m.done ? "is-done" : ""}">${m.done ? "✅" : "▫️"} ${m.label} (${Math.min(m.progress, m.target)}/${m.target})</li>`,
    )
    .join("");

  ui.end.classList.add("is-visible");
  playTone(150, 0.22, "sawtooth", 0.04);
  playTone(86, 0.28, "sine", 0.05);
  vibrate(result.isNewBest ? [40, 60, 90] : [50]);

  if (result.isNewBest) flashScreen("216,243,94", 0.5);

  result.unlockedAchievements.forEach((a, i) => {
    setTimeout(() => {
      toast(`🎖️ Obiettivo sbloccato: ${a.icon} ${a.name}`);
      playTone(720, 0.1, "triangle", 0.05);
      playTone(960, 0.16, "sine", 0.04);
    }, 400 + i * 650);
  });

  if (result.starEarned) {
    setTimeout(
      () => {
        toast("⭐ Missioni giornaliere completate! Hai guadagnato una stella.");
        playTone(880, 0.14, "sine", 0.05);
      },
      400 + result.unlockedAchievements.length * 650,
    );
  }

  renderSkinStrip();
  renderStarsCount();
}

function togglePause() {
  if (game.state === "running") {
    game.state = "paused";
    ui.pause.textContent = "Riprendi";
  } else if (game.state === "paused") {
    game.state = "running";
    ui.pause.textContent = "Pausa";
    lastTime = performance.now();
  }
}

/* ---------------- audio ---------------- */

function playTone(freq, duration, type = "sine", gain = 0.04) {
  if (audioMuted) return;
  audioContext ||= new AudioContext();
  const osc = audioContext.createOscillator();
  const amp = audioContext.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  amp.gain.setValueAtTime(0, audioContext.currentTime);
  amp.gain.linearRampToValueAtTime(gain, audioContext.currentTime + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
  osc.connect(amp).connect(audioContext.destination);
  osc.start();
  osc.stop(audioContext.currentTime + duration + 0.02);
}

function playThunder() {
  if (audioMuted) return;
  audioContext ||= new AudioContext();
  const bufferSize = audioContext.sampleRate * 0.5;
  const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }
  const noise = audioContext.createBufferSource();
  noise.buffer = buffer;
  const amp = audioContext.createGain();
  amp.gain.setValueAtTime(0.05, audioContext.currentTime);
  amp.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.45);
  noise.connect(amp).connect(audioContext.destination);
  noise.start();
}

/* ---------------- spawning ---------------- */

function spawnObstacle() {
  const size = 42 + Math.random() * 56;
  const lane = Math.random();
  const y = 110 + lane * Math.max(140, h - 220);
  const type = Math.random() > 0.58 ? "bar" : "diamond";
  game.obstacles.push({
    x: w + size,
    y,
    size,
    type,
    spin: Math.random() * Math.PI,
    drift: (Math.random() - 0.5) * 52,
    hit: false,
  });
}

function spawnBoss() {
  game.boss.active = true;
  game.obstacles.push({
    x: w + 140,
    y: h * 0.5,
    size: 130,
    type: "boss",
    spin: 0,
    drift: 0,
    driftPhase: Math.random() * Math.PI * 2,
    hit: false,
    hp: 1,
  });
  showEventBanner("⚠️ GUARDIANO IN ARRIVO", 2200);
  playTone(70, 0.4, "sawtooth", 0.07);
  vibrate([60, 40, 60]);
}

function spawnShard() {
  game.shards.push({
    x: w + 30,
    y: 110 + Math.random() * Math.max(120, h - 220),
    r: 11,
    pulse: Math.random() * Math.PI * 2,
  });
}

function emit(x, y, color, amount = 12) {
  for (let i = 0; i < amount; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 70 + Math.random() * 180;
    game.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.35 + Math.random() * 0.35,
      max: 0.7,
      color,
    });
  }
}

function flashScreen(rgb, alpha = 0.35) {
  game.flash = alpha;
  game.flashColor = rgb;
}

/* ---------------- input ---------------- */

function inputVector() {
  const vector = { x: 0, y: 0 };
  if (keys.has("arrowleft") || keys.has("a")) vector.x -= 1;
  if (keys.has("arrowright") || keys.has("d")) vector.x += 1;
  if (keys.has("arrowup") || keys.has("w")) vector.y -= 1;
  if (keys.has("arrowdown") || keys.has("s")) vector.y += 1;
  return vector;
}

/* ---------------- Neon Storm ---------------- */

function updateStorm(dt) {
  if (!game.storm.enabled) return;

  game.storm.timer += dt;
  if (game.storm.timer >= game.storm.interval) {
    game.storm.timer = 0;
    const next = STORM_MODIFIERS[Math.floor(Math.random() * STORM_MODIFIERS.length)];
    game.storm.active = next;
    showEventBanner(STORM_LABELS[next]);
    canvas.classList.toggle("fx-invert", next === "invert");
    if (next === "rain") seedWeather("rain");
    if (next === "snow") seedWeather("snow");
    if (next === "lightning") game.storm.lightningAt = 0.6;
  }

  if (game.storm.active === "lightning") {
    game.storm.lightningAt -= dt;
    if (game.storm.lightningAt <= 0) {
      flashScreen("255,255,255", 0.45);
      shake = Math.max(shake, 0.6);
      playThunder();
      game.storm.lightningAt = 1.6 + Math.random() * 2.2;
    }
  }

  if (game.storm.active === "fire" && Math.random() < dt * 6) {
    game.embers.push({
      x: Math.random() * w,
      y: h + 10,
      vy: -(60 + Math.random() * 90),
      vx: (Math.random() - 0.5) * 30,
      life: 1.2 + Math.random() * 0.8,
      max: 2,
    });
  }

  if (game.storm.active === "rain" || game.storm.active === "snow") {
    for (const drop of game.weather) {
      drop.y += drop.v * dt;
      drop.x += drop.drift * dt;
      if (drop.y > h + 20) {
        drop.y = -10;
        drop.x = Math.random() * w;
      }
    }
  }
}

function stormSpeedMultiplier() {
  if (game.storm.active === "rain") return 1.08;
  if (game.storm.active === "snow") return 0.92;
  return 1;
}

function stormSpawnMultiplier() {
  return game.storm.active === "traffic" ? 0.5 : 1;
}

/* ---------------- update ---------------- */

function update(dt) {
  if (game.state !== "running") return;

  game.time += dt;
  game.level = Math.max(1, Math.floor(game.time / 12) + 1);
  const hardcoreMul = game.mode === "hardcore" ? 1.18 : 1;
  const scoreRamp = Math.min(game.score * 0.05, 220);
  game.speed = (330 + game.level * 34 + scoreRamp) * hardcoreMul * stormSpeedMultiplier();
  game.score += dt * (18 + game.level * 4) * (game.mode === "hardcore" ? 1.25 : 1);
  game.invincible = Math.max(0, game.invincible - dt);
  shake = Math.max(0, shake - dt * 18);
  game.flash = Math.max(0, game.flash - dt * 1.8);

  updateStorm(dt);

  if (!game.boss.active && game.score >= game.boss.nextScore) {
    spawnBoss();
  }

  const wantsPhase = keys.has(" ") || keys.has("shift");
  game.phase = wantsPhase && game.energy > 3;
  const energyRegen = game.mode === "hardcore" ? 12 : 18;
  game.energy += (game.phase ? -34 : energyRegen) * dt;
  game.energy = Math.max(0, Math.min(100, game.energy));

  const v = inputVector();
  const gravityMode = game.storm.active === "gravity";
  const moveSpeed = (game.phase ? 440 : 350) * (gravityMode ? 0.72 : 1);
  const len = Math.hypot(v.x, v.y) || 1;

  if (pointer.active) {
    const dx = pointer.x - game.player.x;
    const dy = pointer.y - game.player.y;
    const lerpRate = pointer.isTouch ? 5 : 8;
    game.player.x += dx * Math.min(1, dt * lerpRate);
    game.player.y += dy * Math.min(1, dt * lerpRate);
  } else {
    game.player.x += (v.x / len) * moveSpeed * dt;
    game.player.y += (v.y / len) * moveSpeed * dt;
  }

  if (gravityMode) {
    game.player.y += Math.sin(game.time * 1.4) * 26 * dt;
  }

  game.player.x = Math.max(52, Math.min(w * 0.62, game.player.x));
  game.player.y = Math.max(92, Math.min(h - 92, game.player.y));
  game.player.trail.unshift({ x: game.player.x, y: game.player.y, phase: game.phase });
  game.player.trail = game.player.trail.slice(0, 18);

  spawnTimer -= dt;
  shardTimer -= dt;
  if (spawnTimer <= 0) {
    spawnObstacle();
    spawnTimer = Math.max(0.38, 1.05 - game.level * 0.055 + Math.random() * 0.34) * stormSpawnMultiplier();
  }
  if (shardTimer <= 0) {
    spawnShard();
    shardTimer = 1.2 + Math.random() * 1.2;
  }

  updateObjects(dt);
  updateParticles(dt);
  updateEmbers(dt);
  updateStars(dt);
  updateUI();
}

function updateObjects(dt) {
  const p = game.player;

  for (const obstacle of game.obstacles) {
    const isBoss = obstacle.type === "boss";
    obstacle.x -= (isBoss ? game.speed * 0.55 : game.speed) * dt;
    if (isBoss) {
      obstacle.driftPhase += dt * 1.4;
      obstacle.y = h * 0.5 + Math.sin(obstacle.driftPhase) * (h * 0.28);
      obstacle.spin += dt * 0.6;
    } else {
      obstacle.y += Math.sin(game.time * 2 + obstacle.x * 0.01) * obstacle.drift * dt;
      obstacle.spin += dt * 1.8;
    }

    const radius = isBoss ? obstacle.size * 0.5 : obstacle.type === "bar" ? obstacle.size * 0.62 : obstacle.size * 0.5;
    const distance = Math.hypot(p.x - obstacle.x, p.y - obstacle.y);
    const canHit = !game.phase && game.invincible <= 0 && !obstacle.hit;

    if (canHit && distance < p.r + radius) {
      if (isBoss) {
        obstacle.hit = true;
        game.boss.active = false;
        game.boss.nextScore += 500;
      } else {
        obstacle.hit = true;
      }
      game.lives -= 1;
      game.invincible = game.mode === "hardcore" ? 0.6 : 1.35;
      game.combo = 0;
      ui.comboCell.hidden = true;
      shake = isBoss ? 1.4 : 1;
      emit(p.x, p.y, colors.ember, isBoss ? 40 : 26);
      playTone(isBoss ? 60 : 96, isBoss ? 0.3 : 0.18, "sawtooth", 0.06);
      vibrate(isBoss ? [30, 30, 60] : [35]);
      if (game.lives <= 0) endGame();
    }
  }

  for (const shard of game.shards) {
    shard.x -= (game.speed + 35) * dt;
    shard.pulse += dt * 5;

    if (Math.hypot(p.x - shard.x, p.y - shard.y) < p.r + shard.r) {
      shard.collected = true;
      game.gemsCollected += 1;
      game.combo += 1;
      game.maxCombo = Math.max(game.maxCombo, game.combo);
      game.score += 160 + game.level * 18 + Math.min(game.combo, 20) * 4;
      game.energy = Math.min(100, game.energy + 20);
      emit(shard.x, shard.y, colors.lime, 18);
      playTone(680, 0.08, "triangle", 0.035);
      playTone(920, 0.12, "sine", 0.025);
      if (game.combo >= 3) {
        ui.comboCell.hidden = false;
        ui.comboValue.textContent = game.combo;
      }
      if (game.combo > 0 && game.combo % 10 === 0) {
        vibrate([20, 20, 20]);
      }
    }
  }

  if (game.boss.active && !game.obstacles.some((o) => o.type === "boss")) {
    game.boss.active = false;
  }

  game.obstacles = game.obstacles.filter((item) => item.x > -160);
  game.shards = game.shards.filter((item) => !item.collected && item.x > -40);
}

function updateParticles(dt) {
  for (const particle of game.particles) {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vx *= 1 - dt * 2.4;
    particle.vy *= 1 - dt * 2.4;
    particle.life -= dt;
  }
  game.particles = game.particles.filter((particle) => particle.life > 0);
}

function updateEmbers(dt) {
  for (const ember of game.embers) {
    ember.x += ember.vx * dt;
    ember.y += ember.vy * dt;
    ember.life -= dt;
  }
  game.embers = game.embers.filter((e) => e.life > 0);
}

function updateStars(dt) {
  for (const star of game.stars) {
    star.x -= game.speed * star.z * dt * 0.28;
    if (star.x < -10) {
      star.x = w + 10;
      star.y = Math.random() * h;
      star.z = Math.random() * 0.8 + 0.2;
    }
  }
}

function updateUI() {
  ui.score.textContent = Math.floor(game.score);
  ui.level.textContent = game.level;
  ui.lives.textContent = game.lives;
  ui.energy.style.transform = `scaleX(${game.energy / 100})`;
  ui.mute.setAttribute("aria-pressed", String(audioMuted));
  ui.mute.textContent = audioMuted ? "Muto" : "Audio";
}

function renderStarsCount() {
  ui.starsCount.textContent = `⭐ ${Meta.getStars()}`;
}

/* ---------------- draw ---------------- */

function draw() {
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  if (shake > 0) {
    ctx.translate((Math.random() - 0.5) * shake * 9, (Math.random() - 0.5) * shake * 9);
  }

  drawBackground();
  drawWeather();
  drawObjects();
  drawPlayer();
  drawParticles();
  drawEmbers();

  if (game.storm.active === "blackout") drawBlackoutMask();
  if (game.flash > 0) drawFlash();

  if (game.state === "paused") {
    drawPauseVeil();
  }

  ctx.restore();
}

function drawBackground() {
  const fire = game.storm.active === "fire";
  const grad = ctx.createLinearGradient(0, 0, w, h);
  if (fire) {
    grad.addColorStop(0, "#210806");
    grad.addColorStop(0.55, "#2a0f08");
    grad.addColorStop(1, "#1a0705");
  } else {
    grad.addColorStop(0, "#080908");
    grad.addColorStop(0.55, "#11110e");
    grad.addColorStop(1, "#15110f");
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.strokeStyle = fire ? "rgba(255,140,70,.12)" : "rgba(216,243,94,.09)";
  ctx.lineWidth = 1;
  for (let y = h * 0.18; y < h; y += 54) {
    ctx.beginPath();
    ctx.moveTo(0, y + Math.sin(game.time + y * 0.01) * 8);
    ctx.lineTo(w, y + Math.cos(game.time + y * 0.01) * 8);
    ctx.stroke();
  }
  for (let x = -80; x < w + 80; x += 90) {
    ctx.beginPath();
    ctx.moveTo(x - ((game.time * 70) % 90), h);
    ctx.lineTo(w * 0.56, h * 0.22);
    ctx.stroke();
  }
  ctx.restore();

  for (const star of game.stars) {
    ctx.fillStyle = `rgba(244,242,232,${0.18 + star.z * 0.42})`;
    ctx.fillRect(star.x, star.y, 14 * star.z, 1.5);
  }
}

function drawWeather() {
  if (game.storm.active === "rain") {
    ctx.strokeStyle = "rgba(150,200,255,.5)";
    ctx.lineWidth = 1.4;
    for (const drop of game.weather) {
      ctx.beginPath();
      ctx.moveTo(drop.x, drop.y);
      ctx.lineTo(drop.x - 3, drop.y - drop.len);
      ctx.stroke();
    }
  } else if (game.storm.active === "snow") {
    ctx.fillStyle = "rgba(255,255,255,.85)";
    for (const drop of game.weather) {
      ctx.beginPath();
      ctx.arc(drop.x, drop.y, drop.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawEmbers() {
  for (const ember of game.embers) {
    const alpha = Math.max(0, ember.life / ember.max);
    ctx.fillStyle = `rgba(255,${120 + Math.floor(alpha * 100)},60,${alpha})`;
    ctx.beginPath();
    ctx.arc(ember.x, ember.y, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBlackoutMask() {
  const p = game.player;
  const radius = Math.max(w, h) * 0.32;
  const grad = ctx.createRadialGradient(p.x, p.y, radius * 0.25, p.x, p.y, radius);
  grad.addColorStop(0, "rgba(4,4,8,0)");
  grad.addColorStop(1, "rgba(4,4,8,0.94)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

function drawFlash() {
  ctx.fillStyle = `rgba(${game.flashColor},${game.flash})`;
  ctx.fillRect(0, 0, w, h);
}

function drawObjects() {
  for (const shard of game.shards) {
    ctx.save();
    ctx.translate(shard.x, shard.y);
    ctx.rotate(shard.pulse * 0.6);
    ctx.shadowColor = colors.lime;
    ctx.shadowBlur = 18;
    ctx.fillStyle = colors.lime;
    diamond(0, 0, shard.r + Math.sin(shard.pulse) * 2);
    ctx.fill();
    ctx.restore();
  }

  for (const obstacle of game.obstacles) {
    ctx.save();
    ctx.translate(obstacle.x, obstacle.y);
    ctx.rotate(obstacle.spin);
    ctx.globalAlpha = obstacle.hit ? 0.28 : 1;

    if (obstacle.type === "boss") {
      const pulse = 1 + Math.sin(game.time * 4) * 0.04;
      ctx.scale(pulse, pulse);
      ctx.shadowColor = colors.gold;
      ctx.shadowBlur = 30;
      ctx.fillStyle = "#3a1206";
      polygon(0, 0, obstacle.size * 0.5, 6);
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.strokeStyle = colors.gold;
      polygon(0, 0, obstacle.size * 0.5, 6);
      ctx.stroke();
      ctx.fillStyle = colors.ember;
      ctx.beginPath();
      ctx.arc(0, 0, obstacle.size * 0.16, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      continue;
    }

    ctx.shadowColor = obstacle.type === "bar" ? colors.ember : colors.gold;
    ctx.shadowBlur = 18;
    ctx.fillStyle = obstacle.type === "bar" ? colors.ember : colors.gold;

    if (obstacle.type === "bar") {
      roundedRect(-obstacle.size * 0.22, -obstacle.size * 0.82, obstacle.size * 0.44, obstacle.size * 1.64, 6);
      ctx.fill();
      ctx.rotate(Math.PI / 2);
      roundedRect(-obstacle.size * 0.12, -obstacle.size * 0.52, obstacle.size * 0.24, obstacle.size * 1.04, 6);
      ctx.fill();
    } else {
      diamond(0, 0, obstacle.size * 0.55);
      ctx.fill();
      ctx.strokeStyle = "rgba(9,10,10,.7)";
      ctx.lineWidth = 4;
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawPlayer() {
  const p = game.player;
  const skin = currentSkinColors();

  ctx.save();
  for (let i = game.player.trail.length - 1; i >= 0; i -= 1) {
    const dot = game.player.trail[i];
    const alpha = (1 - i / game.player.trail.length) * 0.42;
    const base = dot.phase ? skin.phase : skin.normal;
    ctx.fillStyle = withAlpha(base, alpha);
    ctx.beginPath();
    ctx.arc(dot.x, dot.y, p.r * (1 - i / 24), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.translate(p.x, p.y);
  ctx.rotate(Math.sin(game.time * 5) * 0.08);
  const activeColor = game.phase ? skin.phase : skin.normal;
  ctx.shadowColor = activeColor;
  ctx.shadowBlur = game.phase ? 28 : 18;
  ctx.globalAlpha = game.invincible > 0 ? 0.58 + Math.sin(game.time * 42) * 0.28 : 1;
  ctx.fillStyle = activeColor;
  ctx.beginPath();
  ctx.moveTo(p.r + 10, 0);
  ctx.lineTo(-p.r, -p.r * 0.82);
  ctx.lineTo(-p.r * 0.48, 0);
  ctx.lineTo(-p.r, p.r * 0.82);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = colors.lime;
  ctx.beginPath();
  ctx.arc(2, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function withAlpha(color, alpha) {
  if (color.startsWith("hsl(")) {
    return color.replace("hsl(", "hsla(").replace(")", `,${alpha})`);
  }
  if (color.startsWith("#")) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return color;
}

function drawParticles() {
  for (const particle of game.particles) {
    const alpha = Math.max(0, particle.life / particle.max);
    ctx.fillStyle = particle.color;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, 3 + alpha * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawPauseVeil() {
  ctx.fillStyle = "rgba(0,0,0,.42)";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = colors.paper;
  ctx.font = "900 42px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Pausa", w / 2, h / 2);
}

function diamond(x, y, r) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r, y);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r, y);
  ctx.closePath();
}

function polygon(x, y, r, sides) {
  ctx.beginPath();
  for (let i = 0; i < sides; i += 1) {
    const angle = (i / sides) * Math.PI * 2;
    const px = x + Math.cos(angle) * r;
    const py = y + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function roundedRect(x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function loop(now) {
  const dt = Math.min(0.034, (now - lastTime) / 1000 || 0);
  lastTime = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

/* ---------------- panels (classifica / obiettivi / missioni) ---------------- */

let activeBoardMode = "classic";

function renderBoard() {
  const board = Meta.getBoard(activeBoardMode);
  ui.boardList.innerHTML = board.length
    ? board
        .map(
          (entry, i) =>
            `<li><span class="board-rank">#${i + 1}</span><span class="board-name">${escapeHtml(entry.name)}</span><span class="board-score">${entry.score}</span></li>`,
        )
        .join("")
    : `<li class="board-empty">Nessun punteggio ancora — sii il primo!</li>`;
}

function renderAchievements() {
  const list = Meta.getAchievements();
  ui.achvList.innerHTML = list
    .map(
      (a) =>
        `<li class="${a.unlocked ? "is-unlocked" : "is-locked"}"><span class="achv-icon">${a.unlocked ? a.icon : "🔒"}</span><span><strong>${a.name}</strong><br>${a.desc}</span></li>`,
    )
    .join("");
}

function renderMissions() {
  const missions = Meta.getMissionsState();
  ui.missionList.innerHTML = missions
    .map(
      (m) => `<li class="${m.done ? "is-done" : ""}">
        <div class="mission-row"><span>${m.done ? "✅" : "▫️"} ${m.label}</span><span>${m.progress}/${m.target}</span></div>
        <div class="mission-bar"><i style="width:${Math.min(100, (m.progress / m.target) * 100)}%"></i></div>
      </li>`,
    )
    .join("");
  renderStarsCount();
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function openPanel(id) {
  document.querySelectorAll(".panel").forEach((p) => (p.hidden = p.id !== id));
  ui.panelBackdrop.hidden = false;
  if (id === "leaderboardPanel") renderBoard();
  if (id === "achievementsPanel") renderAchievements();
  if (id === "missionsPanel") renderMissions();
}

function closePanels() {
  ui.panelBackdrop.hidden = true;
}

function openPremiumPanel() {
  ui.premiumBuyLink.href = Meta.getPaymentLink();
  ui.premiumInput.value = "";
  document.querySelectorAll(".panel").forEach((p) => (p.hidden = p.id !== "premiumPanel"));
  ui.panelBackdrop.hidden = false;
}

ui.premiumRedeem.addEventListener("click", () => {
  const ok = Meta.redeemCode(ui.premiumInput.value);
  if (ok) {
    toast("💎 Skin Prisma sbloccata! Grazie per il supporto.");
    playTone(880, 0.12, "sine", 0.05);
    playTone(1320, 0.16, "triangle", 0.04);
    closePanels();
    renderSkinStrip();
  } else {
    toast("Codice non valido. Controlla di averlo copiato per intero.");
  }
});

/* ---------------- events ---------------- */

window.addEventListener("resize", resize);
window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) {
    event.preventDefault();
  }
  keys.add(key);

  if (key === "enter" && (game.state === "intro" || game.state === "ended")) resetGame();
  if (key === "p") togglePause();
  if (key === "escape") closePanels();
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.key.toLowerCase());
});

canvas.addEventListener("pointerdown", (event) => {
  pointer.active = true;
  pointer.isTouch = event.pointerType === "touch";
  pointer.x = event.clientX;
  pointer.y = event.clientY;
  if (game.state === "intro") resetGame();
});

canvas.addEventListener("pointermove", (event) => {
  pointer.isTouch = event.pointerType === "touch";
  pointer.x = event.clientX;
  pointer.y = event.clientY;
});

window.addEventListener("pointerup", () => {
  pointer.active = false;
});

ui.start.addEventListener("click", resetGame);
ui.retry.addEventListener("click", resetGame);
ui.pause.addEventListener("click", togglePause);
ui.mute.addEventListener("click", () => {
  audioMuted = !audioMuted;
  updateUI();
});

ui.hardcoreToggle.addEventListener("click", () => {
  const active = ui.hardcoreToggle.getAttribute("aria-pressed") === "true";
  ui.hardcoreToggle.setAttribute("aria-pressed", String(!active));
  ui.hardcoreToggle.classList.toggle("is-active", !active);
});

ui.stormToggle.addEventListener("click", () => {
  const active = ui.stormToggle.getAttribute("aria-pressed") === "true";
  ui.stormToggle.setAttribute("aria-pressed", String(!active));
  ui.stormToggle.classList.toggle("is-active", !active);
});

ui.share.addEventListener("click", async () => {
  const result = await Meta.shareScore(game.score);
  if (result === "copied") toast("🔗 Link della sfida copiato negli appunti!");
  else if (result === "shared") toast("Sfida condivisa!");
  else if (result === "unavailable") toast("Copia manualmente il link dalla barra degli indirizzi per condividere.");
});

document.querySelectorAll("[data-panel]").forEach((btn) => {
  btn.addEventListener("click", () => openPanel(btn.dataset.panel));
});

document.querySelectorAll("[data-close]").forEach((btn) => {
  btn.addEventListener("click", closePanels);
});

ui.panelBackdrop.addEventListener("click", (event) => {
  if (event.target === ui.panelBackdrop) closePanels();
});

document.querySelectorAll(".panel-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".panel-tab").forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    activeBoardMode = tab.dataset.board;
    renderBoard();
  });
});

/* ---------------- init ---------------- */

function initChallengeBanner() {
  const challenge = Meta.getChallengeFromURL();
  if (challenge) {
    ui.challengeText.textContent = `Un amico ha fatto ${challenge} punti su Neon Drift. Riuscirai a batterlo?`;
    ui.challengeBanner.hidden = false;
  }
}

function initSeason() {
  const season = Meta.getSeason();
  if (season && Meta.SEASON_THEMES[season]) {
    const theme = Meta.SEASON_THEMES[season];
    document.documentElement.style.setProperty("--lime", theme.accent2);
    document.documentElement.style.setProperty("--ember", theme.accent);
    showEventBanner(`${theme.emoji} ${theme.label}`, 2600);
  }
}

function initAd() {
  try {
    document.querySelectorAll(".adsbygoogle").forEach(() => {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    });
  } catch (e) {
    /* AdBlock o sito non ancora approvato da AdSense: nessun problema,
       i contenitori restano semplicemente vuoti. */
  }
}

resize();
updateUI();
renderSkinStrip();
renderStarsCount();
initChallengeBanner();
initSeason();
initAd();
requestAnimationFrame((time) => {
  lastTime = time;
  requestAnimationFrame(loop);
});
