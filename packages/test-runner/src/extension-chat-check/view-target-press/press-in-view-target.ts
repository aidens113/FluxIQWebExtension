import { randomUUID } from "node:crypto";
import type { CDPSession } from "@playwright/test";
import { attachTarget, type TargetChannel } from "./attach-target.js";
import { inPanelTarget, type PanelTargetAnswer, type PanelTargetStep, type PressSeen } from "./in-panel-target.js";

/** How long one command to the panel's target may take. */
const CALL_MS = 5_000;
/** How long after the mouse is released the panel has to report the click. */
const CONFIRM_MS = 2_000;
const CONFIRM_POLL_MS = 100;
const NOT_SHOWN_YET = "not shown yet";

/**
 * Presses the button labelled `label` in an extension view Playwright gives
 * no Page for (Chrome's real side panel), with real mouse input.
 *
 * The chat's answer controls take only trusted events, and the extension
 * sends an answer only while the view has a person's activation, so a
 * script's `button.click()` from another extension page no longer answers.
 * Input sent over CDP to the view's own target is browser input: trusted, and
 * it gives the view a person's activation.
 *
 * `session` is a CDP session on another page (the run's control tab). The
 * view's target is the one whose url starts with `viewUrl` and that is not the
 * session's own page. Attached to it without flattening: `Runtime.evaluate`
 * finds the button and its centre (`inPanelTarget`, which also starts a watch
 * for the click), `Input.dispatchMouseEvent` moves, presses and releases the
 * left button there, and the watch is read back until it saw the click.
 *
 * Answers `"pressed"` once the panel saw a trusted click with a person's
 * activation reach the button, or why nothing was pressed (`NOT_SHOWN_YET`
 * when no such button shows), for the caller to try again. A click that
 * reached the button untrusted or without activation throws: it reached the
 * button, so pressing again is not a retry of the same press.
 */
export async function pressInViewTarget(session: CDPSession, input: { viewUrl: string; label: string }): Promise<string> {
  const own = (await session.send("Target.getTargetInfo")).targetInfo.targetId;
  const { targetInfos } = await session.send("Target.getTargets");
  const views = targetInfos.filter(info => info.targetId !== own && info.url.startsWith(input.viewUrl));
  if (views.length === 0) return `no side panel target among ${targetInfos.length} browser target(s)`;
  let outcome = NOT_SHOWN_YET;
  for (const view of views) {
    outcome = await pressInTarget(session, view.targetId, input.label);
    if (outcome !== NOT_SHOWN_YET) return outcome;
  }
  return outcome;
}

async function pressInTarget(session: CDPSession, targetId: string, label: string): Promise<string> {
  const channel = await attachTarget(session, targetId);
  const key = `__fluxiqLabPress${randomUUID().replaceAll("-", "")}`;
  try {
    const located = await evaluate(channel, { step: "locate", label, key });
    if (located === null || !("found" in located)) throw new Error(`The side panel answered the press lookup with ${JSON.stringify(located)}`);
    if (!located.found) return located.reason;
    for (const type of ["mouseMoved", "mousePressed", "mouseReleased"] as const) {
      const pressing = type !== "mouseMoved";
      await channel.call("Input.dispatchMouseEvent", { type, x: located.x, y: located.y, button: pressing ? "left" : "none", buttons: type === "mousePressed" ? 1 : 0, clickCount: pressing ? 1 : 0 }, CALL_MS);
    }
    const seen = await watchForClick(channel, key);
    if (!seen.seen) return `the press at (${Math.round(located.x)}, ${Math.round(located.y)}) did not reach the "${label}" button`;
    if (!seen.trusted || !seen.activation) throw new Error(`The "${label}" press reached the side panel as ${seen.trusted ? "trusted" : "untrusted"} input ${seen.activation ? "with" : "without"} a person's activation, so the panel would not take it as an answer`);
    return "pressed";
  } finally {
    await channel.detach().catch(/* best-effort: a panel closed since the press has no target left to detach from */ () => undefined);
  }
}

/** Reads the watch until it saw the click; at the bound, ends the watch and answers what it saw last. */
async function watchForClick(channel: TargetChannel, key: string): Promise<PressSeen> {
  const deadline = Date.now() + CONFIRM_MS;
  for (;;) {
    const answer = await evaluate(channel, { step: "confirm", key });
    if (answer !== null && "seen" in answer && answer.seen) return answer;
    if (Date.now() >= deadline) {
      const last = await evaluate(channel, { step: "forget", key });
      return last !== null && "seen" in last ? last : { seen: false, trusted: false, activation: false };
    }
    await new Promise(resolve => setTimeout(resolve, CONFIRM_POLL_MS));
  }
}

async function evaluate(channel: TargetChannel, step: PanelTargetStep): Promise<PanelTargetAnswer> {
  const expression = `(${inPanelTarget.toString()})(${JSON.stringify(step)})`;
  const answer = await channel.call("Runtime.evaluate", { expression, returnByValue: true }, CALL_MS);
  const failure = answer.exceptionDetails as { text?: string; exception?: { description?: string } } | undefined;
  if (failure) throw new Error(`The side panel could not run the press script: ${failure.exception?.description ?? failure.text ?? "no description"}`);
  const result = answer.result as { value?: PanelTargetAnswer } | undefined;
  if (!result || !("value" in result)) throw new Error("The side panel returned no value for the press script");
  return result.value ?? null;
}
