import { Chess } from "chess.ts";
import type { PartialMove, PieceSymbol } from "chess.ts";
import {
  buttonElementShowBestMove,
  divElementContainer,
  spanElementLabel,
} from "./html";
import { elementToPgn } from "./chess";

declare const chrome:
  | {
      runtime?: {
        getURL(path: string): string;
      };
    }
  | undefined;

const STOCKFISH_SCRIPT_PATH = "dist/stockfish-18-lite-single.js";
const STOCKFISH_WASM_PATH = "dist/stockfish-18-lite-single.wasm";
const STOCKFISH_SEARCH_TIMEOUT_MS = 60_000;
const STOCKFISH_STARTUP_TIMEOUT_MS = 10_000;
const STOCKFISH_MAX_DEPTH = 99;
const DEFAULT_STOCKFISH_DEPTH = 20;
const MAX_CONTINUATION_CACHE_SIZE = 128;

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

type StockfishListener = (line: string) => void;

let stockfishWorker: Promise<Worker> | null = null;
let stockfishReady: Promise<void> | null = null;
let stockfishWorkerUrl: string | null = null;
let stockfishWasmUrl: string | null = null;
let stockfishAnalysisQueue: Promise<unknown> = Promise.resolve();
const stockfishListeners = new Set<StockfishListener>();
const continuationCache = new Map<string, string>();

function getExtensionUrl(path: string) {
  if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
    return chrome.runtime.getURL(path);
  }

  return path;
}

async function getStockfishWorkerUrl() {
  if (!stockfishWorkerUrl) {
    const [stockfishScript, stockfishWasm] = await Promise.all([
      fetch(getExtensionUrl(STOCKFISH_SCRIPT_PATH)).then((response) => {
        if (!response.ok) {
          throw new Error("Could not load Stockfish script.");
        }

        return response.text();
      }),
      fetch(getExtensionUrl(STOCKFISH_WASM_PATH)).then((response) => {
        if (!response.ok) {
          throw new Error("Could not load Stockfish WASM.");
        }

        return response.blob();
      }),
    ]);

    stockfishWasmUrl = URL.createObjectURL(
      new Blob([stockfishWasm], {
        type: "application/wasm",
      })
    );
    const stockfishScriptUrl = URL.createObjectURL(new Blob([stockfishScript], {
      type: "text/javascript",
    }));

    stockfishWorkerUrl = `${stockfishScriptUrl}#${encodeURIComponent(
      stockfishWasmUrl
    )}`;
  }

  return stockfishWorkerUrl;
}

function getStockfishWorker() {
  if (!stockfishWorker) {
    stockfishWorker = getStockfishWorkerUrl().then((workerUrl) => {
      const worker = new Worker(workerUrl);
      worker.onmessage = handleStockfishOutput;
      worker.onerror = (event) => {
        stockfishListeners.forEach((listener) =>
          listener(`stockfish-error ${event.message}`)
        );
      };

      return worker;
    });
  }

  return stockfishWorker;
}

async function sendStockfishCommand(command: string) {
  const worker = await getStockfishWorker();
  worker.postMessage(command);
}

function handleStockfishOutput(event: MessageEvent) {
  String(event.data)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      stockfishListeners.forEach((listener) => listener(line));
    });
}

function waitForStockfishLine(
  predicate: (line: string) => boolean,
  timeoutMessage: string,
  timeoutMs = STOCKFISH_SEARCH_TIMEOUT_MS
) {
  return new Promise<string>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      stockfishListeners.delete(listener);
      reject(new Error(timeoutMessage));
    }, timeoutMs);

    const listener = (line: string) => {
      if (line.startsWith("stockfish-error ")) {
        window.clearTimeout(timeoutId);
        stockfishListeners.delete(listener);
        reject(new Error(line.replace("stockfish-error ", "")));
        return;
      }

      if (!predicate(line)) {
        return;
      }

      window.clearTimeout(timeoutId);
      stockfishListeners.delete(listener);
      resolve(line);
    };

    stockfishListeners.add(listener);
  });
}

function getStockfishReady() {
  if (!stockfishReady) {
    stockfishReady = (async () => {
      const ready = waitForStockfishLine(
        (line) => line === "uciok",
        "Stockfish did not initialize.",
        STOCKFISH_STARTUP_TIMEOUT_MS
      );
      await sendStockfishCommand("uci");
      await ready;
    })().catch((error) => {
      stockfishReady = null;
      throw error;
    });
  }

  return stockfishReady;
}

function getFenPositionKey(fen: string) {
  return fen.split(" ").slice(0, 4).join(" ");
}

function isUciMove(move: string) {
  return /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move);
}

function uciMoveToChessMove(move: string): PartialMove {
  const chessMove: PartialMove = {
    from: move.slice(0, 2),
    to: move.slice(2, 4),
  };

  if (move[4]) {
    chessMove.promotion = move[4] as PieceSymbol;
  }

  return chessMove;
}

function trimContinuationCache() {
  while (continuationCache.size > MAX_CONTINUATION_CACHE_SIZE) {
    const oldestKey = continuationCache.keys().next().value;
    if (!oldestKey) {
      break;
    }

    continuationCache.delete(oldestKey);
  }
}

function getPrincipalVariationFromLine(line: string) {
  const match = line.match(/\bpv\s+(.+)$/i);
  if (!match) {
    return [];
  }

  return match[1].split(/\s+/).filter(isUciMove);
}

function getPonderMoveFromResponse(response: string) {
  return response.match(/\bponder\s+([a-h][1-8][a-h][1-8][qrbn]?)/i)?.[1];
}

function getContinuationFromAnalysis(response: string, principalVariation: string[]) {
  const bestMove = getBestMoveFromResponse(response);
  if (!bestMove) {
    return principalVariation;
  }
  if (principalVariation[0] === bestMove) {
    return principalVariation;
  }

  const ponderMove = getPonderMoveFromResponse(response);
  return [bestMove, ...(ponderMove ? [ponderMove] : [])];
}

function rememberContinuation(fen: string, continuation: string[]) {
  const chess = new Chess(fen);

  for (const move of continuation) {
    if (!isUciMove(move)) {
      break;
    }

    continuationCache.set(getFenPositionKey(chess.fen()), move);

    if (!chess.move(uciMoveToChessMove(move))) {
      continuationCache.delete(getFenPositionKey(chess.fen()));
      break;
    }
  }

  trimContinuationCache();
}

function getCachedBestMove(fen: string) {
  const key = getFenPositionKey(fen);
  const cachedMove = continuationCache.get(key);
  if (!cachedMove) {
    return null;
  }

  const chess = new Chess(fen);
  if (!chess.move(uciMoveToChessMove(cachedMove))) {
    continuationCache.delete(key);
    return null;
  }

  continuationCache.delete(key);
  continuationCache.set(key, cachedMove);

  return cachedMove;
}

async function analyzeWithStockfish({ fen, depth }: StockfishRequest) {
  if (!Number.isFinite(depth) || depth < 1 || depth > STOCKFISH_MAX_DEPTH) {
    throw new Error(`Depth must be between 1 and ${STOCKFISH_MAX_DEPTH}.`);
  }

  const cachedMove = getCachedBestMove(fen);
  if (cachedMove) {
    return `bestmove ${cachedMove} cached`;
  }

  const runAnalysis = async () => {
    let principalVariation: string[] = [];
    const principalVariationListener = (line: string) => {
      const variation = getPrincipalVariationFromLine(line);
      if (variation.length) {
        principalVariation = variation;
      }
    };

    stockfishListeners.add(principalVariationListener);

    await getStockfishReady();

    try {
      await sendStockfishCommand("ucinewgame");
      const ready = waitForStockfishLine(
        (line) => line === "readyok",
        "Stockfish did not become ready."
      );
      await sendStockfishCommand("isready");
      await ready;

      await sendStockfishCommand(`position fen ${fen}`);
      const bestMove = waitForStockfishLine(
        (line) => line.startsWith("bestmove "),
        "Stockfish analysis timed out."
      );
      await sendStockfishCommand(`go depth ${Math.floor(depth)}`);

      const response = await bestMove;
      rememberContinuation(
        fen,
        getContinuationFromAnalysis(response, principalVariation)
      );

      return response;
    } catch (error) {
      await sendStockfishCommand("stop");
      throw error;
    } finally {
      stockfishListeners.delete(principalVariationListener);
    }
  };

  const result = stockfishAnalysisQueue.then(runAnalysis);
  stockfishAnalysisQueue = result.catch(() => undefined);

  return result;
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

  const pgn = elementToPgn(element).trim();
  if (pgn && !chess.loadPgn(pgn)) {
    spanElementLabel.textContent = "Could not read current game.";
    return;
  }

  const fen = chess.fen();

  const move = {
    fen,
    depth: DEFAULT_STOCKFISH_DEPTH,
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
