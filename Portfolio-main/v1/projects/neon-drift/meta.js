/*
 * meta.js — livello di progressione/persistenza per Neon Drift.
 * Gestisce: skin sbloccabili, achievement, missioni giornaliere,
 * classifica locale (per dispositivo), condivisione sfida e tema
 * stagionale. Tutto salvato in localStorage, nessun backend.
 *
 * Espone un unico oggetto globale `Meta`.
 */

const Meta = (() => {
  const NS = "neonDrift:";
  const todayKey = () => new Date().toISOString().slice(0, 10);

  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(NS + key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function save(key, value) {
    try {
      localStorage.setItem(NS + key, JSON.stringify(value));
    } catch (e) {
      /* storage non disponibile: si degrada silenziosamente */
    }
  }

  /* ---------------- stato persistente ---------------- */

  const state = {
    stats: load("stats", {
      bestScoreClassic: 0,
      bestScoreHardcore: 0,
      bestSurvivalSeconds: 0,
      bestCombo: 0,
      totalGems: 0,
      gamesPlayed: 0,
    }),
    achievements: load("achievements", []),
    stars: load("stars", 0),
    selectedSkin: load("selectedSkin", "teal"),
    missions: load("missions", null),
    boards: load("boards", { classic: [], hardcore: [] }),
    premiumUnlocked: load("premiumUnlocked", false),
  };

  if (!state.missions || state.missions.date !== todayKey()) {
    state.missions = {
      date: todayKey(),
      gems: 0,
      scoreBest: 0,
      surviveBest: 0,
      starAwarded: false,
    };
    save("missions", state.missions);
  }

  /* ---------------- skin ---------------- */

  const SKINS = [
    {
      id: "teal",
      name: "Neon Blu",
      colors: { normal: "#19b4a5", phase: "#4f74ff" },
      unlock: { type: "default" },
      hint: "Sempre sbloccata",
    },
    {
      id: "red",
      name: "Neon Rosso",
      colors: { normal: "#f0573f", phase: "#ff8a3d" },
      unlock: { type: "score", value: 300 },
      hint: "Fai 300 punti in una partita",
    },
    {
      id: "gold",
      name: "Oro",
      colors: { normal: "#ffcf4d", phase: "#fff1b8" },
      unlock: { type: "score", value: 800 },
      hint: "Fai 800 punti in una partita",
    },
    {
      id: "rainbow",
      name: "Arcobaleno",
      colors: { normal: "rainbow", phase: "rainbow" },
      unlock: { type: "achievement", value: "combo_20" },
      hint: "Sblocca l'obiettivo Combo x20",
    },
    {
      id: "cyber",
      name: "Cyber",
      colors: { normal: "#7d4dff", phase: "#19f0d0" },
      unlock: { type: "stars", value: 3 },
      hint: "Raggiungi 3 stelle dalle missioni",
    },
    {
      id: "prisma",
      name: "Prisma",
      colors: { normal: "#ffe9b0", phase: "#ffffff", sparkle: true },
      unlock: { type: "code" },
      hint: "Skin a pagamento — richiede un codice",
      premium: true,
    },
  ];

  function isSkinUnlocked(skin) {
    if (skin.unlock.type === "default") return true;
    if (skin.unlock.type === "score") {
      return (
        state.stats.bestScoreClassic >= skin.unlock.value ||
        state.stats.bestScoreHardcore >= skin.unlock.value
      );
    }
    if (skin.unlock.type === "achievement") {
      return state.achievements.includes(skin.unlock.value);
    }
    if (skin.unlock.type === "stars") {
      return state.stars >= skin.unlock.value;
    }
    if (skin.unlock.type === "code") {
      return state.premiumUnlocked;
    }
    return false;
  }

  function getSkins() {
    return SKINS.map((s) => ({ ...s, unlocked: isSkinUnlocked(s) }));
  }

  function getSelectedSkin() {
    const skin = SKINS.find((s) => s.id === state.selectedSkin);
    if (skin && isSkinUnlocked(skin)) return skin;
    return SKINS[0];
  }

  function setSelectedSkin(id) {
    const skin = SKINS.find((s) => s.id === id);
    if (!skin || !isSkinUnlocked(skin)) return false;
    state.selectedSkin = id;
    save("selectedSkin", id);
    return true;
  }

  /* ---------------- skin premium / codice a pagamento ----------------
   * Nessun backend: il "pagamento" avviene fuori dal sito (link di
   * pagamento esterno impostato da Angelo), e chi paga riceve un
   * codice da inserire qui. Il controllo è locale via hash — comodo
   * per un piccolo progetto indie, ma non è una vera protezione
   * anti-pirateria: chiunque legga il codice sorgente può risalire
   * al meccanismo. Per qualcosa di davvero sicuro servirebbe un
   * backend che verifica il pagamento lato server.
   */

  const PAYMENT_LINK = "https://buy.stripe.com/TUO-LINK-DI-PAGAMENTO";

  function tinyHash(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i += 1) {
      hash = (hash * 33) ^ str.charCodeAt(i);
    }
    return (hash >>> 0).toString(36);
  }

  // Hash del codice valido "NEONPRISMA". Per cambiare codice, calcola
  // il nuovo hash con tinyHash("TUOCODICE".toUpperCase()) dalla console
  // del browser e sostituisci il valore qui sotto.
  const VALID_CODE_HASH = "yt1eyj";

  function redeemCode(input) {
    const clean = (input || "").trim().toUpperCase();
    if (!clean) return false;
    if (tinyHash(clean) === VALID_CODE_HASH) {
      state.premiumUnlocked = true;
      save("premiumUnlocked", true);
      return true;
    }
    return false;
  }

  function getPaymentLink() {
    return PAYMENT_LINK;
  }

  /* ---------------- achievement ---------------- */

  const ACHIEVEMENTS = [
    { id: "first_game", name: "Primo giro", desc: "Completa la tua prima partita.", icon: "🎮" },
    { id: "score_100", name: "Scaldamotori", desc: "Raggiungi 100 punti in una partita.", icon: "✨" },
    { id: "score_500", name: "In corsia", desc: "Raggiungi 500 punti in una partita.", icon: "🚀" },
    { id: "score_1000", name: "Leggenda del drift", desc: "Raggiungi 1000 punti in una partita.", icon: "👑" },
    { id: "survive_5min", name: "Fondista", desc: "Sopravvivi 5 minuti in una partita.", icon: "⏱️" },
    { id: "combo_20", name: "Combo Master", desc: "Fai una combo da 20 senza essere colpito.", icon: "🔥" },
  ];

  function getAchievements() {
    return ACHIEVEMENTS.map((a) => ({ ...a, unlocked: state.achievements.includes(a.id) }));
  }

  function unlockAchievement(id) {
    if (state.achievements.includes(id)) return false;
    state.achievements.push(id);
    save("achievements", state.achievements);
    return true;
  }

  /* ---------------- missioni giornaliere ---------------- */

  const MISSION_DEFS = [
    { id: "gems50", type: "gems", label: "Raccogli 50 gemme", target: 50 },
    { id: "score300", type: "score", label: "Fai 300 punti in una partita", target: 300 },
    { id: "survive2", type: "survive", label: "Sopravvivi 2 minuti in una partita", target: 120 },
  ];

  function ensureMissionsFresh() {
    if (state.missions.date !== todayKey()) {
      state.missions = {
        date: todayKey(),
        gems: 0,
        scoreBest: 0,
        surviveBest: 0,
        starAwarded: false,
      };
      save("missions", state.missions);
    }
  }

  function getMissionsState() {
    ensureMissionsFresh();
    return MISSION_DEFS.map((m) => {
      const progress =
        m.type === "gems"
          ? state.missions.gems
          : m.type === "score"
            ? state.missions.scoreBest
            : state.missions.surviveBest;
      return { ...m, progress: Math.min(progress, m.target), done: progress >= m.target };
    });
  }

  function allMissionsDone() {
    return getMissionsState().every((m) => m.done);
  }

  /* ---------------- classifica locale ---------------- */

  function getBoard(mode) {
    return (state.boards[mode] || []).slice(0, 10);
  }

  function submitScore(mode, score) {
    const board = state.boards[mode] || [];
    const qualifies = board.length < 10 || score > board[board.length - 1].score;
    if (!qualifies || score <= 0) return { qualifies: false, rank: null };

    let name = "Tu";
    try {
      const input = window.prompt(
        `Nuovo ingresso in classifica ${mode === "hardcore" ? "Hardcore" : "Classica"} con ${score} punti!\nCome vuoi firmarti? (max 12 caratteri)`,
        "Tu",
      );
      if (input && input.trim()) name = input.trim().slice(0, 12);
    } catch (e) {
      /* prompt non disponibile (es. iframe) */
    }

    board.push({ name, score, date: todayKey() });
    board.sort((a, b) => b.score - a.score);
    state.boards[mode] = board.slice(0, 10);
    save("boards", state.boards);

    const rank = state.boards[mode].findIndex((e) => e.name === name && e.score === score) + 1;
    return { qualifies: true, rank };
  }

  /* ---------------- report di fine partita ---------------- */

  function reportRun({ score, survivalSeconds, gemsCollected, maxCombo, mode }) {
    ensureMissionsFresh();
    const unlocked = [];
    const isHardcore = mode === "hardcore";

    state.stats.gamesPlayed += 1;
    state.stats.totalGems += gemsCollected;
    if (survivalSeconds > state.stats.bestSurvivalSeconds) {
      state.stats.bestSurvivalSeconds = survivalSeconds;
    }
    if (maxCombo > state.stats.bestCombo) state.stats.bestCombo = maxCombo;
    if (isHardcore) {
      if (score > state.stats.bestScoreHardcore) state.stats.bestScoreHardcore = score;
    } else if (score > state.stats.bestScoreClassic) {
      state.stats.bestScoreClassic = score;
    }
    save("stats", state.stats);

    state.missions.gems += gemsCollected;
    state.missions.scoreBest = Math.max(state.missions.scoreBest, score);
    state.missions.surviveBest = Math.max(state.missions.surviveBest, survivalSeconds);
    let starEarned = false;
    if (!state.missions.starAwarded && allMissionsDone()) {
      state.missions.starAwarded = true;
      state.stars += 1;
      starEarned = true;
      save("stars", state.stars);
    }
    save("missions", state.missions);

    if (unlockAchievement("first_game")) unlocked.push("first_game");
    if (score >= 100 && unlockAchievement("score_100")) unlocked.push("score_100");
    if (score >= 500 && unlockAchievement("score_500")) unlocked.push("score_500");
    if (score >= 1000 && unlockAchievement("score_1000")) unlocked.push("score_1000");
    if (survivalSeconds >= 300 && unlockAchievement("survive_5min")) unlocked.push("survive_5min");
    if (maxCombo >= 20 && unlockAchievement("combo_20")) unlocked.push("combo_20");

    const boardResult = submitScore(isHardcore ? "hardcore" : "classic", Math.floor(score));

    return {
      unlockedAchievements: unlocked.map((id) => ACHIEVEMENTS.find((a) => a.id === id)),
      starEarned,
      boardResult,
      isNewBest: isHardcore
        ? score >= state.stats.bestScoreHardcore
        : score >= state.stats.bestScoreClassic,
    };
  }

  /* ---------------- condivisione sfida ---------------- */

  function getChallengeFromURL() {
    const params = new URLSearchParams(window.location.search);
    const val = parseInt(params.get("challenge"), 10);
    return Number.isFinite(val) && val > 0 ? val : null;
  }

  async function shareScore(score) {
    const url = new URL(window.location.href);
    url.search = "";
    url.searchParams.set("challenge", Math.floor(score));
    const text = `Ho fatto ${Math.floor(score)} punti su Neon Drift. Riesci a battermi?`;

    if (navigator.share) {
      try {
        await navigator.share({ title: "Neon Drift", text, url: url.toString() });
        return "shared";
      } catch (e) {
        return "cancelled";
      }
    }

    try {
      await navigator.clipboard.writeText(`${text} ${url.toString()}`);
      return "copied";
    } catch (e) {
      return "unavailable";
    }
  }

  /* ---------------- tema stagionale ---------------- */

  function getSeason() {
    const override = new URLSearchParams(window.location.search).get("season");
    if (override) return override;

    const now = new Date();
    const m = now.getMonth() + 1;
    const d = now.getDate();
    if (m === 12 && d <= 26) return "natale";
    if (m === 10 && d >= 24) return "halloween";
    if (m === 2 && d >= 10 && d <= 14) return "valentino";
    return null;
  }

  const SEASON_THEMES = {
    natale: { accent: "#ff4d4d", accent2: "#2bd97a", emoji: "🎄", label: "Evento Natale" },
    halloween: { accent: "#ff8a3d", accent2: "#7d4dff", emoji: "🎃", label: "Evento Halloween" },
    valentino: { accent: "#ff5c8a", accent2: "#ff9db8", emoji: "❤️", label: "Evento San Valentino" },
  };

  return {
    getSkins,
    getSelectedSkin,
    setSelectedSkin,
    redeemCode,
    getPaymentLink,
    getAchievements,
    getMissionsState,
    getStars: () => state.stars,
    getBoard,
    reportRun,
    getChallengeFromURL,
    shareScore,
    getSeason,
    SEASON_THEMES,
    getStats: () => state.stats,
  };
})();
