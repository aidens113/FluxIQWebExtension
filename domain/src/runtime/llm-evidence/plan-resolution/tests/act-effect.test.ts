// A step a build created knows its own effect (t447, `r4b-coupon-step-identity.md` F2).
//
// t442 saves the coupon step as exploration's press found its control ("Get coupons"). What the press made true
// ("Collected" in its place) is the step's effect: `acted` keeps it beside the identity, from the very captures the
// press was made from and left (`../act-effect.ts`), and a candidate's resolution answers it to Core, which writes it
// onto the Flow node's `routeSignatures.effect`. Held here on the whole path, through the node runner: the effect
// holds by the host's own test (`routeEffectHolds`) on a page that already holds the coupon and not on a fresh one;
// it is never answered where no identity was acted on; and the build test's check of the step answers `present`
// when the page shows it, whatever the control now reads.
//
// And it leaves out what the page changes by itself (t496): in `run-mv6eq215-a986f1f3` the look an act was made from
// caught a rotating banner on its second slide, the press reloaded the page onto its first, and the first slide's link
// was kept as added, so the effect held only while that slide was up. Held on a generic page of that shape: a banner
// that moves one slide on every capture and starts again on every reload, and a units switch whose press reloads.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { webAutomationOutputNodeId } from "../../../../output-nodes";
import { webAutomationRouteEffectHolds, webAutomationRouteEffectSeen } from "../../../route-state";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_RUN_NODE_TOOL_ID, type WebAutomationLlmEvidenceRuntime } from "../..";
import { shownHandle } from "../../page-view/tests/shown-page-lines";

const SCOPE = { projectId: "project.effect", flowId: "flow.effect" };
const URL_ = "https://crossborder.test/item/1005008123450";
const CLICK = webAutomationOutputNodeId("web.dom.click");
const LOOK = webAutomationOutputNodeId("web.dom.capture_snapshot");
const COUPON = "#coupons > div:nth-of-type(2)";
const SHARE = "#share";
const PERMITTED = async () => ({ permitted: true as const });

/** A store coupon whose press collects it, and a Share button whose press changes nothing on the page. */
function store(start: { collected: boolean } = { collected: false }): { runtime: WebAutomationLlmEvidenceRuntime; commands: string[] } {
  let collected = start.collected;
  const commands: string[] = [];
  const runtime = createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      commands.push(command.actionType);
      if (command.actionType === "web.dom.click") {
        if (command.parameters.selector === COUPON) collected = true;
        return { status: "succeeded" };
      }
      if (command.actionType !== "web.dom.capture_snapshot") return { status: "succeeded" };
      const elements: JsonObject[] = [
        { tagName: "h2", selector: "#coupons > h2", visibleText: "Store coupons" },
        { tagName: "button", selector: SHARE, visibleText: "Share" },
        { tagName: "div", selector: COUPON, visibleText: collected ? "Collected" : "Get coupons", hasClickHandler: true, classNames: collected ? ["b", "x"] : ["b"], attributes: { class: collected ? "b x" : "b" } }
      ];
      return { status: "succeeded", payload: { snapshot: { url: URL_, title: "Item", interactiveElements: elements } } };
    }
  });
  return { runtime, commands };
}

let calls = 0;
async function run(runtime: WebAutomationLlmEvidenceRuntime, node: string, parameters: JsonObject) {
  calls += 1;
  return await runtime.executeTool({ ...SCOPE, callId: `call.${calls}`, toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node, parameters, consequences: [] } });
}

/** The route state the host's `observeRouteState` reads of a page, as a look reports it. */
async function routeStateOf(runtime: WebAutomationLlmEvidenceRuntime): Promise<JsonObject> {
  const looked = await run(runtime, LOOK, {});
  assert.ok(looked.routeState, "a look reports the route state of the page it left");
  return looked.routeState;
}

/** A candidate submission's resolution, or with `legacy` one that asks for no view history. */
async function candidate(runtime: WebAutomationLlmEvidenceRuntime, handle: string, legacy = false) {
  const asked = { ...SCOPE, nodeDefinitionId: CLICK, parameters: { target: { handle } }, declaredConsequences: ["create_new" as const], permission: PERMITTED };
  return await runtime.resolvePlanNodeParameters(legacy ? asked : { ...asked, handleReach: "view_history" });
}

/** Exploration as R4b's: look, collect the coupon, look again. Returns the coupon's handle. */
async function explored(runtime: WebAutomationLlmEvidenceRuntime): Promise<string> {
  const looked = await run(runtime, LOOK, {});
  const coupon = shownHandle(looked.evidence, "Get coupons");
  const pressed = await run(runtime, CLICK, { target: { handle: coupon } });
  assert.equal((pressed.evidence as { pageChanged?: boolean }).pageChanged, true);
  await run(runtime, LOOK, {});
  return coupon;
}

test("a candidate's step on the coupon exploration collected carries what the press made true, which holds only where the coupon is collected", async () => {
  const { runtime } = store();
  const coupon = await explored(runtime);
  const resolved = await candidate(runtime, coupon);
  assert.equal(resolved.status, "resolved", JSON.stringify(resolved));
  if (resolved.status !== "resolved") return;
  // t442's identity is unchanged: the control as the press found it.
  assert.equal((resolved.parameters.element as JsonObject).visibleText, "Get coupons");
  const effect = resolved.effect;
  assert.ok(effect, "the step carries its effect");
  // Hashes only: neither the act's words nor the control's address leave as the effect.
  assert.equal(effect.v, "web-effect.v1");
  assert.ok(!JSON.stringify(effect).includes("Collected") && !JSON.stringify(effect).includes(COUPON));
  assert.ok(JSON.stringify(effect).length <= 2_048, "within Core's signature bound");

  assert.equal(webAutomationRouteEffectHolds(effect, await routeStateOf(store({ collected: true }).runtime)), true, "a page that already holds the coupon shows it");
  assert.equal(webAutomationRouteEffectHolds(effect, await routeStateOf(store().runtime)), false, "a fresh page does not");
});

test("no effect is answered where no act's identity is: exploration's own resolution, a legacy one, a control nothing changed", async () => {
  const { runtime } = store();
  const coupon = await explored(runtime);
  const exploring = await runtime.resolvePlanNodeParameters({ ...SCOPE, nodeDefinitionId: CLICK, parameters: { target: { handle: coupon } }, gatedByCaller: true });
  assert.equal(exploring.status, "resolved");
  assert.equal(Object.hasOwn(exploring, "effect"), false);
  // Against the page as it now is the agreed identity is wordless, which t442's floor refuses; resolved or not, no effect.
  const legacy = await candidate(runtime, coupon, true);
  assert.equal(Object.hasOwn(legacy, "effect"), false, JSON.stringify(legacy));

  // Share's press changed no control on the page: there is nothing its step could be passed over for.
  const share = shownHandle((await run(runtime, LOOK, {})).evidence, "Share");
  const pressed = await run(runtime, CLICK, { target: { handle: share } });
  // Genuinely a press that changed nothing: waited on, pressed once more, and answered `no_effect` (t511).
  assert.equal((pressed.evidence as JsonObject).status, "no_effect");
  assert.deepEqual(pressed.routeState, await routeStateOf(runtime), "the page the press left is the page as it was");
  const unchanged = await candidate(runtime, share);
  assert.equal(unchanged.status, "resolved", JSON.stringify(unchanged));
  assert.equal(Object.hasOwn(unchanged, "effect"), false);
});

test("the build test's check answers `present` for a step whose effect the page shows, and acts on nothing", async () => {
  const { runtime } = store();
  const coupon = await explored(runtime);
  const resolved = await candidate(runtime, coupon);
  if (resolved.status !== "resolved" || !resolved.effect) throw new Error(JSON.stringify(resolved));
  // R4b's saved step: a wordless identity, which the page's "Collected" div still answers to.
  const parameters = { selector: COUPON, element: { tagName: "div", classNames: ["b"] } };
  const check = async (page: { collected: boolean }, effect?: JsonObject) => {
    const stubbed = store(page);
    const value: JsonObject = { replay: "verify", node: CLICK, parameters, consequences: ["create_new"], from: { location: URL_ } };
    if (effect) value.effect = effect;
    const answered = await stubbed.runtime.executeTool({ ...SCOPE, callId: `dryrun.${(calls += 1)}`, toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED, value });
    assert.equal(answered.effectApplied, false);
    assert.equal(stubbed.commands.includes("web.dom.click"), false, "a check presses nothing");
    return answered.resultCode;
  };
  assert.equal(await check({ collected: true }, resolved.effect), "core.replay.present");
  // Without its effect the check reads only the control, which answers: `verified`, R4b's wrong answer.
  assert.equal(await check({ collected: true }), "core.replay.verified");
  // An effect the page does not show says nothing: the check goes on and finds the control.
  assert.equal(await check({ collected: false }, resolved.effect), "core.replay.verified");
});

const BANNER_URL = "https://recipes.test/";
const SWITCH = "#units > button";
const SLIDES = ["Read this week's pick", "Browse the archive", "Meet the cooks"];

/**
 * A recipe page. Its banner shows slide `slide` at the next capture, moves on one
 * slide each capture after, and starts again at the first on a reload; pressing
 * the units switch saves metric units and reloads the page.
 */
function site(start: { metric: boolean; slide: number } = { metric: false, slide: 0 }): WebAutomationLlmEvidenceRuntime {
  let metric = start.metric;
  let slide = start.slide;
  let document = 1;
  return createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType === "web.dom.click") {
        if (command.parameters.selector === SWITCH && !metric) {
          metric = true;
          document += 1;
          slide = 0;
        }
        return { status: "succeeded" };
      }
      if (command.actionType !== "web.dom.capture_snapshot") return { status: "succeeded" };
      const shown = SLIDES[slide % SLIDES.length]!;
      slide += 1;
      const elements: JsonObject[] = [
        { tagName: "a", selector: "#banner > a", visibleText: shown, attributes: { href: "/featured" } },
        { tagName: "a", selector: "#nav > a", visibleText: "All recipes", attributes: { href: "/recipes" } },
        { tagName: "span", selector: "#units > span", visibleText: metric ? "Units: metric" : "Units: imperial", hasClickHandler: true },
        ...(metric ? [] : [{ tagName: "button", selector: SWITCH, visibleText: "Use metric units" }])
      ];
      return { status: "succeeded", payload: { snapshot: { url: BANNER_URL, title: "Recipes", interactiveElements: elements, evidence: { navigation: { type: "navigate", timeOrigin: 1_000 * document } } } } };
    }
  });
}

/** A build that looks (first slide), then presses the switch from its own look (second slide) and the reload starts the banner again. */
async function builtEffect(): Promise<JsonObject> {
  const runtime = site();
  const looked = await run(runtime, LOOK, {});
  const units = shownHandle(looked.evidence, "Use metric units");
  const pressed = await run(runtime, CLICK, { target: { handle: units } });
  assert.equal((pressed.evidence as { pageChanged?: boolean }).pageChanged, true);
  const resolved = await runtime.resolvePlanNodeParameters({ ...SCOPE, nodeDefinitionId: CLICK, parameters: { target: { handle: units } }, declaredConsequences: ["modify_existing"], permission: PERMITTED, handleReach: "view_history" });
  assert.equal(resolved.status, "resolved", JSON.stringify(resolved));
  if (resolved.status !== "resolved" || !resolved.effect) throw new Error(`the step carries no effect: ${JSON.stringify(resolved)}`);
  return resolved.effect;
}

test("an act whose look caught a turning banner keeps only what the act did, and holds on every slide", async () => {
  const effect = await builtEffect();
  // What the act did: the units chip reads metric. The banner's link is not the act's.
  assert.equal((effect.added as string[]).length, 1, JSON.stringify(effect));
  for (const slide of [0, 1, 2]) {
    assert.equal(webAutomationRouteEffectHolds(effect, await routeStateOf(site({ metric: true, slide }))), true, `metric units already saved, banner on slide ${slide + 1}`);
  }
});

test("the same effect never holds where the act's result is not on the page, whatever the banner shows", async () => {
  const effect = await builtEffect();
  for (const slide of [0, 1, 2]) {
    assert.equal(webAutomationRouteEffectHolds(effect, await routeStateOf(site({ metric: false, slide }))), false, `imperial units, banner on slide ${slide + 1}`);
  }
});

// t499: nor does it keep what a layer the page raised by itself shows (`../self-changing/page-raised.ts`). In
// `run-mv6i28zl-a53d36db` (F1) a press that chose a store reloaded the page, the reloaded page put a chat card up by
// itself, and the card's control was kept beside the store chip, so a later run on a page that remembered the store,
// with the card closed, never saw the effect hold. Held on a generic page of that shape -- a recipe whose "Save to my
// box" reloads onto a page with a help bubble -- and on a layer the capture recognised as the page's own (an
// assistant, a promotion). What must not change is held beside it: a layer the press itself opened on the same
// document -- a dialog, a panel that answers an add -- is the press's effect, and its controls stay required.

const RECIPE_URL = "https://recipes.test/recipes/lemon-tart";
const BOX = { x: 0, y: 0, width: 1280, height: 800 };

type Raw = JsonObject & { selector: string };

/** The captured list, with each element's `parent` written as its parent's index, as the capture writes it. */
function listed(elements: ReadonlyArray<Raw & { under?: string }>): JsonObject[] {
  return elements.map(({ under, ...element }) => {
    if (under === undefined) return element;
    const parent = elements.findIndex((other) => other.selector === under);
    assert.ok(parent >= 0, `no element ${under}`);
    return { ...element, parent };
  });
}

/** The effect a candidate's step on `handle` carries, after exploration pressed it. */
async function effectOf(runtime: WebAutomationLlmEvidenceRuntime, handle: string): Promise<JsonObject> {
  const resolved = await runtime.resolvePlanNodeParameters({ ...SCOPE, nodeDefinitionId: CLICK, parameters: { target: { handle } }, declaredConsequences: ["modify_existing"], permission: PERMITTED, handleReach: "view_history" });
  assert.equal(resolved.status, "resolved", JSON.stringify(resolved));
  if (resolved.status !== "resolved" || !resolved.effect) throw new Error(`the step carries no effect: ${JSON.stringify(resolved)}`);
  return resolved.effect;
}

const SAVE = "#save";
const HELP = "#help";

type Box = {
  /** The recipe is in the reader's box. */
  saved: boolean;
  /** The help bubble is up. */
  help: boolean;
  /** Saving reloads the page; otherwise the page answers in place. */
  reloads: boolean;
  /** What the capture recognised the bubble as, if anything. */
  kind?: string;
};

/**
 * A recipe page. Pressing "Save to my box" saves the recipe, and the page then puts up a help bubble by itself:
 * after the reload when saving reloads, or in place when it does not. The bubble's own "×" closes it.
 */
function recipe(start: Box): WebAutomationLlmEvidenceRuntime {
  const state = { ...start };
  let document = 1;
  return createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType === "web.dom.click") {
        if (command.parameters.selector === SAVE && !state.saved) {
          state.saved = true;
          state.help = true;
          if (state.reloads) document += 1;
        }
        if (command.parameters.selector === `${HELP} .close`) state.help = false;
        return { status: "succeeded" };
      }
      if (command.actionType !== "web.dom.capture_snapshot") return { status: "succeeded" };
      const elements: Array<Raw & { under?: string }> = [
        { tagName: "a", selector: "#nav > a", visibleText: "All recipes", attributes: { href: "/recipes" } },
        { tagName: "button", selector: "#box", visibleText: state.saved ? "My box: 1 recipe" : "My box: empty" },
        ...(state.saved ? [] : [{ tagName: "button", selector: SAVE, visibleText: "Save to my box" }]),
        { tagName: "a", selector: "#method > a", visibleText: "Jump to method", attributes: { href: "#method" } }
      ];
      const evidence: JsonObject = { navigation: { type: "navigate", timeOrigin: 1_000 * document } };
      if (state.help) {
        elements.push(
          { tagName: "div", selector: HELP },
          { tagName: "div", selector: `${HELP} > div`, visibleText: "Need help? ×", hasClickHandler: true, under: HELP },
          { tagName: "span", selector: `${HELP} .close`, visibleText: "×", hasClickHandler: true, under: `${HELP} > div` }
        );
        const blocker: JsonObject = { selector: HELP, blocks: 1, blocked: ["#method > a"] };
        if (state.kind !== undefined) blocker.kind = state.kind;
        evidence.overlays = { tested: 4, blockedCount: 1, blockers: [blocker] };
      }
      return { status: "succeeded", payload: { snapshot: { url: RECIPE_URL, title: "Lemon tart", interactiveElements: listed(elements), evidence } } };
    }
  });
}

/** Exploration: look at the page with no bubble up, press "Save to my box", and take the step's effect. */
async function savedEffect(shape: Pick<Box, "reloads" | "kind">): Promise<JsonObject> {
  const runtime = recipe({ saved: false, help: false, ...shape });
  const save = shownHandle((await run(runtime, LOOK, {})).evidence, "Save to my box");
  const pressed = await run(runtime, CLICK, { target: { handle: save } });
  assert.equal((pressed.evidence as { pageChanged?: boolean }).pageChanged, true);
  return await effectOf(runtime, save);
}

async function holdsOn(effect: JsonObject, page: Box): Promise<boolean> {
  return webAutomationRouteEffectHolds(effect, await routeStateOf(recipe(page)));
}

test("a press that reloads onto a page whose help bubble opens by itself keeps only what the press did", async () => {
  const effect = await savedEffect({ reloads: true });
  assert.equal((effect.added as string[]).length, 1, `the box chip alone: ${JSON.stringify(effect)}`);
  // A later run on a page that remembers the recipe, the bubble closed (an earlier step closed it).
  assert.equal(await holdsOn(effect, { saved: true, help: false, reloads: true }), true, "remembered, bubble closed");
  assert.equal(await holdsOn(effect, { saved: true, help: true, reloads: true }), true, "remembered, bubble up");
  assert.equal(await holdsOn(effect, { saved: false, help: false, reloads: true }), false, "not saved");
  assert.equal(await holdsOn(effect, { saved: false, help: true, reloads: true }), false, "not saved, bubble up");
});

test("a layer the capture recognised as one the page puts up on its own is left out even on the same document", async () => {
  for (const kind of ["assistant", "promotion"]) {
    const effect = await savedEffect({ reloads: false, kind });
    assert.equal((effect.added as string[]).length, 1, `${kind}: ${JSON.stringify(effect)}`);
    assert.equal(await holdsOn(effect, { saved: true, help: false, reloads: false }), true, `${kind}: remembered, bubble closed`);
    assert.equal(await holdsOn(effect, { saved: false, help: true, reloads: false, kind }), false, `${kind}: not saved`);
  }
});

test("a layer of no recognised kind that came up on the same document is the press's, and stays required", async () => {
  const effect = await savedEffect({ reloads: false });
  assert.equal((effect.added as string[]).length, 3, `the chip and the layer's two controls: ${JSON.stringify(effect)}`);
  assert.equal(await holdsOn(effect, { saved: true, help: true, reloads: false }), true);
  assert.equal(await holdsOn(effect, { saved: true, help: false, reloads: false }), false);
});

const SERVINGS = "#servings";
const DIALOG = "#servings-dialog";
const LIST = "#add-to-list";
const PANEL = "#list-panel";

/**
 * A recipe page on one document. "Serves 4" opens a modal dialog to change the servings and changes nothing else;
 * "Add to shopping list" opens a panel that answers the add, and the header's list count goes up.
 */
function kitchen(start: { dialog: boolean; listed: boolean; panel: boolean }): WebAutomationLlmEvidenceRuntime {
  const state = { ...start };
  return createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType === "web.dom.click") {
        if (command.parameters.selector === SERVINGS) state.dialog = true;
        if (command.parameters.selector === LIST && !state.listed) {
          state.listed = true;
          state.panel = true;
        }
        return { status: "succeeded" };
      }
      if (command.actionType !== "web.dom.capture_snapshot") return { status: "succeeded" };
      const elements: Array<Raw & { under?: string }> = [
        { tagName: "a", selector: "#nav > a", visibleText: "All recipes", attributes: { href: "/recipes" } },
        { tagName: "a", selector: "#list", visibleText: state.listed ? "Shopping list (1)" : "Shopping list", attributes: { href: "/list" } },
        { tagName: "button", selector: SERVINGS, visibleText: "Serves 4" },
        { tagName: "button", selector: LIST, visibleText: "Add to shopping list" }
      ];
      const dialogs: JsonObject[] = [];
      const blockers: JsonObject[] = [];
      if (state.dialog) {
        elements.push(
          { tagName: "div", selector: DIALOG, role: "dialog", accessibleName: "Change servings" },
          { tagName: "button", selector: `${DIALOG} > button:nth-of-type(1)`, visibleText: "Serves 2", under: DIALOG },
          { tagName: "button", selector: `${DIALOG} > button:nth-of-type(2)`, visibleText: "Serves 6", under: DIALOG },
          { tagName: "button", selector: `${DIALOG} > button:nth-of-type(3)`, visibleText: "Done", under: DIALOG }
        );
        dialogs.push({ selector: DIALOG, role: "dialog", label: "Change servings", modal: true, bounds: BOX });
        blockers.push({ selector: DIALOG, label: "Change servings", blocks: 4, blocked: ["#nav > a", "#list", SERVINGS, LIST] });
      }
      if (state.panel) {
        elements.push(
          { tagName: "div", selector: PANEL, role: "dialog", accessibleName: "Added to your list" },
          { tagName: "a", selector: `${PANEL} > a`, visibleText: "View list", attributes: { href: "/list" }, under: PANEL },
          { tagName: "button", selector: `${PANEL} > button:nth-of-type(1)`, visibleText: "Keep browsing", under: PANEL },
          { tagName: "button", selector: `${PANEL} > button:nth-of-type(2)`, visibleText: "Close", under: PANEL }
        );
        dialogs.push({ selector: PANEL, role: "dialog", label: "Added to your list", modal: true, bounds: BOX });
        blockers.push({ selector: PANEL, label: "Added to your list", blocks: 4, blocked: ["#nav > a", "#list", SERVINGS, LIST] });
      }
      const evidence: JsonObject = { navigation: { type: "navigate", timeOrigin: 1_000 } };
      if (dialogs.length > 0) evidence.dialogs = { open: dialogs };
      if (blockers.length > 0) evidence.overlays = { tested: 4, blockedCount: 4, blockers };
      return { status: "succeeded", payload: { snapshot: { url: RECIPE_URL, title: "Lemon tart", interactiveElements: listed(elements), evidence } } };
    }
  });
}

async function pressedEffect(words: string): Promise<JsonObject> {
  const runtime = kitchen({ dialog: false, listed: false, panel: false });
  const handle = shownHandle((await run(runtime, LOOK, {})).evidence, words);
  const pressed = await run(runtime, CLICK, { target: { handle } });
  assert.equal((pressed.evidence as { pageChanged?: boolean }).pageChanged, true);
  return await effectOf(runtime, handle);
}

test("a press that opens a dialog keeps the dialog's controls as its effect", async () => {
  const effect = await pressedEffect("Serves 4");
  assert.equal((effect.added as string[]).length, 3, `the dialog's three controls: ${JSON.stringify(effect)}`);
  assert.equal(webAutomationRouteEffectHolds(effect, await routeStateOf(kitchen({ dialog: true, listed: false, panel: false }))), true, "the dialog is open");
  assert.equal(webAutomationRouteEffectHolds(effect, await routeStateOf(kitchen({ dialog: false, listed: false, panel: false }))), false, "the dialog is closed");
});

test("a press whose panel answers it keeps the panel's controls beside the count it raised, so an add that never happened reads as not seen", async () => {
  const effect = await pressedEffect("Add to shopping list");
  assert.equal((effect.added as string[]).length, 4, `the count and the panel's three controls: ${JSON.stringify(effect)}`);
  assert.equal(webAutomationRouteEffectSeen(effect, await routeStateOf(kitchen({ dialog: false, listed: true, panel: true }))), "seen");
  assert.equal(webAutomationRouteEffectSeen(effect, await routeStateOf(kitchen({ dialog: false, listed: false, panel: false }))), "not_seen");
});
