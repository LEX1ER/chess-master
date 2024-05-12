export function elementToPgn(element: HTMLElement) {
  const chessRows = element?.childNodes;
  const pgnArray = [];
  [...chessRows]
    .filter((x: ChildNode) => x.childNodes.length)
    .forEach((chessRow: Element) => {
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
    .filter((chessColumn: HTMLElement) =>
      // possible changes
      chessColumn.classList?.contains("main-line-row")
    )
    .forEach((mainLineRow: Element) => {
      [...mainLineRow.childNodes]
        .filter((mainLineRowChilds: Element) =>
          // possible changes
          mainLineRowChilds.classList?.contains("node")
        )
        .forEach((mainLineRow: Element) => {
          // possible changes
          [...mainLineRow.children].forEach((chessColumn) => {
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
        });
    });
  return pgnPerColumns;
}

export function elementChessColumnToMove(chessColumn: Element) {
  let move = "";
  [...chessColumn.childNodes].forEach((chessMove: HTMLElement) => {
    if (chessMove.dataset?.figurine) {
      move += chessMove.dataset?.figurine;
    } else {
      move += chessMove.textContent;
    }
  });
  // possible changes
  return move.replaceAll(" ", "");
}
