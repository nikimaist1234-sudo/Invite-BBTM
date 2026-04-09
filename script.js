/* ===========================
   XO Nights Invite + Quiz
   Beauty Behind the Madness Edition
   =========================== */

document.addEventListener("DOMContentLoaded", () => {
  /* ---------- Elements ---------- */
  const startBtn = document.getElementById("startBtn");
  const music = document.getElementById("bgMusic");
  const spiralEl = document.getElementById("neonSpiral");

  /* ---------- Game Config ---------- */
  const XO_RAIN_DURATION_MS = 5000;
  // Yellow theme colors: black, grey, yellow
  const XO_COLORS = ["#111", "#777", "#FFD84A"];

  let musicStarted = false;
  let unlocked = false;
  let finishing = false;

  // Spiral physics
  let rotation = 0;
  let spinSpeed = 0;
  let progress = 0;
  let isDragging = false;
  let lastAngle = null;
  let lastTime = null;
  let rafId = null;
  let rafLast = null;

  // Prevent touch scrolling while locked (mobile)
  function preventScroll(e) {
    if (document.body.classList.contains("locked")) {
      const allowed = e.target?.closest?.(".spiral-container");
      if (allowed) return;
      e.preventDefault();
    }
  }
  window.addEventListener("touchmove", preventScroll, { passive: false });

  /* ---------- Page nav (Page0 -> Page1) ---------- */
  function showOnlyPage(pageNumber) {
    document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
    const el = document.getElementById("page" + pageNumber);
    if (el) el.classList.add("active");
  }

  /* ---------- Music ---------- */
  function startMusic() {
    if (musicStarted || !music) return;
    music.volume = 0;
    music.play().catch(() => {});
    musicStarted = true;
    const fade = setInterval(() => {
      if (music.volume < 0.6) {
        music.volume = Math.min(0.6, music.volume + 0.05);
      } else {
        clearInterval(fade);
      }
    }, 180);
  }

  /* ---------- Start button ---------- */
  if (startBtn) {
    let started = false;
    const onceStart = (e) => {
      if (started) return;
      started = true;
      e?.preventDefault?.();
      showOnlyPage(1);
      startMusic();
      startSpiralGame();
    };

    startBtn.addEventListener("pointerup", onceStart, { passive: false });
    startBtn.addEventListener("touchend", onceStart, { passive: false });
    startBtn.addEventListener("click", onceStart);
  }

  /* ---------- Spiral Game ---------- */
  function startSpiralGame() {
    if (!spiralEl) return;

    unlocked = false;
    finishing = false;
    rotation = 0;
    spinSpeed = 0;
    progress = 0;
    isDragging = false;
    lastAngle = null;
    lastTime = null;

    spiralEl.style.setProperty("--r", "0deg");
    spiralEl.style.transform = "rotate(0deg)";
    spiralEl.classList.remove("spinning-fast");

    spiralEl.addEventListener("pointerdown", onSpiralDown);

    cancelAnimationFrame(rafId);
    rafLast = performance.now();
    rafId = requestAnimationFrame(tick);
  }

  function onSpiralDown(e) {
    if (unlocked || !spiralEl) return;
    isDragging = true;
    spiralEl.setPointerCapture?.(e.pointerId);
    lastAngle = angleFromCenter(e, spiralEl);
    lastTime = performance.now();
    spiralEl.addEventListener("pointermove", onSpiralMove);
    spiralEl.addEventListener("pointerup", onSpiralUp);
    spiralEl.addEventListener("pointercancel", onSpiralUp);
  }

  function onSpiralMove(e) {
    if (unlocked || !spiralEl || !isDragging) return;
    const now = performance.now();
    const ang = angleFromCenter(e, spiralEl);
    let delta = ang - lastAngle;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
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

  function onSpiralUp(e) {
    if (!spiralEl) return;
    isDragging = false;
    try { spiralEl.releasePointerCapture?.(e.pointerId); } catch {}
    spiralEl.removeEventListener("pointermove", onSpiralMove);
    spiralEl.removeEventListener("pointerup", onSpiralUp);
    spiralEl.removeEventListener("pointercancel", onSpiralUp);
  }

  function tick(now) {
    if (unlocked || !spiralEl || finishing) {
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
    if (speedFactor < 0.45) {
      progress -= (0.45 - speedFactor) * dt * DECAY_RATE * 2.2;
    }
    progress = clamp(progress, 0, 1);

    if (progress >= 1) {
      unlockSpiral();
      return;
    }

    rafId = requestAnimationFrame(tick);
  }

  function angleFromCenter(e, el) {
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    return Math.atan2(dy, dx) * 180 / Math.PI;
  }

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  function unlockSpiral() {
    if (unlocked || !spiralEl) return;
    unlocked = true;
    finishing = true;

    spiralEl.removeEventListener("pointerdown", onSpiralDown);
    spiralEl.removeEventListener("pointermove", onSpiralMove);
    spiralEl.removeEventListener("pointerup", onSpiralUp);
    spiralEl.removeEventListener("pointercancel", onSpiralUp);

    spiralEl.classList.add("spinning-fast");

    // Start XO rain (yellow themed) then fade to scroll mode
    setTimeout(() => {
      startXORain(XO_RAIN_DURATION_MS);
    }, 1200);
  }

  /* ---------- XO Rain (Yellow Theme) ---------- */
  function startXORain(durationMs) {
    const page1 = document.getElementById("page1");

    let layer = document.getElementById("xoRainLayer");
    if (!layer) {
      layer = document.createElement("div");
      layer.id = "xoRainLayer";
      document.body.appendChild(layer);
    }

    const start = Date.now();

    const spawn = () => {
      const burst = rand(10, 18);
      for (let i = 0; i < burst; i++) {
        const piece = document.createElement("div");
        piece.className = "xo-piece";
        piece.textContent = "XO";

        const left = rand(0, window.innerWidth);
        const duration = rand(1800, 3200);
        const drift = rand(-140, 140) + "px";
        const rot = rand(-540, 540) + "deg";

        piece.style.left = left + "px";
        piece.style.animationDuration = duration + "ms";
        piece.style.color = XO_COLORS[rand(0, XO_COLORS.length - 1)];
        piece.style.setProperty("--drift", drift);
        piece.style.setProperty("--rot", rot);

        layer.appendChild(piece);
        setTimeout(() => piece.remove(), duration + 150);
      }
    };

    spawn();
    const rainTimer = setInterval(() => {
      spawn();
      if (Date.now() - start >= durationMs) {
        clearInterval(rainTimer);
        if (page1) page1.classList.add("fade-out");
        setTimeout(() => {
          cleanupXORain();
          finishGame();
        }, 850);
      }
    }, 140);
  }

  function cleanupXORain() {
    const layer = document.getElementById("xoRainLayer");
    if (layer) layer.remove();
  }

  /* ---------- Unlock scrolling after game ---------- */
  function finishGame() {
    document.body.classList.remove("locked");
    document.body.classList.add("scroll-mode");
    const page2 = document.getElementById("page2");
    setTimeout(() => {
      page2?.scrollIntoView({ behavior: "smooth" });
    }, 350);
  }

  /* ---------- Helpers ---------- */
  function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /* ===========================
     QUIZ (Trilogy Style)
     =========================== */

  const openQuizBtn = document.getElementById("openQuizBtn");
  const quizBackBtn = document.getElementById("quizBackBtn");
  const quizCloseBtn = document.getElementById("quizCloseBtn");
  const quizFinishBtn = document.getElementById("quizFinishBtn");
  const quizRetryBtn = document.getElementById("quizRetryBtn");

  const quizScreen = document.getElementById("pageQuiz");
  const quizForm = document.getElementById("quizForm");
  const quizResult = document.getElementById("quizResult");
  const quizResultInner = document.getElementById("quizResultInner");
  const quizOverlay = document.getElementById("quizOverlay");
  const resultCover = document.getElementById("resultCover");
  const resultBlurb = document.getElementById("resultBlurb");
  const guestNameInput = document.getElementById("guestName");
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
    "often": "You're the main character. Smooth, confident, and a little dangerous.",
    "losers": "You're real, unfiltered, and you don't pretend for anyone.",
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
      try { music.currentTime = _inviteTime || 0; } catch (e) {}
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

  function playResultSong(songKey) {
    music?.pause();
    if (resultCover) {
      resultCover.src = `${songKey}.jpg`;
      resultCover.classList.add("show");
    }
    if (resultAudio) {
      resultAudio.pause();
      resultAudio.currentTime = 0;
      resultAudio.src = `${songKey}.mp3`;
      resultAudio.load();
      resultAudio.play().catch(() => {});
    }
  }

  function revealQuizResult(songKey, guestName) {
    if (!quizResult || !quizResultInner) return;
    quizResult.style.display = "block";
    quizResultInner.classList.remove("show");
    quizResultInner.innerHTML = `
      <h2>${guestName}, you are <span>${SONG_PRETTY[songKey] || "a Mystery Track"}</span></h2>
    `;
    if (resultBlurb) resultBlurb.textContent = SONG_BLURB[songKey] || "";
    if (quizOverlay) {
      quizOverlay.classList.add("on");
      setTimeout(() => quizOverlay.classList.remove("on"), 900);
    }
    requestAnimationFrame(() => quizResultInner.classList.add("show"));
    playResultSong(songKey);

    const scrollToFullResult = () => {
      quizResult.scrollIntoView({ behavior: "smooth", block: "start" });
      setTimeout(() => window.scrollBy({ top: -16, left: 0, behavior: "auto" }), 350);
    };

    setTimeout(scrollToFullResult, 180);

    if (resultCover) {
      resultCover.onload = () => {
        setTimeout(scrollToFullResult, 60);
      };
    }
  }

  openQuizBtn?.addEventListener("click", openQuiz);
  quizBackBtn?.addEventListener("click", closeQuiz);
  quizCloseBtn?.addEventListener("click", closeQuiz);

  quizRetryBtn?.addEventListener("click", () => {
    resetQuizUI();
    stopResultAudio();
    if (quizScreen) quizScreen.scrollTop = 0;
  });

  quizFinishBtn?.addEventListener("click", () => {
    const res = computeQuizResult();
    if (res.error) {
      if (!quizResult || !quizResultInner) return;
      quizResult.style.display = "block";
      quizResultInner.classList.remove("show");
      quizResultInner.innerHTML = `<h2>Hold up</h2><p>${res.error}</p>`;
      if (resultBlurb) resultBlurb.textContent = "";
      requestAnimationFrame(() => quizResultInner.classList.add("show"));
      setTimeout(() => quizResult.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
      return;
    }
    revealQuizResult(res.chosen, res.guestName);
  });
});
