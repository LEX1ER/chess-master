import { Chess } from "chess.ts";
import {
  buttonElementShowBestMove,
  divElementContainer,
  spanElementLabel,
} from "./html";
import { elementToPgn } from "./chess";

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
const boardLayoutSidebar = document.getElementById("board-layout-sidebar");
boardLayoutSidebar?.prepend(divElementContainer);

buttonElementShowBestMove.addEventListener("click", async () => {
  const chess = new Chess();
  chess.move("");
  const element = document.querySelector(
    // possible changes
    "wc-new-move-list"
  ) as HTMLElement;
  const pgn = elementToPgn(element);
  chess.loadPgn(pgn);
  const fen = chess.fen();

  const move = {
    fen,
    depth: 20,
  };
  spanElementLabel.textContent = "Thingking . . .";
  const response = await fetch("https://lex2er.bsite.net/api/Chess", {
    method: "POST",
    body: JSON.stringify(move),
    headers: {
      "Content-Type": "application/json",
    },
  });

  const data = await response.text();
  spanElementLabel.textContent = data;

  var strings = data.split(" ");
  var bestMove = strings[1].split("");

  var firstSquare = letterAssignments[bestMove[0]] + bestMove[1];
  var secondSquare = letterAssignments[bestMove[2]] + bestMove[3];

  var board = document.querySelector("wc-chess-board");

  const highlightRedDiv = document.createElement("div");
  const highlightBlueDiv = document.createElement("div");
  const customs = document.querySelectorAll("[class^='custom']");
  customs.forEach((x) => x.remove());

  highlightRedDiv.className = `custom highlight square-${firstSquare}`;
  highlightRedDiv.style.backgroundColor = "#ef9a9a";
  board.prepend(highlightRedDiv);

  highlightBlueDiv.className = `custom highlight square-${secondSquare}`;
  highlightBlueDiv.style.backgroundColor = "#90caf9";
  board.prepend(highlightBlueDiv);
});
