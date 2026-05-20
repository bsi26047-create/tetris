const boardCanvas = document.getElementById("tetris");
const boardContext = boardCanvas.getContext("2d");
const holdCanvas = document.getElementById("hold");
const holdContext = holdCanvas.getContext("2d");
const nextCanvas = document.getElementById("next");
const nextContext = nextCanvas.getContext("2d");

const homeScreen = document.getElementById("homeScreen");
const settingsScreen = document.getElementById("settingsScreen");
const gameScreen = document.getElementById("gameScreen");
const singlePlayButton = document.getElementById("singlePlayButton");
const settingsButton = document.getElementById("settingsButton");
const settingsBackButton = document.getElementById("settingsBackButton");
const bgmToggle = document.getElementById("bgmToggle");
const bgmVolume = document.getElementById("bgmVolume");
const bgmVolumeValue = document.getElementById("bgmVolumeValue");
const scoreElement = document.getElementById("score");
const levelElement = document.getElementById("level");
const linesElement = document.getElementById("lines");
const startButton = document.getElementById("startButton");
const startIcon = document.getElementById("startIcon");
const resetButton = document.getElementById("resetButton");
const overlay = document.getElementById("boardOverlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayButton = document.getElementById("overlayButton");
const bgm = document.getElementById("bgm");

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;
const START_MESSAGE_MS = 900;
const DEFAULT_BGM_VOLUME = 0.36;
const SETTINGS_STORAGE_KEY = "tetrisSettings";
const BASE_DROP_INTERVAL = 1000;
const MIN_DROP_INTERVAL = 90;
const DROP_INTERVAL_STEP = 70;
const SCORE_PER_LEVEL = 1000;
const TYPE_UNLOCKS = [
  { level: 1, types: ["I", "O", "T"] },
  { level: 2, types: ["J", "L"] },
  { level: 3, types: ["S", "Z"] },
  { level: 4, types: ["P", "U"] },
  { level: 5, types: ["V", "W"] },
  { level: 6, types: ["X", "F"] },
];
const LINE_POINTS = [0, 100, 300, 500, 800];

const COLORS = {
  I: "#22d3ee",
  J: "#3b82f6",
  L: "#f97316",
  O: "#facc15",
  S: "#22c55e",
  T: "#a855f7",
  Z: "#ef4444",
  P: "#ec4899",
  U: "#14b8a6",
  X: "#eab308",
  V: "#84cc16",
  W: "#06b6d4",
  F: "#f43f5e",
};

const SHAPES = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
  P: [
    [1, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  U: [
    [1, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
  X: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 1, 0],
  ],
  V: [
    [1, 0, 0],
    [1, 0, 0],
    [1, 1, 1],
  ],
  W: [
    [1, 0, 0],
    [1, 1, 0],
    [0, 1, 1],
  ],
  F: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 1, 0],
  ],
};

const state = {
  arena: createArena(),
  active: null,
  hold: null,
  canHold: true,
  nextQueue: [],
  bag: [],
  score: 0,
  level: 1,
  lines: 0,
  dropCounter: 0,
  dropInterval: BASE_DROP_INTERVAL,
  lastTime: 0,
  status: "home",
  particles: [],
  settings: loadSettings(),
};

let startMessageTimer = null;

function loadSettings() {
  const settings = {
    bgmEnabled: true,
    bgmVolume: DEFAULT_BGM_VOLUME,
  };

  try {
    const savedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!savedSettings) {
      return settings;
    }

    const parsedSettings = JSON.parse(savedSettings);
    if (typeof parsedSettings.bgmEnabled === "boolean") {
      settings.bgmEnabled = parsedSettings.bgmEnabled;
    }

    const savedVolume = Number(parsedSettings.bgmVolume);
    if (Number.isFinite(savedVolume)) {
      settings.bgmVolume = clamp(savedVolume, 0, 1);
    }
  } catch {
    return settings;
  }

  return settings;
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(state.settings));
  } catch {}
}

function updateSettingsControls() {
  const volumePercent = Math.round(state.settings.bgmVolume * 100);
  bgmToggle.checked = state.settings.bgmEnabled;
  bgmVolume.value = volumePercent.toString();
  bgmVolumeValue.textContent = `${volumePercent}%`;
}

function setBgmEnabled(enabled) {
  state.settings.bgmEnabled = enabled;
  saveSettings();
  updateSettingsControls();
  syncBgmWithStatus();
}

function setBgmVolume(percent) {
  state.settings.bgmVolume = clamp(percent / 100, 0, 1);

  if (bgm) {
    bgm.volume = state.settings.bgmVolume;
  }

  saveSettings();
  updateSettingsControls();
  syncBgmWithStatus();
}

function playBgm() {
  if (!bgm || !state.settings.bgmEnabled) {
    pauseBgm();
    return;
  }

  bgm.volume = state.settings.bgmVolume;
  bgm.loop = true;
  const playPromise = bgm.play();
  if (playPromise) {
    playPromise.catch(() => {});
  }
}

function pauseBgm() {
  if (bgm) {
    bgm.pause();
  }
}

function resetBgm() {
  if (!bgm) {
    return;
  }

  bgm.pause();
  bgm.currentTime = 0;
}

function syncBgmWithStatus() {
  if (state.settings.bgmEnabled && (state.status === "playing" || state.status === "starting")) {
    playBgm();
  } else {
    pauseBgm();
  }
}

function createArena() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function cloneMatrix(matrix) {
  return matrix.map(row => row.slice());
}

function shuffle(values) {
  const result = values.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function takeFromBag() {
  if (state.bag.length === 0) {
    state.bag = shuffle(getAvailableTypes());
  }
  return state.bag.pop();
}

function getAvailableTypes(level = state.level) {
  const availableTypes = [];

  TYPE_UNLOCKS.forEach(group => {
    if (level >= group.level) {
      availableTypes.push(...group.types);
    }
  });

  return availableTypes;
}

function fillQueue() {
  while (state.nextQueue.length < 5) {
    state.nextQueue.push(takeFromBag());
  }
}

function createPiece(type) {
  const matrix = cloneMatrix(SHAPES[type]);
  return {
    type,
    matrix,
    pos: {
      x: Math.floor((COLS - matrix[0].length) / 2),
      y: type === "I" ? -1 : 0,
    },
  };
}

function spawnPiece() {
  fillQueue();
  state.active = createPiece(state.nextQueue.shift());
  fillQueue();
  state.canHold = true;

  if (collides(state.active)) {
    state.status = "gameover";
    updateOverlay();
  }

  drawPreviews();
}

function collides(piece, offsetX = 0, offsetY = 0, matrix = piece.matrix) {
  for (let y = 0; y < matrix.length; y++) {
    for (let x = 0; x < matrix[y].length; x++) {
      if (!matrix[y][x]) {
        continue;
      }

      const arenaX = piece.pos.x + x + offsetX;
      const arenaY = piece.pos.y + y + offsetY;

      if (arenaX < 0 || arenaX >= COLS || arenaY >= ROWS) {
        return true;
      }

      if (arenaY >= 0 && state.arena[arenaY][arenaX]) {
        return true;
      }
    }
  }

  return false;
}

function mergePiece() {
  state.active.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      const arenaY = state.active.pos.y + y;
      const arenaX = state.active.pos.x + x;
      if (value && arenaY >= 0) {
        state.arena[arenaY][arenaX] = state.active.type;
      }
    });
  });
}

function movePiece(dir) {
  if (!isPlaying()) {
    return;
  }

  if (!collides(state.active, dir, 0)) {
    state.active.pos.x += dir;
  }
}

function softDrop() {
  dropPiece(true);
}

function gravityDrop() {
  dropPiece(false);
}

function dropPiece(awardSoftDropPoint) {
  if (!isPlaying()) {
    return;
  }

  if (!collides(state.active, 0, 1)) {
    state.active.pos.y++;
    if (awardSoftDropPoint) {
      state.score += 1;
    }
  } else {
    lockPiece();
  }
  state.dropCounter = 0;
  updateScore();
}

function hardDrop() {
  if (!isPlaying()) {
    return;
  }

  let distance = 0;
  while (!collides(state.active, 0, 1)) {
    state.active.pos.y++;
    distance++;
  }
  state.score += distance * 2;
  lockPiece();
  state.dropCounter = 0;
  updateScore();
}

function rotatePiece(dir) {
  if (!isPlaying() || state.active.type === "O") {
    return;
  }

  const rotated = rotateMatrix(state.active.matrix, dir);
  const kicks = [0, 1, -1, 2, -2];

  for (const kick of kicks) {
    if (!collides(state.active, kick, 0, rotated)) {
      state.active.matrix = rotated;
      state.active.pos.x += kick;
      return;
    }
  }
}

function rotateMatrix(matrix, dir) {
  const rotated = matrix[0].map((_, index) => matrix.map(row => row[index]));
  return dir > 0 ? rotated.map(row => row.reverse()) : rotated.reverse();
}

function holdPiece() {
  if (!isPlaying() || !state.canHold) {
    return;
  }

  const currentType = state.active.type;
  if (state.hold) {
    state.active = createPiece(state.hold);
    state.hold = currentType;
  } else {
    state.hold = currentType;
    spawnPiece();
  }

  state.canHold = false;
  if (collides(state.active)) {
    state.status = "gameover";
    updateOverlay();
  }
  drawPreviews();
}

function lockPiece() {
  mergePiece();
  clearLines();
  spawnPiece();
}

function clearLines() {
  let cleared = 0;

  for (let y = ROWS - 1; y >= 0; y--) {
    if (state.arena[y].every(Boolean)) {
      burstLine(y);
      state.arena.splice(y, 1);
      state.arena.unshift(Array(COLS).fill(null));
      cleared++;
      y++;
    }
  }

  if (cleared > 0) {
    state.score += getLineScore(cleared);
    state.lines += cleared;
    updateScore();
  }
}

function getLineScore(cleared) {
  if (cleared < LINE_POINTS.length) {
    return LINE_POINTS[cleared] * state.level;
  }

  const bonusLines = cleared - (LINE_POINTS.length - 1);
  return (LINE_POINTS[LINE_POINTS.length - 1] + bonusLines * 450) * state.level;
}

function burstLine(row) {
  for (let x = 0; x < COLS; x++) {
    const type = state.arena[row][x];
    for (let i = 0; i < 4; i++) {
      state.particles.push({
        x: x * BLOCK + BLOCK / 2,
        y: row * BLOCK + BLOCK / 2,
        vx: (Math.random() - 0.5) * 4,
        vy: -Math.random() * 4 - 1,
        life: 420,
        maxLife: 420,
        color: COLORS[type],
        size: Math.random() * 4 + 3,
      });
    }
  }

  if (state.particles.length > 360) {
    state.particles.splice(0, state.particles.length - 360);
  }
}

function getGhostPiece() {
  const ghost = {
    type: state.active.type,
    matrix: state.active.matrix,
    pos: { ...state.active.pos },
  };

  while (!collides(ghost, 0, 1)) {
    ghost.pos.y++;
  }

  return ghost;
}

function drawBoard() {
  boardContext.clearRect(0, 0, boardCanvas.width, boardCanvas.height);
  drawBoardBackground();

  state.arena.forEach((row, y) => {
    row.forEach((type, x) => {
      if (type) {
        drawBlock(boardContext, x * BLOCK, y * BLOCK, BLOCK, type, 1);
      }
    });
  });

  if (state.active) {
    drawPiece(getGhostPiece(), 0.24);
    drawPiece(state.active, 1);
  }

  drawParticles();
}

function drawBoardBackground() {
  boardContext.fillStyle = "#090b0a";
  boardContext.fillRect(0, 0, boardCanvas.width, boardCanvas.height);
  boardContext.strokeStyle = "rgba(255, 255, 255, 0.055)";
  boardContext.lineWidth = 1;

  for (let x = 1; x < COLS; x++) {
    boardContext.beginPath();
    boardContext.moveTo(x * BLOCK, 0);
    boardContext.lineTo(x * BLOCK, boardCanvas.height);
    boardContext.stroke();
  }

  for (let y = 1; y < ROWS; y++) {
    boardContext.beginPath();
    boardContext.moveTo(0, y * BLOCK);
    boardContext.lineTo(boardCanvas.width, y * BLOCK);
    boardContext.stroke();
  }
}

function drawPiece(piece, alpha) {
  piece.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      const boardY = piece.pos.y + y;
      if (value && boardY >= 0) {
        drawBlock(
          boardContext,
          (piece.pos.x + x) * BLOCK,
          boardY * BLOCK,
          BLOCK,
          piece.type,
          alpha
        );
      }
    });
  });
}

function drawBlock(ctx, px, py, size, type, alpha = 1) {
  const color = COLORS[type];
  ctx.save();
  ctx.globalAlpha = alpha;

  const gradient = ctx.createLinearGradient(px, py, px + size, py + size);
  gradient.addColorStop(0, lighten(color, 18));
  gradient.addColorStop(0.58, color);
  gradient.addColorStop(1, darken(color, 22));

  ctx.fillStyle = gradient;
  ctx.fillRect(px + 1, py + 1, size - 2, size - 2);

  ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
  ctx.fillRect(px + 4, py + 4, size - 8, Math.max(3, size * 0.16));

  ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
  ctx.lineWidth = Math.max(1, size * 0.05);
  ctx.strokeRect(px + 1.5, py + 1.5, size - 3, size - 3);
  ctx.restore();
}

function drawParticles() {
  state.particles.forEach(particle => {
    const alpha = Math.max(particle.life / particle.maxLife, 0);
    boardContext.save();
    boardContext.globalAlpha = alpha;
    boardContext.fillStyle = particle.color;
    boardContext.fillRect(
      particle.x - particle.size / 2,
      particle.y - particle.size / 2,
      particle.size,
      particle.size
    );
    boardContext.restore();
  });
}

function updateParticles(deltaTime) {
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const particle = state.particles[i];
    particle.life -= deltaTime;

    if (particle.life <= 0) {
      state.particles.splice(i, 1);
      continue;
    }

    particle.vy += 0.013 * (deltaTime / 16);
    particle.x += particle.vx * (deltaTime / 16);
    particle.y += particle.vy * (deltaTime / 16);
  }
}

function drawPreviews() {
  drawPreviewCanvas(holdContext, holdCanvas, state.hold ? [state.hold] : []);
  drawPreviewCanvas(nextContext, nextCanvas, state.nextQueue.slice(0, 1));
}

function drawPreviewCanvas(ctx, canvas, types) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#101210";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const slotHeight = canvas.height / Math.max(types.length, 1);
  types.forEach((type, index) => {
    drawPreviewPiece(ctx, type, 0, index * slotHeight, canvas.width, slotHeight);
  });
}

function drawPreviewPiece(ctx, type, originX, originY, width, height) {
  const matrix = SHAPES[type];
  const bounds = getMatrixBounds(matrix);
  const cell = Math.min(24, Math.floor(Math.min(width / 5, height / 4)));
  const pieceWidth = (bounds.maxX - bounds.minX + 1) * cell;
  const pieceHeight = (bounds.maxY - bounds.minY + 1) * cell;
  const startX = originX + (width - pieceWidth) / 2;
  const startY = originY + (height - pieceHeight) / 2;

  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value) {
        drawBlock(
          ctx,
          startX + (x - bounds.minX) * cell,
          startY + (y - bounds.minY) * cell,
          cell,
          type,
          1
        );
      }
    });
  });
}

function getMatrixBounds(matrix) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    });
  });

  return { minX, minY, maxX, maxY };
}

function lighten(color, percent) {
  return shade(color, Math.abs(percent));
}

function darken(color, percent) {
  return shade(color, -Math.abs(percent));
}

function shade(color, percent) {
  const value = parseInt(color.slice(1), 16);
  const amount = Math.round(2.55 * percent);
  const r = clamp((value >> 16) + amount, 0, 255);
  const g = clamp(((value >> 8) & 255) + amount, 0, 255);
  const b = clamp((value & 255) + amount, 0, 255);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function updateProgression() {
  const nextLevel = Math.floor(state.score / SCORE_PER_LEVEL) + 1;
  const levelChanged = nextLevel !== state.level;
  state.level = nextLevel;
  state.dropInterval = Math.max(
    MIN_DROP_INTERVAL,
    BASE_DROP_INTERVAL - (state.level - 1) * DROP_INTERVAL_STEP
  );

  if (levelChanged) {
    state.bag = [];
  }
}

function updateScore() {
  updateProgression();
  scoreElement.textContent = state.score.toLocaleString("ja-JP");
  levelElement.textContent = state.level.toString();
  linesElement.textContent = state.lines.toString();
}

function updateOverlay() {
  const isPaused = state.status === "paused";
  const isGameOver = state.status === "gameover";
  const isStarting = state.status === "starting";
  overlay.hidden = !(isPaused || isGameOver || isStarting);

  if (isPaused) {
    overlayTitle.textContent = "PAUSED";
    overlayButton.textContent = "RESUME";
    overlayButton.hidden = false;
  } else if (isGameOver) {
    overlayTitle.textContent = "GAME OVER";
    overlayButton.textContent = "RESTART";
    overlayButton.hidden = false;
  } else if (isStarting) {
    overlayTitle.textContent = "\u30b9\u30bf\u30fc\u30c8";
    overlayButton.hidden = true;
  }

  startIcon.textContent = state.status === "playing" ? "II" : ">";
  syncBgmWithStatus();
}

function isPlaying() {
  return state.status === "playing";
}

function pauseGame() {
  if (state.status === "playing") {
    state.status = "paused";
    updateOverlay();
  }
}

function resumeGame() {
  if (state.status === "paused") {
    state.status = "playing";
    state.dropCounter = 0;
    state.lastTime = performance.now();
    updateOverlay();
  }
}

function togglePause() {
  if (state.status === "playing") {
    pauseGame();
  } else if (state.status === "paused") {
    resumeGame();
  } else if (state.status === "starting") {
    clearStartMessageTimer();
    state.status = "playing";
    state.dropCounter = 0;
    state.lastTime = performance.now();
    updateOverlay();
  } else if (state.status === "home" || state.status === "gameover") {
    newGame();
  }
}

function showHome() {
  homeScreen.hidden = false;
  settingsScreen.hidden = true;
  gameScreen.hidden = true;
  state.status = "home";
  updateOverlay();
}

function showSettings() {
  clearStartMessageTimer();
  homeScreen.hidden = true;
  settingsScreen.hidden = false;
  gameScreen.hidden = true;
  state.status = "settings";
  updateSettingsControls();
  updateOverlay();
}

function showGame() {
  homeScreen.hidden = true;
  settingsScreen.hidden = true;
  gameScreen.hidden = false;
}

function clearStartMessageTimer() {
  if (startMessageTimer !== null) {
    clearTimeout(startMessageTimer);
    startMessageTimer = null;
  }
}

function beginStartMessage() {
  clearStartMessageTimer();
  state.status = "starting";
  state.dropCounter = 0;
  state.lastTime = performance.now();
  updateOverlay();

  startMessageTimer = setTimeout(() => {
    startMessageTimer = null;
    if (state.status !== "starting") {
      return;
    }

    state.status = "playing";
    state.dropCounter = 0;
    state.lastTime = performance.now();
    updateOverlay();
  }, START_MESSAGE_MS);
}

function newGame() {
  clearStartMessageTimer();
  resetBgm();
  showGame();
  state.arena = createArena();
  state.active = null;
  state.hold = null;
  state.canHold = true;
  state.nextQueue = [];
  state.bag = [];
  state.score = 0;
  state.level = 1;
  state.lines = 0;
  state.dropCounter = 0;
  state.dropInterval = BASE_DROP_INTERVAL;
  state.lastTime = performance.now();
  state.status = "starting";
  state.particles = [];
  fillQueue();
  spawnPiece();
  updateScore();
  if (state.status === "gameover") {
    updateOverlay();
    return;
  }

  beginStartMessage();
}

function performAction(action) {
  if (action === "left") {
    movePiece(-1);
  } else if (action === "right") {
    movePiece(1);
  } else if (action === "down") {
    softDrop();
  } else if (action === "rotate") {
    rotatePiece(1);
  } else if (action === "drop") {
    hardDrop();
  } else if (action === "hold") {
    holdPiece();
  }
}

function update(time = 0) {
  const deltaTime = Math.max(0, Math.min(time - state.lastTime, 64));
  state.lastTime = time;

  if (isPlaying()) {
    state.dropCounter += deltaTime;
    if (state.dropCounter >= state.dropInterval) {
      gravityDrop();
    }
  }

  updateParticles(deltaTime);
  drawBoard();
  requestAnimationFrame(update);
}

startButton.addEventListener("click", togglePause);
resetButton.addEventListener("click", newGame);
overlayButton.addEventListener("click", togglePause);
singlePlayButton.addEventListener("click", newGame);
settingsButton.addEventListener("click", showSettings);
settingsBackButton.addEventListener("click", showHome);
bgmToggle.addEventListener("change", () => setBgmEnabled(bgmToggle.checked));
bgmVolume.addEventListener("input", () => setBgmVolume(Number(bgmVolume.value)));

let boardPointer = null;

boardCanvas.addEventListener("pointerdown", event => {
  event.preventDefault();
  boardCanvas.setPointerCapture(event.pointerId);
  boardPointer = {
    x: event.clientX,
    y: event.clientY,
    time: performance.now(),
  };
});

boardCanvas.addEventListener("pointerup", event => {
  if (!boardPointer) {
    return;
  }

  const dx = event.clientX - boardPointer.x;
  const dy = event.clientY - boardPointer.y;
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  const elapsed = performance.now() - boardPointer.time;
  boardPointer = null;

  if (absX < 14 && absY < 14 && elapsed < 320) {
    rotatePiece(1);
    return;
  }

  if (absY > absX && dy > 42) {
    hardDrop();
    return;
  }

  if (absY > absX && dy < -42) {
    holdPiece();
    return;
  }

  if (absX > 24) {
    const direction = dx > 0 ? 1 : -1;
    const steps = clamp(Math.round(absX / 38), 1, 5);
    for (let i = 0; i < steps; i++) {
      movePiece(direction);
    }
  }
});

boardCanvas.addEventListener("pointercancel", () => {
  boardPointer = null;
});

window.addEventListener("keydown", event => {
  const key = event.key.toLowerCase();
  const handledKeys = ["arrowleft", "arrowright", "arrowdown", "arrowup", " ", "z", "x", "c", "shift", "p", "enter"];

  if (state.status === "settings") {
    return;
  }

  if (!handledKeys.includes(key)) {
    return;
  }

  event.preventDefault();

  if (key === "p" || key === "enter") {
    togglePause();
    return;
  }

  if (key === "arrowleft") {
    movePiece(-1);
  } else if (key === "arrowright") {
    movePiece(1);
  } else if (key === "arrowdown") {
    softDrop();
  } else if (key === "arrowup" || key === "x") {
    rotatePiece(1);
  } else if (key === "z") {
    rotatePiece(-1);
  } else if (key === " ") {
    hardDrop();
  } else if (key === "c" || key === "shift") {
    holdPiece();
  }
});

document.querySelectorAll(".touch-controls button").forEach(button => {
  let repeatId = null;
  const action = button.dataset.action;
  const repeatingActions = new Set(["left", "right", "down"]);

  const stopRepeat = () => {
    if (repeatId !== null) {
      clearInterval(repeatId);
      repeatId = null;
    }
  };

  button.addEventListener("pointerdown", event => {
    event.preventDefault();
    stopRepeat();
    performAction(action);

    if (repeatingActions.has(action)) {
      repeatId = setInterval(() => performAction(action), action === "down" ? 72 : 120);
    }
  });

  button.addEventListener("pointerup", stopRepeat);
  button.addEventListener("pointercancel", stopRepeat);
  button.addEventListener("pointerleave", stopRepeat);
});

updateSettingsControls();
showHome();
requestAnimationFrame(update);
