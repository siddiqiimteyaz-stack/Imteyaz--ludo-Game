// =========================================================
// 🎲 IMTEYAZ LUDO — हंसी वाला लूडो (Complete Game Engine)
// =========================================================

const COLORS = ["red", "green", "yellow", "blue"];
const COLOR_NAMES = {
  red: "लाल",
  green: "हरा",
  yellow: "पीला",
  blue: "नीला"
};

// AI Player Names
const AI_NAMES = {
  red: "लाल (आप)",
  green: "AI हरीश (हरा)",
  yellow: "AI योगेश (पीला)",
  blue: "AI बंटी (नीला)"
};

const PASS_NAMES = {
  red: "खिलाड़ी 1 (लाल)",
  green: "खिलाड़ी 2 (हरा)",
  yellow: "खिलाड़ी 3 (पीला)",
  blue: "खिलाड़ी 4 (नीला)"
};

// =========================================================
// 1. Path Data (52 Shared Cells in 15x15 grid)
// =========================================================
const SHARED_PATH = [
  [6,1],[6,2],[6,3],[6,4],[6,5],
  [5,6],[4,6],[3,6],[2,6],[1,6],[0,6],
  [0,7],
  [0,8],[1,8],[2,8],[3,8],[4,8],[5,8],
  [6,9],[6,10],[6,11],[6,12],[6,13],[6,14],
  [7,14],
  [8,14],[8,13],[8,12],[8,11],[8,10],[8,9],
  [9,8],[10,8],[11,8],[12,8],[13,8],[14,8],
  [14,7],
  [14,6],[13,6],[12,6],[11,6],[10,6],[9,6],
  [8,5],[8,4],[8,3],[8,2],[8,1],[8,0],
  [7,0],
  [6,0],
];

const START_INDEX = { red: 0, green: 13, yellow: 26, blue: 39 };
const SAFE_INDEXES = [0, 8, 13, 21, 26, 34, 39, 47];

const HOME_STRETCH = {
  red:    [[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]],
  green:  [[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]],
  yellow: [[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]],
  blue:   [[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]],
};

function buildLocalPath(color) {
  const path = [];
  for (let i = 0; i <= 50; i++) {
    path.push(SHARED_PATH[(START_INDEX[color] + i) % 52]);
  }
  HOME_STRETCH[color].forEach(cell => path.push(cell));
  return path; // length 57 (0-50: shared, 51-56: home stretch)
}

const LOCAL_PATH = {};
COLORS.forEach(c => { LOCAL_PATH[c] = buildLocalPath(c); });

const YARD_QUADRANT = {
  red: { rowStart: 0, colStart: 0 },
  green: { rowStart: 0, colStart: 9 },
  yellow: { rowStart: 9, colStart: 9 },
  blue: { rowStart: 9, colStart: 0 },
};

// =========================================================
// 2. Sound Effects & Ambient Music (Web Audio API)
// =========================================================
let soundOn = localStorage.getItem("ludo_sound_on") !== "false";
let bgmOn = localStorage.getItem("ludo_bgm_on") === "true";
let audioCtx = null;
let bgmInterval = null;

function getAudioCtx() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) audioCtx = new AudioContextClass();
  }
  if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function playTone(freq, startOffset, duration, type, volume) {
  if (!soundOn) return;
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || "sine";
    osc.frequency.value = freq;
    gain.gain.value = volume || 0.1;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const startAt = ctx.currentTime + startOffset;
    osc.start(startAt);
    gain.gain.setValueAtTime(gain.gain.value, startAt);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
    osc.stop(startAt + duration + 0.02);
  } catch (e) {
    // Audio non-blocking
  }
}

function playDiceSound() {
  // Realistic wooden rattle & multi-bounce
  for (let i = 0; i < 6; i++) {
    const freq = 180 + Math.random() * 260;
    playTone(freq, i * 0.07, 0.05, "triangle", 0.12);
  }
}

function playStepSound(stepNum) {
  // Melodic footstep that pitches up slightly
  const baseFreq = 400 + ((stepNum % 8) * 35);
  playTone(baseFreq, 0, 0.06, "sine", 0.08);
}

function playExitSound() {
  // Joyful ascending arpeggio when leaving yard
  [440, 554.37, 659.25, 880].forEach((f, i) => {
    playTone(f, i * 0.06, 0.12, "triangle", 0.12);
  });
}

function playHomeSound() {
  // Grand victory fanfare on entering home
  [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
    playTone(f, i * 0.08, 0.22, "triangle", 0.15);
  });
}

function playCaptureSound() {
  // Comic punch / slap sound
  playTone(150, 0, 0.12, "sawtooth", 0.2);
  playTone(880, 0.04, 0.1, "square", 0.15);
  playTone(440, 0.1, 0.15, "triangle", 0.1);
}

function playCapturedSound() {
  // Comic slide down trombone
  [587.33, 493.88, 440, 349.23, 293.66].forEach((f, i) => {
    playTone(f, i * 0.08, 0.16, "sine", 0.1);
  });
}

function playReactionSound(mood) {
  if (mood === "khushi" || mood === "jeet") {
    [523.25, 659.25, 783.99].forEach((f, i) => playTone(f, i * 0.06, 0.1, "sine", 0.1));
  } else if (mood === "gussa") {
    playTone(220, 0, 0.15, "sawtooth", 0.15);
    playTone(180, 0.1, 0.2, "sawtooth", 0.15);
  } else if (mood === "udaas") {
    playTone(392, 0, 0.12, "sine", 0.1);
    playTone(349.23, 0.1, 0.2, "sine", 0.1);
  } else {
    playTone(440, 0, 0.08, "triangle", 0.1);
    playTone(554.37, 0.08, 0.12, "triangle", 0.1);
  }
}

// Subtle Procedural Background Music
function startBgm() {
  if (bgmInterval) return;
  const notes = [261.63, 329.63, 392.00, 523.25, 392.00, 329.63];
  let step = 0;
  bgmInterval = setInterval(() => {
    if (!bgmOn || !soundOn) return;
    const f = notes[step % notes.length];
    playTone(f, 0, 0.18, "sine", 0.03);
    if (step % 2 === 0) {
      playTone(130.81, 0, 0.1, "triangle", 0.02);
    }
    step++;
  }, 400);
}

function stopBgm() {
  if (bgmInterval) {
    clearInterval(bgmInterval);
    bgmInterval = null;
  }
}

// =========================================================
// 3. Game State
// =========================================================
let gameMode = "ai"; // "ai" या "pass4"
let aiDifficulty = "normal"; // "easy", "normal", "hard"
let players = [];
let currentPlayerIndex = 0;
let diceValue = 0;
let piecePositions = {}; // piecePositions[color][0..3] = -1 (yard) or 0..56 (home=56)
let awaitingMove = false;
let isAnimatingMove = false;
let consecutiveSixes = 0;
let movingPieceKey = null;
let finishedColors = new Set();
let finishOrder = [];
let playerMoods = { red: "khushi", green: "khushi", yellow: "khushi", blue: "khushi" };

const PLAYER_SETS = {
  2: ["red", "yellow"],
  3: ["red", "green", "yellow"],
  4: ["red", "green", "yellow", "blue"],
};

// =========================================================
// 4. Game Initialization
// =========================================================
function initGame(mode, count) {
  gameMode = mode;
  players = PLAYER_SETS[count] || PLAYER_SETS[4];
  currentPlayerIndex = 0;
  diceValue = 0;
  awaitingMove = false;
  isAnimatingMove = false;
  consecutiveSixes = 0;
  finishedColors = new Set();
  finishOrder = [];

  piecePositions = {};
  COLORS.forEach(c => {
    piecePositions[c] = [-1, -1, -1, -1];
    playerMoods[c] = "khushi";
  });

  document.getElementById("modeScreen").style.display = "none";
  document.getElementById("playerCountScreen").style.display = "none";
  document.getElementById("finalScreen").style.display = "none";

  const banner = document.getElementById("championBanner");
  banner.style.display = "none";
  banner.textContent = "";

  document.getElementById("gameScreen").style.display = "flex";

  setupPlayerCards();
  buildBoardDom();
  renderBoard();
  initAllDiceFaces();
  updateStatus();
  renderDiceFace(1, players[currentPlayerIndex]);
  setMessage(`खेल शुरू! ${COLOR_NAMES[players[currentPlayerIndex]]} की बारी है — पासा फेंकें 🎲`);

  if (bgmOn) startBgm();
}

function setupPlayerCards() {
  COLORS.forEach(c => {
    const card = document.getElementById("playerCard-" + c);
    const nameEl = document.getElementById("playerName-" + c);
    if (!card) return;

    if (players.includes(c)) {
      card.style.display = "flex";
      card.classList.remove("inactive");
      nameEl.textContent = (gameMode === "ai") ? AI_NAMES[c] : PASS_NAMES[c];
    } else {
      card.style.display = "none";
      card.classList.add("inactive");
    }
  });
}

function updatePlayerStats() {
  players.forEach(c => {
    const poses = piecePositions[c];
    let inYard = 0;
    let onTrack = 0;
    let atHome = 0;

    poses.forEach(p => {
      if (p === -1) inYard++;
      else if (p === 56) atHome++;
      else onTrack++;
    });

    const yEl = document.getElementById("yardCount-" + c);
    const tEl = document.getElementById("trackCount-" + c);
    const hEl = document.getElementById("homeCount-" + c);
    if (yEl) yEl.textContent = inYard;
    if (tEl) tEl.textContent = onTrack;
    if (hEl) hEl.textContent = atHome;

    // Update Avatar Mood Sprite
    const avatarEl = document.getElementById("avatarSprite-" + c);
    if (avatarEl) {
      const mood = playerMoods[c] || "khushi";
      avatarEl.className = `spriteInner sprite-${c}-${mood}`;
    }
  });
}

// =========================================================
// 5. Board DOM Construction (Authentic 15x15 Ludo)
// =========================================================
function buildBoardDom() {
  const board = document.getElementById("board");
  board.innerHTML = "";

  // Skip the 4x4 inner yard areas & 3x3 center hub (created as special containers)
  const skipCells = new Set();

  COLORS.forEach(color => {
    const { rowStart, colStart } = YARD_QUADRANT[color];
    for (let r = rowStart + 1; r <= rowStart + 4; r++) {
      for (let c = colStart + 1; c <= colStart + 4; c++) {
        skipCells.add(r + "_" + c);
      }
    }
  });

  // Skip center 3x3 hub (rows 6..8, cols 6..8)
  for (let r = 6; r <= 8; r++) {
    for (let c = 6; c <= 8; c++) {
      skipCells.add(r + "_" + c);
    }
  }

  // Create individual 1x1 cells
  for (let r = 0; r < 15; r++) {
    for (let c = 0; c < 15; c++) {
      if (skipCells.has(r + "_" + c)) continue;
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.row = r;
      cell.dataset.col = c;
      cell.style.gridRow = (r + 1) + "";
      cell.style.gridColumn = (c + 1) + "";
      board.appendChild(cell);
    }
  }

  // Color 6x6 Yard backgrounds
  COLORS.forEach(color => {
    const { rowStart, colStart } = YARD_QUADRANT[color];
    for (let r = rowStart; r < rowStart + 6; r++) {
      for (let c = colStart; c < colStart + 6; c++) {
        const dom = getCellDom(r, c);
        if (dom) dom.classList.add("yard-" + color);
      }
    }
  });

  // Color Shared Track
  SHARED_PATH.forEach(pos => {
    const dom = getCellDom(pos[0], pos[1]);
    if (dom) dom.classList.add("path");
  });

  // Start cells with stars
  COLORS.forEach(color => {
    const startPos = SHARED_PATH[START_INDEX[color]];
    const dom = getCellDom(startPos[0], startPos[1]);
    if (dom) dom.classList.add("start-" + color);
  });

  // Neutral Safe cells with stars
  SAFE_INDEXES.forEach(idx => {
    const pos = SHARED_PATH[idx];
    const dom = getCellDom(pos[0], pos[1]);
    if (dom && !dom.className.includes("start-")) {
      dom.classList.add("safe-neutral");
    }
  });

  // Home stretch cells
  COLORS.forEach(color => {
    HOME_STRETCH[color].forEach((pos, idx) => {
      const dom = getCellDom(pos[0], pos[1]);
      if (dom) {
        dom.classList.add("home-" + color);
        // Add directional arrows pointing into home stretch
        if (idx === 0) dom.classList.add("arrow-" + color);
      }
    });
  });

  // Create 4x4 White Yard Boxes with 4 Dedicated Pawn Docks
  COLORS.forEach(color => {
    const { rowStart, colStart } = YARD_QUADRANT[color];
    const yardBox = document.createElement("div");
    yardBox.className = "cell yardBoxCell yard-" + color;
    yardBox.id = "yardBox-" + color;
    yardBox.style.gridRow = (rowStart + 2) + " / span 4";
    yardBox.style.gridColumn = (colStart + 2) + " / span 4";

    // 4 dedicated docks
    for (let i = 0; i < 4; i++) {
      const dock = document.createElement("div");
      dock.className = "yard-dock";
      dock.id = `dock-${color}-${i}`;
      dock.dataset.color = color;
      dock.dataset.pieceIndex = i;
      dock.onclick = () => onYardDockClick(color, i);
      yardBox.appendChild(dock);
    }

    board.appendChild(yardBox);
  });

  // Create Grand Center 3x3 Hub (Triangles & Trophy)
  const centerHub = document.createElement("div");
  centerHub.className = "center-hub";
  centerHub.id = "centerHub";

  ["red", "green", "yellow", "blue"].forEach(color => {
    const triangle = document.createElement("div");
    triangle.className = "center-triangle " + color;
    centerHub.appendChild(triangle);

    // Pod for tokens that finished
    const pod = document.createElement("div");
    pod.className = "home-tokens-pod " + color;
    pod.id = "homePod-" + color;
    centerHub.appendChild(pod);
  });

  // Central Golden Trophy / Star
  const crown = document.createElement("div");
  crown.className = "center-crown";
  crown.innerHTML = "🏆";
  centerHub.appendChild(crown);

  board.appendChild(centerHub);
}

function getCellDom(r, c) {
  return document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
}

// =========================================================
// 6. Board Rendering & Dynamic Tokens
// =========================================================
function renderBoard() {
  // Clear existing placed pieces & badges
  document.querySelectorAll(".board .piece:not(.overlayPiece), .stackBadge").forEach(p => p.remove());

  // Reset docks can-unlock class
  document.querySelectorAll(".yard-dock").forEach(d => d.classList.remove("can-unlock"));

  // Clear cell click handlers
  document.querySelectorAll(".cell:not(.yardBoxCell)").forEach(el => {
    el.onclick = null;
    el.classList.remove("target-highlight");
  });

  const current = players[currentPlayerIndex];
  const movable = awaitingMove ? getMovablePieces(current, diceValue) : [];

  // Group track pieces by cell DOM
  const trackGroups = new Map();

  players.forEach(color => {
    for (let i = 0; i < 4; i++) {
      const pos = piecePositions[color][i];
      const key = `${color}_${i}`;
      if (movingPieceKey === key) continue; // Currently animating via overlay

      if (pos === -1) {
        // In Yard: Place cleanly in designated dock
        const dock = document.getElementById(`dock-${color}-${i}`);
        if (dock) {
          const piece = createPieceElement(color, i, "khushi", true);
          dock.appendChild(piece);

          // Highlight dock if piece can be unlocked
          if (color === current && movable.includes(i)) {
            dock.classList.add("can-unlock");
            piece.classList.add("movable");
          }
        }
      } else if (pos === 56) {
        // In Center Home: Place in color's home pod
        const pod = document.getElementById("homePod-" + color);
        if (pod) {
          const piece = createPieceElement(color, i, "jeet", false);
          piece.classList.add("in-center");
          pod.appendChild(piece);
        }
      } else {
        // On Track / Home Stretch: Group by cell
        const [r, c] = LOCAL_PATH[color][pos];
        const dom = getCellDom(r, c);
        if (dom) {
          if (!trackGroups.has(dom)) trackGroups.set(dom, []);
          trackGroups.get(dom).push({ color, pieceIndex: i });
        }
      }
    }
  });

  // Render Track Pieces with clean stacking
  trackGroups.forEach((list, dom) => {
    list.forEach((item, idx) => {
      const { color, pieceIndex } = item;
      const piece = createPieceElement(color, pieceIndex, "daudna", false);

      const isMovable = color === current && movable.includes(pieceIndex);
      if (isMovable) {
        piece.classList.add("movable");
      }

      if (list.length > 1) {
        piece.classList.add("stacked");
        const offsetX = (idx * 12) - ((list.length - 1) * 6);
        const offsetY = (idx * 12) - ((list.length - 1) * 6);
        piece.style.left = `calc(50% - 37% + ${offsetX}%)`;
        piece.style.top = `calc(50% - 37% + ${offsetY}%)`;
        piece.style.zIndex = (idx + 2) + "";
      }

      dom.appendChild(piece);
    });

    // Delegated click handler on the cell
    dom.onclick = () => {
      const match = list.find(it => it.color === current && movable.includes(it.pieceIndex));
      if (match) onPieceClick(match.color, match.pieceIndex);
    };

    // Target highlight preview on mouseover / touch
    const movableMatch = list.find(it => it.color === current && movable.includes(it.pieceIndex));
    if (movableMatch) {
      dom.onmouseenter = () => highlightTargetPath(current, movableMatch.pieceIndex);
      dom.onmouseleave = clearTargetHighlight;
    }

    // Stack Multiplier Badge (×2, ×3)
    if (list.length > 1) {
      const badge = document.createElement("div");
      badge.className = "stackBadge";
      badge.textContent = "×" + list.length;
      dom.appendChild(badge);
    }
  });

  updatePlayerStats();
}

function createPieceElement(color, pieceIndex, defaultMood, inDock) {
  const piece = document.createElement("div");
  piece.className = `piece ${color}` + (inDock ? " in-dock" : "");
  piece.dataset.color = color;
  piece.dataset.pieceIndex = pieceIndex;

  const inner = document.createElement("div");
  const spriteClass = (defaultMood === "khushi" || defaultMood === "jeet")
    ? `sprite-${color}-${defaultMood}`
    : `sprite-${color}-daudna-front`;

  inner.className = `spriteInner ${spriteClass}`;
  piece.appendChild(inner);
  return piece;
}

function onYardDockClick(color, pieceIndex) {
  if (!awaitingMove || isAnimatingMove) return;
  if (color !== players[currentPlayerIndex]) return;
  const movable = getMovablePieces(color, diceValue);
  if (!movable.includes(pieceIndex)) return;
  if (gameMode === "ai" && color !== "red") return;

  movePiece(color, pieceIndex);
}

// Highlight preview of where piece will land
function highlightTargetPath(color, pieceIndex) {
  clearTargetHighlight();
  const currentPos = piecePositions[color][pieceIndex];
  const targetPos = currentPos === -1 ? 0 : currentPos + diceValue;
  if (targetPos <= 55) {
    const [tr, tc] = LOCAL_PATH[color][targetPos];
    const targetDom = getCellDom(tr, tc);
    if (targetDom) targetDom.classList.add("target-highlight");
  }
}

function clearTargetHighlight() {
  document.querySelectorAll(".cell.target-highlight").forEach(c => c.classList.remove("target-highlight"));
}

// =========================================================
// 7. Dice Rolling & Turn Logic
// =========================================================
const DICE_PATTERNS = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function initAllDiceFaces() {
  COLORS.forEach(c => {
    const face = document.getElementById("diceFace-" + c);
    if (!face) return;
    face.innerHTML = "";
    for (let i = 0; i < 9; i++) {
      const dot = document.createElement("div");
      dot.className = "dot";
      if (!DICE_PATTERNS[1].includes(i)) dot.style.visibility = "hidden";
      face.appendChild(dot);
    }
  });
}

function renderDiceFace(value, targetColor) {
  const current = targetColor || players[currentPlayerIndex];
  const face = document.getElementById("diceFace-" + current);
  if (!face) return;
  face.innerHTML = "";
  for (let i = 0; i < 9; i++) {
    const dot = document.createElement("div");
    dot.className = "dot";
    if (!DICE_PATTERNS[value].includes(i)) dot.style.visibility = "hidden";
    face.appendChild(dot);
  }
}

// Bind Corner 3D Dice Stations for all 4 players
COLORS.forEach(c => {
  const station = document.getElementById("cornerDice-" + c);
  if (station) {
    station.addEventListener("click", () => handleDiceClick(c));
  }
});

function handleDiceClick(clickedColor) {
  if (awaitingMove || isAnimatingMove) return;
  const current = players[currentPlayerIndex];

  // Disallow manual roll during AI turns
  if (gameMode === "ai" && current !== "red") return;

  // In pass & play mode, click matching the current player's corner
  if (gameMode === "pass" && clickedColor !== current) {
    setMessage(`${COLOR_NAMES[current]} की बारी है! ${COLOR_NAMES[current]} के पासे पर टैप करें 🎲`);
    return;
  }

  executeDiceRoll(current);
}

function executeDiceRoll(current) {
  const diceFaceEl = document.getElementById("diceFace-" + current);
  if (diceFaceEl) {
    diceFaceEl.classList.remove("rolling");
    void diceFaceEl.offsetWidth;
    diceFaceEl.classList.add("rolling");
  }

  playDiceSound();
  setMessage(`${COLOR_NAMES[current]} का पासा घूम रहा है... 🎲`);

  let ticks = 0;
  const rollInterval = setInterval(() => {
    renderDiceFace(Math.floor(Math.random() * 6) + 1, current);
    ticks++;
    if (ticks >= 6) {
      clearInterval(rollInterval);
      diceValue = Math.floor(Math.random() * 6) + 1;
      renderDiceFace(diceValue, current);
      if (diceFaceEl) {
        diceFaceEl.classList.remove("rolling");
      }
      afterDiceRolled(current);
    }
  }, 75);
}

function afterDiceRolled(current) {
  // Check for consecutive 6s
  const streakBadge = document.getElementById("sixStreakBadge");
  if (diceValue === 6) {
    consecutiveSixes++;
    if (consecutiveSixes === 2) {
      streakBadge.textContent = "2 छक्के!";
      streakBadge.style.display = "block";
    }
  } else {
    consecutiveSixes = 0;
    streakBadge.style.display = "none";
  }

  // Rule: 3 consecutive sixes cancels turn
  if (consecutiveSixes >= 3) {
    consecutiveSixes = 0;
    streakBadge.style.display = "none";
    showComicReaction(current, "gussa", "3 छक्के रद्द!", "धत् तेरे की! लगातार 3 छक्के आने पर बारी रद्द हो गई 😡", 2000);
    setMessage(`🚫 ${COLOR_NAMES[current]}: लगातार 3 छक्के! बारी रद्द`);
    setTimeout(() => {
      handleTurnEnd(false);
    }, 1500);
    return;
  }

  const movable = getMovablePieces(current, diceValue);

  if (movable.length === 0) {
    // No possible moves
    showComicReaction(current, "ladkhadana", "फंस गए!", `${diceValue} आया, पर कोई गोटी आगे नहीं बढ़ सकती 😅`, 1600);
    setMessage(`${COLOR_NAMES[current]}: ${diceValue} आया, पर कोई चाल संभव नहीं`);
    setTimeout(() => {
      handleTurnEnd(diceValue === 6);
    }, 1000);
    return;
  }

  awaitingMove = true;
  renderBoard();

  if (diceValue === 6) {
    showComicReaction(current, "khushi", "छक्का आया! 🥳", "वाह! गोटी बाहर निकालें या आगे बढ़ाएं!", 1400);
  }

  if (gameMode === "ai" && current !== "red") {
    // AI Turn: Thinking delay
    setMessage(`${COLOR_NAMES[current]} सोच रहा है... 🤔`);
    setTimeout(() => {
      const chosen = pickAiMove(current, diceValue, movable);
      movePiece(current, chosen);
    }, 600);
  } else {
    // Single move assistance: if only 1 move is possible, announce it clearly
    if (movable.length === 1) {
      setMessage(`${COLOR_NAMES[current]}: ${diceValue} आया! चमकती गोटी पर टैप करें`);
    } else {
      setMessage(`${COLOR_NAMES[current]}: ${diceValue} आया! अपनी पसंद की गोटी चुनें`);
    }
  }
}

function getMovablePieces(color, dice) {
  const result = [];
  for (let i = 0; i < 4; i++) {
    const pos = piecePositions[color][i];
    if (pos === -1) {
      if (dice === 6) result.push(i);
    } else if (pos >= 0 && pos < 56) {
      if (pos + dice <= 56) result.push(i);
    }
  }
  return result;
}

// =========================================================
// 8. Piece Movement & Real-time Smooth Animations
// =========================================================
const STEP_DELAY = 220;
const CELL_PCT = 100 / 15;

function computeDirection(fromCell, toCell) {
  if (toCell[1] > fromCell[1]) return "right";
  if (toCell[1] < fromCell[1]) return "left";
  if (toCell[0] < fromCell[0]) return "back";
  if (toCell[0] > fromCell[0]) return "front";
  return "front";
}

function createMovingOverlay(color) {
  const el = document.createElement("div");
  el.className = "piece overlayPiece " + color;
  const inner = document.createElement("div");
  inner.className = "spriteInner";
  el.appendChild(inner);
  document.getElementById("board").appendChild(el);
  return el;
}

function placeOverlayAtCell(el, cell, animate) {
  if (!animate) el.style.transition = "none";
  el.style.left = (cell[1] * CELL_PCT) + "%";
  el.style.top = (cell[0] * CELL_PCT) + "%";
  if (!animate) {
    void el.offsetWidth;
    el.style.transition = "";
  }
}

function setOverlaySprite(el, color, mood, direction, moving) {
  const inner = el.querySelector(".spriteInner");
  inner.className = `spriteInner sprite-${color}-${mood}-${direction}` + (moving ? " is-moving" : "");
}

function onPieceClick(color, pieceIndex) {
  if (!awaitingMove || isAnimatingMove) return;
  if (color !== players[currentPlayerIndex]) return;
  const movable = getMovablePieces(color, diceValue);
  if (!movable.includes(pieceIndex)) return;
  if (gameMode === "ai" && color !== "red") return;

  clearTargetHighlight();
  movePiece(color, pieceIndex);
}

function movePiece(color, pieceIndex) {
  if (isAnimatingMove) return;
  const oldPos = piecePositions[color][pieceIndex];
  const newPos = oldPos === -1 ? 0 : oldPos + diceValue;

  awaitingMove = false;
  isAnimatingMove = true;
  movingPieceKey = `${color}_${pieceIndex}`;
  renderBoard();

  const overlay = createMovingOverlay(color);

  if (oldPos === -1) {
    // Unlocking from yard: jump onto starting cell with joy!
    placeOverlayAtCell(overlay, LOCAL_PATH[color][0], false);
    setOverlaySprite(overlay, color, "khushi", "front", true);
    playExitSound();
    showComicReaction(color, "khushi", "गोटी बाहर! 🚀", "मैदान में आ गए, अब देखो कमाल!", 1200);

    setTimeout(() => {
      finishMovement(color, pieceIndex, oldPos, newPos, overlay);
    }, 500);
    return;
  }

  // Smooth step-by-step path traversing
  const posList = [];
  for (let p = oldPos; p <= Math.min(newPos, 55); p++) {
    posList.push(p);
  }

  placeOverlayAtCell(overlay, LOCAL_PATH[color][oldPos], false);

  let idx = 1;
  function stepNext() {
    if (idx < posList.length) {
      const fromCell = LOCAL_PATH[color][posList[idx - 1]];
      const toCell = LOCAL_PATH[color][posList[idx]];
      const dir = computeDirection(fromCell, toCell);
      setOverlaySprite(overlay, color, "daudna", dir, true);
      placeOverlayAtCell(overlay, toCell, true);
      playStepSound(idx);
      idx++;
      setTimeout(stepNext, STEP_DELAY);
    } else if (newPos === 56) {
      // Final hop into Center Home!
      setOverlaySprite(overlay, color, "jeet", "front", true);
      placeOverlayAtCell(overlay, [7, 7], true);
      playHomeSound();
      showComicReaction(color, "jeet", "घर पहुँच गए! 🏆", "शानदार! एक और गोटी मंज़िल पर!", 1800);
      triggerConfetti();
      setTimeout(() => {
        finishMovement(color, pieceIndex, oldPos, newPos, overlay);
      }, 600);
    } else {
      finishMovement(color, pieceIndex, oldPos, newPos, overlay);
    }
  }

  setTimeout(stepNext, 30);
}

function finishMovement(color, pieceIndex, oldPos, newPos, overlay) {
  piecePositions[color][pieceIndex] = newPos;
  overlay.remove();
  movingPieceKey = null;

  let captured = false;
  let victimColor = null;

  // Check for Captures on Shared Track (0..50)
  if (newPos >= 0 && newPos <= 50) {
    const [r, c] = LOCAL_PATH[color][newPos];
    const sharedIdx = SHARED_PATH.findIndex(p => p[0] === r && p[1] === c);
    const isSafe = SAFE_INDEXES.includes(sharedIdx);

    if (!isSafe) {
      COLORS.forEach(other => {
        if (other === color) return;
        for (let i = 0; i < 4; i++) {
          const otherPos = piecePositions[other][i];
          if (otherPos >= 0 && otherPos <= 50) {
            const [orr, occ] = LOCAL_PATH[other][otherPos];
            if (orr === r && occ === c) {
              piecePositions[other][i] = -1; // Send back to yard
              captured = true;
              victimColor = other;
            }
          }
        }
      });
    }
  }

  isAnimatingMove = false;
  renderBoard();

  if (captured && victimColor) {
    playCaptureSound();
    setTimeout(playCapturedSound, 250);
    playerMoods[color] = "jeet";
    playerMoods[victimColor] = "udaas";
    showComicReaction(color, "jeet", "गोटी कट गई! 💥", `${COLOR_NAMES[color]} ने ${COLOR_NAMES[victimColor]} को यार्ड भेज दिया! 😂`, 2000);
    setMessage(`💥 ${COLOR_NAMES[color]} ने ${COLOR_NAMES[victimColor]} की गोटी काटी! अतिरिक्त चाल मिली!`);
  }

  checkWinner(color);

  // Extra turn on 6 or capture!
  const hasExtraTurn = (diceValue === 6 || captured);
  handleTurnEnd(hasExtraTurn);
}

// =========================================================
// 9. Turn Transition & Round Management
// =========================================================
function handleTurnEnd(extraTurn) {
  const current = players[currentPlayerIndex];
  const currentFinished = finishedColors.has(current);

  if (extraTurn && !currentFinished) {
    setMessage(`🎉 ${COLOR_NAMES[current]} को मिली एक और बारी! पासा फेंकें`);
    updateStatus();

    if (gameMode === "ai" && current !== "red") {
      setTimeout(() => executeDiceRoll(current), 700);
    }
    return;
  }

  // Switch to next active player
  consecutiveSixes = 0;
  document.getElementById("sixStreakBadge").style.display = "none";

  do {
    currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
  } while (finishedColors.has(players[currentPlayerIndex]));

  updateStatus();

  const nextPlayer = players[currentPlayerIndex];
  setMessage(`${COLOR_NAMES[nextPlayer]} की बारी है — पासा फेंकें 🎲`);

  if (gameMode === "ai" && nextPlayer !== "red") {
    setTimeout(() => executeDiceRoll(nextPlayer), 700);
  }
}

function updateStatus() {
  const current = players[currentPlayerIndex];

  const tag = document.getElementById("turnPlayerTag");
  if (tag) {
    tag.className = "turn-player-tag " + current;
    tag.textContent = COLOR_NAMES[current];
  }

  // Active turn glow on player cards and corner stations
  COLORS.forEach(c => {
    const card = document.getElementById("playerCard-" + c);
    if (card) {
      if (c === current) {
        card.classList.add("active-turn");
      } else {
        card.classList.remove("active-turn");
      }
    }
  });
}

function setMessage(msg) {
  const el = document.getElementById("messageText");
  if (el) el.textContent = msg;
}

// =========================================================
// 10. Comic Reactions & Social Taunts ("हंसी वाला लूडो")
// =========================================================
let comicTimeout = null;
function showComicReaction(color, mood, title, subtitle, duration = 1800) {
  playerMoods[color] = mood;
  updatePlayerStats();
  playReactionSound(mood);

  // Show player bubble on their card
  const bubble = document.getElementById("bubble-" + color);
  if (bubble) {
    bubble.textContent = subtitle;
    bubble.style.display = "block";
    setTimeout(() => { bubble.style.display = "none"; }, duration);
  }

  // Show floating comic banner
  const banner = document.getElementById("comicMoodBanner");
  const inner = document.getElementById("comicMoodInner");
  const titleEl = document.getElementById("comicMoodTitle");
  const subEl = document.getElementById("comicMoodSubtitle");

  if (!banner || !inner) return;

  inner.className = `spriteInner sprite-${color}-${mood}`;
  titleEl.textContent = title;
  subEl.textContent = subtitle;

  banner.classList.add("show");
  clearTimeout(comicTimeout);
  comicTimeout = setTimeout(() => {
    banner.classList.remove("show");
  }, duration);
}

// Bottom Taunt Bar buttons
document.querySelectorAll(".reaction-chip").forEach(chip => {
  chip.addEventListener("click", () => {
    const current = players[currentPlayerIndex];
    const mood = chip.dataset.mood;
    const text = chip.dataset.text;
    showComicReaction(current, mood, `${COLOR_NAMES[current]} कहता है:`, text, 2200);
  });
});

// =========================================================
// 11. Winner Detection & Victory Podium
// =========================================================
function checkWinner(color) {
  if (finishedColors.has(color)) return;
  if (!piecePositions[color].every(p => p === 56)) return;

  finishedColors.add(color);
  finishOrder.push(color);

  playerMoods[color] = "jeet";
  triggerConfetti();

  if (finishOrder.length === 1) {
    const banner = document.getElementById("championBanner");
    banner.textContent = `🏆 ${COLOR_NAMES[color]} बना प्रथम चैंपियन! खेल जारी है...`;
    banner.style.display = "block";
    showComicReaction(color, "jeet", "विजेता! 🥇", `बधाई हो! ${COLOR_NAMES[color]} ने बाज़ी मार ली!`, 2500);
  } else {
    showComicReaction(color, "jeet", "स्थान प्राप्त!", `${COLOR_NAMES[color]} ने स्थान #${finishOrder.length} हासिल किया!`, 2200);
  }

  // If only 1 player remains, end match
  if (finishOrder.length >= players.length - 1) {
    setTimeout(endGame, 1200);
  }
}

function endGame() {
  const remaining = players.filter(c => !finishedColors.has(c));
  const fullOrder = [...finishOrder, ...remaining];
  const medals = ["🥇 पहला स्थान", "🥈 दूसरा स्थान", "🥉 तीसरा स्थान", "4️⃣ चौथा स्थान"];

  // Podium Mascots setup
  for (let i = 1; i <= 3; i++) {
    const charBox = document.getElementById(`podiumChar-${i}`);
    if (charBox) {
      const pColor = fullOrder[i - 1];
      if (pColor) {
        charBox.style.display = "block";
        const inner = charBox.querySelector(".spriteInner");
        inner.className = `spriteInner sprite-${pColor}-jeet`;
      } else {
        charBox.style.display = "none";
      }
    }
  }

  const list = document.getElementById("rankingList");
  list.innerHTML = "";

  fullOrder.forEach((color, i) => {
    const row = document.createElement("div");
    row.className = "rankingRow";
    row.innerHTML = `
      <div class="ranking-left">
        <span class="medal">${medals[i] || (i + 1) + "."}</span>
        <span style="color:${color === 'yellow' ? '#fbc02d' : color}; font-weight:800;">${(gameMode === 'ai') ? AI_NAMES[color] : PASS_NAMES[color]}</span>
      </div>
      <div class="stat-chip">🏠 4/4 घर पहुंचे</div>
    `;
    list.appendChild(row);
  });

  document.getElementById("gameScreen").style.display = "none";
  document.getElementById("finalScreen").style.display = "block";
  triggerConfetti(80);
}

// =========================================================
// 12. Smart AI Logic (3 Difficulties)
// =========================================================
function pickAiMove(color, dice, movable) {
  if (aiDifficulty === "easy") {
    // Random move
    return movable[Math.floor(Math.random() * movable.length)];
  }

  let bestIndex = movable[0];
  let bestScore = -9999;

  movable.forEach(idx => {
    const oldPos = piecePositions[color][idx];
    const newPos = oldPos === -1 ? 0 : oldPos + dice;
    let score = 0;

    // 1. Entering Home (+100)
    if (newPos === 56) score += 100;

    // 2. Capturing an opponent (+80)
    if (newPos <= 50) {
      const [r, c] = LOCAL_PATH[color][newPos];
      const sharedIdx = SHARED_PATH.findIndex(p => p[0] === r && p[1] === c);
      const isSafe = SAFE_INDEXES.includes(sharedIdx);

      if (!isSafe) {
        const canCapture = COLORS.some(other => {
          if (other === color) return false;
          return piecePositions[other].some(p => {
            if (p < 0 || p > 50) return false;
            const [orr, occ] = LOCAL_PATH[other][p];
            return orr === r && occ === c;
          });
        });
        if (canCapture) score += 80;
      }
    }

    // 3. Unlocking from yard on 6 (+40)
    if (oldPos === -1 && dice === 6) score += 40;

    // 4. Reaching a safe spot (+35)
    if (newPos <= 50) {
      const [r, c] = LOCAL_PATH[color][newPos];
      const sharedIdx = SHARED_PATH.findIndex(p => p[0] === r && p[1] === c);
      if (SAFE_INDEXES.includes(sharedIdx)) score += 35;
    }

    // 5. Hard AI: Evading opponent behind (+30)
    if (aiDifficulty === "hard" && oldPos >= 0 && oldPos <= 50) {
      const [cr, cc] = LOCAL_PATH[color][oldPos];
      const inDanger = COLORS.some(other => {
        if (other === color) return false;
        return piecePositions[other].some(p => {
          if (p < 0 || p > 50) return false;
          const [orr, occ] = LOCAL_PATH[other][p];
          return (Math.abs(orr - cr) + Math.abs(occ - cc)) <= 6;
        });
      });
      if (inDanger) score += 30;
    }

    // 6. Prefer moving pieces further ahead (+0.5 * pos)
    score += (oldPos >= 0 ? oldPos : 0) * 0.5;

    if (score > bestScore) {
      bestScore = score;
      bestIndex = idx;
    }
  });

  return bestIndex;
}

// =========================================================
// 13. Lightweight Canvas Confetti Engine
// =========================================================
function triggerConfetti(count = 50) {
  const canvas = document.getElementById("confettiCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles = [];
  const colors = ["#e53935", "#2e7d32", "#fbc02d", "#1565c0", "#ffc107", "#ffffff"];

  for (let i = 0; i < count; i++) {
    particles.push({
      x: canvas.width / 2 + (Math.random() * 200 - 100),
      y: canvas.height * 0.4,
      vx: (Math.random() - 0.5) * 12,
      vy: (Math.random() - 0.9) * 14,
      size: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: 1,
      rotation: Math.random() * 360,
      vRot: (Math.random() - 0.5) * 10
    });
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.35; // gravity
      p.alpha -= 0.012;
      p.rotation += p.vRot;

      if (p.alpha > 0) {
        alive = true;
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      }
    });

    if (alive) requestAnimationFrame(draw);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  requestAnimationFrame(draw);
}

// =========================================================
// 14. UI Controls, Modals & Screen Navigation
// =========================================================
let pendingMode = "ai";

document.getElementById("vsAiBtn").addEventListener("click", () => {
  pendingMode = "ai";
  document.getElementById("setupScreenTitle").textContent = "कंप्यूटर के साथ कितने खिलाड़ी?";
  document.getElementById("aiDifficultySection").style.display = "block";
  document.getElementById("modeScreen").style.display = "none";
  document.getElementById("playerCountScreen").style.display = "block";
});

document.getElementById("pass4Btn").addEventListener("click", () => {
  pendingMode = "pass4";
  document.getElementById("setupScreenTitle").textContent = "कितने दोस्त खेलेंगे?";
  document.getElementById("aiDifficultySection").style.display = "none";
  document.getElementById("modeScreen").style.display = "none";
  document.getElementById("playerCountScreen").style.display = "block";
});

document.querySelectorAll(".diff-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".diff-btn").forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
    aiDifficulty = btn.dataset.diff;
  });
});

document.querySelectorAll(".playerCountBtn").forEach(btn => {
  btn.addEventListener("click", () => {
    const count = parseInt(btn.dataset.count, 10);
    initGame(pendingMode, count);
  });
});

document.getElementById("backToModeBtn").addEventListener("click", () => {
  document.getElementById("playerCountScreen").style.display = "none";
  document.getElementById("modeScreen").style.display = "block";
});

function backToHome() {
  document.getElementById("gameScreen").style.display = "none";
  document.getElementById("finalScreen").style.display = "none";
  document.getElementById("modeScreen").style.display = "block";
  stopBgm();
}

document.getElementById("restartBtn").addEventListener("click", backToHome);
document.getElementById("finalRestartBtn").addEventListener("click", backToHome);

// Audio Toggles
const muteBtn = document.getElementById("muteBtn");
muteBtn.addEventListener("click", () => {
  soundOn = !soundOn;
  localStorage.setItem("ludo_sound_on", soundOn);
  muteBtn.textContent = soundOn ? "🔊 आवाज़" : "🔇 म्यूट";
  muteBtn.classList.toggle("active", soundOn);
  if (soundOn) getAudioCtx();
});

const bgmBtn = document.getElementById("bgmBtn");
bgmBtn.addEventListener("click", () => {
  bgmOn = !bgmOn;
  localStorage.setItem("ludo_bgm_on", bgmOn);
  bgmBtn.classList.toggle("active", bgmOn);
  if (bgmOn) {
    getAudioCtx();
    startBgm();
  } else {
    stopBgm();
  }
});

// Rules Modal
const rulesModal = document.getElementById("rulesModal");
document.getElementById("rulesBtn").addEventListener("click", () => {
  rulesModal.classList.add("show");
});
document.getElementById("closeRulesBtn").addEventListener("click", () => {
  rulesModal.classList.remove("show");
});
rulesModal.addEventListener("click", (e) => {
  if (e.target === rulesModal) rulesModal.classList.remove("show");
});

// Window resize adjust for confetti
window.addEventListener("resize", () => {
  const c = document.getElementById("confettiCanvas");
  if (c) {
    c.width = window.innerWidth;
    c.height = window.innerHeight;
  }
});
