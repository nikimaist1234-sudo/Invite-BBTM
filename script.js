const startBtn = document.getElementById("startBtn");
const music = document.getElementById("bgMusic");

let musicStarted = false;

/* ---------------- Prevent touch scrolling while locked (mobile)
   BUT allow interactions on the spiral container
---------------- */
function preventScroll(e){
  if(!document.body.classList.contains("locked")) return;

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

  const fade = setInterval(() => {
    if(music.volume < 0.6){
      music.volume = Math.min(0.6, music.volume + 0.05);
    } else {
      clearInterval(fade);
    }
  }, 180);
}

/* =========================================================
   PAGE 1 GAME (Momentum + Build-up)
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

  spiralEl.addEventListener("pointerdown", onSpiralDown);

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

  if(delta > 180) delta -= 360;
  if(delta < -180) delta += 360;

  const dt = Math.max(10, now - lastTime);

  const instantDegPerSec = (delta / dt) * 1000;

  const PUSH_GAIN = 0.70;
  const MAX_SPEED = 4200;

  spinSpeed += instantDegPerSec * PUSH_GAIN;
  spinSpeed = clamp(spinSpeed, -MAX_SPEED, MAX_SPEED);

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

  const dt = Math.min(34, now - rafLast);
  rafLast = now;

  const FRICTION = 0.965;
  const frictionPow = Math.pow(FRICTION, dt / 16);
  spinSpeed *= frictionPow;

  rotation += (spinSpeed * dt) / 1000;

  spiralEl.style.setProperty("--r", `${rotation}deg`);
  spiralEl.style.transform = `rotate(${rotation}deg)`;

  const absSpeed = Math.abs(spinSpeed);

  const TARGET_SPEED = 2200;
  const speedFactor = clamp(absSpeed / TARGET_SPEED, 0, 1);

  const BUILD_RATE = 0.00045;
  const DECAY_RATE = 0.00010;

  progress += speedFactor * dt * BUILD_RATE;

  if(speedFactor < 0.45){
    progress -= (0.45 - speedFactor) * dt * DECAY_RATE * 2.2;
  }

  progress = clamp(progress, 0, 1);

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

  spiralEl.removeEventListener("pointerdown", onSpiralDown);
  spiralEl.removeEventListener("pointermove", onSpiralMove);
  spiralEl.removeEventListener("pointerup", onSpiralUp);
  spiralEl.removeEventListener("pointercancel", onSpiralUp);

  document.body.classList.add("page-spin");
  spiralEl.classList.add("spinning-fast");

  setTimeout(() => {
    yellowFlashEl?.classList.add("show");
  }, 1100);

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

/* =========================================================
   QUIZ (ported from Trilogy + updated to BBTM songs)
   - jpg/mp3 filenames use exact keys:
     often, losers, earned-it, in-the-night, as-you-are
   ========================================================= */
const quizScreen = document.getElementById("pageQuiz");
const openQuizBtn = document.getElementById("openQuizBtn");
const quizBackBtn = document.getElementById("quizBackBtn");

const quizForm = document.getElementById("quizForm");
const guestNameInput = document.getElementById("guestName");
const quizFinishBtn = document.getElementById("quizFinishBtn");

const quizResult = document.getElementById("quizResult");
const quizResultInner = document.getElementById("quizResultInner");
const resultCover = document.getElementById("resultCover");
const resultBlurb = document.getElementById("resultBlurb");
const quizOverlay = document.getElementById("quizOverlay");

const quizRetryBtn = document.getElementById("quizRetryBtn");
const quizCloseBtn = document.getElementById("quizCloseBtn");

const resultAudio = document.getElementById("resultAudio");

const SONG_KEYS = ["often", "losers", "earned-it", "in-the-night", "as-you-are"];

const SONG_PRETTY = {
  "often": "Often",
  "losers": "Losers",
  "earned-it": "Earned It",
  "in-the-night": "In The Night",
  "as-you-are": "As You Are",
};

const SONG_BLURB = {
  "often": "You’re the main character. Smooth, confident, and a little dangerous.",
  "losers": "You’re real, unfiltered, and you don’t pretend for anyone.",
  "earned-it": "Soft heart, high standards. You move like luxury.",
  "in-the-night": "Mysterious vibe. People want the story but you keep it lowkey.",
  "as-you-are": "Warm energy. You make people feel seen without even trying.",
};

let _inviteWasPlaying = false;
let _inviteTime = 0;
let _scrollYBeforeQuiz = 0;

function stopResultAudio() {
  if (!resultAudio) return;
  resultAudio.pause();
  resultAudio.currentTime = 0;
  resultAudio.removeAttribute("src");
}

function enterQuizAudioMode() {
  stopResultAudio();

  if (!music) return;
  _inviteWasPlaying = !music.paused;
  _inviteTime = music.currentTime || 0;
  music.pause();
}

function exitQuizAudioMode() {
  stopResultAudio();

  if (!music) return;
  if (_inviteWasPlaying) {
    try {
      music.currentTime = _inviteTime || 0;
    } catch (e) {}
    music.play().catch(() => {});
  }
}

function resetQuizUI() {
  quizForm?.reset();

  if (quizResult) quizResult.style.display = "none";
  if (quizResultInner) {
    quizResultInner.classList.remove("show");
    quizResultInner.innerHTML = "";
  }
  if (resultCover) {
    resultCover.classList.remove("show");
    resultCover.removeAttribute("src");
  }
  if (resultBlurb) resultBlurb.textContent = "";
  quizOverlay?.classList.remove("on");
}

function openQuiz() {
  _scrollYBeforeQuiz = window.scrollY || 0;
  enterQuizAudioMode();
  resetQuizUI();

  document.body.classList.add("quiz-open");
  quizScreen?.setAttribute("aria-hidden", "false");

  setTimeout(() => {
    if (quizScreen) quizScreen.scrollTop = 0;
    window.scrollTo({ top: 0, behavior: "auto" });
  }, 0);
}

function closeQuiz() {
  document.body.classList.remove("quiz-open");
  quizScreen?.setAttribute("aria-hidden", "true");
  stopResultAudio();

  setTimeout(() => {
    window.scrollTo({ top: _scrollYBeforeQuiz, behavior: "auto" });
  }, 0);

  exitQuizAudioMode();
}

function computeQuizResult() {
  if (!quizForm) return { error: "Quiz not found." };

  const guestName = (guestNameInput?.value || "").trim();
  if (!guestName) return { error: "Enter your name first." };

  const scores = Object.fromEntries(SONG_KEYS.map((k) => [k, 0]));
  const data = new FormData(quizForm);

  for (const [key, value] of data.entries()) {
    if (key === "guestName") continue;
    if (scores[value] !== undefined) scores[value] += 1;
  }

  for (let i = 1; i <= 6; i++) {
    if (!data.get("q" + i)) return { error: "Answer all 6 questions first." };
  }

  const max = Math.max(...Object.values(scores));
  const top = Object.keys(scores).filter((k) => scores[k] === max);
  const chosen = top[Math.floor(Math.random() * top.length)];

  return { chosen, guestName };
}

function showQuizResult({ chosen, guestName }) {
  const pretty = SONG_PRETTY[chosen] || chosen;

  if (quizResult) quizResult.style.display = "block";
  quizOverlay?.classList.add("on");

  if (quizResultInner) {
    quizResultInner.innerHTML = `
      <h2>${guestName}, your song is <span class="quiz-album">${pretty}</span></h2>
      <p>Don’t argue. The vibe picked you.</p>
    `;
    requestAnimationFrame(() => quizResultInner.classList.add("show"));
  }

  if (resultCover) {
    resultCover.src = `${chosen}.jpg`;
    resultCover.classList.add("show");
  }

  if (resultBlurb) {
    resultBlurb.textContent = SONG_BLURB[chosen] || "";
  }

  // play result mp3 (exact filename spelling)
  if (resultAudio) {
    try {
      resultAudio.src = `${chosen}.mp3`;
      resultAudio.currentTime = 0;
      resultAudio.play().catch(() => {});
    } catch (e) {}
  }
}

openQuizBtn?.addEventListener("click", openQuiz);
quizBackBtn?.addEventListener("click", closeQuiz);
quizCloseBtn?.addEventListener("click", closeQuiz);

quizRetryBtn?.addEventListener("click", () => {
  stopResultAudio();
  resetQuizUI();
});

quizFinishBtn?.addEventListener("click", () => {
  const res = computeQuizResult();
  if (res.error) {
    alert(res.error);
    return;
  }
  showQuizResult(res);
});
