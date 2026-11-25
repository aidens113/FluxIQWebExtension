// A press is credited only with what it changed, never with what the page changed by itself
// while it was made (t1043), through the real runtime.
//
// Run `run-mww6euuw-ecdb20f8` pressed "Accept all" on a cookie banner while the home page's
// carousel turned to its next slide, as it does every few seconds. The press's statement said
// the slide's heading and text read otherwise, Core took that for a change the press made that
// stays, carried the press into the next attempt, and that attempt's judge was held unsure. The
// race is timing; here it is forced: the press and the slide's turn land between the same two looks.
// A garden centre's page stands in, unrelated to any realistic scenario.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_RUN_NODE_TOOL_ID, type WebLlmEvidenceGateway } from "../../..";
import { shownHandle } from "../../../page-view/tests/shown-page-lines";

const PROJECT = { projectId: "project.garden", flowId: "flow.garden" };
const CLICK = "web.output.dom-click";
const SNAPSHOT = "web.output.dom-capture_snapshot";
const HOME = "https://garden.test/";
const SLIDES = [["Bulbs for spring", "Plant now for colour in April."], ["Free delivery over $40", "Order by noon for next-day delivery."], ["Seed potatoes are back", "Twelve kinds, all certified."]];

type Page = { banner: boolean; slide: number; ticker: number };
type Pressed = (page: Page, control: string) => Page;

/** A home page with a cookie banner, a carousel by ARIA's carousel pattern (or the same blocks with no such markup), and a ticker. */
function stub(onPress: Pressed, options: { marked?: boolean; tickEveryLook?: boolean } = {}) {
  let page: Page = { banner: true, slide: 0, ticker: 0 };
  let looks = 0;
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.garden"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType === "web.dom.capture_snapshot") {
        looks += 1;
        if (options.tickEveryLook) page = { ...page, ticker: page.ticker + 1 };
        return { status: "succeeded", payload: { snapshot: snapshot(page, options.marked !== false) } };
      }
      if (command.actionType === "web.dom.click") page = onPress(page, String(command.parameters.selector ?? ""));
      return { status: "succeeded", payload: { value: "ok" } };
    }
  };
  return { gateway, looks: () => looks };
}

function snapshot(page: Page, marked: boolean): JsonObject {
  const [heading, text] = SLIDES[page.slide] as [string, string];
  const elements: JsonObject[] = [
    { tagName: "h2", selector: "#welcome", visibleText: "Garden centre" },
    { tagName: "section", selector: "#hero", attributes: marked ? { "aria-roledescription": "carousel", id: "hero" } : { id: "hero" } },
    { tagName: "h1", selector: "#hero h1", visibleText: heading, parent: 1 },
    { tagName: "p", selector: "#hero p", visibleText: text, parent: 1 },
    { tagName: "button", selector: "#hero .next", visibleText: "Next slide", parent: 1, attributes: { "aria-controls": "hero" } },
    { tagName: "span", selector: "#ticker", visibleText: `Visitors today: ${100 + page.ticker * 7} people` },
    { tagName: "button", selector: "#basket", visibleText: "Basket" }
  ];
  if (page.banner) elements.push({ tagName: "div", selector: "#cookies", visibleText: "We use cookies to run this site." }, { tagName: "button", selector: "#accept", visibleText: "Accept all" });
  return { url: HOME, title: "Garden centre", viewport: { width: 1000, height: 1000, scrollX: 0, scrollY: 0 }, interactiveElements: elements, evidence: { navigation: { timeOrigin: 1 } } };
}

const turn = (page: Page): Page => ({ ...page, slide: (page.slide + 1) % SLIDES.length });

async function look(runtime: ReturnType<typeof createWebAutomationLlmEvidenceRuntime>) {
  return runtime.executeTool({ ...PROJECT, callId: `call.look.${Math.random()}`, toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: SNAPSHOT, parameters: {}, consequences: [] } });
}

async function press(runtime: ReturnType<typeof createWebAutomationLlmEvidenceRuntime>, handle: string) {
  return runtime.executeTool({ ...PROJECT, callId: `call.press.${handle}.${Math.random()}`, toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: CLICK, parameters: { target: { handle } }, consequences: [] } });
}

test("a press made while the page's carousel turns is credited only with its own effect", async () => {
  // The banner goes with the press, and the carousel turns between the same two looks.
  const runtime = createWebAutomationLlmEvidenceRuntime(stub((page, control) => (control === "#accept" ? turn({ ...page, banner: false }) : page)).gateway);
  const looked = await look(runtime);
  const pressed = await press(runtime, shownHandle(looked.evidence, "Accept all"));
  assert.equal(pressed.resultCode, "web.action.succeeded");
  const evidence = pressed.evidence as JsonObject;
  assert.equal(evidence.pageChanged, true);
  // Core reads only what the press did: the banner went. Nothing reads otherwise, so nothing is a change that stays.
  const stated = pressed.draft?.changed ?? [];
  assert.deepEqual(stated.map((line) => line.how), ["went"]);
  assert.match(stated[0]!.words, /We use cookies/u);
  // The model still sees the slide turn, as the page's own, after what the press did.
  const changed = evidence.changed as string[];
  assert.match(changed[0]!, /We use cookies.* gone$/u);
  assert.ok(changed.some((entry) => /"Free delivery over \$40" was "Bulbs for spring" \(changes by itself\)$/u.test(entry)), changed.join("\n"));
  assert.ok(changed.findIndex((entry) => entry.includes("(changes by itself)")) > changed.findIndex((entry) => entry.includes("gone")));
});

test("a press that changed nothing while the carousel turned had no effect", async () => {
  const runtime = createWebAutomationLlmEvidenceRuntime(stub((page, control) => (control === "#basket" ? turn(page) : page)).gateway);
  const looked = await look(runtime);
  const pressed = await press(runtime, shownHandle(looked.evidence, "Basket"));
  const evidence = pressed.evidence as JsonObject;
  assert.equal(evidence.status, "no_effect");
  assert.equal(pressed.draft?.changed, undefined);
});

test("a press on the carousel's own control is credited with the slide it turned", async () => {
  const runtime = createWebAutomationLlmEvidenceRuntime(stub((page, control) => (control === "#hero .next" ? turn(page) : page)).gateway);
  const looked = await look(runtime);
  const pressed = await press(runtime, shownHandle(looked.evidence, "Next slide"));
  assert.equal((pressed.evidence as JsonObject).status, "succeeded");
  assert.deepEqual((pressed.draft?.changed ?? []).map((line) => line.how), ["reads", "reads"]);
  assert.doesNotMatch(((pressed.evidence as JsonObject).changed as string[]).join("\n"), /changes by itself/u);
});

test("with no markup, a line the run has twice seen change with nothing done is the page's own", async () => {
  // The ticker moves on every look; the slides carry no carousel markup. Each press also takes the banner's place in turn.
  const stubbed = stub((page, control) => (control === "#accept" ? { ...page, banner: false } : control === "#basket" ? { ...page, banner: true } : page), { marked: false, tickEveryLook: true });
  const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);
  const ticker = /Visitors today/u;
  let shown = await look(runtime);
  // First press: the ticker has moved once with nothing done (the look, then the press's own look before it), so it still counts.
  shown = await press(runtime, shownHandle(shown.evidence, "Accept all"));
  assert.ok((shown.draft?.changed ?? []).some((line) => ticker.test(line.words) && line.how === "rose"), JSON.stringify(shown.draft?.changed));
  // Second press: seen moving by itself a second time, it is now the page's own.
  shown = await press(runtime, shownHandle(shown.evidence, "Basket"));
  const stated = shown.draft?.changed ?? [];
  assert.equal(stated.some((line) => ticker.test(line.words)), false, JSON.stringify(stated));
  assert.ok(stated.some((line) => /We use cookies/u.test(line.words) && line.how === "appeared"), JSON.stringify(stated));
  assert.ok(((shown.evidence as JsonObject).changed as string[]).some((entry) => ticker.test(entry) && entry.endsWith("(changes by itself)")));
});
