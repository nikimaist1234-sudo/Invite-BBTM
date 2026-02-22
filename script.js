const startBtn = document.getElementById("startBtn");
const music = document.getElementById("bgMusic");

let musicStarted = false;

/* ---------------- Prevent touch scrolling while locked (mobile) ---------------- */
function preventScroll(e){
  if(document.body.classList.contains("locked")){
    e.preventDefault();
  }
}
window.addEventListener("touchmove", preventScroll, { passive: false });

/* ---------------- PAGE NAV (only for Page0 -> Page1) ---------------- */
function showOnlyPage(pageNumber){
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  const el = document.getElementById("page" + pageNumber);
  if(el) el.classList.add("active");
}

startBtn?.addEventListener("click", () => {
  showOnlyPage(1);
  startMusic();
  startMaskFireGame();
});

/* ---------------- MUSIC ---------------- */
function startMusic(){
  if(musicStarted || !music) return;

  music.volume = 0;
  music.play().catch(() => {});
  musicStarted = true;

  // gentle fade in
  const fade = setInterval(() => {
    if(music.volume < 0.6){
      music.volume = Math.min(0.6, music.volume + 0.05);
    } else {
      clearInterval(fade);
    }
  }, 180);
}

/* =========================================================
   PAGE 1 GAME: BURNING NEON MASK
   - Tap flames to extinguish before mask reaches full scale
   - If fail: Try Again or View Invite
   - If win: Yellow flood -> invite
   ========================================================= */

let maskGame = null;
let maskEl = null;
let fireLayerEl = null;
let overlayEl = null;
let heatLabelEl = null;

let gameActive = false;
let heat = 100;             // 0 = extinguished (win), 100 = fully burning
let scale = 0.70;           // grows until fail threshold
let tickGrow = null;
let tickHeat = null;
let tickSpawn = null;

const FAIL_SCALE = 1.25;
const GROW_STEP = 0.010;     // growth per tick
const GROW_MS = 60;

const PASSIVE_BURN = 1.6;    // heat reduction per second (game wins even if user taps some)
const TAP_COOL = 7;          // heat reduction per flame tap
const SPAWN_MS = 260;        // flame spawn rate
const FLAME_LIFE = 1400;     // flame lifetime

function cacheMaskGameEls(){
  maskGame = document.getElementById("maskGame");
  maskEl = document.getElementById("neonMask");
  fireLayerEl = document.getElementById("fireLayer");
  overlayEl = document.getElementById("maskOverlay");
  heatLabelEl = document.getElementById("heatValue");
}

function ensureMaskGameMarkup(){
  // If your index.html hasn’t been updated yet, this prevents crashing.
  if(document.getElementById("maskGame")) return;

  const page1 = document.getElementById("page1");
  if(!page1) return;

  const gameArea = page1.querySelector(".game-area");
  if(!gameArea) return;

  gameArea.innerHTML = `
    <p class="game-hint">Tap the flames to put the fire out before it consumes the mask</p>

    <div class="mask-game" id="maskGame" aria-label="Burning mask game">
      <div class="mask-hud">
        <div class="hud-pill">Fire: <span id="heatValue">100</span>%</div>
        <div class="hud-pill">Tap flames 🔥</div>
      </div>

      <div class="mask-stage">
        <div class="fire-layer" id="fireLayer"></div>
        <div class="neon-mask" id="neonMask"></div>
      </div>

      <div class="game-overlay" id="maskOverlay" aria-hidden="true">
        <div class="game-card">
          <h2 id="maskOverlayTitle">The fire consumed it...</h2>
          <p id="maskOverlayDesc">Try again or skip straight to the invite.</p>
          <div class="game-actions">
            <button class="primary" id="retryBtn">Try Again</button>
            <button id="viewBtn">View Invite</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function startMaskFireGame(){
  ensureMaskGameMarkup();
  cacheMaskGameEls();

  if(!maskGame || !maskEl || !fireLayerEl || !overlayEl) return;

  clearMaskTimers();

  // reset state
  gameActive = true;
  heat = 100;
  scale = 0.70;

  fireLayerEl.innerHTML = "";
  overlayEl.classList.remove("show");
  overlayEl.setAttribute("aria-hidden", "true");

  updateHeatHud();
  maskEl.style.transform = `scale(${scale})`;

  // wire buttons
  const retryBtn = document.getElementById("retryBtn");
  const viewBtn = document.getElementById("viewBtn");
  retryBtn?.addEventListener("click", restartGame);
  viewBtn?.addEventListener("click", finishGame);

  // growth loop (fail if too large)
  tickGrow = setInterval(() => {
    if(!gameActive) return;
    scale += GROW_STEP;
    maskEl.style.transform = `scale(${scale})`;

    if(scale >= FAIL_SCALE){
      failGame();
    }
  }, GROW_MS);

  // passive extinguish (so it always progresses)
  tickHeat = setInterval(() => {
    if(!gameActive) return;
    heat = Math.max(0, heat - (PASSIVE_BURN / 5)); // 200ms ticks -> /5
    updateHeatHud();
    if(heat <= 0){
      winGame();
    }
  }, 200);

  // spawn tappable flames
  tickSpawn = setInterval(() => {
    if(!gameActive) return;
    spawnFlame();
  }, SPAWN_MS);
}

function spawnFlame(){
  if(!fireLayerEl || !maskGame) return;

  const flame = document.createElement("div");
  flame.className = "flame";

  // Spawn mostly around the mask area (center), but still varied
  const rx = randFloat(18, 82);
  const ry = randFloat(18, 82);

  flame.style.left = rx + "%";
  flame.style.top = ry + "%";

  flame.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if(!gameActive) return;

    // cool down
    heat = Math.max(0, heat - TAP_COOL);
    updateHeatHud();

    // pop effect
    flame.style.transform = "scale(1.55)";
    flame.style.opacity = "0";
    setTimeout(() => flame.remove(), 120);

    if(heat <= 0){
      winGame();
    }
  });

  fireLayerEl.appendChild(flame);

  setTimeout(() => {
    flame.remove();
  }, FLAME_LIFE);
}

function updateHeatHud(){
  if(heatLabelEl){
    heatLabelEl.textContent = String(Math.round(heat));
  }
}

function failGame(){
  if(!gameActive) return;
  gameActive = false;
  clearMaskTimers();

  if(overlayEl){
    const title = document.getElementById("maskOverlayTitle");
    const desc = document.getElementById("maskOverlayDesc");
    if(title) title.textContent = "The fire consumed it...";
    if(desc) desc.textContent = "Try again or skip straight to the invite.";
    overlayEl.classList.add("show");
    overlayEl.setAttribute("aria-hidden", "false");
  }
}

function winGame(){
  if(!gameActive) return;
  gameActive = false;
  clearMaskTimers();

  // Yellow flood animation
  document.body.classList.add("yellow-flood");

  // after flood, go to invite
  setTimeout(() => {
    document.body.classList.remove("yellow-flood");
    finishGame();
  }, 1900);
}

function clearMaskTimers(){
  if(tickGrow) clearInterval(tickGrow);
  if(tickHeat) clearInterval(tickHeat);
  if(tickSpawn) clearInterval(tickSpawn);
  tickGrow = null;
  tickHeat = null;
  tickSpawn = null;
}

/* Buttons call these */
function restartGame(){
  startMaskFireGame();
}

/* ---------------- FINISH: enable scroll from Show Up to end ---------------- */
function finishGame(){
  document.body.classList.remove("locked");
  document.body.classList.add("scroll-mode");

  const page2 = document.getElementById("page2");
  setTimeout(() => {
    page2?.scrollIntoView({ behavior: "smooth" });
  }, 350);
}

/* ---------------- HELPERS ---------------- */
function randFloat(min, max){
  return Math.random() * (max - min) + min;
}
