// Whether a press whose answer was lost landed, judged on the page from the
// pressed control itself (t430): what this host answers when Core's effect
// check asks about a node that declares no expected state
// (`AutomationStudioHostRuntimeBoundary.actLanded`, Core
// `executor/defensive/host-act-landed.ts`).
//
// Before this, a step written without a `done when:` gave the effect check
// nothing to read, so a timed-out press of a notice's "Not now" ended the run
// as Outcome uncertain (recovery matrix row 9, t404). Core 61f6adbf answered
// that by pressing again whenever the step declared `consequences: none`; a
// model under-declares (paid R4a declared an offer button `none`), so the
// declaration was withdrawn as a reason and the page decides instead:
//
//  - **The control is no longer shown -> `landed`.** The press took its layer,
//    or its page, with it. Whatever the press was, it is not made again: a
//    control that is gone cannot be pressed twice, and reading its absence as
//    "did not happen" is the one mistake that makes an act twice.
//  - **The control is still shown and its name is only a way out -> `not_landed`.**
//    A "Not now" or a close glyph does nothing but close what it sits on, so
//    while it is still there, the close did not happen and pressing it again
//    is not a second act (`./way-out-label.ts`). Asked again until the window
//    ends first, so a layer still animating out is not pressed twice.
//  - **Anything else -> `unknown`.** A "Confirm" or an "Add to cart" still
//    shown proves nothing: many committing controls stay on the page after
//    they land. So does a page that did not answer, a node that is not a
//    press, and a target the page cannot resolve again.
//
// The step's declared consequences are never read here.

import type { JsonObject } from "fluxiq/core";
import type { WebAutomationFactEvaluator } from "../facts";
import { webAutomationPressedControl } from "./pressed-control";
import { webAutomationIsWayOutLabel } from "./way-out-label";

/** How often the control is looked for again while the window lasts. */
const LOOK_AGAIN_MS = 500;

/** What Core asks: the node that pressed, its attempt, and how long the page may take to settle. */
export type WebAutomationActLandedInput = {
  node: { id: string; definitionId: string; parameterValues?: JsonObject | undefined };
  attemptId: string;
  timeoutMs: number;
  signal?: AbortSignal | undefined;
};

/** The pacing the look uses; a test passes its own clock. */
export type WebAutomationActLandingPace = { now?: () => number; delay?: (ms: number) => Promise<void> };

/** `landed`, `not_landed` or `unknown` for the press behind `input`, from the page as `evaluate` reads it. */
export async function webAutomationActLanded(
  input: WebAutomationActLandedInput,
  evaluate: WebAutomationFactEvaluator,
  pace: WebAutomationActLandingPace = {}
): Promise<"landed" | "not_landed" | "unknown"> {
  const target = webAutomationPressedControl(input.node);
  if (!target) return "unknown";
  const now = pace.now ?? Date.now;
  const delay = pace.delay ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const deadline = now() + Math.max(0, input.timeoutMs);
  const context = { nodeId: input.node.id, attemptId: input.attemptId, ...(input.signal ? { signal: input.signal } : {}) };
  let wayOutShown = false;
  for (;;) {
    if (input.signal?.aborted) return "unknown";
    const [answer] = await evaluate([{ fact: "visible", op: "visible", target }], context);
    if (answer?.result === "false") return "landed";
    wayOutShown = answer?.result === "true" && webAutomationIsWayOutLabel(answer.evidence?.element?.accessibleName);
    const left = deadline - now();
    if (left <= 0) break;
    await delay(Math.min(LOOK_AGAIN_MS, left));
  }
  return wayOutShown ? "not_landed" : "unknown";
}
