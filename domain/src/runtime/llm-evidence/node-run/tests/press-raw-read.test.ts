// A press never hands the model the extension's raw page.
//
// Live run `run-mup2i28c-6c7fc209`, the `dismiss.privacy` press: the click came
// back with the sanitized packet (316 elements) and, as its `read`, the
// extension's whole click payload -- its raw `snapshot` of the same 316
// elements with xpaths, class names and attributes, the clicked `element`, the
// `resolution` and the `visualTarget`. Every later decision carried the page
// twice, and the raw copy was the one path by which markup reached a decision.
// The stub page below answers a click the way the extension does.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_RUN_NODE_TOOL_ID, type WebLlmEvidenceGateway } from "../..";
import { webNodeWithoutPageRecord } from "../page-record";

const PROJECT = { projectId: "project.privacy", flowId: "flow.privacy" };
const ORIGIN = "https://store.test";
const HOME = `${ORIGIN}/`;
const CLICK = "web.output.dom-click";
const SNAPSHOT = "web.output.dom-capture_snapshot";
const NAVIGATE = "web.output.browser-navigate";
const EXTRACT = "web.output.dom-extract";
/** Markup only the raw payload carries: none of it may reach the model. */
const RAW_XPATH = "/html/body/div[9]/div[2]/button[1]";
const RAW_CLASS = "css-0yh3pb0-raw-only";
/** A link the raw snapshot lists and the sanitized packet never shows. */
const RAW_ONLY_LINK = "/raw-only/secret-route/12345";
const VALIDATION = { status: "passed", expected: "the click lands on the target or something inside it", actual: "the point 509,430 landed on the target" };

type Packet = JsonObject & { elements: Array<{ target: string; text?: string; name?: string }>; read?: JsonObject; control?: string; status?: string; pageChanged?: boolean };

/** The page as the extension's raw snapshot holds it: selectors, xpaths, classes, attributes. */
function rawPage(bannerOpen: boolean, rawOnlyLink: boolean): JsonObject {
  const elements: JsonObject[] = [
    { tagName: "a", selector: "#deals", xpath: "/html/body/nav/a[1]", classNames: ["nav-link"], accessibleName: "Deals", href: "/deals", bounds: { x: 1, y: 1, width: 10, height: 10 } },
    { tagName: "input", selector: "#q", xpath: "/html/body/header/input", classNames: ["search"], inputType: "search", accessibleName: "Search", bounds: { x: 1, y: 20, width: 10, height: 10 } }
  ];
  if (bannerOpen) {
    elements.push({ tagName: "button", selector: "#privacy-ok", xpath: RAW_XPATH, classNames: [RAW_CLASS], attributes: { "data-testid": "privacy-accept", type: "button" }, visibleText: "Accept", bounds: { x: 1, y: 40, width: 10, height: 10 } });
  }
  // Present only in the snapshot the click returns, never in a look: an address
  // the model is not shown once the raw copy stays out of its read.
  if (rawOnlyLink) elements.push({ tagName: "a", selector: "#hidden", xpath: "/html/body/div[3]/a", classNames: [RAW_CLASS], accessibleName: "Hidden", href: RAW_ONLY_LINK, bounds: { x: 1, y: 80, width: 10, height: 10 } });
  return { url: HOME, title: "Store", viewport: { width: 100, height: 100, scrollX: 0, scrollY: 0 }, interactiveElements: elements, focusedElement: { selector: "#privacy-ok", xpath: RAW_XPATH } };
}

/** A store whose privacy banner a click dismisses, answering the click as the extension does. */
function store() {
  let location: string | undefined;
  let bannerOpen = true;
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType === "web.browser.navigate") {
        location = String(command.parameters.url);
        return { status: "succeeded", payload: { url: location } };
      }
      if (command.actionType === "web.dom.capture_snapshot") {
        return location === undefined
          ? { status: "failed", error: "Browser and extension pages cannot be automated." }
          : { status: "succeeded", payload: { snapshot: rawPage(bannerOpen, false) } };
      }
      if (command.actionType === "web.dom.click") {
        bannerOpen = false;
        return {
          status: "succeeded",
          payload: {
            commandId: "command.click",
            actionType: "web.dom.click",
            status: "succeeded",
            validation: VALIDATION,
            url: location ?? HOME,
            title: "Store",
            element: { tagName: "button", selector: "#privacy-ok", xpath: RAW_XPATH, classNames: [RAW_CLASS] },
            snapshot: rawPage(false, true),
            resolution: { strategy: "selector", selector: "#privacy-ok", xpath: RAW_XPATH, matched: 1 },
            visualTarget: { namespace: "web", statePath: "web.elements.privacy-ok", selector: "#privacy-ok" },
            startedAt: 1,
            finishedAt: 2
          }
        };
      }
      if (command.actionType === "web.dom.extract") {
        return {
          status: "succeeded",
          payload: {
            validation: { status: "passed", expected: "a value is read", actual: "read" },
            extracted: { name: "Deals", url: "/deals/today" },
            element: { tagName: "a", selector: "#deals", xpath: "/html/body/nav/a[1]", classNames: [RAW_CLASS] },
            snapshot: rawPage(false, true),
            resolution: { strategy: "selector", selector: "#deals", xpath: RAW_XPATH, matched: 1 }
          }
        };
      }
      return { status: "succeeded" };
    }
  };
  return { runtime: createWebAutomationLlmEvidenceRuntime(gateway) };
}

function call(site: ReturnType<typeof store>, callId: string, node: string, parameters: JsonObject) {
  return site.runtime.executeTool({ ...PROJECT, callId, toolId: WEB_LLM_RUN_NODE_TOOL_ID, startLocation: HOME, value: { node, parameters, consequences: [] } });
}

/** Arrive at the store and look, returning the look's packet. */
async function arriveAndLook(site: ReturnType<typeof store>): Promise<Packet> {
  const opening = await call(site, "initial.core.run_node", SNAPSHOT, {});
  assert.equal(opening.resultCode, "web.action.rejected.not_at_start_location");
  assert.equal((await call(site, "call.start", NAVIGATE, { url: HOME })).resultCode, "web.action.succeeded");
  return (await call(site, "call.look", SNAPSHOT, {})).evidence as Packet;
}

function handleOf(packet: Packet, text: string): string {
  const element = packet.elements.find((candidate) => candidate.text === text || candidate.name === text);
  assert.ok(element, `${text} is in the packet`);
  return element.target;
}

test("a click whose payload carries the raw snapshot returns no snapshot, element, resolution or visual target to the model", async () => {
  const site = store();
  const looked = await arriveAndLook(site);
  const pressed = await call(site, "call.dismiss", CLICK, { target: { handle: handleOf(looked, "Accept") } });

  assert.equal(pressed.resultCode, "web.action.succeeded");
  const packet = pressed.evidence as Packet;
  for (const key of ["snapshot", "element", "resolution", "visualTarget", "structure"]) {
    assert.equal(packet.read !== undefined && Object.hasOwn(packet.read, key), false, `read carries no ${key}`);
  }
  // Nowhere in what the model is shown, not just not under `read`.
  const shown = JSON.stringify(pressed.evidence);
  assert.equal(shown.includes(RAW_XPATH), false, "no raw xpath");
  assert.equal(shown.includes(RAW_CLASS), false, "no raw class name");
  assert.equal(shown.includes(RAW_ONLY_LINK), false, "no element only the raw snapshot listed");
  assert.equal(shown.includes("interactiveElements"), false, "no raw element list");

  // What the press says about itself is still there.
  assert.equal(packet.status, "succeeded");
  assert.equal(packet.pageChanged, true);
  assert.equal(packet.control, "Accept");
  assert.deepEqual(packet.read?.validation, VALIDATION);
  assert.equal(packet.read?.url, HOME);
  // And the page, sanitized, with the banner gone.
  assert.equal(packet.elements.some((element) => element.text === "Accept"), false);
  assert.equal(packet.elements.some((element) => element.name === "Search"), true);

  // The replay's record is the payload as the node answered it: unchanged.
  assert.equal(pressed.draft?.proposes, true);
  assert.deepEqual(pressed.draft?.replay?.from, { location: HOME });
  assert.deepEqual(pressed.draft?.replay?.produced, { records: (rawPage(false, true).interactiveElements as unknown[]).length });
});

test("a read node's own answer is still shown whole, without the page record it came with", async () => {
  const site = store();
  const looked = await arriveAndLook(site);
  const read = await call(site, "call.read", EXTRACT, { target: { handle: handleOf(looked, "Deals") } });

  assert.equal(read.resultCode, "web.inspect.succeeded");
  const packet = read.evidence as Packet;
  assert.deepEqual(packet.read?.extracted, { name: "Deals", url: "/deals/today" });
  assert.deepEqual(packet.read?.validation, { status: "passed", expected: "a value is read", actual: "read" });
  assert.equal(Object.hasOwn(packet.read!, "snapshot"), false);
  assert.equal(Object.hasOwn(packet.read!, "element"), false);
  assert.equal(Object.hasOwn(packet.read!, "resolution"), false);
  assert.equal(JSON.stringify(read.evidence).includes(RAW_CLASS), false);

  // The address the read returned was shown, so it may be followed.
  assert.equal((await call(site, "call.follow", NAVIGATE, { url: `${ORIGIN}/deals/today` })).resultCode, "web.action.succeeded");
});

test("the shown-address rule counts what the model was shown after a press, and nothing only the raw copy held", async () => {
  const site = store();
  const looked = await arriveAndLook(site);
  assert.equal((await call(site, "call.dismiss", CLICK, { target: { handle: handleOf(looked, "Accept") } })).resultCode, "web.action.succeeded");

  // A link in the packet after the press was shown.
  assert.equal((await call(site, "call.deals", NAVIGATE, { url: `${ORIGIN}/deals` })).resultCode, "web.action.succeeded");
  // A link only the raw snapshot listed was never shown, so it is the model's own address.
  assert.equal((await call(site, "call.raw", NAVIGATE, { url: `${ORIGIN}${RAW_ONLY_LINK}` })).resultCode, "web.action.rejected.address_not_shown");
});

test("the page record is taken out of a payload and nothing else is", () => {
  const answer = { extracted: [{ name: "a" }], extraction: { recordCount: 1 }, validation: VALIDATION, url: HOME, dialog: { type: "alert" }, checkWait: { waitedMs: 5 } };
  assert.deepEqual(webNodeWithoutPageRecord({ ...answer, snapshot: rawPage(true, true), element: {}, visualTarget: {}, resolution: {}, structure: {} }), answer);
  // Untouched, by identity, when there is no page record in it.
  assert.equal(webNodeWithoutPageRecord(answer), answer);
  // A payload that was only the page's record is no read at all.
  assert.equal(webNodeWithoutPageRecord({ snapshot: rawPage(true, false) }), undefined);
  assert.deepEqual(webNodeWithoutPageRecord([1, 2]), [1, 2]);
  assert.equal(webNodeWithoutPageRecord(undefined), undefined);
});
