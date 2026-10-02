// A build navigates only to an address it was shown.
//
// Live run 28 (`run-munvvc3z-3eadc185`, bigbox-retail): the build never opened
// the first product's page, composed its address from that product's slug and
// the second product's item id, and navigated there. The site routes by id, so
// the Flow's "first product" step opened the second product, and the goal
// missed three facts. The stub site below is that shape: a home page that
// links to one product, a search box, and a product route read by id.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_RUN_NODE_TOOL_ID, type WebLlmEvidenceGateway } from "../..";
import { shownHandle, shownPageLines } from "../../page-view/tests/shown-page-lines";

const PROJECT = { projectId: "project.bigbox", flowId: "flow.bigbox" };
const ORIGIN = "https://store.test";
const START = `${ORIGIN}/scenarios/bigbox-retail/`;
/** The product the home page links to. */
const SHOWN_ITEM = `${ORIGIN}/scenarios/bigbox-retail/ip/kitchen-napkins/418831402`;
/** The address run 28 composed: the other product's slug with the shown product's id. */
const MADE_UP_ITEM = `${ORIGIN}/scenarios/bigbox-retail/ip/paper-towels/418831402`;
const SEARCH = `${ORIGIN}/scenarios/bigbox-retail/search`;
/** A step of the saved Flow whose address no page in this stub shows. */
const FLOW_ITEM = `${ORIGIN}/scenarios/bigbox-retail/ip/paper-towels/418830127`;
const NAVIGATE = "web.output.browser-navigate";
const SNAPSHOT = "web.output.dom-capture_snapshot";
const CLICK = "web.output.dom-click";
const TYPE = "web.output.dom-type";

type Call = { node: string; parameters: JsonObject };

test("a navigation to an item address no evidence showed is refused, and nothing is dispatched", async () => {
  const site = bigbox();
  await arrive(site);

  const went = await call(site, "call.made-up", { node: NAVIGATE, parameters: { url: MADE_UP_ITEM } });

  assert.equal(went.resultCode, "web.action.rejected.address_not_shown");
  assert.equal(went.effectApplied, false);
  const refusal = went.evidence as JsonObject & { code: string; detail: { reason: string; instead: string[] }; page?: { location: string; page: string } };
  assert.equal(refusal.code, "address_not_shown");
  assert.equal(refusal.detail.reason, "address_not_shown");
  // What to do instead, in this domain's words: press the link, or use an address the evidence gave.
  assert.equal(refusal.detail.instead.length, 2);
  assert.match(refusal.detail.instead[0]!, /web\.output\.dom-click/u);
  // The page comes back, so the link that does go there can be pressed next.
  assert.equal(refusal.page?.location, START);
  // The link with its query, as the packet now shows it (t200).
  assert.equal(shownPageLines(refusal).some((line) => line.line.includes("?variant=1")), true, refusal.page?.page);
  // Refused before the command went out, and never a step of the Flow.
  assert.equal(site.navigations().includes(MADE_UP_ITEM), false);
  assert.equal(went.draft?.ranWith, undefined);
});

test("a shown link's address, the start location and the page already open are all allowed", async () => {
  const site = bigbox();
  await arrive(site);

  const linked = await call(site, "call.linked", { node: NAVIGATE, parameters: { url: SHOWN_ITEM } });
  assert.equal(linked.resultCode, "web.action.succeeded");
  // Back to where the Flow starts, written without its trailing slash.
  const home = await call(site, "call.home", { node: NAVIGATE, parameters: { url: START.slice(0, -1) } });
  assert.equal(home.resultCode, "web.action.succeeded");
  // The item page was visited, so going back to it is going back, not guessing.
  const again = await call(site, "call.again", { node: NAVIGATE, parameters: { url: `${SHOWN_ITEM}#reviews` } });
  assert.equal(again.resultCode, "web.action.succeeded");
  assert.deepEqual(site.navigations(), [START, SHOWN_ITEM, START.slice(0, -1), `${SHOWN_ITEM}#reviews`]);
});

test("a shown link's own query may be navigated to, since the packet shows it (t200)", async () => {
  const site = bigbox();
  await arrive(site);

  const linked = await call(site, "call.linked-query", { node: NAVIGATE, parameters: { url: `${SHOWN_ITEM}?variant=1` } });
  assert.equal(linked.resultCode, "web.action.succeeded");
  const other = await call(site, "call.other-query", { node: NAVIGATE, parameters: { url: `${SHOWN_ITEM}?variant=2` } });
  assert.equal(other.resultCode, "web.action.rejected.address_not_shown");
  assert.deepEqual(site.navigations(), [START, `${SHOWN_ITEM}?variant=1`]);
});

test("a query the build never met is refused, even on a path it was shown", async () => {
  const site = bigbox();
  await arrive(site);

  // The packet shows the item's path and never a query, so a query is the model's own.
  const sized = await call(site, "call.sized", { node: NAVIGATE, parameters: { url: `${SHOWN_ITEM}?variant=2` } });
  assert.equal(sized.resultCode, "web.action.rejected.address_not_shown");
  // A search the build did not perform is a search address it composed.
  const searched = await call(site, "call.searched", { node: NAVIGATE, parameters: { url: `${SEARCH}?q=paper+towels` } });
  assert.equal(searched.resultCode, "web.action.rejected.address_not_shown");
});

test("a site search the build performed may be run again with other words, and only that", async () => {
  const site = bigbox();
  await arrive(site);
  const looked = await call(site, "call.look", { node: SNAPSHOT, parameters: {} });
  const box = handleOf(looked, "Search");
  const go = handleOf(looked, "Go");
  assert.equal((await call(site, "call.type", { node: TYPE, parameters: { target: { handle: box }, text: "paper towels" } })).resultCode, "web.action.succeeded");
  assert.equal((await call(site, "call.press", { node: CLICK, parameters: { target: { handle: go } } })).resultCode, "web.action.succeeded");
  assert.equal(site.location(), `${SEARCH}?q=paper+towels&store=12`);

  // Same path, same keys, the typed words replaced and the store kept: the same search, for other words.
  const napkins = await call(site, "call.napkins", { node: NAVIGATE, parameters: { url: `${SEARCH}?store=12&q=napkins` } });
  assert.equal(napkins.resultCode, "web.action.succeeded");
  // A key the search never had, or a changed value the build did not type, is not that search.
  const sorted = await call(site, "call.sorted", { node: NAVIGATE, parameters: { url: `${SEARCH}?q=napkins&store=12&sort=price` } });
  assert.equal(sorted.resultCode, "web.action.rejected.address_not_shown");
  const otherStore = await call(site, "call.other-store", { node: NAVIGATE, parameters: { url: `${SEARCH}?q=napkins&store=13` } });
  assert.equal(otherStore.resultCode, "web.action.rejected.address_not_shown");
});

test("an address a read gave back may be navigated to, query and all", async () => {
  const site = bigbox({ readRows: [{ name: "Paper towels", url: "/scenarios/bigbox-retail/ip/paper-towels/418830127?variant=2" }] });
  await arrive(site);
  const read = await call(site, "call.read", { node: "web.output.dom-wait_for_text", parameters: { text: "Napkins" } });
  assert.equal(read.resultCode, "web.inspect.succeeded");

  const went = await call(site, "call.row", { node: NAVIGATE, parameters: { url: `${ORIGIN}/scenarios/bigbox-retail/ip/paper-towels/418830127?variant=2` } });
  assert.equal(went.resultCode, "web.action.succeeded");
});

test("a replay of a saved step navigates where the step says, as it always did", async () => {
  const site = bigbox();
  const replayed = await site.runtime.executeTool({
    ...PROJECT, callId: "dryrun.1.2", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: async () => ({ permitted: true as const }),
    value: { replay: "step", node: NAVIGATE, parameters: { url: MADE_UP_ITEM }, consequences: [] }
  });
  assert.equal(replayed.resultCode, "core.replay.replayed");
  assert.equal(site.navigations().includes(MADE_UP_ITEM), true);
});

test("a new build of the flow forgets what the last one was shown and searched", async () => {
  const site = bigbox();
  await arrive(site);
  const looked = await call(site, "call.look", { node: SNAPSHOT, parameters: {} });
  await call(site, "call.type", { node: TYPE, parameters: { target: { handle: handleOf(looked, "Search") }, text: "paper towels" } });
  await call(site, "call.press", { node: CLICK, parameters: { target: { handle: handleOf(looked, "Go") } } });
  const results = site.location()!;

  // The opening call of the next build re-arms the rule: this build has not
  // searched. It opens on a blank tab, because a look reads the page as it
  // stands and the results page would show this build the address itself.
  site.blank();
  await arrive(site);
  const again = await call(site, "call.results", { node: NAVIGATE, parameters: { url: results } });
  assert.equal(again.resultCode, "web.action.rejected.address_not_shown");
});

// Live run 38 (`run-muqilf9s-c3211328`, cause C8): the re-author's opening
// forgot everything the build had been shown, and its navigation to the Flow's
// own step-3 address was refused `address_not_shown` four times. A round whose
// draft holds the Flow opens with Core's look carrying the Flow's calls under
// `held`: it forgets nothing, and a held navigation's address counts as shown,
// since it passed this rule when it first ran. Nothing else is widened.
test("a round that continues the Flow may go to the Flow's own step address, from nothing remembered (run 38 C8)", async () => {
  const site = bigbox();
  site.at(START);

  const opened = await continuing(site, [{ node: NAVIGATE, parameters: { url: START } }, { node: CLICK, parameters: { target: { handle: "t1" } } }, { node: NAVIGATE, parameters: { url: FLOW_ITEM } }]);
  assert.equal(opened.resultCode, "web.inspect.succeeded");
  // A look on the page where the test left it: nothing was navigated.
  assert.deepEqual(site.navigations(), []);

  const went = await call(site, "call.flow-step", { node: NAVIGATE, parameters: { url: FLOW_ITEM } });
  assert.equal(went.resultCode, "web.action.succeeded");
  // An address neither the page nor the Flow holds is still refused.
  const madeUp = await call(site, "call.made-up", { node: NAVIGATE, parameters: { url: MADE_UP_ITEM } });
  assert.equal(madeUp.resultCode, "web.action.rejected.address_not_shown");
});

test("a round that continues the Flow forgets nothing its build was shown and searched", async () => {
  const site = bigbox();
  await arrive(site);
  const looked = await call(site, "call.look", { node: SNAPSHOT, parameters: {} });
  await call(site, "call.type", { node: TYPE, parameters: { target: { handle: handleOf(looked, "Search") }, text: "paper towels" } });
  await call(site, "call.press", { node: CLICK, parameters: { target: { handle: handleOf(looked, "Go") } } });
  const results = site.location()!;
  site.at(START);

  assert.equal((await continuing(site, [{ node: NAVIGATE, parameters: { url: START } }])).resultCode, "web.inspect.succeeded");
  const again = await call(site, "call.results", { node: NAVIGATE, parameters: { url: results } });
  assert.equal(again.resultCode, "web.action.succeeded");
});

test("held calls count only on Core's own opening look, never on a call the model names", async () => {
  const site = bigbox();
  await arrive(site);
  const held = [{ node: NAVIGATE, parameters: { url: FLOW_ITEM } }];

  for (const callId of ["call.held", "initial.model.1"]) {
    const sent = await site.runtime.executeTool({ ...PROJECT, callId, toolId: WEB_LLM_RUN_NODE_TOOL_ID, startLocation: START, value: { node: SNAPSHOT, parameters: {}, consequences: [], held } });
    assert.equal(sent.resultCode, "web.action.rejected.invalid_input", callId);
  }
  const went = await call(site, "call.flow-step", { node: NAVIGATE, parameters: { url: FLOW_ITEM } });
  assert.equal(went.resultCode, "web.action.rejected.address_not_shown");
});

// The guard remembers everything a build was shown (2026-09-30). It kept the
// newest 512 addresses, 16 typed texts and the first 256 address strings of a
// read six levels deep, so on a whole page a link the model had been shown
// could be refused as unshown.
test("every link of a page with 1,200 of them may be followed, the first as well as the last", async () => {
  const site = bigbox({ extraLinks: 1_200 });
  await arrive(site);

  const first = await call(site, "call.first", { node: NAVIGATE, parameters: { url: `${ORIGIN}${itemLink(0)}` } });
  assert.equal(first.resultCode, "web.action.succeeded");
  const last = await call(site, "call.last", { node: NAVIGATE, parameters: { url: `${ORIGIN}${itemLink(1_199)}` } });
  assert.equal(last.resultCode, "web.action.succeeded");
});

test("every address a read returned may be followed, however many and however deep", async () => {
  const deep = (index: number): JsonObject => {
    let row: JsonObject = { url: `/scenarios/bigbox-retail/ip/read-${index}/${700_000 + index}` };
    for (let level = 0; level < 10; level += 1) row = { nested: row };
    return row;
  };
  const site = bigbox({ readRows: Array.from({ length: 400 }, (_unused, index) => deep(index)) });
  await arrive(site);
  const read = await call(site, "call.read", { node: "web.output.dom-wait_for_text", parameters: { text: "Napkins" } });
  assert.equal(read.resultCode, "web.inspect.succeeded");

  const went = await call(site, "call.read-last", { node: NAVIGATE, parameters: { url: `${ORIGIN}/scenarios/bigbox-retail/ip/read-399/700399` } });
  assert.equal(went.resultCode, "web.action.succeeded");
});

/**
 * The build's opening look, then the move to the start location. The look
 * reads the page as it stands, so only the blank tab refuses it.
 */
async function arrive(site: ReturnType<typeof bigbox>): Promise<void> {
  const blank = site.location() === undefined;
  const opening = await call(site, "initial.core.run_node", { node: SNAPSHOT, parameters: {} });
  assert.equal(opening.resultCode, blank ? "web.action.rejected.not_at_start_location" : "web.inspect.succeeded");
  const went = await call(site, "call.start", { node: NAVIGATE, parameters: { url: START } });
  assert.equal(went.resultCode, "web.action.succeeded");
}

/** Core's opening look of a round whose draft already holds the Flow (`AS/runtime/llm/evidence-loop.ts`). */
function continuing(site: ReturnType<typeof bigbox>, held: Call[]) {
  return site.runtime.executeTool({ ...PROJECT, callId: "initial.core.run_node", toolId: WEB_LLM_RUN_NODE_TOOL_ID, startLocation: START, value: { node: SNAPSHOT, parameters: {}, consequences: [], held } });
}

function call(site: ReturnType<typeof bigbox>, callId: string, value: Call) {
  return site.runtime.executeTool({ ...PROJECT, callId, toolId: WEB_LLM_RUN_NODE_TOOL_ID, startLocation: START, value: { ...value, consequences: [] } });
}

function handleOf(looked: { evidence: unknown }, name: string): string {
  return shownHandle(looked.evidence, name);
}

/**
 * The store: a blank tab until a navigation, a home page linking to one
 * product, a search box whose button goes to a results address carrying the
 * typed words and the chosen store, and whatever a read is told to return.
 */
function bigbox(options: { readRows?: JsonObject[]; extraLinks?: number } = {}) {
  let location: string | undefined;
  let typed = "";
  const navigated: string[] = [];
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType === "web.browser.navigate") {
        location = String(command.parameters.url);
        navigated.push(location);
        return { status: "succeeded", payload: { url: location } };
      }
      if (command.actionType === "web.dom.capture_snapshot") {
        return location === undefined
          ? { status: "failed", error: "Browser and extension pages cannot be automated." }
          : { status: "succeeded", payload: { snapshot: page(location, options.extraLinks ?? 0) } };
      }
      if (command.actionType === "web.dom.type") {
        typed = String(command.parameters.text);
        return { status: "succeeded" };
      }
      if (command.actionType === "web.dom.click" && command.parameters.selector === "#go") {
        location = `${SEARCH}?${new URLSearchParams({ q: typed, store: "12" }).toString()}`;
        return { status: "succeeded" };
      }
      if (command.actionType === "web.dom.wait_for_text") return { status: "succeeded", payload: { rows: options.readRows ?? [] } };
      return { status: "succeeded" };
    }
  };
  return {
    runtime: createWebAutomationLlmEvidenceRuntime(gateway),
    navigations: () => [...navigated],
    location: () => location,
    /** The tab back to the blank one a browser opens on. */
    blank: () => { location = undefined; },
    /** The tab where a test of the Flow left it, with nothing dispatched. */
    at: (url: string) => { location = url; }
  };
}

/** A link to one more product, as a whole page of results shows it. */
function itemLink(index: number): string {
  return `/scenarios/bigbox-retail/ip/item-${index}/${500_000 + index}`;
}

function page(url: string, extraLinks = 0): JsonObject {
  return {
    url,
    title: "Bigbox",
    viewport: { width: 100, height: 100, scrollX: 0, scrollY: 0 },
    interactiveElements: [
      ...Array.from({ length: extraLinks }, (_unused, index) => ({ tagName: "a", selector: `#item-${index}`, accessibleName: `Item ${index}`, href: itemLink(index), bounds: { x: 1, y: 60 + index, width: 10, height: 1 } })),
      { tagName: "a", selector: "#napkins", accessibleName: "Kitchen napkins", href: "/scenarios/bigbox-retail/ip/kitchen-napkins/418831402?variant=1", bounds: { x: 1, y: 1, width: 10, height: 10 } },
      { tagName: "input", selector: "#q", inputType: "search", accessibleName: "Search", bounds: { x: 1, y: 20, width: 10, height: 10 } },
      { tagName: "button", selector: "#go", visibleText: "Go", attributes: { type: "button" }, bounds: { x: 1, y: 40, width: 10, height: 10 } }
    ]
  };
}
