(function () {
  'use strict';
  const E = window.ChessEngine;

  // ---------- Unicode piece glyphs (solid set, colored via CSS) ----------
  const GLYPH = { k: '\u265A', q: '\u265B', r: '\u265C', b: '\u265D', n: '\u265E', p: '\u265F' };

  // ---------- Global state ----------
  let game = E.createGame();
  let mode = 'ai';            // 'ai' | 'local' | 'online'
  let aiDepth = 3;
  let humanColor = 'w';       // color the human plays in AI mode
  let selected = null;        // {r,c}
  let legalForSelected = [];  // legal moves from selected square
  let lastMove = null;        // {from,to}
  let boardFlipped = false;
  let reviewIndex = null;     // index into history when reviewing past position; null = live
  let gameOver = false;
  let soundEnabled = true;
  let aiThinking = false;
  let pendingPromotion = null; // {from,to} awaiting piece choice

  // Online state
  let peer = null, conn = null, isHost = false, myColor = 'w', onlineConnected = false;

  // ---------- DOM refs ----------
  const boardEl = document.getElementById('board');
  const statusBar = document.getElementById('statusBar');
  const historyList = document.getElementById('historyList');
  const thinkingIndicator = document.getElementById('thinkingIndicator');
  const capturedByWhiteEl = document.getElementById('capturedByWhite');
  const capturedByBlackEl = document.getElementById('capturedByBlack');
  const promoModal = document.getElementById('promoModal');
  const promoChoices = document.getElementById('promoChoices');
  const gameOverModal = document.getElementById('gameOverModal');
  const gameOverTitle = document.getElementById('gameOverTitle');
  const gameOverSubtitle = document.getElementById('gameOverSubtitle');
  const returnLiveBtn = document.getElementById('liveBtn');
  const aiOptions = document.getElementById('aiOptions');
  const onlineOptions = document.getElementById('onlineOptions');

  // ---------- Build board squares once ----------
  const squareEls = [];
  function buildBoard() {
    boardEl.innerHTML = '';
    squareEls.length = 0;
    for (let r = 0; r < 8; r++) {
      const row = [];
      for (let c = 0; c < 8; c++) {
        const sqEl = document.createElement('div');
        sqEl.className = 'square ' + (((r + c) % 2 === 0) ? 'light' : 'dark');
        sqEl.dataset.r = r; sqEl.dataset.c = c;
        sqEl.addEventListener('click', () => onSquareClick(r, c));
        boardEl.appendChild(sqEl);
        row.push(sqEl);
      }
      squareEls.push(row);
    }
  }
  buildBoard();

  function displayCoords(r, c) {
    // apply board flip for rendering order
    return boardFlipped ? { r: 7 - r, c: 7 - c } : { r, c };
  }
  function boardPosToDisplayIndex(r, c) {
    const d = displayCoords(r, c);
    return d;
  }

  // ---------- Rendering ----------
  function renderBoard() {
    const boardState = reviewIndex !== null ? reviewBoardAt(reviewIndex) : game.board;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const disp = displayCoords(r, c);
        const el = squareEls[disp.r][disp.c];
        el.innerHTML = '';
        el.classList.remove('selected', 'legal-move', 'legal-capture', 'last-move', 'in-check', 'in-checkmate');
        const piece = boardState[r][c];
        if (piece) {
          const span = document.createElement('span');
          span.className = 'piece ' + (piece.color === 'w' ? 'white-piece' : 'black-piece');
          span.textContent = GLYPH[piece.type];
          el.appendChild(span);
        }
        if (selected && selected.r === r && selected.c === c) el.classList.add('selected');
        if (lastMove && ((lastMove.from.r === r && lastMove.from.c === c) || (lastMove.to.r === r && lastMove.to.c === c))) {
          el.classList.add('last-move');
        }
      }
    }
    // legal move dots
    for (const m of legalForSelected) {
      const disp = displayCoords(m.to.r, m.to.c);
      const el = squareEls[disp.r][disp.c];
      const isCapture = m.capture;
      el.classList.add(isCapture ? 'legal-capture' : 'legal-move');
      const dot = document.createElement('div');
      dot.className = 'move-dot';
      el.appendChild(dot);
    }
    // check highlight
    if (reviewIndex === null) {
      const status = E.getStatus(game);
      if (status.status === 'check' || status.status === 'checkmate') {
        const kingPos = E.findKing(game.board, game.turn);
        if (kingPos) {
          const disp = displayCoords(kingPos.r, kingPos.c);
          squareEls[disp.r][disp.c].classList.add(status.status === 'checkmate' ? 'in-checkmate' : 'in-check');
        }
      }
    }
  }

  function reviewBoardAt(idx) {
    // Replay from scratch up to idx (inclusive) to get a snapshot board without mutating live game.
    const g = E.createGame();
    for (let i = 0; i <= idx; i++) {
      E.applyMove(g, game.history[i].move);
    }
    return g.board;
  }

  function renderHistory() {
    historyList.innerHTML = '';
    for (let i = 0; i < game.history.length; i += 2) {
      const row = document.createElement('div');
      row.className = 'history-row';
      const num = document.createElement('div');
      num.className = 'num';
      num.textContent = (i / 2 + 1) + '.';
      row.appendChild(num);
      const whiteMove = document.createElement('div');
      whiteMove.className = 'history-move';
      whiteMove.textContent = game.history[i] ? game.history[i].san : '';
      whiteMove.addEventListener('click', () => enterReview(i));
      row.appendChild(whiteMove);
      const blackMove = document.createElement('div');
      blackMove.className = 'history-move';
      if (game.history[i + 1]) {
        blackMove.textContent = game.history[i + 1].san;
        blackMove.addEventListener('click', () => enterReview(i + 1));
      }
      row.appendChild(blackMove);
      historyList.appendChild(row);
    }
    historyList.scrollTop = historyList.scrollHeight;
    // mark active review entry
    historyList.querySelectorAll('.history-move').forEach(elm => elm.classList.remove('active-review'));
  }

  function renderCaptured() {
    const byWhite = []; // pieces white has captured (black pieces)
    const byBlack = [];
    for (const h of game.history) {
      if (h.captured) {
        if (h.color === 'w') byWhite.push(h.captured);
        else byBlack.push(h.captured);
      }
    }
    const order = { q: 0, r: 1, b: 2, n: 3, p: 4 };
    byWhite.sort((a, b) => order[a] - order[b]);
    byBlack.sort((a, b) => order[a] - order[b]);
    capturedByWhiteEl.textContent = byWhite.map(t => GLYPH[t]).join('');
    capturedByBlackEl.textContent = byBlack.map(t => GLYPH[t]).join('');
  }

  function renderStatus() {
    if (gameOver) return;
    const status = E.getStatus(game);
    const turnName = game.turn === 'w' ? 'White' : 'Black';
    if (status.status === 'check') statusBar.textContent = turnName + ' to move — Check!';
    else statusBar.textContent = turnName + ' to move';
  }

  function renderAll() {
    renderBoard();
    renderHistory();
    renderCaptured();
    renderStatus();
  }

  // ---------- Review mode ----------
  function enterReview(idx) {
    reviewIndex = idx;
    selected = null; legalForSelected = [];
    lastMove = game.history[idx].move;
    renderBoard();
    document.querySelectorAll('.history-move').forEach(el => el.classList.remove('active-review'));
    const rows = historyList.querySelectorAll('.history-row');
    const rowIdx = Math.floor(idx / 2);
    const cellIdx = idx % 2 === 0 ? 1 : 2;
    if (rows[rowIdx]) rows[rowIdx].children[cellIdx].classList.add('active-review');
    returnLiveBtn.classList.remove('hidden');
    statusBar.textContent = 'Viewing move ' + (idx + 1) + ' (' + game.history[idx].san + ')';
  }
  function exitReview() {
    reviewIndex = null;
    lastMove = game.history.length ? game.history[game.history.length - 1].move : null;
    returnLiveBtn.classList.add('hidden');
    renderAll();
  }
  returnLiveBtn.addEventListener('click', exitReview);

  // ---------- Sound (Web Audio API synth — no external audio files) ----------
  let audioCtx = null;
  function ensureAudio() {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      audioCtx = new Ctx();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }
  function tone(freq, duration, type, gain, delay) {
    if (!soundEnabled) return;
    try {
      const ctx = ensureAudio();
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.value = freq;
      osc.connect(g); g.connect(ctx.destination);
      const t0 = ctx.currentTime + (delay || 0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(gain || 0.12, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
      osc.start(t0);
      osc.stop(t0 + duration + 0.03);
    } catch (e) { /* audio not available */ }
  }
  const Sound = {
    move: () => tone(440, 0.09, 'sine', 0.14),
    capture: () => { tone(220, 0.1, 'square', 0.13); tone(170, 0.12, 'square', 0.09, 0.05); },
    castle: () => { tone(330, 0.08, 'sine', 0.13); tone(415, 0.1, 'sine', 0.11, 0.08); },
    promote: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.14, 'triangle', 0.11, i * 0.07)),
    check: () => tone(880, 0.18, 'sawtooth', 0.13),
    checkmate: () => [660, 554, 440, 330].forEach((f, i) => tone(f, 0.38, 'sawtooth', 0.15, i * 0.19)),
    illegal: () => tone(120, 0.15, 'square', 0.1),
    gameEnd: () => [392, 440, 494, 523].forEach((f, i) => tone(f, 0.22, 'sine', 0.11, i * 0.13))
  };
  document.getElementById('soundToggleBtn').addEventListener('click', function () {
    soundEnabled = !soundEnabled;
    this.textContent = soundEnabled ? '🔊' : '🔇';
    if (soundEnabled) ensureAudio();
  });

  // ---------- AI worker ----------
  let aiWorker = null;
  function getWorker() {
    if (!aiWorker) {
      aiWorker = new Worker('ai-worker.js');
      aiWorker.onmessage = onAiResult;
    }
    return aiWorker;
  }
  let aiRequestId = 0;
  function requestAiMove() {
    if (gameOver) return;
    aiThinking = true;
    thinkingIndicator.classList.remove('hidden');
    const stateForWorker = {
      board: E.cloneBoard(game.board),
      turn: game.turn,
      castling: Object.assign({}, game.castling),
      ep: game.ep ? Object.assign({}, game.ep) : null,
      halfmove: game.halfmove,
      fullmove: game.fullmove
    };
    const myId = ++aiRequestId;
    getWorker().postMessage({ state: stateForWorker, depth: aiDepth, requestId: myId });
  }
  function onAiResult(e) {
    if (e.data.requestId !== aiRequestId) return; // stale response (e.g. after New Game)
    aiThinking = false;
    thinkingIndicator.classList.add('hidden');
    if (gameOver || !e.data.move) return;
    performMove(e.data.move);
  }

  // ---------- Move execution ----------
  function pieceColorAt(r, c) {
    const p = game.board[r][c];
    return p ? p.color : null;
  }

  function isMyTurnToClick() {
    if (gameOver || reviewIndex !== null) return false;
    if (mode === 'ai') return game.turn === humanColor && !aiThinking;
    if (mode === 'online') return onlineConnected && game.turn === myColor;
    return true; // local hotseat — either side may click
  }

  function onSquareClick(r, c) {
    if (!isMyTurnToClick()) return;
    if (selected) {
      const match = legalForSelected.find(m => m.to.r === r && m.to.c === c);
      if (match) {
        attemptMove(match);
        return;
      }
    }
    const color = pieceColorAt(r, c);
    if (color === game.turn) {
      selected = { r, c };
      legalForSelected = E.generateLegalMoves(game, game.turn).filter(m => m.from.r === r && m.from.c === c);
      renderBoard();
    } else {
      if (selected) Sound.illegal();
      selected = null; legalForSelected = [];
      renderBoard();
    }
  }

  function attemptMove(move) {
    const piece = game.board[move.from.r][move.from.c];
    const isPromotion = piece.type === 'p' && (move.to.r === 0 || move.to.r === 7) && move.promotion;
    // Legal move list already expands promotions into 4 variants (q/r/b/n) — if multiple exist for same to-square, prompt user.
    const promoOptions = legalForSelected.filter(m => m.to.r === move.to.r && m.to.c === move.to.c && m.promotion);
    if (promoOptions.length > 1) {
      showPromotionModal(promoOptions);
      return;
    }
    performMove(move);
  }

  function showPromotionModal(options) {
    pendingPromotion = options;
    const color = game.turn;
    promoChoices.innerHTML = '';
    ['q', 'r', 'b', 'n'].forEach(type => {
      const opt = options.find(o => o.promotion === type);
      if (!opt) return;
      const btn = document.createElement('button');
      btn.textContent = GLYPH[type];
      btn.style.color = color === 'w' ? '#f7f5ef' : '#1b1b1b';
      btn.addEventListener('click', () => {
        promoModal.classList.add('hidden');
        performMove(opt);
      });
      promoChoices.appendChild(btn);
    });
    promoModal.classList.remove('hidden');
  }

  function performMove(move, opts) {
    const broadcast = !opts || opts.broadcast !== false;
    selected = null; legalForSelected = [];
    const piece = game.board[move.from.r][move.from.c];
    const wasCapture = !!move.capture;
    const wasCastle = !!move.castle;
    const wasPromotion = !!move.promotion;

    E.makeGameMove(game, move);
    lastMove = move;

    const status = E.getStatus(game);

    if (status.status === 'checkmate') {
      Sound.checkmate();
    } else if (status.status === 'check') {
      Sound.check();
    } else if (wasPromotion) {
      Sound.promote();
    } else if (wasCastle) {
      Sound.castle();
    } else if (wasCapture) {
      Sound.capture();
    } else {
      Sound.move();
    }

    renderAll();

    if (broadcast && mode === 'online' && conn && onlineConnected) {
      conn.send({ type: 'move', move });
    }

    handleStatusResult(status);

    if (!gameOver && mode === 'ai' && game.turn !== humanColor && reviewIndex === null) {
      setTimeout(requestAiMove, 350);
    }
  }

  function handleStatusResult(status) {
    if (status.status === 'checkmate') {
      endGame((status.winner === 'w' ? 'White' : 'Black') + ' wins by checkmate!', 'Checkmate');
    } else if (status.status === 'stalemate') {
      endGame('The game is drawn.', 'Stalemate');
    } else if (status.status === 'draw') {
      endGame('The game is drawn — ' + status.reason + '.', 'Draw');
    }
  }

  function endGame(subtitle, title) {
    gameOver = true;
    Sound.gameEnd();
    gameOverTitle.textContent = title;
    gameOverSubtitle.textContent = subtitle;
    gameOverModal.classList.remove('hidden');
    statusBar.textContent = subtitle;
  }
  document.getElementById('gameOverCloseBtn').addEventListener('click', () => {
    gameOverModal.classList.add('hidden');
  });

  // ---------- Controls: mode / level / side ----------
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      mode = btn.dataset.mode;
      aiOptions.classList.toggle('hidden', mode !== 'ai');
      onlineOptions.classList.toggle('hidden', mode !== 'online');
      resetGame();
    });
  });
  document.querySelectorAll('.side-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.side-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      humanColor = btn.dataset.side;
      resetGame();
    });
  });
  document.getElementById('levelSelect').addEventListener('change', e => {
    aiDepth = parseInt(e.target.value, 10);
  });

  document.getElementById('newGameBtn').addEventListener('click', () => {
    if (mode === 'online' && onlineConnected) {
      conn.send({ type: 'new-game' });
    }
    resetGame();
  });

  document.getElementById('flipBtn').addEventListener('click', () => {
    boardFlipped = !boardFlipped;
    renderBoard();
  });

  document.getElementById('resignBtn').addEventListener('click', () => {
    if (gameOver) return;
    if (mode === 'online' && onlineConnected) {
      conn.send({ type: 'resign' });
      endGame((myColor === 'w' ? 'Black' : 'White') + ' wins — you resigned.', 'Resigned');
    } else if (mode === 'ai') {
      endGame((humanColor === 'w' ? 'Black' : 'White') + ' wins by resignation.', 'Resigned');
    } else {
      endGame((game.turn === 'w' ? 'Black' : 'White') + ' wins by resignation.', 'Resigned');
    }
  });

  document.getElementById('undoBtn').addEventListener('click', () => {
    if (mode === 'online') return; // undo not supported in online play
    if (gameOver) return;
    if (game.history.length === 0) return;
    let movesToUndo = 1;
    if (mode === 'ai' && game.history.length >= 2) movesToUndo = 2; // undo human + AI reply
    const keepCount = Math.max(0, game.history.length - movesToUndo);
    const oldMoves = game.history.slice(0, keepCount).map(h => h.move);
    game = E.createGame();
    for (const m of oldMoves) E.makeGameMove(game, m);
    reviewIndex = null;
    selected = null; legalForSelected = [];
    lastMove = game.history.length ? game.history[game.history.length - 1].move : null;
    gameOver = false;
    aiRequestId++; // invalidate any in-flight AI request from before the undo
    aiThinking = false;
    thinkingIndicator.classList.add('hidden');
    gameOverModal.classList.add('hidden');
    renderAll();
  });

  function resetGame() {
    game = E.createGame();
    selected = null; legalForSelected = [];
    lastMove = null;
    reviewIndex = null;
    gameOver = false;
    aiRequestId++; // invalidate any in-flight AI request
    aiThinking = false;
    thinkingIndicator.classList.add('hidden');
    gameOverModal.classList.add('hidden');
    returnLiveBtn.classList.add('hidden');
    boardFlipped = (mode === 'ai' && humanColor === 'b') || (mode === 'online' && myColor === 'b');
    renderAll();
    if (mode === 'ai' && humanColor === 'b') {
      setTimeout(requestAiMove, 400);
    }
  }

  // ---------- Online multiplayer (PeerJS) ----------
  const hostBtn = document.getElementById('hostBtn');
  const joinBtn = document.getElementById('joinBtn');
  const hostInfo = document.getElementById('hostInfo');
  const hostCodeDisplay = document.getElementById('hostCodeDisplay');
  const joinCodeInput = document.getElementById('joinCodeInput');
  const onlineStatus = document.getElementById('onlineStatus');
  const copyCodeBtn = document.getElementById('copyCodeBtn');

  function setupConnection(connection, hostFlag) {
    conn = connection;
    isHost = hostFlag;
    myColor = isHost ? 'w' : 'b';
    conn.on('open', () => {
      onlineConnected = true;
      onlineStatus.textContent = 'Connected! You are playing ' + (myColor === 'w' ? 'White' : 'Black') + '.';
      resetGame();
    });
    conn.on('data', data => {
      if (data.type === 'move') {
        performMove(data.move, { broadcast: false });
      } else if (data.type === 'resign') {
        endGame((myColor === 'w' ? 'White' : 'Black') + ' wins — opponent resigned.', 'Opponent Resigned');
      } else if (data.type === 'new-game') {
        resetGame();
      }
    });
    conn.on('close', () => {
      onlineConnected = false;
      onlineStatus.textContent = 'Opponent disconnected.';
    });
  }

  hostBtn.addEventListener('click', () => {
    peer = new Peer();
    peer.on('open', id => {
      hostCodeDisplay.value = id;
      hostInfo.classList.remove('hidden');
      onlineStatus.textContent = 'Share the code above. Waiting for opponent…';
    });
    peer.on('connection', connection => {
      setupConnection(connection, true);
    });
    peer.on('error', err => {
      onlineStatus.textContent = 'Connection error: ' + err.type;
    });
  });

  copyCodeBtn.addEventListener('click', () => {
    hostCodeDisplay.select();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(hostCodeDisplay.value).catch(() => document.execCommand('copy'));
    } else {
      document.execCommand('copy');
    }
  });

  joinBtn.addEventListener('click', () => {
    const code = joinCodeInput.value.trim();
    if (!code) return;
    peer = new Peer();
    peer.on('open', () => {
      const connection = peer.connect(code);
      onlineStatus.textContent = 'Connecting…';
      connection.on('open', () => setupConnection(connection, false));
      connection.on('error', err => { onlineStatus.textContent = 'Connection error: ' + err; });
    });
    peer.on('error', err => {
      onlineStatus.textContent = 'Connection error: ' + err.type;
    });
  });

  // ---------- Init ----------
  renderAll();
})();
