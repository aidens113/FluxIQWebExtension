// Which of a capture's elements a press acts on (t378, lane D).
//
// Live (`run-mv0fuual-f9e6f089`, view 14) the chat panel printed
// `t857 button "Close chat"` and, under it, the plain text line
// `t860 "I can bring the gazebo if you need it"`. A candidate's "close the chat
// if it shows" step pressed `t860`, and both trials pressed the message. A
// press names a control, so one whose element the page view prints as plain
// text is refused (`resolve-plan-node.ts`, `web.handle.not_a_control`).
//
// An element is pressed when it is a control by itself -- its tag, its role,
// a press listener or a cursor of its own, as the view reads them
// (`../page-view/element/traits.ts`), which keeps the controls a page draws
// (a colour swatch, a chip) -- or a layer, whose backdrop a press dismisses, or
// a label, which presses the control it names; or when a control the view
// prints as one holds it, as a button holds its words. An ancestor that only
// hears the presses of the controls inside it (a delegate,
// `../page-view/line/control-holders.ts`) is not such a control: the chat panel
// listening on its whole body does not make its messages buttons, and the view
// does not print it as one.

import { actionableEvidenceElement, type WebLlmEvidenceElement } from "../elements";
import { webLlmControlHolders, webLlmPageTree, webLlmViewTraits } from "../page-view";

/** The handles of the elements of one capture a press acts on (header). */
export function webLlmPressableTargets(elements: readonly WebLlmEvidenceElement[]): ReadonlySet<string> {
  const tree = webLlmPageTree(elements);
  const holders = webLlmControlHolders(elements, tree);
  const printedAsControl = (element: WebLlmEvidenceElement): boolean => webLlmViewTraits(element, holders.has(element)).control;
  const pressable = new Set<string>();
  for (const element of elements) {
    if (pressedByItself(element) || tree.ancestors(element).some(printedAsControl)) pressable.add(element.target);
  }
  return pressable;
}

function pressedByItself(element: WebLlmEvidenceElement): boolean {
  const traits = webLlmViewTraits(element);
  return traits.control || traits.layer || element.tag === "label" || actionableEvidenceElement(element);
}
