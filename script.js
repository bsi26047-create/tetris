const boardCanvas = document.getElementById("tetris");
const boardContext = boardCanvas.getContext("2d");
const holdCanvas = document.getElementById("hold");
const holdContext = holdCanvas.getContext("2d");
const nextCanvas = document.getElementById("next");
const nextContext = nextCanvas.getContext("2d");

const scoreElement = document.getElementById("score");
const levelElement = document.getElementById("level");
const linesElement = document.getElementById("lines");
const startButton = document.getElementById("startButton");
const startIcon = document.getElementById("startIcon");
const resetButton = document.getElementById("resetButton");
const overlay = document.getElementById("boardOverlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayButton = document.getElementById("overlayButton");

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;
const TYPES = ["I", "J", "L", "O", "S", "T", "Z"];
const LINE_POINTS = [0, 100, 300, 500, 800];

const COLORS = {
  I: "#22d3ee",
  J: "#3b82f6",
  L: "#f97316",
  O: "#facc15",
  S: "#22c55e",
  T: "#a855f7",
  Z: "#ef4444",
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
  dropInterval: 1000,
  lastTime: 0,
  status: "playing",
  particles: [],
};

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
    state.bag = shuffle(TYPES);
  }
  return state.bag.pop();
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
    state.score += LINE_POINTS[cleared] * state.level;
    state.lines += cleared;
    state.level = Math.floor(state.lines / 10) + 1;
    state.dropInterval = Math.max(90, 1000 - (state.level - 1) * 70);
    updateScore();
  }
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
  drawPreviewCanvas(nextContext, nextCanvas, state.nextQueue.slice(0, 4));
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

function updateScore() {
  scoreElement.textContent = state.score.toLocaleString("ja-JP");
  levelElement.textContent = state.level.toString();
  linesElement.textContent = state.lines.toString();
}

function updateOverlay() {
  const isPaused = state.status === "paused";
  const isGameOver = state.status === "gameover";
  overlay.hidden = !(isPaused || isGameOver);

  if (isPaused) {
    overlayTitle.textContent = "PAUSED";
    overlayButton.textContent = "RESUME";
  } else if (isGameOver) {
    overlayTitle.textContent = "GAME OVER";
    overlayButton.textContent = "RESTART";
  }

  startIcon.textContent = state.status === "playing" ? "Ⅱ" : "▶";
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
  } else {
    newGame();
  }
}

function newGame() {
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
  state.dropInterval = 1000;
  state.lastTime = performance.now();
  state.status = "playing";
  state.particles = [];
  fillQueue();
  spawnPiece();
  updateScore();
  updateOverlay();
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

window.addEventListener("keydown", event => {
  const key = event.key.toLowerCase();
  const handledKeys = ["arrowleft", "arrowright", "arrowdown", "arrowup", " ", "z", "x", "c", "shift", "p", "enter"];

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

newGame();
requestAnimationFrame(update);
