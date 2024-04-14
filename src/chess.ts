export function elementToPgn(element: HTMLElement) {
  const chessRows = element?.childNodes;
  const pgnArray = [];
  chessRows?.forEach((chessRow: Element) => {
    const chessColumns = chessRow.childNodes;
    const pgnPerColumns = processChessColumns(chessColumns);
    pgnArray.push(...pgnPerColumns);
  });
  const pgn = pgnArray.join(" ");
  return pgn;
}

function processChessColumns(chessColumns: NodeListOf<ChildNode>) {
  const pgnPerColumns = [];
  [...chessColumns]
    .filter(
      (x: HTMLElement) =>
        x.dataset == undefined || x.dataset.vmlElement == undefined
    )
    .forEach((chessColumn: Element) => {
      if (chessColumn.hasChildNodes()) {
        if (chessColumn.childNodes.length > 1) {
          let move = elementChessColumnToMove(chessColumn);
          pgnPerColumns.push(move);
        } else {
          pgnPerColumns.push(chessColumn.innerHTML);
        }
      } else {
        pgnPerColumns.push(chessColumn.textContent);
      }
    });
  return pgnPerColumns;
}

export function elementChessColumnToMove(chessColumn: Element) {
  let move = "";
  chessColumn.childNodes.forEach((chessMove: HTMLElement) => {
    if (chessMove.dataset?.figurine) {
      move += chessMove.dataset?.figurine;
    } else {
      move += chessMove.textContent;
    }
  });
  return move;
}
