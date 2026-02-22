const startBtn = document.getElementById("startBtn");
const music = document.getElementById("bgMusic");

let musicStarted = false;

/* ---------------- Prevent touch scrolling while locked (mobile)
   BUT allow interactions on the spiral container
---------------- */
function preventScroll(e){
  if(!document.body.classList.contains("locked")) return;

  // Allow touches inside spiral game area
  const allowed = e.target?.closest?.(".spiral-container");
  if(allowed) return;

  e.preventDefault();
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
  startSpiralGame();
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
   PAGE 1 GAME: NEON SPIRAL SPIN
   - Guests spin spiral (drag in circles)
   - If spin speed is high enough -> fly/zoom + whole page spin
   - Then unlock invite (scroll-mode)
   ========================================================= */

let spiralEl = null;
let unlocked = false;

let rotation = 0;      // degrees
let velocity = 0;      // rough speed score

let lastAngle = null;
let lastTime = null;

function startSpiralGame(){
  spiralEl = document.getElementById("neonSpiral");
  if(!spiralEl) return;

  unlocked = false;
  rotation = 0;
  velocity = 0;
  lastAngle = null;
  lastTime = null;

  spiralEl.style.setProperty("--r", "0deg");
  spiralEl.style.transform = "rotate(0deg)";
  spiralEl.classList.remove("spinning-fast");
  document.body.classList.remove("page-spin");

  spiralEl.addEventListener("pointerdown", onSpiralDown);
}

function onSpiralDown(e){
  if(unlocked || !spiralEl) return;

  spiralEl.setPointerCapture?.(e.pointerId);

  lastAngle = angleFromCenter(e, spiralEl);
  lastTime = performance.now();

  spiralEl.addEventListener("pointermove", onSpiralMove);
  spiralEl.addEventListener("pointerup", onSpiralUp);
  spiralEl.addEventListener("pointercancel", onSpiralUp);
}

function onSpiralMove(e){
  if(unlocked || !spiralEl) return;

  const now = performance.now();
  const ang = angleFromCenter(e, spiralEl);

  let delta = ang - lastAngle;

  // fix jump across -180/180 wrap
  if(delta > 180) delta -= 360;
  if(delta < -180) delta += 360;

  const dt = Math.max(16, now - lastTime); // clamp

  rotation += delta;

  // Apply rotation
  spiralEl.style.setProperty("--r", `${rotation}deg`);
  spiralEl.style.transform = `rotate(${rotation}deg)`;

  // Velocity score (bigger = faster)
  const instant = Math.abs(delta) / dt;   // deg per ms
  velocity = velocity * 0.86 + instant * 0.14;

  // Threshold: tune if you want easier/harder
  // On phones, ~0.18–0.28 feels good. This is ~0.22.
  if(velocity > 0.22){
    unlockSpiral();
  }

  lastAngle = ang;
  lastTime = now;
}

function onSpiralUp(e){
  if(!spiralEl) return;
  try { spiralEl.releasePointerCapture?.(e.pointerId); } catch {}

  spiralEl.removeEventListener("pointermove", onSpiralMove);
  spiralEl.removeEventListener("pointerup", onSpiralUp);
  spiralEl.removeEventListener("pointercancel", onSpiralUp);
}

function angleFromCenter(e, el){
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const dx = e.clientX - cx;
  const dy = e.clientY - cy;
  return Math.atan2(dy, dx) * 180 / Math.PI;
}

function unlockSpiral(){
  if(unlocked || !spiralEl) return;
  unlocked = true;

  // Stop listening
  spiralEl.removeEventListener("pointermove", onSpiralMove);
  spiralEl.removeEventListener("pointerup", onSpiralUp);
  spiralEl.removeEventListener("pointercancel", onSpiralUp);

  // Whole page spins while spiral flies forward
  document.body.classList.add("page-spin");

  // Fly/zoom animation
  spiralEl.classList.add("spinning-fast");

  // After animation ends -> reveal invite (scroll mode)
  // Match CSS duration: 1.35s
  setTimeout(() => {
    document.body.classList.remove("page-spin");
    finishGame();
  }, 1350);
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
