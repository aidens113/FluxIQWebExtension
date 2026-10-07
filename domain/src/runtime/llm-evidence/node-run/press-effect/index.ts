// What a press, a type or a choice did to the page it found, read from the
// look before it and the look after: which lines changed, walked once
// (`./change/walk.ts`) and said both to the model (`./page-changes.ts`) and to
// the draft as the lines Core reads acts from (`./change/statement.ts`),
// what it did to the pressed control's own choice -- read once
// (`./chosen-state.ts`), said as a sentence (`./choice.ts`) and stated to the
// draft as the control and the way it flipped (`./toggle.ts`) -- whether it
// answered a layer that then went (`./answered-layer.ts`), and, for a press
// the page refused, the line the page answered with (`./notice.ts`).

export { webAnsweredLayer } from "./answered-layer";
export { webPressChoice } from "./choice";
export { webPressChosenState, type WebPressChosenState } from "./chosen-state";
export { webNodeNoticedDetail, webNodePageNotice, type WebNodeNoticedDetail } from "./notice";
export { webNodePageChangeStatement, type WebNodePageChangeLine } from "./change";
export { webNodePageChanges } from "./page-changes";
export { webPressToggle } from "./toggle";
