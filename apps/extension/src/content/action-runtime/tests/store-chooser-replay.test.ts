// The store chooser's two steps, replayed against the pages a dry run and a
// playback meet.
//
// Live run `run-munri5gr-94d7f8a0` (bigbox-retail, "Switch my pickup store to
// Millbrook Crossing Supercenter, then add ..."). Exploring, the model opened
// the chooser (draft step 7) and pressed Millbrook's "Set as my store" (step
// 8), and the store switched -- server-side, so a dry run's reset, which is a
// navigation, does not put it back. Both dry runs then replayed step 7 as
// `core.replay.unreproducible` after 5.5 s and step 8 as `core.replay.failed`
// after 1.3 s, and completion was refused.
//
// Each row goes the whole way the created Flow's step goes. The recorded page
// (Carden Falls Supercenter chosen, the flyout open) is described with the
// content script's own selector, host chain, name and record rules; the domain's
// evidence runtime turns the description into a packet, the model's handle is
// resolved into node parameters, and those pass through Core's target
// normalizer and the gateway mapping into the command this resolver reads. The
// page it is then resolved against is `store-chooser-page.ts`.
//
// What the rows found, and hold:
//
// - Step 7, the chip, is recorded as `button` in the widget's root with the
//   name "Pickup or delivery?Carden Falls Supercenter". With Millbrook chosen
//   the name has changed, so the veto refused the one visible button the
//   selector found and scoring refused it again: not found, which a replay
//   calls unreproducible. It is now found by the stable part of its name
//   (`identity/stable-name.ts`), and nothing else is.
// - Step 8 is recorded as `div > ul > li:nth-of-type(3) > button` and, until
//   t193, nothing that said which card. With Millbrook chosen the third card
//   holds "Your store" and no button: the position missed, the fingerprint's
//   text matched the other stores' three buttons, and three is
//   TARGET_AMBIGUOUS -- the `failed`. The identity now carries the card
//   (`domain/.../plan-resolution/element-identity.ts`), a strategy's count is
//   taken inside it, and the missing card reads as missing: TARGET_NOT_FOUND.
// - A fresh page -- Carden Falls chosen, as a playback on a new session meets
//   it -- presses Millbrook's button, and a page whose cards have moved presses
//   Millbrook's and not whichever store sits third.

import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { normalizeAutomationStudioElementTarget } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_RUN_NODE_TOOL_ID } from "@fluxiq-web-extension/domain";
import { outputTargetFromPayload, webAutomationActionFromGatewayCommand, webAutomationOutputNodeId } from "@fluxiq-web-extension/domain/client";
import { accessibleNameFor, boundedText, implicitRole, recordIdentity } from "../../identity";
import { selectorFor, shadowHostChain } from "../../selector";
import type { BrowserActionCommand } from "../../types";
import { resolveTarget } from "../resolve-target";
import { STORE_CARDS, chipButton, installStoreChooser, plainButton, type StoreChooser, type StoreChooserState } from "./store-chooser-page";

const PAGE_URL = "http://127.0.0.1:4100/bigbox/";
const CARDEN_FALLS = "2291";
const MILLBROOK = "1187";

/** An element as `describe-element.ts` puts it in a snapshot, from the rules the content script records with. */
function described(element: Element): JsonObject {
  const text = boundedText(element.textContent, 500);
  const hosts = shadowHostChain(element);
  const record = recordIdentity(element);
  const name = accessibleNameFor(element);
  const role = implicitRole(element);
  return {
    tagName: element.tagName.toLowerCase(),
    selector: selectorFor(element),
    ...(text ? { visibleText: text, text } : {}),
    ...(name ? { accessibleName: name } : {}),
    ...(role ? { implicitRole: role } : {}),
    context: { ...(hosts ? { shadowHosts: hosts } : {}), ...(record ? { record } : {}) } as JsonObject
  };
}

type RecordedSteps = { openChooser: BrowserActionCommand; setMillbrook: BrowserActionCommand };

/**
 * The two steps as the draft kept them: the exploration page described, shown
 * to the domain as a packet, and the handles for the chip and for the button in
 * Millbrook's card resolved and dispatched.
 */
async function recordSteps(t: TestContext): Promise<RecordedSteps> {
  const page = installStoreChooser(t, { chosen: CARDEN_FALLS, open: true });
  const millbrook = page.setButtons.get(MILLBROOK);
  assert.ok(millbrook);
  // Each card's name rides with its button, as a capture of the whole page
  // lists it (t200): the model tells the four "Set as my store" buttons apart
  // by the card each sits under in the page view (t223), never by a field.
  const cards = [...page.setButtons.values()].flatMap((button) => [button.parentElement!.children[0]!, button]);
  const snapshot = [page.chip, ...cards].map(described);
  const runtime = createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => command.actionType === "web.dom.capture_snapshot"
      ? { status: "succeeded", payload: { snapshot: { url: PAGE_URL, title: "Bigbox", interactiveElements: snapshot } } }
      : { status: "succeeded" }
  });
  const shown = await runtime.executeTool({ projectId: "project.one", flowId: "flow.one", callId: "call.look", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: webAutomationOutputNodeId("web.dom.capture_snapshot"), parameters: {}, consequences: [] } });
  // The page as the model reads it: one line per element, in page order.
  const view = String((shown.evidence as JsonObject | undefined)?.page ?? "");
  const lines = view.split("\n").flatMap((line) => {
    const parsed = /^(t[1-9][0-9]*) (?:(button) )?"((?:[^"\\]|\\.)*)"/u.exec(line);
    return parsed ? [{ target: parsed[1]!, button: parsed[2] === "button", words: parsed[3]! }] : [];
  });
  const chipHandle = lines.find((line) => line.button && line.words.startsWith("Pickup or delivery?"))?.target;
  const millbrookName = lines.findIndex((line) => line.words.startsWith("Millbrook Crossing Supercenter"));
  const millbrookHandle = millbrookName < 0 ? undefined : lines.slice(millbrookName + 1).find((line) => line.button)?.target;
  assert.ok(typeof chipHandle === "string" && typeof millbrookHandle === "string", `the page shows the chip and Millbrook's button: ${view}`);
  const step = async (handle: string, commandId: string): Promise<BrowserActionCommand> => {
    const resolution = await runtime.resolvePlanNodeParameters({ projectId: "project.one", flowId: "flow.one", nodeDefinitionId: webAutomationOutputNodeId("web.dom.click"), parameters: { selector: { handle } }, declaredConsequences: [] });
    assert.equal(resolution.status, "resolved", JSON.stringify(resolution));
    const parameters = resolution.status === "resolved" ? resolution.parameters : {};
    const prepared: JsonObject = Object.assign({}, parameters);
    const target = normalizeAutomationStudioElementTarget(parameters, { source: "runtime" });
    if (target) prepared.target = target as unknown as JsonObject;
    const command = webAutomationActionFromGatewayCommand({ commandId, actionType: "web.dom.click", parameters: prepared, target: outputTargetFromPayload(prepared) ?? {} });
    assert.equal("status" in command, false, "the command is dispatched");
    return command as unknown as BrowserActionCommand;
  };
  return { openChooser: await step(chipHandle, "cmd-7"), setMillbrook: await step(millbrookHandle, "cmd-8") };
}

/** The recorded steps, and then the page for `state` in place of the one they were recorded on. */
async function replayOn(t: TestContext, state: StoreChooserState): Promise<RecordedSteps & { page: StoreChooser }> {
  const steps = await recordSteps(t);
  return { ...steps, page: installStoreChooser(t, state) };
}

function failureCode(action: () => unknown): string | undefined {
  try {
    action();
  } catch (error) {
    return (error as { failure?: { code?: string } }).failure?.code;
  }
  return undefined;
}

test("what the draft kept: the chip by its root and its whole name, Millbrook's button by its position and its card", async (t) => {
  const { openChooser, setMillbrook } = await recordSteps(t);
  assert.equal(openChooser.selector, "button");
  assert.equal(openChooser.element?.accessibleName, "Pickup or delivery?Carden Falls Supercenter", "the recorded name carries the store that was chosen then");
  assert.deepEqual(openChooser.element?.context?.shadowHosts, ["body > header > div > vr-fulfillment-picker"]);
  assert.equal(openChooser.element?.context?.record, undefined, "the chip is in no card");
  assert.equal(setMillbrook.selector, "div > ul > li:nth-of-type(3) > button");
  assert.equal(setMillbrook.element?.accessibleName, "Set as my store");
  assert.deepEqual(setMillbrook.element?.context?.record, { text: "Millbrook Crossing Supercenter88 Ferris Rd, Millbrook · 9.8 miOpen 24 hours" }, "the card rides with the step");
});

test("the dry run's page, Millbrook already chosen: step 7 finds the chip by the stable part of its name", async (t) => {
  const { openChooser, page } = await replayOn(t, { chosen: MILLBROOK, open: false });
  const resolved = resolveTarget(openChooser);
  assert.equal(resolved.element, page.chip);
  assert.equal(resolved.resolution.strategy, "selector");
  assert.ok((resolved.resolution.confidence ?? 0) > 0, "the acceptance carries Core's measurement of the stable part");
});

test("the dry run's page with the chooser open: step 8 reads Millbrook's card as gone, not the other cards as a tie", async (t) => {
  for (const open of [false, true]) {
    await t.test(open ? "flyout open" : "flyout closed", async (inner) => {
      const { setMillbrook } = await replayOn(inner, { chosen: MILLBROOK, open });
      assert.equal(failureCode(() => resolveTarget(setMillbrook)), "web.target.not_found");
    });
  }
});

// A step the recorder wrote carries the button's visible text as well
// (`describe-element.ts`), and a created one does not -- the packet does not
// repeat text that is the name. That text is what the fingerprint strategy
// scans for, so a recorded step reaches the three other cards' buttons at
// Level 1, as one strategy's count, before any scoring: a count of three was a
// tie whatever the record said. The count is taken inside the record now.
test("a recorded step, carrying the button's text, also reads the missing card as missing", async (t) => {
  for (const open of [false, true]) {
    await t.test(open ? "flyout open" : "flyout closed", async (inner) => {
      const { setMillbrook } = await replayOn(inner, { chosen: MILLBROOK, open });
      const recorded = { ...setMillbrook, element: { ...setMillbrook.element, visibleText: "Set as my store" } } as BrowserActionCommand;
      assert.equal(failureCode(() => resolveTarget(recorded)), "web.target.not_found");
    });
  }
});

test("a fresh page, Carden Falls chosen: step 7 opens the chooser and step 8 presses Millbrook's button", async (t) => {
  const { openChooser, setMillbrook, page } = await replayOn(t, { chosen: CARDEN_FALLS, open: true });
  assert.equal(resolveTarget(openChooser).element, page.chip);
  assert.equal(resolveTarget(setMillbrook).element, page.setButtons.get(MILLBROOK));
});

test("cards in another order: step 8 presses Millbrook's button, not the store that now sits third", async (t) => {
  const order = [STORE_CARDS[2], STORE_CARDS[0], STORE_CARDS[3], STORE_CARDS[1]];
  const { setMillbrook, page } = await replayOn(t, { chosen: CARDEN_FALLS, open: true, order });
  assert.equal(resolveTarget(setMillbrook).element, page.setButtons.get(MILLBROOK));
});

test("the stable part is not loosened into another button", async (t) => {
  await t.test("a different two-part button under the chip's selector is refused", async (inner) => {
    const { openChooser } = await replayOn(inner, { chosen: MILLBROOK, open: false, chip: () => chipButton("Sign in", "Account") });
    assert.equal(failureCode(() => resolveTarget(openChooser)), "web.target.not_found");
  });
  await t.test("a one-part button holding only the label is refused", async (inner) => {
    const { openChooser } = await replayOn(inner, { chosen: MILLBROOK, open: false, chip: () => plainButton("Pickup or delivery?") });
    assert.equal(failureCode(() => resolveTarget(openChooser)), "web.target.not_found");
  });
  await t.test("two buttons in the root reading the same way are a tie, not a match", async (inner) => {
    const { openChooser } = await replayOn(inner, { chosen: MILLBROOK, open: false, beside: () => [chipButton("Pickup or delivery?", "Delivery to 10001")] });
    // With `button` both are one strategy's count, and a count of two is a tie
    // before any reading is taken.
    assert.equal(failureCode(() => resolveTarget(openChooser)), "web.target.ambiguous");
    // A recording made where the page held both names the chip by its place,
    // which finds the chip alone -- and the second button reading the same way
    // is what refuses it.
    const placed = "button:nth-of-type(1)";
    const byPlace = { ...openChooser, selector: placed, element: { ...openChooser.element, selector: placed } } as BrowserActionCommand;
    assert.equal(failureCode(() => resolveTarget(byPlace)), "web.target.not_found");
  });
  await t.test("the Set as my store buttons never answer the chip's step", async (inner) => {
    const { openChooser, page } = await replayOn(inner, { chosen: MILLBROOK, open: true, chip: () => chipButton("Sign in", "Account") });
    const code = failureCode(() => resolveTarget(openChooser));
    assert.ok(code, `refused rather than resolved to ${[...page.setButtons.keys()].join(", ")}`);
  });
});
