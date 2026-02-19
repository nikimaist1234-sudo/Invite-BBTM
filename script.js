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
  initMirrorPuzzle();
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

/* ---------------- MIRROR MAZE PUZZLE ---------------- */
const mirrorWrap = document.getElementById("mirrorWrap");
const mirrorBoard = document.getElementById("mirrorBoard");
const targetsEl = document.getElementById("targets");
const piecesEl = document.getElementById("pieces");
const yellowMask = document.getElementById("yellowMask");
const shatterCanvas = document.getElementById("shatterCanvas");

const SNAP_DIST = 28;   // px
const ROT_TOL = 14;     // deg

// Hand-crafted shards
const SHARDS = [
  { id: "s1", w: 190, h: 220, tx: 185, ty: 195, tr: -10, poly: "10% 8%, 82% 0%, 100% 42%, 72% 100%, 0% 74%" },
  { id: "s2", w: 170, h: 210, tx: 420, ty: 190, tr: 8,   poly: "0% 18%, 70% 0%, 100% 34%, 78% 100%, 10% 78%" },
  { id: "s3", w: 160, h: 170, tx: 305, ty: 155, tr: 2,   poly: "18% 0%, 88% 12%, 100% 70%, 52% 100%, 0% 62%" },
  { id: "s4", w: 210, h: 180, tx: 220, ty: 395, tr: 16,  poly: "0% 26%, 52% 0%, 100% 20%, 84% 100%, 20% 84%" },
  { id: "s5", w: 200, h: 190, tx: 415, ty: 395, tr: -14, poly: "12% 0%, 100% 18%, 86% 100%, 30% 84%, 0% 42%" },
  { id: "s6", w: 175, h: 200, tx: 305, ty: 305, tr: 0,   poly: "0% 18%, 42% 0%, 100% 24%, 88% 100%, 22% 84%" }
];

let lockedCount = 0;
let active = null;

function initMirrorPuzzle(){
  if(!mirrorWrap || !mirrorBoard || !targetsEl || !piecesEl) return;

  // reset
  targetsEl.innerHTML = "";
  piecesEl.innerHTML = "";
  lockedCount = 0;
  active = null;

  mirrorWrap.classList.remove("solved");
  mirrorWrap.classList.remove("cracking");
  yellowMask?.classList.remove("show");

  if(piecesEl) piecesEl.style.opacity = "1";
  if(targetsEl) targetsEl.style.opacity = "1";
  if(yellowMask) yellowMask.style.opacity = "1";

  sizeCanvasToElement();

  SHARDS.forEach((s, idx) => {
    // target
    const t = document.createElement("div");
    t.className = "target";
    t.style.setProperty("--w", s.w + "px");
    t.style.setProperty("--h", s.h + "px");
    t.style.setProperty("--x", s.tx + "px");
    t.style.setProperty("--y", s.ty + "px");
    t.style.setProperty("--r", s.tr + "deg");
    t.style.setProperty("--poly", s.poly);
    targetsEl.appendChild(t);

    // piece
    const p = document.createElement("div");
    p.className = "shard";
    p.dataset.id = s.id;
    p.dataset.tx = String(s.tx);
    p.dataset.ty = String(s.ty);
    p.dataset.tr = String(s.tr);

    p.style.setProperty("--w", s.w + "px");
    p.style.setProperty("--h", s.h + "px");
    p.style.setProperty("--poly", s.poly);

    const spawn = spawnPoint(idx);
    p.style.setProperty("--x", spawn.x + "px");
    p.style.setProperty("--y", spawn.y + "px");
    p.style.setProperty("--r", (s.tr + rand(-120, 120)) + "deg");

    p.addEventListener("pointerdown", onDown);
    piecesEl.appendChild(p);
  });

  window.addEventListener("resize", sizeCanvasToElement);
}

function spawnPoint(i){
  const w = mirrorBoard.clientWidth || 620;
  const h = mirrorBoard.clientHeight || 620;

  const pads = [
    {x: rand(70, w-70), y: rand(70, 120)},          // top
    {x: rand(w-140, w-70), y: rand(120, h-120)},    // right
    {x: rand(70, w-70), y: rand(h-120, h-70)},      // bottom
    {x: rand(70, 140), y: rand(120, h-120)}         // left
  ];
  return pads[i % pads.length];
}

/* ---------------- Drag logic ---------------- */
function onDown(e){
  const el = e.currentTarget;
  if(!el || el.classList.contains("locked")) return;

  el.setPointerCapture(e.pointerId);
  el.style.zIndex = "50";

  const rect = mirrorBoard.getBoundingClientRect();
  const ex = e.clientX - rect.left;
  const ey = e.clientY - rect.top;

  active = {
    el,
    offsetX: ex - parseFloat(el.style.getPropertyValue("--x")),
    offsetY: ey - parseFloat(el.style.getPropertyValue("--y"))
  };

  el.addEventListener("pointermove", onMove);
  el.addEventListener("pointerup", onUp);
  el.addEventListener("pointercancel", onUp);
}

function onMove(e){
  if(!active) return;
  const rect = mirrorBoard.getBoundingClientRect();
  const x = e.clientX - rect.left - active.offsetX;
  const y = e.clientY - rect.top - active.offsetY;

  const pad = 40;
  const nx = clamp(x, pad, rect.width - pad);
  const ny = clamp(y, pad, rect.height - pad);

  active.el.style.setProperty("--x", nx + "px");
  active.el.style.setProperty("--y", ny + "px");
}

function onUp(e){
  if(!active) return;

  const el = active.el;
  el.releasePointerCapture(e.pointerId);

  el.removeEventListener("pointermove", onMove);
  el.removeEventListener("pointerup", onUp);
  el.removeEventListener("pointercancel", onUp);

  const x = parseFloat(el.style.getPropertyValue("--x"));
  const y = parseFloat(el.style.getPropertyValue("--y"));
  const r = parseFloat(el.style.getPropertyValue("--r"));
  const tx = parseFloat(el.dataset.tx);
  const ty = parseFloat(el.dataset.ty);
  const tr = parseFloat(el.dataset.tr);

  const dist = Math.hypot(x - tx, y - ty);
  const rotDiff = angleDiff(r, tr);

  if(dist < SNAP_DIST && rotDiff < ROT_TOL){
    lockShard(el, tx, ty, tr);
  } else {
    el.style.zIndex = "1";
  }

  active = null;
}

function lockShard(el, tx, ty, tr){
  if(el.classList.contains("locked")) return;

  el.classList.add("locked");
  el.style.setProperty("--x", tx + "px");
  el.style.setProperty("--y", ty + "px");
  el.style.setProperty("--r", tr + "deg");
  el.style.zIndex = "10";

  lockedCount++;
  if(lockedCount >= SHARDS.length){
    onPuzzleSolved();
  }
}

/* ---------------- SOLVED SEQUENCE ---------------- */
function onPuzzleSolved(){
  mirrorWrap?.classList.add("solved");
  yellowMask?.classList.add("show");

  // crack veins “pop” moment
  mirrorWrap?.classList.add("cracking");
  setTimeout(() => mirrorWrap?.classList.remove("cracking"), 900);

  setTimeout(() => {
    shatterIntoInvite();
  }, 1050);
}

function shatterIntoInvite(){
  if(!shatterCanvas || !mirrorBoard) return;

  shatterCanvas.classList.add("on");
  runShatterParticles(10000, 1350);

  if(piecesEl) piecesEl.style.opacity = "0";
  if(targetsEl) targetsEl.style.opacity = "0";
  if(yellowMask) yellowMask.style.opacity = "0";

  setTimeout(() => {
    finishGame();
  }, 1450);
}

/* ---------------- SHATTER PARTICLES (CANVAS) ---------------- */
function sizeCanvasToElement(){
  if(!shatterCanvas || !mirrorBoard) return;
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const w = mirrorBoard.clientWidth;
  const h = mirrorBoard.clientHeight;
  shatterCanvas.width = Math.floor(w * dpr);
  shatterCanvas.height = Math.floor(h * dpr);
  shatterCanvas.style.width = w + "px";
  shatterCanvas.style.height = h + "px";
}

function runShatterParticles(count, durationMs){
  const ctx = shatterCanvas.getContext("2d");
  if(!ctx) return;

  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const w = shatterCanvas.width;
  const h = shatterCanvas.height;

  const ox = w * 0.5;
  const oy = h * 0.48;

  const parts = new Array(count);
  for(let i = 0; i < count; i++){
    const a = Math.random() * Math.PI * 2;
    const sp = randFloat(1.2, 4.8) * dpr;
    const bias = Math.random();

    parts[i] = {
      x: ox + randFloat(-12, 12) * dpr,
      y: oy + randFloat(-12, 12) * dpr,
      vx: Math.cos(a) * sp * (0.55 + bias),
      vy: Math.sin(a) * sp * (0.55 + bias),
      rot: Math.random() * Math.PI * 2,
      vr: randFloat(-0.25, 0.25),
      life: randFloat(0.65, 1.0),
      size: randFloat(0.6, 2.0) * dpr
    };
  }

  const t0 = performance.now();

  function frame(t){
    const p = (t - t0) / durationMs;
    ctx.clearRect(0,0,w,h);

    const fade = 1 - Math.min(1, p);
    ctx.globalCompositeOperation = "lighter";

    for(let i = 0; i < parts.length; i++){
      const s = parts[i];

      s.x += s.vx;
      s.y += s.vy + (0.03 * dpr);
      s.rot += s.vr;

      const alpha = fade * s.life;
      ctx.globalAlpha = alpha;

      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.rot);

      ctx.fillStyle = "rgba(245,245,255,0.55)";
      ctx.fillRect(-s.size, -s.size*0.6, s.size*1.8, s.size*1.1);

      ctx.fillStyle = "rgba(255,214,64,0.32)";
      ctx.fillRect(-s.size*0.6, -s.size*0.3, s.size*1.2, s.size*0.7);

      ctx.restore();
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    if(p < 1){
      requestAnimationFrame(frame);
    } else {
      shatterCanvas.classList.remove("on");
      ctx.clearRect(0,0,w,h);
    }
  }

  requestAnimationFrame(frame);
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
function rand(min, max){
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min, max){
  return Math.random() * (max - min) + min;
}

function clamp(value, min, max){
  return Math.min(max, Math.max(min, value));
}

function angleDiff(a, b){
  const na = ((a % 360) + 360) % 360;
  const nb = ((b % 360) + 360) % 360;
  let d = Math.abs(na - nb);
  if(d > 180) d = 360 - d;
  return d;
}
