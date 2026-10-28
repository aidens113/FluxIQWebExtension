// What a press, a type or a choice did to the page it found, read from the
// look before it and the look after: which lines changed, walked once
// (`./change/walk.ts`) and said both to the model (`./page-changes.ts`) and to
// the draft as the lines Core reads acts from (`./change/statement.ts`),
// what it did to the pressed control's own choice -- read once
// (`./chosen-state.ts`), said as a sentence (`./choice.ts`) and stated to the
// draft as the control and the way it flipped (`./toggle.ts`) -- whether it
// answered a layer that then went (`./answered-layer.ts`), which item of a
// repeating list it acted on (`./acted-on.ts`, t504), for a press the page
// refused, the line the page answered with (`./notice.ts`), and, for a press
// that changed nothing at all, its own wait and second press
// (`./settled.ts`), made for a lasting press only when it certainly did not
// happen (`./certain-no-effect.ts`, t513), and the sentence that says it had no effect
// (`./no-effect.ts`, t511), naming the control one way (`./press-words.ts`),
// all read from whether the page stayed the same page apart from where it is
// drawn (`./unchanged-page.ts`), which `pageChanged` reads too.

export { webNodeActedOn } from "./acted-on";
export { webAnsweredLayer } from "./answered-layer";
export { webPressCertainlyIgnored } from "./certain-no-effect";
export { webPressChoice } from "./choice";
export { webPressChosenState, type WebPressChosenState } from "./chosen-state";
export { webNodeNoticedDetail, webNodePageNotice, type WebNodeNoticedDetail } from "./notice";
export { webNodePageChangeStatement, type WebNodePageChangeLine } from "./change";
export { webNodePageChanges } from "./page-changes";
export { webPressNoEffect } from "./no-effect";
export { webPressSettled, type WebPressSettled, type WebPressSettleSteps } from "./settled";
export { webPressedControlWords } from "./press-words";
export { webPageUnchanged } from "./unchanged-page";
export { webPressToggle } from "./toggle";
export { webPressToggleSignature, type WebPressToggleOutput } from "./toggle-signature";
