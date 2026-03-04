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
   PAGE 1 GAME (UPDATED): MOMENTUM + BUILD-UP
   - First swipe starts slow
   - Keep swiping builds speed (momentum)
   - Must maintain fast spin long enough to fill "unlock progress"
   - On unlock: page spins + spiral fills screen + bright yellow flood (2s) -> reveal invite
   ========================================================= */

let spiralEl = null;
let yellowFlashEl = null;

let unlocked = false;

let rotation = 0;       // degrees (visual)
let spinSpeed = 0;      // degrees per second (momentum)
let progress = 0;       // 0..1 unlock meter

let isDragging = false;
let lastAngle = null;
let lastTime = null;

let rafId = null;
let rafLast = null;

function startSpiralGame(){
  spiralEl = document.getElementById("neonSpiral");
  yellowFlashEl = document.getElementById("yellowFlash");

  if(!spiralEl) return;

  // reset
  unlocked = false;
  rotation = 0;
  spinSpeed = 0;
  progress = 0;

  isDragging = false;
  lastAngle = null;
  lastTime = null;

  spiralEl.style.setProperty("--r", "0deg");
  spiralEl.style.transform = "rotate(0deg)";
  spiralEl.classList.remove("spinning-fast");

  document.body.classList.remove("page-spin");
  yellowFlashEl?.classList.remove("show");

  // listeners
  spiralEl.addEventListener("pointerdown", onSpiralDown);

  // start animation loop
  cancelAnimationFrame(rafId);
  rafLast = performance.now();
  rafId = requestAnimationFrame(tick);
}

function onSpiralDown(e){
  if(unlocked || !spiralEl) return;

  isDragging = true;
  spiralEl.setPointerCapture?.(e.pointerId);

  lastAngle = angleFromCenter(e, spiralEl);
  lastTime = performance.now();

  spiralEl.addEventListener("pointermove", onSpiralMove);
  spiralEl.addEventListener("pointerup", onSpiralUp);
  spiralEl.addEventListener("pointercancel", onSpiralUp);
}

function onSpiralMove(e){
  if(unlocked || !spiralEl || !isDragging) return;

  const now = performance.now();
  const ang = angleFromCenter(e, spiralEl);

  let delta = ang - lastAngle;

  // fix jump across -180/180 wrap
  if(delta > 180) delta -= 360;
  if(delta < -180) delta += 360;

  const dt = Math.max(10, now - lastTime); // ms clamp

  // Convert to a speed "push"
  const instantDegPerSec = (delta / dt) * 1000;

  // Add momentum: small swipes add small speed, repeated swipes build up
  // Tweak numbers here if you want harder/easier.
  const PUSH_GAIN = 0.70;          // how much each swipe adds
  const MAX_SPEED = 4200;          // deg/sec cap

  spinSpeed += instantDegPerSec * PUSH_GAIN;
  spinSpeed = clamp(spinSpeed, -MAX_SPEED, MAX_SPEED);

  // Tiny direct response so it feels connected to finger
  rotation += delta * 0.25;

  lastAngle = ang;
  lastTime = now;
}

function onSpiralUp(e){
  if(!spiralEl) return;

  isDragging = false;

  try { spiralEl.releasePointerCapture?.(e.pointerId); } catch {}

  spiralEl.removeEventListener("pointermove", onSpiralMove);
  spiralEl.removeEventListener("pointerup", onSpiralUp);
  spiralEl.removeEventListener("pointercancel", onSpiralUp);
}

function tick(now){
  if(unlocked || !spiralEl){
    cancelAnimationFrame(rafId);
    return;
  }

  const dt = Math.min(34, now - rafLast); // ms
  rafLast = now;

  // Momentum/friction: slows down if they stop swiping
  // Higher friction => slows faster => harder.
  const FRICTION = 0.965; // per frame-ish
  const frictionPow = Math.pow(FRICTION, dt / 16);
  spinSpeed *= frictionPow;

  // Update rotation from momentum
  rotation += (spinSpeed * dt) / 1000;

  spiralEl.style.setProperty("--r", `${rotation}deg`);
  spiralEl.style.transform = `rotate(${rotation}deg)`;

  // Unlock progress: only builds meaningfully at higher speeds
  const absSpeed = Math.abs(spinSpeed);

  // Need sustained speed; slow spins barely add anything.
  const TARGET_SPEED = 2200; // deg/sec where progress builds at full rate
  const speedFactor = clamp(absSpeed / TARGET_SPEED, 0, 1);

  // Progress build & decay (so one swipe won't win)
  const BUILD_RATE = 0.00045;  // per ms at full speed (≈0.45/sec)
  const DECAY_RATE = 0.00010;  // per ms when not keeping speed

  progress += speedFactor * dt * BUILD_RATE;

  // If they slow down too much, progress bleeds out
  if(speedFactor < 0.45){
    progress -= (0.45 - speedFactor) * dt * DECAY_RATE * 2.2;
  }

  progress = clamp(progress, 0, 1);

  // Unlock when meter is filled
  if(progress >= 1){
    unlockSpiral();
    return;
  }

  rafId = requestAnimationFrame(tick);
}

function angleFromCenter(e, el){
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const dx = e.clientX - cx;
  const dy = e.clientY - cy;
  return Math.atan2(dy, dx) * 180 / Math.PI;
}

function clamp(n, a, b){
  return Math.max(a, Math.min(b, n));
}

function unlockSpiral(){
  if(unlocked || !spiralEl) return;
  unlocked = true;

  // stop input
  spiralEl.removeEventListener("pointerdown", onSpiralDown);
  spiralEl.removeEventListener("pointermove", onSpiralMove);
  spiralEl.removeEventListener("pointerup", onSpiralUp);
  spiralEl.removeEventListener("pointercancel", onSpiralUp);

  // Screen spin + spiral fills screen
  document.body.classList.add("page-spin");
  spiralEl.classList.add("spinning-fast");

  // After the spin animation ends, flood bright yellow for ~2s, then reveal
  // CSS spin/fly is 1.35s
  setTimeout(() => {
    yellowFlashEl?.classList.add("show");
  }, 1100); // starts near the end of the spin so it feels like it "bursts" out

  // Total delay: spin (1350ms) + yellow hold (2000ms)
  setTimeout(() => {
    document.body.classList.remove("page-spin");
    yellowFlashEl?.classList.remove("show");
    finishGame();
  }, 1350 + 2000);
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
