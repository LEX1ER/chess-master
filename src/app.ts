import { Chess } from "chess.ts";
import {
  buttonElementShowBestMove,
  divElementContainer,
  spanElementLabel,
} from "./html";
import { elementToPgn } from "./chess";

const STOCKFISH_API_URL = "https://stockfish.online/api/s/v2.php";
const STOCKFISH_MAX_DEPTH = 15;

const letterAssignments = {
  a: 1,
  b: 2,
  c: 3,
  d: 4,
  e: 5,
  f: 6,
  g: 7,
  h: 8,
};

type StockfishRequest = {
  fen: string;
  depth: number;
};

type StockfishResponse = {
  success?: boolean;
  bestmove?: string;
  error?: string;
};

async function analyzeWithStockfish({ fen, depth }: StockfishRequest) {
  if (!Number.isFinite(depth) || depth < 1 || depth > STOCKFISH_MAX_DEPTH) {
    throw new Error(`Depth must be between 1 and ${STOCKFISH_MAX_DEPTH}.`);
  }

  const params = new URLSearchParams({
    fen,
    depth: Math.floor(depth).toString(),
  });

  const response = await fetch(`${STOCKFISH_API_URL}?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Stockfish request failed: ${response.status}`);
  }

  const data = (await response.json()) as StockfishResponse;
  if (data.success === false) {
    throw new Error(data.error || "Stockfish could not analyze this position.");
  }
  if (!data.bestmove) {
    throw new Error("Stockfish did not return a best move.");
  }

  return data.bestmove;
}

function getBestMoveFromResponse(response: string) {
  const match =
    response.match(/\bbestmove\s+([a-h][1-8][a-h][1-8][qrbn]?)/i) ||
    response.match(/\b([a-h][1-8][a-h][1-8][qrbn]?)\b/i);

  return match?.[1];
}

function squareToChessComClass(square: string) {
  const file = square[0] as keyof typeof letterAssignments;
  return `${letterAssignments[file]}${square[1]}`;
}

function highlightBestMove(bestMove: string) {
  const fromSquare = squareToChessComClass(bestMove.slice(0, 2));
  const toSquare = squareToChessComClass(bestMove.slice(2, 4));
  const board = document.querySelector("wc-chess-board");
  if (!board) {
    throw new Error("Chess board not found.");
  }

  const highlightRedDiv = document.createElement("div");
  const highlightBlueDiv = document.createElement("div");
  const customs = document.querySelectorAll("[class^='custom']");
  customs.forEach((x) => x.remove());

  highlightRedDiv.className = `custom highlight square-${fromSquare}`;
  highlightRedDiv.style.backgroundColor = "#ef9a9a";
  board.prepend(highlightRedDiv);

  highlightBlueDiv.className = `custom highlight square-${toSquare}`;
  highlightBlueDiv.style.backgroundColor = "#90caf9";
  board.prepend(highlightBlueDiv);
}

const boardLayoutSidebar = document.getElementById("board-layout-sidebar");
boardLayoutSidebar?.prepend(divElementContainer);

buttonElementShowBestMove.addEventListener("click", async () => {
  const chess = new Chess();
  const element = document.querySelector(
    // possible changes
    "wc-simple-move-list"
  ) as HTMLElement;
  if (!element) {
    spanElementLabel.textContent = "Move list not found.";
    return;
  }

  const pgn = elementToPgn(element);
  if (!chess.loadPgn(pgn)) {
    spanElementLabel.textContent = "Could not read current game.";
    return;
  }

  const fen = chess.fen();

  const move = {
    fen,
    depth: 15,
  };

  spanElementLabel.textContent = "Thinking . . .";

  try {
    const data = await analyzeWithStockfish(move);
    const bestMove = getBestMoveFromResponse(data);
    if (!bestMove) {
      throw new Error("Could not parse Stockfish best move.");
    }

    spanElementLabel.textContent = data;
    highlightBestMove(bestMove);
  } catch (error) {
    spanElementLabel.textContent =
      error instanceof Error ? error.message : "Stockfish analysis failed.";
  }
});
