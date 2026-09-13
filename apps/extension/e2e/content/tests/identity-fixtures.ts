// What the three identity specs beside this file share: the fixture selectors
// they aim at, the two failure records they assert, and the four helpers that
// put a recorded descriptor on a replayed command.
//
// It exists because one spec grew past 700 lines carrying three subjects --
// which signal resolves a drifted control, what happens when two controls
// answer to one description, and when a fast answer is refused before it is
// acted on. Those are now `identity-resolution.spec.ts`,
// `identity-ambiguity.spec.ts` and `identity-veto.spec.ts`; this is the part
// none of them owns alone.
//
// Scope, precisely: these rows hand the descriptor to the content script the
// way the background worker does, in `options.element`, and prove what the
// content script then does with it. They are not end-to-end proof of the
// plumbing that fills `options` on a live run. That half lives in the domain --
// `webAutomationOutputPayload` puts the fingerprint in a node's `parameters`
// and `webAutomationActionFromGatewayCommand` copies `parameters` into
// `options` -- and belongs to the domain's own tests. The two halves no longer
// differ in what they carry: the wire projection in `gateway-payloads.ts` and
// `output-nodes/targets.ts` both keep `testId`, `accessibleName`, `label`,
// `implicitRole` and `context`, and `identity-wire-chain.spec.ts` runs a
// recorded click through both before replaying it, so a signal lost on the way
// fails a row there instead of a refusal on a live run.

import { expect } from "../index.js";
import type { ContentHarness } from "../index.js";

type ActionCommand = Parameters<ContentHarness["runAction"]>[0];
type ActionOptions = NonNullable<ActionCommand["options"]>;
export type Descriptor = NonNullable<Awaited<ReturnType<ContentHarness["runAction"]>>["element"]>;
export type Rect = { x: number; y: number; width: number; height: number };

export const SAVE_BASELINE = '[data-testid="save-changes"]';
export const DISPLAY_NAME = '[data-testid="display-name"]';
export const PRIMARY = '[data-testid="choice-primary"]';
export const SECONDARY = '[data-testid="choice-secondary"]';
export const BELOW_FOLD = '[data-testid="below-fold-target"]';

/** The closed set's record for an ambiguous target, exactly as Core stores it. */
export const TARGET_AMBIGUOUS = { category: "target_ambiguous", code: "web.target.ambiguous", retryable: false, stage: "target_resolution" };
/** And for one that could not be found at all. */
export const TARGET_NOT_FOUND = { category: "target_not_found", code: "web.target.not_found", retryable: true, stage: "target_resolution" };

/** Each drifted rendering, and the id the Save action carries in it. */
export const DRIFT_MODES = [
  { mode: "selector-only", saveId: "workspace-settings-submit" },
  { mode: "text-only", saveId: "save-settings" },
  { mode: "moved", saveId: "save-settings" },
  { mode: "wrapped-aria", saveId: "save-settings" }
] as const;

/** The descriptor for one element, read through `web.dom.extract`, which changes nothing. */
export async function describe(harness: ContentHarness, selector: string): Promise<Descriptor> {
  const reply = await harness.runAction({ commandId: `describe:${selector}`, actionType: "web.dom.extract", selector });
  if (reply.status !== "succeeded" || !reply.element) {
    throw new Error(`extract did not describe ${selector}: ${reply.status} ${reply.message ?? ""}`);
  }
  return reply.element;
}

/** A recorded descriptor as a replayed command carries it, in `options.element`. */
export function recordedElement(descriptor: Descriptor): ActionOptions {
  return { element: descriptor } as unknown as ActionOptions;
}

/** Arms an identity-drift mode through the fixture's own `set-mode`, then reloads the page. */
export async function armMode(harness: ContentHarness, mode: string): Promise<void> {
  const response = await fetch(`${harness.lab.origin}/api/identity-drift/set-mode`, {
    method: "POST",
    headers: { authorization: `Bearer ${harness.lab.runToken}`, "content-type": "application/json" },
    body: JSON.stringify({ mode })
  });
  expect(response.ok, `arming ${mode} answered ${response.status}`).toBe(true);
  await harness.page.goto(harness.url);
  await expect
    .poll(async () => (await harness.messages()).some((message) => message.type === "fluxiq.contentReady"))
    .toBe(true);
}

export async function documentRect(harness: ContentHarness, selector: string): Promise<Rect> {
  return harness.page.locator(selector).evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { x: rect.x + window.scrollX, y: rect.y + window.scrollY, width: rect.width, height: rect.height };
  });
}

export async function viewportRect(harness: ContentHarness, selector: string): Promise<Rect> {
  const box = await harness.page.locator(selector).boundingBox();
  if (!box) throw new Error(`${selector} has no layout box.`);
  return box;
}

/** A visual target as the background worker sends it; the content script reads only its bounds. */
export function visualTarget(bounds: { bounds?: Rect; documentBounds?: Rect }) {
  return { namespace: "web" as const, statePath: "harness.target", ...bounds };
}
