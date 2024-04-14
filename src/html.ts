const divElementContainer = document.createElement("div");
divElementContainer.style.width = "100%";
divElementContainer.style.marginBottom = "5px";
divElementContainer.style.borderRadius = "5px";
divElementContainer.style.backgroundColor = "rgba(0,0,0,.2)";

const divElementContent1 = document.createElement("div");
divElementContent1.style.backgroundColor = "rgba(0,0,0,.1)";
divElementContent1.style.padding = "5px";

const titleElement = document.createElement("h2");
titleElement.textContent = "Stockfish 16";
titleElement.style.color = "hsla(0,0%,100%,.72)";
divElementContent1.append(titleElement);
divElementContainer.append(divElementContent1);

const divElementContent2 = document.createElement("div");
divElementContent2.style.padding = "10px 15px 10px 15px";

const divElementContent2divElement1 = document.createElement("div");
divElementContent2divElement1.style.paddingBottom = "10px";

const spanElementLabel = document.createElement("span");
spanElementLabel.textContent = "-";
spanElementLabel.style.textAlign = "center";
spanElementLabel.style.color = "hsla(0,0%,100%,.72)";

divElementContent2.append(spanElementLabel);
divElementContainer.append(divElementContent2);

const divElementContent3 = document.createElement("div");
divElementContent3.style.backgroundColor = "rgba(0,0,0,.1)";
divElementContent3.style.textAlign = "right";
divElementContent3.style.padding = "5px";

//#region Show Best Move
const buttonElementShowBestMove = document.createElement("button");
buttonElementShowBestMove.className =
  "ui_v5-button-component ui_v5-button-basic primary-controls-button";
buttonElementShowBestMove.title = "Show Best Move";

const iconShowBestMove = document.createElement("span");
iconShowBestMove.className = "icon-font-chess ui_v5-button-icon lightbulb";
buttonElementShowBestMove.append(iconShowBestMove);

divElementContent3.append(buttonElementShowBestMove);
divElementContainer.append(divElementContent3);
//#endregion

export { divElementContainer, spanElementLabel, buttonElementShowBestMove };
