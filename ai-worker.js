/* ai-worker.js
 * Runs chess move search in a Web Worker so the UI never freezes.
 * Uses negamax with alpha-beta pruning, MVV-LVA move ordering, and a
 * quiescence search on captures/promotions to avoid horizon-effect blunders.
 * The move chosen is always the highest-scoring move found — never random.
 */
importScripts('engine.js');
const E = self.ChessEngine;
const MATE_VALUE = 1000000;

function scoreMoveGuess(state, m) {
  let s = 0;
  if (m.capture) {
    const board = state.board;
    const captured = m.enPassant ? { type: 'p' } : board[m.to.r][m.to.c];
    const attacker = board[m.from.r][m.from.c];
    const cVal = captured ? (E.PIECE_VALUES[captured.type] || 0) : 0;
    const aVal = attacker ? (E.PIECE_VALUES[attacker.type] || 0) : 0;
    s += 10 * cVal - aVal;
  }
  if (m.promotion === 'q') s += 900;
  else if (m.promotion) s += 200;
  if (m.castle) s += 60;
  return s;
}

function orderMoves(state, moves) {
  return moves.slice().sort((a, b) => scoreMoveGuess(state, b) - scoreMoveGuess(state, a));
}

let nodeCount = 0;

function quiesce(state, alpha, beta, sign, depthLimit) {
  nodeCount++;
  const standPat = sign * E.evaluate(state.board);
  if (standPat >= beta) return beta;
  if (alpha < standPat) alpha = standPat;
  if (depthLimit <= 0) return alpha;
  const color = state.turn;
  const all = E.generateLegalMoves(state, color);
  if (all.length === 0) {
    return E.isInCheck(state.board, color) ? -MATE_VALUE : 0;
  }
  const tactical = orderMoves(state, all.filter(m => m.capture || m.promotion));
  for (const m of tactical) {
    const undo = E.applyMove(state, m);
    const score = -quiesce(state, -beta, -alpha, -sign, depthLimit - 1);
    E.undoMove(state, undo);
    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }
  return alpha;
}

function negamax(state, depth, alpha, beta, sign, ply) {
  nodeCount++;
  const color = state.turn;
  const moves = E.generateLegalMoves(state, color);
  if (moves.length === 0) {
    if (E.isInCheck(state.board, color)) return -(MATE_VALUE - ply);
    return 0;
  }
  if (depth === 0) return quiesce(state, alpha, beta, sign, 4);

  const ordered = orderMoves(state, moves);
  let best = -Infinity;
  for (const m of ordered) {
    const undo = E.applyMove(state, m);
    const score = -negamax(state, depth - 1, -beta, -alpha, -sign, ply + 1);
    E.undoMove(state, undo);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

function findBestMove(state, depth) {
  nodeCount = 0;
  const color = state.turn;
  const sign = color === 'w' ? 1 : -1;
  const moves = orderMoves(state, E.generateLegalMoves(state, color));
  let bestMove = null;
  let bestScore = -Infinity;
  let alpha = -Infinity;
  const beta = Infinity;
  for (const m of moves) {
    const undo = E.applyMove(state, m);
    const score = -negamax(state, depth - 1, -beta, -alpha, -sign, 1);
    E.undoMove(state, undo);
    if (bestMove === null || score > bestScore) {
      bestScore = score;
      bestMove = m;
    }
    if (score > alpha) alpha = score;
  }
  return { move: bestMove, score: bestScore, nodes: nodeCount };
}

self.onmessage = function (e) {
  const { state, depth, requestId } = e.data;
  const t0 = Date.now();
  const result = findBestMove(state, depth);
  result.ms = Date.now() - t0;
  result.requestId = requestId;
  self.postMessage(result);
};
