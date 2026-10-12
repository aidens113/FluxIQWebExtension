// `web.dom.check` on a control the page draws itself, on the real crossborder
// item page (t364). Lane A round 5 (`run-muz0f12h-eae63685`) stopped here: the
// colour swatches are `<div>`s, Space Grey arrives chosen and is shown only by
// a class the other swatches lack, a click toggles it off, and `check` refused
// it as not a checkbox, so no step could say "Space Grey, chosen" and be right
// however the page arrived. The oracle is the Scenario Lab's own server state
// (the cart) and the option group's label, never the reply alone.
//
// Selectors are written by hand in the first two rows: they prove the verb on
// this page, not how a model addresses the controls. The last row goes the
// whole way a saved step goes (t436).

import type { Page } from "@playwright/test";
import type { JsonObject } from "fluxiq/core";
import { normalizeAutomationStudioElementTarget } from "fluxiq/automation-studio";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_RUN_NODE_TOOL_ID, type WebLlmEvidenceGateway } from "@fluxiq-web-extension/domain";
import { outputTargetFromPayload, webAutomationActionFromGatewayCommand, webAutomationOutputNodeId } from "@fluxiq-web-extension/domain/client";
import type { BrowserActionCommand, BrowserActionResult } from "../../../../../src/shared/protocol.js";
import { marketClasses } from "../../../../../../scenario-lab/src/scenarios/crossborder-marketplace/styles/index.js";
import { expect, test } from "../../../index.js";

const market = marketClasses(7342, "baseline");
const OFFICIAL = "1005008123450";

type MarketState = { cart: Array<{ listingId: string; choice: { color: string; spec: string; origin: string }; quantity: number }> };

const actualOf = (reply: BrowserActionResult): string => (reply.validation.status === "none" ? "" : reply.validation.actual);

/** An exact CSS path, by child position from the body, to the option in the group whose label starts with `group`, titled or worded `value`. */
async function optionPath(page: Page, group: string, value: string): Promise<string> {
  const classes = { skuGroup: market.skuGroup, skuLabel: market.skuLabel, swatches: market.swatches };
  const path = await page.evaluate(({ names, groupName, optionValue }) => {
    const option = Array.from(document.querySelectorAll(`.${names.skuGroup}`))
      .filter((g) => (g.querySelector(`.${names.skuLabel}`)?.textContent ?? "").startsWith(groupName))
      .flatMap((g) => Array.from(g.querySelector(`.${names.swatches}`)?.children ?? []))
      .find((o) => (o.getAttribute("title") ?? o.textContent ?? "").trim() === optionValue);
    if (!option) return null;
    const parts: string[] = [];
    for (let node: Element | null = option; node && node !== document.body; node = node.parentElement) {
      parts.unshift(`${node.tagName.toLowerCase()}:nth-child(${Array.from(node.parentElement!.children).indexOf(node) + 1})`);
    }
    return `body > ${parts.join(" > ")}`;
  }, { names: classes, groupName: group, optionValue: value });
  if (!path) throw new Error(`no ${group} option ${value}`);
  return path;
}

/** The chosen value the option group's own label shows. */
async function shownChoice(page: Page, group: string): Promise<string> {
  return await page.evaluate(({ skuLabel, groupName }) => {
    const label = Array.from(document.querySelectorAll(`.${skuLabel}`)).find((l) => (l.textContent ?? "").startsWith(groupName));
    return label?.querySelector("b")?.textContent ?? "";
  }, { skuLabel: market.skuLabel, groupName: group });
}

test("crossborder: check on the preselected Space Grey swatch presses nothing, check on Silver chooses it once, and choices set by check reach the cart", async ({ openHarness, page }) => {
  test.setTimeout(120_000);
  const harness = await openHarness("crossborder-marketplace");
  const state = async (): Promise<MarketState> => (await harness.finalState()).state as unknown as MarketState;
  await page.goto(new URL(`/scenarios/crossborder-marketplace/item/${OFFICIAL}`, harness.lab.origin).href);
  // A first visit raises the chat pill, the welcome coupons and consent; the verb's
  // defence closes what covers a swatch, and its result then says so after the verdict.
  await expect(page.locator(`.${market.chatPill}`)).toBeVisible({ timeout: 6_000 });
  expect(await shownChoice(page, "Color")).toBe("Space Grey");

  const spaceGrey = await optionPath(page, "Color", "Space Grey");
  const already = await harness.runAction({ commandId: "grey-already", actionType: "web.dom.check", selector: spaceGrey, checked: true });
  expect(already.status, actualOf(already)).toBe("succeeded");
  expect(already.validation).toMatchObject({ status: "passed", expected: "the option is chosen", actual: expect.stringMatching(/^the option is chosen \(drawn apart from the like options beside it\)/u) });
  expect(already.message).toBe("Option already chosen; nothing pressed.");
  expect(await shownChoice(page, "Color"), "a press would have un-chosen it").toBe("Space Grey");

  const silver = await optionPath(page, "Color", "Silver");
  const chosen = await harness.runAction({ commandId: "silver", actionType: "web.dom.check", selector: silver, checked: true });
  expect(chosen.status, actualOf(chosen)).toBe("succeeded");
  expect(chosen.validation).toMatchObject({ status: "passed", actual: expect.stringMatching(/^the option is chosen \(drawn apart from the like options beside it\)/u) });
  expect(await shownChoice(page, "Color")).toBe("Silver");
  const replay = await harness.runAction({ commandId: "silver-again", actionType: "web.dom.check", selector: silver, checked: true });
  expect(replay.message, actualOf(replay)).toBe("Option already chosen; nothing pressed.");
  expect(await shownChoice(page, "Color"), "the replay toggled nothing").toBe("Silver");

  // Round 5's trial, with every choice written as desired state.
  for (const [group, value] of [["Color", "Space Grey"], ["Specification", "7-in-1"], ["Ships From", "Spain"]] as const) {
    const reply = await harness.runAction({ commandId: `choose-${value}`, actionType: "web.dom.check", selector: await optionPath(page, group, value), checked: true });
    expect(reply.status, `choose ${value}: ${actualOf(reply)}`).toBe("succeeded");
    expect(await shownChoice(page, group)).toBe(value);
  }
  const added = await harness.runAction({ commandId: "add", actionType: "web.dom.click", selector: `[data-testid="add-to-cart"]` });
  expect(added.status, actualOf(added)).toBe("succeeded");
  await expect.poll(async () => (await state()).cart.map((line) => `${line.choice.color} · ${line.choice.spec} · ${line.choice.origin}`), { timeout: 5_000 }).toEqual(["Space Grey · 7-in-1 · Spain"]);
});

test("crossborder: check on a control that shows no chosen state is refused with a sentence saying so, and presses nothing", async ({ openHarness, page }) => {
  test.setTimeout(90_000);
  const harness = await openHarness("crossborder-marketplace");
  const state = async (): Promise<MarketState> => (await harness.finalState()).state as unknown as MarketState;
  await page.goto(new URL(`/scenarios/crossborder-marketplace/item/${OFFICIAL}`, harness.lab.origin).href);
  await expect(page.locator(`.${market.chatPill}`)).toBeVisible({ timeout: 6_000 });
  const refused = await harness.runAction({ commandId: "add-as-check", actionType: "web.dom.check", selector: `[data-testid="add-to-cart"]`, checked: true });
  expect(refused.status, actualOf(refused)).toBe("failed");
  expect(refused.failure).toMatchObject({ code: "web.action.rejected", retryable: false });
  expect(refused.failure?.actual).toMatch(/^not_checkable: <div> shows no chosen state to read/u);
  await page.waitForTimeout(1_000);
  expect((await state()).cart, "nothing was pressed").toEqual([]);
});

/** Why a reply failed or what its check read: the failure record's words first. */
const whyNot = (reply: BrowserActionResult): string => reply.failure?.actual ?? actualOf(reply);

/** Waits for a document to finish loading and the content script to announce itself in it. */
async function contentReady(page: Page): Promise<void> {
  await page.waitForLoadState("load");
  await expect.poll(async () => await page.evaluate(() => {
    const stub = (window as unknown as Record<string, { sent: Array<{ type?: string }> } | undefined>).__fluxiqContentHarness;
    return stub?.sent.some((message) => message.type === "fluxiq.contentReady") ?? false;
  }).catch(() => false), { timeout: 15_000, message: "the content script announced itself in the new document" }).toBe(true);
}

/** The command a saved check step's dispatch hands the content script: Core's normalizer, the wire target, the gateway mapping. */
function dispatchedCheck(commandId: string, parameters: JsonObject): BrowserActionCommand {
  const prepared: JsonObject = Object.assign({}, parameters);
  const target = normalizeAutomationStudioElementTarget(parameters, { source: "runtime" });
  if (target) prepared.target = target as unknown as JsonObject;
  const command = webAutomationActionFromGatewayCommand({ commandId, actionType: "web.dom.check", parameters: prepared, target: outputTargetFromPayload(prepared) ?? {} });
  if ("status" in command) throw new Error(`the command was refused: ${JSON.stringify(command)}`);
  return command as BrowserActionCommand;
}

/** The id the page drew this view for the option group whose label starts with `group`. */
async function groupId(page: Page, group: string): Promise<string> {
  const id = await page.evaluate(({ skuGroup, skuLabel, groupName }) => Array.from(document.querySelectorAll(`.${skuGroup}`))
    .find((g) => (g.querySelector(`.${skuLabel}`)?.textContent ?? "").startsWith(groupName))?.id ?? "", { skuGroup: market.skuGroup, skuLabel: market.skuLabel, groupName: group });
  expect(id, `the ${group} group carries an id`).toMatch(/^fb[0-9a-z]+$/u);
  return id;
}

/** The page view's handle for the one chosen chip worded `value`. */
function chosenChipHandles(view: string, value: string): string[] {
  return view.split("\n").flatMap((line) => {
    const match = /^(t\d+) clickable "(.*)" marked$/u.exec(line);
    return match && match[2] === value ? [match[1]!] : [];
  });
}

// R4a attempt 4 (`run-mv4912r9-53b05a51`, `reports/r4a-4-saved-chip-not-
// found.md`): the item page draws its option groups' ids again on every view,
// every chip of a picker shares one class, and the chosen chip alone carries
// another. A chip saved on one view was looked up on the next by its class set,
// which answered with the first chip -- 4-in-1 -- whatever was saved; the veto
// refused it, the chip's words were never asked, and the step failed "couldn't
// find it where it was saved" with the chip in plain view. Here each chip is
// saved the way a build saves it (the page view's handle, resolved into the
// step's parameters), while chosen, on one view; then a fresh view, where
// 4-in-1 and China are chosen, must choose exactly the saved chip. The run's own
// dispatched fingerprints follow on another fresh view, their classes and shape
// verbatim, anchored on the exploration view's group ids as the run's were on
// its own.
test("crossborder: option chips saved on one page view are chosen on a fresh one, by what was saved, and the first chip of the class never is", async ({ openHarness, page }) => {
  test.setTimeout(150_000);
  const harness = await openHarness("crossborder-marketplace");
  const itemUrl = new URL(`/scenarios/crossborder-marketplace/item/${OFFICIAL}`, harness.lab.origin).href;
  await page.goto(itemUrl);
  await contentReady(page);
  await expect(page.locator(`.${market.chatPill}`)).toBeVisible({ timeout: 6_000 });

  // Exploration: 7-in-1 and Spain chosen, so each is saved while the page draws it chosen.
  for (const [group, value] of [["Specification", "7-in-1"], ["Ships From", "Spain"]] as const) {
    const reply = await harness.runAction({ commandId: `explore-${value}`, actionType: "web.dom.check", selector: await optionPath(page, group, value), checked: true });
    expect(reply.status, `choose ${value}: ${actualOf(reply)}`).toBe("succeeded");
    expect(await shownChoice(page, group)).toBe(value);
  }
  const anchors = { specification: await groupId(page, "Specification"), origin: await groupId(page, "Ships From") };

  const base = { projectId: "project.t436", flowId: "flow.t436", maxEvidenceBytes: 64_000 } as const;
  let looks = 0;
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.t436"],
    executeAction: async (_sessionId, request) => {
      const reply = await harness.runAction({ commandId: `t436.look.${++looks}`, actionType: request.actionType, ...request.parameters } as BrowserActionCommand);
      const snapshot = reply.snapshot === undefined ? undefined : JSON.parse(JSON.stringify(reply.snapshot)) as JsonObject;
      return { status: reply.status, ...(snapshot ? { payload: { snapshot } } : {}) };
    }
  };
  const runtime = createWebAutomationLlmEvidenceRuntime(gateway);
  const looked = await runtime.executeTool({ ...base, callId: "call.look", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-capture_snapshot", parameters: {}, consequences: [] } });
  const view = (looked.evidence as { page?: string }).page ?? "";
  const saved = new Map<string, JsonObject>();
  for (const value of ["7-in-1", "Spain"]) {
    const handles = chosenChipHandles(view, value);
    expect(handles, `the page view prints one chosen chip "${value}"`).toHaveLength(1);
    const resolution = await runtime.resolvePlanNodeParameters({ ...base, nodeDefinitionId: webAutomationOutputNodeId("web.dom.check"), parameters: { selector: { handle: handles[0]! }, checked: true }, declaredConsequences: [] });
    expect(resolution.status, JSON.stringify(resolution)).toBe("resolved");
    const parameters = resolution.status === "resolved" ? resolution.parameters : {};
    // The class only the chosen chip carries is its state, and is not saved.
    expect(parameters.element, `${value} is saved by its words and its own class`).toMatchObject({ tagName: "div", visibleText: value, classNames: [market.chipOption] });
    saved.set(value, parameters);
  }

  // A fresh view: new group ids, 4-in-1 and China chosen.
  await page.goto(itemUrl);
  await contentReady(page);
  for (const id of Object.values(anchors)) await expect(page.locator(`#${id}`), "the exploration view's group id names nothing on this view").toHaveCount(0);
  expect(await shownChoice(page, "Specification")).toBe("4-in-1");
  expect(await shownChoice(page, "Ships From")).toBe("China");
  for (const [group, value] of [["Specification", "7-in-1"], ["Ships From", "Spain"]] as const) {
    const reply = await harness.runAction(dispatchedCheck(`saved-${value}`, saved.get(value)!));
    expect(reply.status, `saved ${value}: ${whyNot(reply)}`).toBe("succeeded");
    expect(await shownChoice(page, group), `the saved ${value} chip, not the first of its class`).toBe(value);
  }

  // Another fresh view, and the fingerprints the run dispatched (s9 carrying the chosen class, s10 not), on the exploration view's anchors.
  await page.goto(itemUrl);
  await contentReady(page);
  const asDispatched = [
    { group: "Specification", value: "7-in-1", selector: `#${anchors.specification} > div:nth-of-type(2) > div:nth-of-type(2)`, classNames: [market.chipOption, market.optionOn] },
    { group: "Ships From", value: "Spain", selector: `#${anchors.origin} > div:nth-of-type(2) > div:nth-of-type(2)`, classNames: [market.chipOption] }
  ] as const;
  for (const { group, value, selector, classNames } of asDispatched) {
    await expect(page.locator(selector), "the saved anchor names nothing on this view").toHaveCount(0);
    const reply = await harness.runAction({
      commandId: `dispatched-${value}`, actionType: "web.dom.check", selector, checked: true,
      element: { classNames: [...classNames], context: { landmark: "main" }, selector, tagName: "div", visibleText: value }
    } as BrowserActionCommand);
    expect(reply.status, `as dispatched ${value}: ${whyNot(reply)}`).toBe("succeeded");
    expect(await shownChoice(page, group), `the dispatched ${value} chip, not the first of its class`).toBe(value);
  }
});
