const startBtn = document.getElementById("startBtn");
const music = document.getElementById("bgMusic");

let musicStarted = false;

/* ---------------- Prevent touch scrolling while locked (mobile)
   BUT allow scrolling inside the wordsearch grid wrap
---------------- */
function preventScroll(e){
  if(!document.body.classList.contains("locked")) return;

  // Allow scroll inside the grid wrap (both directions)
  const allowed = e.target?.closest?.(".ws-grid-wrap");
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
  startWordSearchGame();
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
   PAGE 1 GAME: WORD SEARCH (Random 5 Words Every Load)
   - Drag across letters to select
   - Words can be forwards/backwards, any direction
   - New grid each open (NO guest button)
   - Win: yellow blood drip flood -> invite
   ========================================================= */

const WORD_POOL = [
  "Beauty",
  "XO",
  "Madness",
  "The Weeknd",
  "Illusion",
  "Chaos",
  "Desire",
  "Tempation",   // keeping your spelling
  "Acquainted",
  "Addiction",
  "Secrets"
];

// Grid settings
const GRID_SIZE = 14;

// Directions: 8-way
const DIRS = [
  {dx: 1, dy: 0},   // right
  {dx: -1, dy: 0},  // left
  {dx: 0, dy: 1},   // down
  {dx: 0, dy: -1},  // up
  {dx: 1, dy: 1},   // down-right
  {dx: -1, dy: -1}, // up-left
  {dx: 1, dy: -1},  // up-right
  {dx: -1, dy: 1}   // down-left
];

let wsGridEl, wsListEl, wsStatusEl, bloodOverlayEl;

let grid = [];
let placed = [];            // [{label, word, cells:[idx...], found:false}]
let activeSelection = [];   // indices
let isDragging = false;
let dragStartIdx = null;
let dragDir = null;         // {dx,dy} once direction locked

function cacheWordSearchEls(){
  wsGridEl = document.getElementById("wsGrid");
  wsListEl = document.getElementById("wordList");
  wsStatusEl = document.getElementById("wsStatus");
  bloodOverlayEl = document.getElementById("bloodOverlay");
}

function startWordSearchGame(){
  cacheWordSearchEls();
  if(!wsGridEl || !wsListEl) return;

  // No visible "New Grid" button anymore — puzzle still random per load
  generateNewPuzzle();
}

function generateNewPuzzle(){
  // Reset visuals
  document.body.classList.remove("blood-win");
  bloodOverlayEl?.classList.remove("show");
  if(bloodOverlayEl) bloodOverlayEl.setAttribute("aria-hidden","true");

  // Pick random 5
  const shuffled = [...WORD_POOL].sort(() => Math.random() - 0.5);
  const chosen = shuffled.slice(0, 5);

  // Build placement objects (sanitize words for grid)
  placed = chosen.map(label => {
    const word = sanitizeWord(label);
    return { label, word, cells: [], found: false };
  });

  // Create empty grid
  grid = new Array(GRID_SIZE * GRID_SIZE).fill("");

  // Place words (try multiple attempts)
  for(const item of placed){
    const ok = tryPlaceWord(item.word);
    if(!ok){
      // If a placement fails (rare), regenerate the whole puzzle
      return generateNewPuzzle();
    }
  }

  // Fill remaining with random letters
  for(let i=0; i<grid.length; i++){
    if(!grid[i]){
      grid[i] = randomLetter();
    }
  }

  // Render list + grid
  renderWordList();
  renderGrid();

  // Wire drag selection
  wireGridInteractions();

  setStatus("Drag to select letters");
}

function sanitizeWord(label){
  return label
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
}

function tryPlaceWord(word){
  const maxAttempts = 600;

  for(let attempt=0; attempt<maxAttempts; attempt++){
    const dir = DIRS[Math.floor(Math.random() * DIRS.length)];
    const start = {
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * GRID_SIZE)
    };

    const endX = start.x + dir.dx * (word.length - 1);
    const endY = start.y + dir.dy * (word.length - 1);

    if(endX < 0 || endX >= GRID_SIZE || endY < 0 || endY >= GRID_SIZE) continue;

    let can = true;
    const cells = [];
    for(let i=0; i<word.length; i++){
      const x = start.x + dir.dx * i;
      const y = start.y + dir.dy * i;
      const idx = xyToIdx(x,y);
      const existing = grid[idx];
      const letter = word[i];
      if(existing && existing !== letter){
        can = false;
        break;
      }
      cells.push(idx);
    }
    if(!can) continue;

    for(let i=0; i<word.length; i++){
      grid[cells[i]] = word[i];
    }

    const p = placed.find(p => p.word === word && p.cells.length === 0);
    if(p) p.cells = cells;

    return true;
  }
  return false;
}

function renderWordList(){
  wsListEl.innerHTML = "";
  for(const item of placed){
    const li = document.createElement("li");
    li.className = "ws-word";
    li.dataset.word = item.word;
    li.textContent = item.label;
    wsListEl.appendChild(li);
  }
}

function renderGrid(){
  wsGridEl.innerHTML = "";
  wsGridEl.style.setProperty("--n", GRID_SIZE);

  for(let idx=0; idx<grid.length; idx++){
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "ws-cell";
    cell.dataset.idx = String(idx);
    cell.textContent = grid[idx];
    wsGridEl.appendChild(cell);
  }
}

function wireGridInteractions(){
  wsGridEl.onpointerdown = handlePointerDown;
  wsGridEl.onpointermove = handlePointerMove;
  wsGridEl.onpointerup = handlePointerUp;
  wsGridEl.onpointercancel = handlePointerUp;
  wsGridEl.onlostpointercapture = handlePointerUp;
}

function handlePointerDown(e){
  const btn = e.target.closest(".ws-cell");
  if(!btn) return;

  const idx = Number(btn.dataset.idx);
  if(isLockedCell(idx)) return;

  isDragging = true;
  dragStartIdx = idx;
  dragDir = null;
  activeSelection = [idx];

  // Disable pan while selecting (so dragging selects, not scrolls)
  wsGridEl.classList.add("dragging");

  wsGridEl.setPointerCapture?.(e.pointerId);

  updateSelectionUI();
  setStatus("Selecting...");
  e.preventDefault();
}

function handlePointerMove(e){
  if(!isDragging) return;

  const el = document.elementFromPoint(e.clientX, e.clientY);
  const btn = el?.closest?.(".ws-cell");
  if(!btn) return;

  const idx = Number(btn.dataset.idx);
  if(Number.isNaN(idx)) return;
  if(isLockedCell(idx)) return;

  if(activeSelection.includes(idx)) return;

  const last = activeSelection[activeSelection.length - 1];

  const a = idxToXY(last);
  const b = idxToXY(idx);
  const dx = b.x - a.x;
  const dy = b.y - a.y;

  if(Math.abs(dx) > 1 || Math.abs(dy) > 1) return;
  if(dx === 0 && dy === 0) return;

  if(activeSelection.length === 1){
    dragDir = { dx, dy };
  } else {
    if(!dragDir) return;
    if(dx !== dragDir.dx || dy !== dragDir.dy) return;
  }

  activeSelection.push(idx);
  updateSelectionUI();
  e.preventDefault();
}

function handlePointerUp(e){
  if(!isDragging) return;

  isDragging = false;
  wsGridEl.classList.remove("dragging");

  const letters = activeSelection.map(i => grid[i]).join("");
  const reversed = letters.split("").reverse().join("");

  const match = placed.find(p => !p.found && (p.word === letters || p.word === reversed));
  if(match){
    match.found = true;

    const selectedCells = [...activeSelection];
    markFoundCells(selectedCells);

    const li = wsListEl.querySelector(`li[data-word="${match.word}"]`);
    li?.classList.add("found");

    setStatus(`Found: ${match.label}`);

    if(placed.every(p => p.found)){
      triggerBloodWin();
      return;
    }
  } else {
    setStatus("Nope — try another word");
  }

  activeSelection = [];
  dragStartIdx = null;
  dragDir = null;
  clearSelectionUI();

  e.preventDefault();
}

function markFoundCells(indices){
  for(const idx of indices){
    const cell = wsGridEl.querySelector(`.ws-cell[data-idx="${idx}"]`);
    cell?.classList.add("found");
    cell?.classList.remove("selected");
  }
}

function isLockedCell(idx){
  const cell = wsGridEl.querySelector(`.ws-cell[data-idx="${idx}"]`);
  return cell?.classList.contains("found");
}

function updateSelectionUI(){
  wsGridEl.querySelectorAll(".ws-cell.selected").forEach(c => c.classList.remove("selected"));

  for(const idx of activeSelection){
    const cell = wsGridEl.querySelector(`.ws-cell[data-idx="${idx}"]`);
    if(cell && !cell.classList.contains("found")){
      cell.classList.add("selected");
    }
  }
}

function clearSelectionUI(){
  wsGridEl.querySelectorAll(".ws-cell.selected").forEach(c => c.classList.remove("selected"));
}

function setStatus(text){
  if(wsStatusEl) wsStatusEl.textContent = text;
}

function triggerBloodWin(){
  setStatus("Unlocked…");

  document.body.classList.add("blood-win");
  if(bloodOverlayEl){
    bloodOverlayEl.classList.add("show");
    bloodOverlayEl.setAttribute("aria-hidden","false");
  }

  setTimeout(() => {
    document.body.classList.remove("blood-win");
    bloodOverlayEl?.classList.remove("show");
    if(bloodOverlayEl) bloodOverlayEl.setAttribute("aria-hidden","true");
    finishGame();
  }, 2300);
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
function randomLetter(){
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return alphabet[Math.floor(Math.random() * alphabet.length)];
}

function xyToIdx(x,y){
  return y * GRID_SIZE + x;
}
function idxToXY(idx){
  return { x: idx % GRID_SIZE, y: Math.floor(idx / GRID_SIZE) };
}
