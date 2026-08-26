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
  COLORS.forEach(c => { piecePositions[c] = [-1, -1, -1, -1]; });

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
    for (let r = rowStart + 2; r <= rowStart + 3; r++) {
      for (let c = colStart + 2; c <= colStart + 3; c++) {
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

  // Shared path cells
  SHARED_PATH.forEach((pos, idx) => {
    const dom = getCellDom(pos[0], pos[1]);
    dom.classList.add("path");
    if (SAFE_INDEXES.includes(idx)) dom.classList.add("safe");
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
    yardBox.className = "cell yardBoxCell";
    yardBox.id = "yardBox-" + color;
    yardBox.style.gridRow = (rowStart + 3) + " / span 2";   // rowStart+2 (0-idx) → line rowStart+3
    yardBox.style.gridColumn = (colStart + 3) + " / span 2"; // colStart+2 (0-idx) → line colStart+3
    yardBox.style.display = "grid";
    yardBox.style.gridTemplateColumns = "1fr 1fr";
    yardBox.style.gridTemplateRows = "1fr 1fr";
    yardBox.style.gap = "6px";
    yardBox.style.padding = "10px";
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
  // पहले सारे pieces हटाएं
  document.querySelectorAll(".piece").forEach(p => p.remove());

  const movable = awaitingMove ? getMovablePieces(players[currentPlayerIndex], diceValue) : [];

  COLORS.forEach(color => {
    for (let i = 0; i < 4; i++) {
      const pos = piecePositions[color][i];
      const piece = document.createElement("div");
      piece.className = "piece " + color;
      piece.textContent = "●";
      piece.dataset.color = color;
      piece.dataset.pieceIndex = i;

      const isMovable = movable.includes(i) && color === players[currentPlayerIndex];
      if (isMovable) piece.classList.add("movable");

      if (pos === -1) {
        // यार्ड में — yardBox के अंदर रखें
        document.getElementById("yardBox-" + color).appendChild(piece);
      } else if (pos === 56) {
        // घर पहुंच गई — center में छोटी सी दिखाएं
        const cell = getCellDom(7, 7);
        piece.style.width = "18%";
        piece.style.height = "18%";
        cell.appendChild(piece);
      } else {
        const [r, c] = LOCAL_PATH[color][pos];
        getCellDom(r, c).appendChild(piece);
      }

      piece.addEventListener("click", () => onPieceClick(color, i));
    }
  });
}

// =========================
// 5. Dice रोल करना
// =========================
document.getElementById("rollDiceBtn").addEventListener("click", () => {
  if (awaitingMove) return; // पहले चाल चलनी ज़रूरी है
  const current = players[currentPlayerIndex];

  diceValue = Math.floor(Math.random() * 6) + 1;
  document.getElementById("diceValueText").textContent = "🎲 " + diceValue;

  const movable = getMovablePieces(current, diceValue);

  if (movable.length === 0) {
    setMessage(`${COLOR_NAMES[current]} के पास कोई चाल नहीं — अगली बारी`);
    handleTurnEnd(diceValue === 6);
    return;
  }

  awaitingMove = true;
  renderBoard();

  if (gameMode === "ai" && current !== "red") {
    // Computer अपने आप चाल चुनेगा (हम सिर्फ़ लाल को असली खिलाड़ी मान रहे हैं)
    setTimeout(() => {
      const chosen = pickAiMove(current, diceValue, movable);
      movePiece(current, chosen);
    }, 700);
  } else {
    setMessage("अब कोई चमकती हुई गोटी दबाएं");
  }
});

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
              captured = true;
            }
          }
        }
      });
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
    setTimeout(() => document.getElementById("rollDiceBtn").click(), 600);
  }
}

function updateStatus() {
  const current = players[currentPlayerIndex];
  document.getElementById("turnText").textContent = "बारी: " + COLOR_NAMES[current];
  document.getElementById("diceValueText").textContent = "";
}

function setMessage(msg) {
  document.getElementById("messageText").textContent = msg;
}

function checkWinner(color) {
  if (piecePositions[color].every(p => p === 56)) {
    setMessage(`🎉🎉 ${COLOR_NAMES[color]} जीत गया! 🎉🎉`);
    document.getElementById("rollDiceBtn").disabled = true;
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
  document.getElementById("rollDiceBtn").disabled = false;
});
