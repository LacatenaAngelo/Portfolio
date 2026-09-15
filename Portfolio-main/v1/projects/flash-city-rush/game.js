// NOTA: il motore di gioco originale di Flash City Rush non è ancora stato
// caricato in questo repository. Questo file disegna una scena statica
// segnaposto (mappa + HUD collegato) così la pagina resta presentabile
// mentre il vero game loop è in lavorazione.

const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const startButton = document.querySelector("#startButton");
const objectiveText = document.querySelector("#objectiveText");

let w = 0;
let h = 0;
let dpr = 1;

function resize() {
  const rect = canvas.getBoundingClientRect();
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  w = rect.width;
  h = rect.height;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  draw();
}

function drawBlocks() {
  const cols = Math.ceil(w / 96) + 1;
  const rows = Math.ceil(h / 96) + 1;
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const shade = (x + y) % 2 === 0 ? "#1c1c1c" : "#161616";
      ctx.fillStyle = shade;
      ctx.fillRect(x * 96, y * 96, 96, 96);
    }
  }
}

function drawRoads() {
  ctx.strokeStyle = "#ffbf2e";
  ctx.setLineDash([26, 18]);
  ctx.lineWidth = 4;
  for (let y = 140; y < h; y += 220) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

function draw() {
  ctx.clearRect(0, 0, w, h);
  drawBlocks();
  drawRoads();

  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.font = "900 clamp(20px, 3vw, 32px) 'Trebuchet MS', sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,244,197,0.9)";
  ctx.font = "900 30px 'Trebuchet MS', sans-serif";
  ctx.fillText("Motore di gioco in arrivo", 0, -6);
  ctx.font = "700 16px 'Trebuchet MS', sans-serif";
  ctx.fillStyle = "rgba(255,244,197,0.6)";
  ctx.fillText("HUD, mappa e struttura sono già pronti", 0, 22);
  ctx.restore();
}

startButton.addEventListener("click", () => {
  objectiveText.textContent =
    "Il motore di gioco (guida, traffico, missioni) è ancora in lavorazione.";
});

window.addEventListener("resize", resize);
resize();
