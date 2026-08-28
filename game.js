// =========================================
// हंसी वाला लूडो — Phase 1: असली Game Logic
// (सादी गोटियों से — characters/sound Phase 2-3 में जुड़ेंगे)
// =========================================

const COLORS = ["red", "green", "yellow", "blue"];
const COLOR_NAMES = { red: "लाल", green: "हरा", yellow: "पीला", blue: "नीला" };

// =========================
// 1. Board का Path Data (52 shared cells, 0-indexed 15x15 grid)
// =========================
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

// हर रंग का पूरा "local path" (57 steps: 0-50 shared + 51-56 home stretch)
function buildLocalPath(color) {
  const path = [];
  for (let i = 0; i <= 50; i++) {
    path.push(SHARED_PATH[(START_INDEX[color] + i) % 52]);
  }
  HOME_STRETCH[color].forEach(cell => path.push(cell));
  return path; // length 57, index 56 = finished (home)
}

const LOCAL_PATH = {};
COLORS.forEach(c => { LOCAL_PATH[c] = buildLocalPath(c); });

// यार्ड (शुरुआती घर) के अंदर 4 गोटियों की जगह — coordinates सिर्फ़ display के लिए
const YARD_QUADRANT = {
  red: { rowStart: 0, colStart: 0 },
  green: { rowStart: 0, colStart: 9 },
  yellow: { rowStart: 9, colStart: 9 },
  blue: { rowStart: 9, colStart: 0 },
};

// =========================
// 2. Game State
// =========================
let gameMode = null; // "ai" या "pass4"
let players = [];    // खेल रहे रंगों की list
let currentPlayerIndex = 0;
let diceValue = 0;
let piecePositions = {}; // piecePositions[color][pieceIndex] = -1 (यार्ड में) या 0-56
let pieceMoods = {};     // pieceMoods[color][pieceIndex] = "khushi" | "ladkhadana" | "daudna" | "gussa" | "udaas" | "jeet"
let awaitingMove = false;
let consecutiveSixes = 0;

function initGame(mode) {
  gameMode = mode;
  players = mode === "ai" ? ["red", "green", "yellow", "blue"] : ["red", "green", "yellow", "blue"];
  currentPlayerIndex = 0;
  diceValue = 0;
  awaitingMove = false;
  consecutiveSixes = 0;

  piecePositions = {};
  pieceMoods = {};
  COLORS.forEach(c => {
    piecePositions[c] = [-1, -1, -1, -1];
    pieceMoods[c] = ["khushi", "khushi", "khushi", "khushi"];
  });

  document.getElementById("modeScreen").style.display = "none";
  document.getElementById("gameScreen").style.display = "block";

  buildBoardDom();
  renderBoard();
  updateStatus();
}

// =========================
// 3. Board DOM बनाना (एक बार)
// =========================
function buildBoardDom() {
  const board = document.getElementById("board");
  board.innerHTML = "";

  // हर रंग के यार्ड के बीच वाली 2x2 जगह — यहां अलग से spanning box बनेगा,
  // इसलिए यहां सामान्य 1x1 cell नहीं बनानी
  const yardCenterSkip = new Set();
  COLORS.forEach(color => {
    const { rowStart, colStart } = YARD_QUADRANT[color];
    for (let r = rowStart + 1; r <= rowStart + 4; r++) {
      for (let c = colStart + 1; c <= colStart + 4; c++) {
        yardCenterSkip.add(r + "_" + c);
      }
    }
  });

  // पूरा 15x15 grid बनाएं — हर cell को उसकी सही जगह साफ़-साफ़ बताई गई है
  // (grid-row / grid-column explicitly सेट करना ज़रूरी है, वरना बीच में
  //  कोई spanning box आने पर बाक़ी cells अपनी जगह से खिसक जाती हैं)
  for (let r = 0; r < 15; r++) {
    for (let c = 0; c < 15; c++) {
      if (yardCenterSkip.has(r + "_" + c)) continue;
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.row = r;
      cell.dataset.col = c;
      cell.style.gridRow = (r + 1) + "";
      cell.style.gridColumn = (c + 1) + "";
      board.appendChild(cell);
    }
  }

  // यार्ड क्षेत्र रंगें
  COLORS.forEach(color => {
    const { rowStart, colStart } = YARD_QUADRANT[color];
    for (let r = rowStart; r < rowStart + 6; r++) {
      for (let c = colStart; c < colStart + 6; c++) {
        const dom = getCellDom(r, c);
        if (dom) dom.classList.add("yard-" + color);
      }
    }
  });

  // Shared path cells — safe cells को अब सिर्फ़ internal logic में रखा जाएगा,
  // visually सिर्फ़ हर रंग की अपनी शुरुआती (start) cell को रंगेंगे
  SHARED_PATH.forEach((pos, idx) => {
    const dom = getCellDom(pos[0], pos[1]);
    dom.classList.add("path");
  });
  COLORS.forEach(color => {
    const startPos = SHARED_PATH[START_INDEX[color]];
    getCellDom(startPos[0], startPos[1]).classList.add("start-" + color);
  });
  // बाक़ी safe cells (जो किसी एक रंग की नहीं, सबके लिए साझा हैं) भी दिखाएं
  SAFE_INDEXES.forEach(idx => {
    const pos = SHARED_PATH[idx];
    const dom = getCellDom(pos[0], pos[1]);
    if (!dom.className.includes("start-")) dom.classList.add("safe-neutral");
  });

  // हर रंग का home-stretch रंगें
  COLORS.forEach(color => {
    HOME_STRETCH[color].forEach(pos => {
      getCellDom(pos[0], pos[1]).classList.add("home-" + color);
    });
  });

  // Center (finish) — explicitly grid line 8,8 (0-indexed row7,col7)
  getCellDom(7, 7).classList.add("center");

  // हर यार्ड के बीच 4 गोटियों के लिए एक साफ़ 2x2 spanning box बनाएं
  COLORS.forEach(color => {
    const { rowStart, colStart } = YARD_QUADRANT[color];
    const yardBox = document.createElement("div");
    yardBox.className = "cell yardBoxCell yard-" + color;
    yardBox.id = "yardBox-" + color;
    yardBox.style.gridRow = (rowStart + 2) + " / span 4";
    yardBox.style.gridColumn = (colStart + 2) + " / span 4";
    yardBox.style.display = "grid";
    yardBox.style.gridTemplateColumns = "1fr 1fr";
    yardBox.style.gridTemplateRows = "1fr 1fr";
    yardBox.style.gap = "10%";
    yardBox.style.padding = "16%";
    yardBox.style.borderRadius = "50%";
    board.appendChild(yardBox);
  });
}

function getCellDom(r, c) {
  return document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
}

// =========================
// 4. Board Render (हर चाल के बाद दोबारा)
// =========================
function renderBoard() {
  // पहले सारे pieces और badges हटाएं
  document.querySelectorAll(".piece, .stackBadge").forEach(p => p.remove());
  // पुराने click handlers भी साफ़ करें (ताकि खाली हो चुकी cell पर पुराना click न रह जाए)
  document.querySelectorAll(".cell, .yardBoxCell").forEach(el => { el.onclick = null; });

  const movable = awaitingMove ? getMovablePieces(players[currentPlayerIndex], diceValue) : [];

  // पहले हर गोटी की "target जगह" (DOM element) पता करें, और उसी हिसाब से समूह बनाएं
  const groups = new Map(); // key: DOM element, value: [{color, pieceIndex}]

  COLORS.forEach(color => {
    for (let i = 0; i < 4; i++) {
      const pos = piecePositions[color][i];
      let targetDom;
      if (pos === -1) {
        targetDom = document.getElementById("yardBox-" + color);
      } else if (pos === 56) {
        targetDom = getCellDom(7, 7);
      } else {
        const [r, c] = LOCAL_PATH[color][pos];
        targetDom = getCellDom(r, c);
      }
      if (!groups.has(targetDom)) groups.set(targetDom, []);
      groups.get(targetDom).push({ color, pieceIndex: i });
    }
  });

  groups.forEach((list, targetDom) => {
    const isYard = targetDom.classList.contains("yardBoxCell");
    const isCenter = targetDom.id !== undefined && targetDom === getCellDom(7, 7);

    list.forEach((item, idx) => {
      const { color, pieceIndex } = item;
      const mood = pieceMoods[color][pieceIndex];
      const piece = document.createElement("img");
      piece.src = `${mood}_${color}.png`;
      piece.className = "piece " + color;
      piece.dataset.color = color;
      piece.dataset.pieceIndex = pieceIndex;

      const isMovable = movable.includes(pieceIndex) && color === players[currentPlayerIndex];
      if (isMovable) piece.classList.add("movable");

      if (isYard) {
        // यार्ड में हर गोटी की अपनी तय जगह (2x2 grid) पहले जैसी ही रहेगी
      } else if (isCenter) {
        piece.style.width = "16%";
        piece.style.height = "16%";
        if (list.length > 1) {
          piece.classList.add("stacked");
          const offset = idx * 10;
          piece.style.left = `calc(50% - 8% + ${offset - (list.length - 1) * 5}%)`;
          piece.style.top = "42%";
        }
      } else if (list.length > 1) {
        // एक ही खाने में कई गोटियाँ — एक के ऊपर एक, पर थोड़ा झलकते हुए
        piece.classList.add("stacked");
        const offsetX = idx * 15 - (list.length - 1) * 7.5;
        const offsetY = idx * 15 - (list.length - 1) * 7.5;
        piece.style.left = `calc(50% - 37% + ${offsetX}%)`;
        piece.style.top = `calc(50% - 37% + ${offsetY}%)`;
        piece.style.zIndex = (idx + 1) + "";
      }

      targetDom.appendChild(piece);
      // ध्यान दें: यहां हर piece पर सीधे click listener नहीं लगाया —
      // नीचे एक ही delegated listener पूरे group के लिए लगेगा,
      // ताकि stack में नीचे दबी गोटी भी सही से चल सके
    });

    // पूरे group (चाहे 1 गोटी हो या ज़्यादा) पर एक ही क्लिक listener —
    // जो भी उस group में "चलने लायक़" गोटी मिले, उसे चलाएं
    targetDom.onclick = () => {
      const current = players[currentPlayerIndex];
      const match = list.find(item =>
        item.color === current && movable.includes(item.pieceIndex)
      );
      if (match) onPieceClick(match.color, match.pieceIndex);
    };

    // अगर एक से ज़्यादा गोटी हों (यार्ड और center के अलावा), गिनती का badge दिखाएं
    if (!isYard && !isCenter && list.length > 1) {
      const badge = document.createElement("div");
      badge.className = "stackBadge";
      badge.textContent = "×" + list.length;
      targetDom.appendChild(badge);
    }
  });
}

// =========================
// 5. Dice रोल करना
// =========================
// =========================
// Dice Face — असली dots वाला Dice
// =========================
const DICE_PATTERNS = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function renderDiceFace(value) {
  const face = document.getElementById("diceFace");
  face.innerHTML = "";
  for (let i = 0; i < 9; i++) {
    const dot = document.createElement("div");
    dot.className = "dot";
    if (!DICE_PATTERNS[value].includes(i)) dot.style.visibility = "hidden";
    face.appendChild(dot);
  }
}

// हल्की सी "टक-टक" आवाज़ — बिना किसी बाहरी audio file के, सीधे browser से
function playDiceSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    for (let i = 0; i < 5; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = 300 + Math.random() * 400;
      gain.gain.value = 0.06;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const startAt = ctx.currentTime + i * 0.09;
      osc.start(startAt);
      gain.gain.setValueAtTime(0.06, startAt);
      gain.gain.exponentialRampToValueAtTime(0.001, startAt + 0.08);
      osc.stop(startAt + 0.09);
    }
  } catch (e) { /* आवाज़ न बजे तो भी खेल चलता रहे */ }
}

// =========================
// Dice रोल करना
// =========================
document.getElementById("diceFace").addEventListener("click", () => {
  if (awaitingMove) return; // पहले चाल चलनी ज़रूरी है
  const current = players[currentPlayerIndex];

  const diceFaceEl = document.getElementById("diceFace");
  diceFaceEl.classList.remove("rolling");
  void diceFaceEl.offsetWidth; // animation दोबारा चलाने के लिए reset
  diceFaceEl.classList.add("rolling");
  playDiceSound();

  // थोड़ी देर के लिए random faces दिखाएं (rolling जैसा एहसास), फिर असली नंबर
  let ticks = 0;
  const rollAnim = setInterval(() => {
    renderDiceFace(Math.floor(Math.random() * 6) + 1);
    ticks++;
    if (ticks > 5) {
      clearInterval(rollAnim);
      diceValue = Math.floor(Math.random() * 6) + 1;
      renderDiceFace(diceValue);
      afterDiceRolled(current);
    }
  }, 90);
});

function afterDiceRolled(current) {
  const movable = getMovablePieces(current, diceValue);

  if (movable.length === 0) {
    setMessage(`${COLOR_NAMES[current]} — पासे में ${diceValue} आया, पर कोई चाल नहीं बनी`);
    handleTurnEnd(diceValue === 6);
    return;
  }

  awaitingMove = true;
  renderBoard();

  if (gameMode === "ai" && current !== "red") {
    setTimeout(() => {
      const chosen = pickAiMove(current, diceValue, movable);
      movePiece(current, chosen);
    }, 700);
  } else {
    setMessage(`${COLOR_NAMES[current]} की बारी — ${diceValue} आया, अब कोई चमकती गोटी दबाएं`);
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

// =========================
// 6. गोटी पर क्लिक करके चलाना
// =========================
function onPieceClick(color, pieceIndex) {
  if (!awaitingMove) return;
  if (color !== players[currentPlayerIndex]) return;
  const movable = getMovablePieces(color, diceValue);
  if (!movable.includes(pieceIndex)) return;
  if (gameMode === "ai" && color !== "red") return; // AI वाली गोटी को हाथ से न चलाएं

  movePiece(color, pieceIndex);
}

function movePiece(color, pieceIndex) {
  const oldPos = piecePositions[color][pieceIndex];
  const newPos = oldPos === -1 ? 0 : oldPos + diceValue;
  piecePositions[color][pieceIndex] = newPos;

  // इस चाल के हिसाब से गोटी का mood तय करें
  if (newPos === 56) {
    pieceMoods[color][pieceIndex] = "jeet";
  } else if (oldPos === -1) {
    pieceMoods[color][pieceIndex] = "khushi"; // पहली बार बाहर निकली
  } else if (diceValue === 6) {
    pieceMoods[color][pieceIndex] = "daudna";
  } else {
    pieceMoods[color][pieceIndex] = "ladkhadana";
  }

  let captured = false;
  // Capturing check — सिर्फ़ shared path (0-50) पर, safe cell पर नहीं
  if (newPos >= 0 && newPos <= 50) {
    const [r, c] = LOCAL_PATH[color][newPos];
    const sharedIdx = SHARED_PATH.findIndex(p => p[0] === r && p[1] === c);
    const isSafe = SAFE_INDEXES.includes(sharedIdx);

    if (!isSafe) {
      COLORS.forEach(otherColor => {
        if (otherColor === color) return;
        for (let i = 0; i < 4; i++) {
          const otherPos = piecePositions[otherColor][i];
          if (otherPos >= 0 && otherPos <= 50) {
            const [orr, occ] = LOCAL_PATH[otherColor][otherPos];
            if (orr === r && occ === c) {
              piecePositions[otherColor][i] = -1; // वापस यार्ड में
              pieceMoods[otherColor][i] = "udaas"; // दुखी होकर लौटी
              captured = true;
            }
          }
        }
      });
      if (captured) pieceMoods[color][pieceIndex] = "gussa"; // मारने वाली गोटी का ग़ुस्सा
    }
  }

  awaitingMove = false;
  renderBoard();

  if (newPos === 56) {
    setMessage(`🏆 ${COLOR_NAMES[color]} की एक गोटी घर पहुंच गई!`);
  } else if (captured) {
    setMessage(`💥 ${COLOR_NAMES[color]} ने किसी को मार दिया!`);
  } else {
    setMessage("");
  }

  checkWinner(color);
  handleTurnEnd(diceValue === 6 || captured);
}

// =========================
// 7. बारी बदलना
// =========================
function handleTurnEnd(extraTurn) {
  if (diceValue === 6) {
    consecutiveSixes++;
  } else {
    consecutiveSixes = 0;
  }

  if (extraTurn && consecutiveSixes < 3) {
    updateStatus();
    return; // वही खिलाड़ी फिर से खेलेगा
  }

  consecutiveSixes = 0;
  currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
  updateStatus();

  if (gameMode === "ai" && players[currentPlayerIndex] !== "red") {
    setTimeout(() => document.getElementById("diceFace").click(), 600);
  }
}

function updateStatus() {
  const current = players[currentPlayerIndex];
  const diceFaceEl = document.getElementById("diceFace");
  diceFaceEl.className = "diceFace turn-" + current;
}

function setMessage(msg) {
  document.getElementById("messageText").textContent = msg;
}

function checkWinner(color) {
  if (piecePositions[color].every(p => p === 56)) {
    setMessage(`🎉🎉 ${COLOR_NAMES[color]} जीत गया! 🎉🎉`);
    const diceFaceEl = document.getElementById("diceFace");
    diceFaceEl.style.pointerEvents = "none";
    diceFaceEl.style.opacity = "0.4";
  }
}

// =========================
// 8. Computer (AI) की चाल चुनना — सादा तरीक़ा
// =========================
function pickAiMove(color, dice, movable) {
  // 1. अगर किसी चाल से कोई opponent कट सकता हो, वही चुनें
  for (const idx of movable) {
    const oldPos = piecePositions[color][idx];
    const newPos = oldPos === -1 ? 0 : oldPos + dice;
    if (newPos <= 50) {
      const [r, c] = LOCAL_PATH[color][newPos];
      const willCapture = COLORS.some(other => {
        if (other === color) return false;
        return piecePositions[other].some((p, i) => {
          if (p < 0 || p > 50) return false;
          const [orr, occ] = LOCAL_PATH[other][p];
          return orr === r && occ === c;
        });
      });
      if (willCapture) return idx;
    }
  }
  // 2. यार्ड से नई गोटी निकालना (6 पर)
  const fromYard = movable.find(idx => piecePositions[color][idx] === -1);
  if (fromYard !== undefined) return fromYard;

  // 3. सबसे आगे वाली गोटी को आगे बढ़ाना
  let best = movable[0];
  movable.forEach(idx => {
    if (piecePositions[color][idx] > piecePositions[color][best]) best = idx;
  });
  return best;
}

// =========================
// 9. Start / Restart Buttons
// =========================
document.getElementById("vsAiBtn").addEventListener("click", () => initGame("ai"));
document.getElementById("pass4Btn").addEventListener("click", () => initGame("pass4"));
document.getElementById("restartBtn").addEventListener("click", () => {
  document.getElementById("gameScreen").style.display = "none";
  document.getElementById("modeScreen").style.display = "block";
  const diceFaceEl = document.getElementById("diceFace");
  diceFaceEl.style.pointerEvents = "";
  diceFaceEl.style.opacity = "";
});
