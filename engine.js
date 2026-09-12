/* engine.js
 * Pure chess rules engine: board representation, legal move generation,
 * make/undo, check/checkmate/stalemate/draw detection, SAN notation,
 * and a static evaluation function used by the AI.
 * No DOM access here — usable from the main thread and from a Web Worker.
 */
(function (global) {
  'use strict';

  const PIECE_VALUES = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

  const PST = {
    p: [
      [0, 0, 0, 0, 0, 0, 0, 0],
      [50, 50, 50, 50, 50, 50, 50, 50],
      [10, 10, 20, 30, 30, 20, 10, 10],
      [5, 5, 10, 25, 25, 10, 5, 5],
      [0, 0, 0, 20, 20, 0, 0, 0],
      [5, -5, -10, 0, 0, -10, -5, 5],
      [5, 10, 10, -20, -20, 10, 10, 5],
      [0, 0, 0, 0, 0, 0, 0, 0]
    ],
    n: [
      [-50, -40, -30, -30, -30, -30, -40, -50],
      [-40, -20, 0, 0, 0, 0, -20, -40],
      [-30, 0, 10, 15, 15, 10, 0, -30],
      [-30, 5, 15, 20, 20, 15, 5, -30],
      [-30, 0, 15, 20, 20, 15, 0, -30],
      [-30, 5, 10, 15, 15, 10, 5, -30],
      [-40, -20, 0, 5, 5, 0, -20, -40],
      [-50, -40, -30, -30, -30, -30, -40, -50]
    ],
    b: [
      [-20, -10, -10, -10, -10, -10, -10, -20],
      [-10, 0, 0, 0, 0, 0, 0, -10],
      [-10, 0, 5, 10, 10, 5, 0, -10],
      [-10, 5, 5, 10, 10, 5, 5, -10],
      [-10, 0, 10, 10, 10, 10, 0, -10],
      [-10, 10, 10, 10, 10, 10, 10, -10],
      [-10, 5, 0, 0, 0, 0, 5, -10],
      [-20, -10, -10, -10, -10, -10, -10, -20]
    ],
    r: [
      [0, 0, 0, 0, 0, 0, 0, 0],
      [5, 10, 10, 10, 10, 10, 10, 5],
      [-5, 0, 0, 0, 0, 0, 0, -5],
      [-5, 0, 0, 0, 0, 0, 0, -5],
      [-5, 0, 0, 0, 0, 0, 0, -5],
      [-5, 0, 0, 0, 0, 0, 0, -5],
      [-5, 0, 0, 0, 0, 0, 0, -5],
      [0, 0, 0, 5, 5, 0, 0, 0]
    ],
    q: [
      [-20, -10, -10, -5, -5, -10, -10, -20],
      [-10, 0, 0, 0, 0, 0, 0, -10],
      [-10, 0, 5, 5, 5, 5, 0, -10],
      [-5, 0, 5, 5, 5, 5, 0, -5],
      [0, 0, 5, 5, 5, 5, 0, -5],
      [-10, 5, 5, 5, 5, 5, 0, -10],
      [-10, 0, 5, 0, 0, 0, 0, -10],
      [-20, -10, -10, -5, -5, -10, -10, -20]
    ],
    k: [
      [-30, -40, -40, -50, -50, -40, -40, -30],
      [-30, -40, -40, -50, -50, -40, -40, -30],
      [-30, -40, -40, -50, -50, -40, -40, -30],
      [-30, -40, -40, -50, -50, -40, -40, -30],
      [-20, -30, -30, -40, -40, -30, -30, -20],
      [-10, -20, -20, -20, -20, -20, -20, -10],
      [20, 20, 0, 0, 0, 0, 20, 20],
      [20, 30, 10, 0, 0, 10, 30, 20]
    ]
  };
  const KING_ENDGAME = [
    [-50, -40, -30, -20, -20, -30, -40, -50],
    [-30, -20, -10, 0, 0, -10, -20, -30],
    [-30, -10, 20, 30, 30, 20, -10, -30],
    [-30, -10, 30, 40, 40, 30, -10, -30],
    [-30, -10, 30, 40, 40, 30, -10, -30],
    [-30, -10, 20, 30, 30, 20, -10, -30],
    [-30, -30, 0, 0, 0, 0, -30, -30],
    [-50, -30, -30, -30, -30, -30, -30, -50]
  ];

  const KNIGHT_DELTAS = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
  const KING_DELTAS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  const BISHOP_DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  const ROOK_DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  function inBounds(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }
  function opposite(c) { return c === 'w' ? 'b' : 'w'; }
  function fileChar(c) { return 'abcdefgh'[c]; }
  function rankChar(r) { return String(8 - r); }
  function sq(r, c) { return fileChar(c) + rankChar(r); }
  function cloneBoard(b) { return b.map(row => row.map(cell => cell ? { type: cell.type, color: cell.color } : null)); }

  function initialBoard() {
    const b = Array.from({ length: 8 }, () => Array(8).fill(null));
    const back = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
    for (let c = 0; c < 8; c++) {
      b[0][c] = { type: back[c], color: 'b' };
      b[1][c] = { type: 'p', color: 'b' };
      b[6][c] = { type: 'p', color: 'w' };
      b[7][c] = { type: back[c], color: 'w' };
    }
    return b;
  }

  function createGame() {
    return {
      board: initialBoard(),
      turn: 'w',
      castling: { wK: true, wQ: true, bK: true, bQ: true },
      ep: null,
      halfmove: 0,
      fullmove: 1,
      history: [],
      positionCounts: {}
    };
  }

  function findKing(board, color) {
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.type === 'k' && p.color === color) return { r, c };
    }
    return null;
  }

  function isSquareAttacked(board, r, c, byColor) {
    for (const dc of [-1, 1]) {
      const rr = r + (byColor === 'w' ? 1 : -1), cc = c + dc;
      if (inBounds(rr, cc)) {
        const p = board[rr][cc];
        if (p && p.color === byColor && p.type === 'p') return true;
      }
    }
    for (const [dr, dc] of KNIGHT_DELTAS) {
      const rr = r + dr, cc = c + dc;
      if (inBounds(rr, cc)) {
        const p = board[rr][cc];
        if (p && p.color === byColor && p.type === 'n') return true;
      }
    }
    for (const [dr, dc] of KING_DELTAS) {
      const rr = r + dr, cc = c + dc;
      if (inBounds(rr, cc)) {
        const p = board[rr][cc];
        if (p && p.color === byColor && p.type === 'k') return true;
      }
    }
    for (const [dr, dc] of BISHOP_DIRS) {
      let rr = r + dr, cc = c + dc;
      while (inBounds(rr, cc)) {
        const p = board[rr][cc];
        if (p) { if (p.color === byColor && (p.type === 'b' || p.type === 'q')) return true; break; }
        rr += dr; cc += dc;
      }
    }
    for (const [dr, dc] of ROOK_DIRS) {
      let rr = r + dr, cc = c + dc;
      while (inBounds(rr, cc)) {
        const p = board[rr][cc];
        if (p) { if (p.color === byColor && (p.type === 'r' || p.type === 'q')) return true; break; }
        rr += dr; cc += dc;
      }
    }
    return false;
  }

  function isInCheck(board, color) {
    const k = findKing(board, color);
    if (!k) return false;
    return isSquareAttacked(board, k.r, k.c, opposite(color));
  }

  function pseudoMovesFor(board, r, c, state) {
    const p = board[r][c];
    if (!p) return [];
    const moves = [];
    const color = p.color;
    const enemy = opposite(color);

    if (p.type === 'p') {
      const dir = color === 'w' ? -1 : 1;
      const startRow = color === 'w' ? 6 : 1;
      const promoRow = color === 'w' ? 0 : 7;
      const r1 = r + dir;
      if (inBounds(r1, c) && !board[r1][c]) {
        if (r1 === promoRow) {
          for (const pr of ['q', 'r', 'b', 'n']) moves.push({ from: { r, c }, to: { r: r1, c }, promotion: pr });
        } else {
          moves.push({ from: { r, c }, to: { r: r1, c } });
          const r2 = r + 2 * dir;
          if (r === startRow && !board[r2][c]) {
            moves.push({ from: { r, c }, to: { r: r2, c }, doublePawn: true });
          }
        }
      }
      for (const dc of [-1, 1]) {
        const rc = r1, cc = c + dc;
        if (!inBounds(rc, cc)) continue;
        const target = board[rc][cc];
        if (target && target.color === enemy) {
          if (rc === promoRow) {
            for (const pr of ['q', 'r', 'b', 'n']) moves.push({ from: { r, c }, to: { r: rc, c: cc }, promotion: pr, capture: true });
          } else {
            moves.push({ from: { r, c }, to: { r: rc, c: cc }, capture: true });
          }
        } else if (state.ep && state.ep.r === rc && state.ep.c === cc) {
          moves.push({ from: { r, c }, to: { r: rc, c: cc }, capture: true, enPassant: true });
        }
      }
      return moves;
    }

    if (p.type === 'n') {
      for (const [dr, dc] of KNIGHT_DELTAS) {
        const rr = r + dr, cc = c + dc;
        if (!inBounds(rr, cc)) continue;
        const t = board[rr][cc];
        if (!t) moves.push({ from: { r, c }, to: { r: rr, c: cc } });
        else if (t.color === enemy) moves.push({ from: { r, c }, to: { r: rr, c: cc }, capture: true });
      }
      return moves;
    }

    if (p.type === 'k') {
      for (const [dr, dc] of KING_DELTAS) {
        const rr = r + dr, cc = c + dc;
        if (!inBounds(rr, cc)) continue;
        const t = board[rr][cc];
        if (!t) moves.push({ from: { r, c }, to: { r: rr, c: cc } });
        else if (t.color === enemy) moves.push({ from: { r, c }, to: { r: rr, c: cc }, capture: true });
      }
      const rights = state.castling;
      const homeRow = color === 'w' ? 7 : 0;
      if (r === homeRow && c === 4 && !isSquareAttacked(board, r, c, enemy)) {
        const kRight = color === 'w' ? rights.wK : rights.bK;
        if (kRight && !board[r][5] && !board[r][6] && board[r][7] && board[r][7].type === 'r' && board[r][7].color === color) {
          if (!isSquareAttacked(board, r, 5, enemy) && !isSquareAttacked(board, r, 6, enemy)) {
            moves.push({ from: { r, c }, to: { r, c: 6 }, castle: 'K' });
          }
        }
        const qRight = color === 'w' ? rights.wQ : rights.bQ;
        if (qRight && !board[r][3] && !board[r][2] && !board[r][1] && board[r][0] && board[r][0].type === 'r' && board[r][0].color === color) {
          if (!isSquareAttacked(board, r, 3, enemy) && !isSquareAttacked(board, r, 2, enemy)) {
            moves.push({ from: { r, c }, to: { r, c: 2 }, castle: 'Q' });
          }
        }
      }
      return moves;
    }

    let dirs = [];
    if (p.type === 'b') dirs = BISHOP_DIRS;
    else if (p.type === 'r') dirs = ROOK_DIRS;
    else if (p.type === 'q') dirs = BISHOP_DIRS.concat(ROOK_DIRS);
    for (const [dr, dc] of dirs) {
      let rr = r + dr, cc = c + dc;
      while (inBounds(rr, cc)) {
        const t = board[rr][cc];
        if (!t) { moves.push({ from: { r, c }, to: { r: rr, c: cc } }); }
        else { if (t.color === enemy) moves.push({ from: { r, c }, to: { r: rr, c: cc }, capture: true }); break; }
        rr += dr; cc += dc;
      }
    }
    return moves;
  }

  function applyMove(state, move) {
    const board = state.board;
    const { from, to } = move;
    const piece = board[from.r][from.c];
    const undo = {
      move,
      movedColor: piece.color,
      captured: board[to.r][to.c],
      prevCastling: Object.assign({}, state.castling),
      prevEp: state.ep,
      prevHalfmove: state.halfmove,
      epCapturedPiece: null,
      epCapturedPos: null,
      rookFrom: null, rookTo: null, rookPiece: null
    };

    if (move.enPassant) {
      const capR = piece.color === 'w' ? to.r + 1 : to.r - 1;
      undo.epCapturedPiece = board[capR][to.c];
      undo.epCapturedPos = { r: capR, c: to.c };
      board[capR][to.c] = null;
    }

    board[to.r][to.c] = move.promotion ? { type: move.promotion, color: piece.color } : piece;
    board[from.r][from.c] = null;

    if (move.castle === 'K') {
      const row = from.r;
      undo.rookFrom = { r: row, c: 7 }; undo.rookTo = { r: row, c: 5 }; undo.rookPiece = board[row][7];
      board[row][5] = board[row][7]; board[row][7] = null;
    } else if (move.castle === 'Q') {
      const row = from.r;
      undo.rookFrom = { r: row, c: 0 }; undo.rookTo = { r: row, c: 3 }; undo.rookPiece = board[row][0];
      board[row][3] = board[row][0]; board[row][0] = null;
    }

    if (piece.type === 'k') {
      if (piece.color === 'w') { state.castling.wK = false; state.castling.wQ = false; }
      else { state.castling.bK = false; state.castling.bQ = false; }
    }
    if (piece.type === 'r') {
      if (from.r === 7 && from.c === 0) state.castling.wQ = false;
      if (from.r === 7 && from.c === 7) state.castling.wK = false;
      if (from.r === 0 && from.c === 0) state.castling.bQ = false;
      if (from.r === 0 && from.c === 7) state.castling.bK = false;
    }
    if (to.r === 7 && to.c === 0) state.castling.wQ = false;
    if (to.r === 7 && to.c === 7) state.castling.wK = false;
    if (to.r === 0 && to.c === 0) state.castling.bQ = false;
    if (to.r === 0 && to.c === 7) state.castling.bK = false;

    if (move.doublePawn) {
      const midR = (from.r + to.r) / 2;
      state.ep = { r: midR, c: from.c };
    } else {
      state.ep = null;
    }

    if (piece.type === 'p' || move.capture) state.halfmove = 0; else state.halfmove++;
    if (piece.color === 'b') state.fullmove++;
    state.turn = opposite(piece.color);

    return undo;
  }

  function undoMove(state, undo) {
    const board = state.board;
    const { move } = undo;
    const { from, to } = move;
    const color = undo.movedColor;

    board[from.r][from.c] = move.promotion ? { type: 'p', color } : board[to.r][to.c];
    board[to.r][to.c] = undo.captured || null;

    if (move.enPassant) {
      board[undo.epCapturedPos.r][undo.epCapturedPos.c] = undo.epCapturedPiece;
    }
    if (move.castle === 'K' || move.castle === 'Q') {
      board[undo.rookFrom.r][undo.rookFrom.c] = undo.rookPiece;
      board[undo.rookTo.r][undo.rookTo.c] = null;
    }

    state.castling = undo.prevCastling;
    state.ep = undo.prevEp;
    state.halfmove = undo.prevHalfmove;
    if (color === 'b') state.fullmove--;
    state.turn = color;
  }

  function generateLegalMoves(state, color) {
    const board = state.board;
    const pseudo = [];
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.color === color) pseudo.push(...pseudoMovesFor(board, r, c, state));
    }
    const legal = [];
    for (const m of pseudo) {
      const undo = applyMove(state, m);
      if (!isInCheck(board, color)) legal.push(m);
      undoMove(state, undo);
    }
    return legal;
  }

  function positionKey(state) {
    let s = state.turn;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      s += p ? p.color + p.type : '-';
    }
    s += (state.castling.wK ? 'K' : '') + (state.castling.wQ ? 'Q' : '') + (state.castling.bK ? 'k' : '') + (state.castling.bQ ? 'q' : '');
    s += state.ep ? state.ep.r + ',' + state.ep.c : '-';
    return s;
  }

  function insufficientMaterial(board) {
    const pieces = [];
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.type !== 'k') pieces.push(Object.assign({ r, c }, p));
    }
    if (pieces.length === 0) return true;
    if (pieces.length === 1 && (pieces[0].type === 'n' || pieces[0].type === 'b')) return true;
    if (pieces.length === 2 && pieces.every(p => p.type === 'b')) {
      const colorOfSq = (r, c) => (r + c) % 2;
      if (colorOfSq(pieces[0].r, pieces[0].c) === colorOfSq(pieces[1].r, pieces[1].c)) return true;
    }
    return false;
  }

  function getStatus(state) {
    const color = state.turn;
    const inCheck = isInCheck(state.board, color);
    const moves = generateLegalMoves(state, color);
    if (moves.length === 0) {
      return inCheck
        ? { status: 'checkmate', winner: opposite(color), legalMoves: [] }
        : { status: 'stalemate', legalMoves: [] };
    }
    if (state.halfmove >= 100) return { status: 'draw', reason: 'Fifty-move rule', legalMoves: moves };
    if (insufficientMaterial(state.board)) return { status: 'draw', reason: 'Insufficient material', legalMoves: moves };
    const key = positionKey(state);
    if ((state.positionCounts[key] || 0) >= 3) return { status: 'draw', reason: 'Threefold repetition', legalMoves: moves };
    return { status: inCheck ? 'check' : 'active', legalMoves: moves };
  }

  function moveToSAN(state, move) {
    const board = state.board;
    const piece = board[move.from.r][move.from.c];
    if (move.castle === 'K') return finishSAN(state, move, 'O-O');
    if (move.castle === 'Q') return finishSAN(state, move, 'O-O-O');
    let s = '';
    const isCapture = !!move.capture;
    if (piece.type === 'p') {
      if (isCapture) s += fileChar(move.from.c) + 'x';
      s += sq(move.to.r, move.to.c);
      if (move.promotion) s += '=' + move.promotion.toUpperCase();
    } else {
      s += piece.type.toUpperCase();
      const others = generateLegalMoves(state, piece.color).filter(m => {
        const op = board[m.from.r][m.from.c];
        return op && op.type === piece.type && m.to.r === move.to.r && m.to.c === move.to.c &&
          !(m.from.r === move.from.r && m.from.c === move.from.c);
      });
      if (others.length) {
        const sameFile = others.some(m => m.from.c === move.from.c);
        const sameRank = others.some(m => m.from.r === move.from.r);
        if (!sameFile) s += fileChar(move.from.c);
        else if (!sameRank) s += rankChar(move.from.r);
        else s += sq(move.from.r, move.from.c);
      }
      if (isCapture) s += 'x';
      s += sq(move.to.r, move.to.c);
    }
    return finishSAN(state, move, s);
  }

  function finishSAN(state, move, s) {
    const undo = applyMove(state, move);
    const opp = state.turn;
    const inCheck = isInCheck(state.board, opp);
    let suffix = '';
    if (inCheck) {
      const moves = generateLegalMoves(state, opp);
      suffix = moves.length === 0 ? '#' : '+';
    }
    undoMove(state, undo);
    return s + suffix;
  }

  function makeGameMove(state, move) {
    const san = moveToSAN(state, move);
    const color = state.board[move.from.r][move.from.c].color;
    const captured = state.board[move.to.r][move.to.c];
    applyMove(state, move);
    const key = positionKey(state);
    state.positionCounts[key] = (state.positionCounts[key] || 0) + 1;
    state.history.push({ san, move, color, captured: captured ? captured.type : (move.enPassant ? 'p' : null) });
    return san;
  }

  function evaluate(board) {
    let score = 0;
    let whiteMaterial = 0, blackMaterial = 0;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p) continue;
      const val = PIECE_VALUES[p.type];
      if (p.color === 'w') whiteMaterial += val; else blackMaterial += val;
    }
    const endgame = (whiteMaterial + blackMaterial) < 2400;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p) continue;
      const val = PIECE_VALUES[p.type];
      const pst = (p.type === 'k' && endgame) ? KING_ENDGAME : PST[p.type];
      const prow = p.color === 'w' ? r : 7 - r;
      const bonus = pst[prow][c];
      score += (p.color === 'w' ? 1 : -1) * (val + bonus);
    }
    return score;
  }

  const ChessEngine = {
    PIECE_VALUES, createGame, initialBoard, generateLegalMoves, applyMove, undoMove,
    makeGameMove, getStatus, evaluate, isInCheck, isSquareAttacked, opposite, sq,
    fileChar, rankChar, cloneBoard, positionKey, insufficientMaterial, findKing, moveToSAN
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = ChessEngine;
  global.ChessEngine = ChessEngine;
})(typeof window !== 'undefined' ? window : self);
