// Live run 38, C2 (`run-muqilf9s-c3211328`): on Circleway's friend requests,
// styled by atomic classes, every detected column was labelled by a class path
// that means nothing, and the model mapped `mutual` to the Confirm button's
// column. Each column now carries `at`, the handle the page view gave its
// element in the list's first item, so the model can read which column says
// "1 mutual friend". The page below is that page's shape: the same class paths,
// the same field selector forms the detection writes.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject, JsonValue } from "fluxiq/core";
import {
  createWebAutomationLlmEvidenceRuntime,
  WEB_LLM_DETECT_STRUCTURE_TOOL_ID,
  WEB_LLM_RUN_NODE_TOOL_ID,
  WEB_LLM_STRUCTURE_RESULT_CODE,
  type WebAutomationLlmEvidenceRuntime,
  type WebLlmRepeatingStructure
} from "../..";
import { shownHandle, shownPageLines } from "../../page-view/tests/shown-page-lines";

const SCOPE = { projectId: "project.one", flowId: "flow.one" };
const URL_ = "http://127.0.0.1:4173/scenarios/social-network-feed/friends/requests/";
const CONTAINER = "body > div:nth-of-type(2) > div";
const BODY = "div.x0531l50.x1r2vv8.x4q0id2";

/** The detection the page answers for the requests, with the field selector forms `infer-fields.ts` writes. */
const STRUCTURE = {
  ok: true,
  proposal: {
    container: CONTAINER,
    item: `${CONTAINER} > div.x1a.xrow`,
    itemCount: 2,
    fields: [
      field("avatar_url", "a.x1cf2e2r.xu37y6r.xvzo2ll url", "link", ":scope > a.x1cf2e2r.xu37y6r.xvzo2ll", 1),
      field("name", `${BODY} > a.x0ybvghy.x130pqy.x1yfagd`, "text", `:scope > ${BODY} > a.x0ybvghy.x130pqy.x1yfagd`, 1),
      // Read by its own classes anywhere in the item, labelled by its path.
      field("mutual", `${BODY} > div.x1a4yqcp.xa73opb.xtlve1b`, "text", ":scope div.x1a4yqcp.xa73opb.xtlve1b", 1),
      field("age", `${BODY} > span.x0gwrdxv.x1ksheh.x4q0id2`, "text", `:scope > ${BODY} > span.x0gwrdxv.x1ksheh.x4q0id2`, 1),
      field("confirm", `${BODY} > div.x1507i5.x1mgzeci.xu37y6r`, "text", `:scope > ${BODY} > div.x1507i5.x1mgzeci.xu37y6r`, 1),
      // A positional step, the last resort a path takes.
      field("delete", `${BODY} > div:3`, "text", `:scope > ${BODY} > div:nth-of-type(3)`, 1),
      // Only the second request has it: nothing in the first item to point at.
      field("new_badge", "span.xbadge", "text", ":scope span.xbadge", 0.5)
    ],
    confidence: 0.75
  }
};

function field(key: string, label: string, kind: string, selector: string, coverage: number): JsonObject {
  return { key, label, spec: { kind, selector, required: coverage >= 1 }, coverage };
}

/** One request card under the container at `parent`, as the capture lists it: every rendered element, its parent by index. */
function request(elements: JsonObject[], parent: number, position: number, person: { slug: string; name: string; mutual: string; age: string; badge: boolean }): void {
  const add = (element: JsonObject): number => elements.push(element) - 1;
  const item = `${CONTAINER} > div:nth-of-type(${position})`;
  const listPosition = { index: position, total: 2 };
  const card = add({ tagName: "div", selector: item, attributes: { class: "xrow x1a" }, parent, context: { listPosition } });
  add({ tagName: "a", selector: `${item} > a`, attributes: { class: "x1cf2e2r xu37y6r xvzo2ll", href: `/people/${person.slug}/` }, parent: card, context: { listPosition } });
  const body = add({ tagName: "div", selector: `${item} > div`, attributes: { class: "x0531l50 x1r2vv8 x4q0id2" }, parent: card, context: { listPosition } });
  const inBody = `${item} > div`;
  add({ tagName: "a", selector: `${inBody} > a`, accessibleName: person.name, visibleText: person.name, attributes: { class: "x0ybvghy x130pqy x1yfagd", href: `/people/${person.slug}/` }, parent: body, context: { listPosition } });
  add({ tagName: "div", selector: `${inBody} > div:nth-of-type(1)`, visibleText: person.mutual, attributes: { class: "x1a4yqcp xa73opb xtlve1b" }, parent: body, context: { listPosition } });
  if (person.badge) add({ tagName: "span", selector: `${inBody} > span:nth-of-type(1)`, visibleText: "New", attributes: { class: "xbadge" }, parent: body, context: { listPosition } });
  add({ tagName: "span", selector: person.badge ? `${inBody} > span:nth-of-type(2)` : `${inBody} > span`, visibleText: person.age, attributes: { class: "x0gwrdxv x1ksheh x4q0id2" }, parent: body, context: { listPosition } });
  add({ tagName: "div", selector: `${inBody} > div:nth-of-type(2)`, role: "button", accessibleName: "Confirm", visibleText: "Confirm", attributes: { class: "x1507i5 x1mgzeci xu37y6r", role: "button" }, parent: body, context: { listPosition } });
  add({ tagName: "div", selector: `${inBody} > div:nth-of-type(3)`, role: "button", accessibleName: "Delete", visibleText: "Delete", attributes: { class: "x07beeli x1ksheh x4q0id2", role: "button" }, parent: body, context: { listPosition } });
}

/** The requests page; `banner` puts a notice above the list, which renumbers every element after it in a capture of its own. */
function requestsPage(banner: boolean): JsonObject[] {
  const elements: JsonObject[] = [];
  if (banner) elements.push({ tagName: "div", selector: "body > div:nth-of-type(1)", visibleText: "You have new notifications" });
  elements.push({ tagName: "h2", selector: "body > div:nth-of-type(2) > h2", visibleText: "Friend requests" });
  const container = elements.push({ tagName: "div", selector: CONTAINER, attributes: { class: "x9f619 xlist" } }) - 1;
  request(elements, container, 1, { slug: "tom.becker.9", name: "Tom Becker", mutual: "1 mutual friend", age: "2w", badge: false });
  request(elements, container, 2, { slug: "amara-osei", name: "Amara Osei", mutual: "23 mutual friends", age: "3d", badge: true });
  return elements;
}

function runtimeOver(elements: () => JsonObject[], url: () => string = () => URL_, structure: JsonObject = STRUCTURE): WebAutomationLlmEvidenceRuntime {
  return createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.one"],
    structureDetectionSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType !== "web.dom.capture_snapshot") return { status: "succeeded" };
      const snapshot: JsonObject = { url: url(), title: "Friend requests", interactiveElements: elements() };
      return { status: "succeeded", payload: command.parameters.detectStructure === undefined ? { snapshot } : { snapshot, structure: structuredClone(structure) as JsonValue } };
    }
  });
}

/** A look at the page, as the model reads it. */
async function look(runtime: WebAutomationLlmEvidenceRuntime): Promise<unknown> {
  return (await runtime.executeTool({ ...SCOPE, callId: "call.look", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-capture_snapshot", parameters: {}, consequences: [] } })).evidence;
}

async function detect(runtime: WebAutomationLlmEvidenceRuntime): Promise<WebLlmRepeatingStructure> {
  const result = await runtime.executeTool({ ...SCOPE, callId: "call.detect", toolId: WEB_LLM_DETECT_STRUCTURE_TOOL_ID, value: {} });
  assert.equal(result.resultCode, WEB_LLM_STRUCTURE_RESULT_CODE);
  return result.evidence as WebLlmRepeatingStructure;
}

/** Each field key with its `at`, absent ones left out. */
function atOf(packet: WebLlmRepeatingStructure): Record<string, string> {
  return Object.fromEntries(packet.fields.flatMap((shown) => shown.at === undefined ? [] : [[shown.key, shown.at]]));
}

/** The handles the page view gave the first request's elements, and the badge only the second request has. */
function firstRequestHandles(shown: unknown): Record<string, string> {
  const lines = shownPageLines(shown);
  const avatar = lines.find((line) => line.kind === "link" && line.words === undefined);
  assert.ok(avatar, "the avatar link has a line of its own");
  return {
    avatar_url: avatar.target,
    name: shownHandle(shown, "Tom Becker"),
    mutual: shownHandle(shown, "1 mutual friend"),
    age: shownHandle(shown, "2w"),
    confirm: shownHandle(shown, "Confirm"),
    delete: shownHandle(shown, "Delete"),
    new_badge: shownHandle(shown, "New")
  };
}

test("each detected column carries the handle the page view gave its element in the first item", async () => {
  const runtime = runtimeOver(() => requestsPage(false));
  const shown = await look(runtime);
  const packet = await detect(runtime);

  assert.deepEqual(atOf(packet), firstRequestHandles(shown));
  // The column the model mistook is told apart by what its line says.
  const mutual = packet.fields.find((shownField) => shownField.key === "mutual");
  assert.equal(mutual?.at, shownHandle(shown, "1 mutual friend"));
  assert.notEqual(mutual?.at, shownHandle(shown, "Confirm"));
  // A column the first item does not have is pointed at in the first item that has it (t195, below).
  assert.equal(packet.fields.find((shownField) => shownField.key === "new_badge")?.at, shownHandle(shown, "New"));
  assert.equal(typeof packet.atNote, "string");
  // Still no selector (D3). A value only as one column's sample from the first item (`../field-sample.ts`): never the second item's.
  const wire = JSON.stringify(packet);
  for (const words of ["Amara Osei", "23 mutual friends", "nth-of-type", ":scope", CONTAINER]) assert.equal(wire.includes(words), false, `the packet does not quote ${words}`);
  assert.equal(mutual?.sample, "1 mutual friend");
});

test("the handle is the one the model was shown, not the detection capture's own numbering", async () => {
  let banner = false;
  const runtime = runtimeOver(() => requestsPage(banner));
  const shown = await look(runtime);
  // A notice appears above the list before the detection: its own capture
  // numbers every element one later, and the model has not seen that capture.
  banner = true;
  const packet = await detect(runtime);
  assert.deepEqual(atOf(packet), firstRequestHandles(shown));
});

test("with no page shown, no column is pointed at, and the packet reads as it did", async () => {
  const unseen = await detect(runtimeOver(() => requestsPage(false)));
  assert.deepEqual(atOf(unseen), {});
  assert.equal(unseen.atNote, undefined);
  // A column's sample is read from the detection's own capture, so it needs no page shown; only `at` does.
  assert.deepEqual(unseen.fields.map((shownField) => Object.keys(shownField).filter((key) => key !== "sample")), unseen.fields.map(() => ["key", "label", "kind", "coverage"]));
});

test("a detection on another page than the one shown points at nothing", async () => {
  let url = `${URL_}sent/`;
  const runtime = runtimeOver(() => requestsPage(false), () => url);
  await look(runtime);
  url = URL_;
  const packet = await detect(runtime);
  assert.deepEqual(atOf(packet), {});
  assert.equal(packet.atNote, undefined);
});

// Live round 1002-M, R2 (`run-murwcaj0-40e56557`, step 0042): after Amara's
// request was confirmed, her card alone read "Request accepted" beside a
// Message link, and those two columns (coverage 0.13) had no `at` because the
// first card lacked them. The model could not tell which key held "Request
// accepted", filtered on the Delete column, and asked for the same detection
// three more times. A column the first item lacks is pointed at in the first
// item that has it; one no item has still points at nothing.
test("a column the first item lacks carries the handle of its element in the first item that has it", async () => {
  const proposal = STRUCTURE.proposal;
  const structure: JsonObject = {
    ...STRUCTURE,
    proposal: {
      ...proposal,
      fields: [
        ...proposal.fields,
        field("pinned", "span.xpin", "text", ":scope span.xpin", 0)
      ]
    }
  };
  const runtime = runtimeOver(() => requestsPage(false), () => URL_, structure);
  const shown = await look(runtime);
  const packet = await detect(runtime);
  const at = atOf(packet);

  assert.equal(at.new_badge, shownHandle(shown, "New"));
  // Full-coverage columns keep the first item's handles.
  assert.equal(at.name, shownHandle(shown, "Tom Becker"));
  assert.equal(at.delete, shownHandle(shown, "Delete"));
  // A column no item has is pointed at by nothing.
  assert.equal(at.pinned, undefined);
  assert.equal(typeof packet.atNote, "string");
  assert.match(packet.atNote ?? "", /first item that has it/u);
  // t195-w39, run `run-murwcaj0-40e56557` (R9): the model took the Confirm column's
  // at (Tom's card) as "the Confirm control" for every kept row. The note says
  // at is that one item's own element, and what to act on for the rows kept.
  assert.match(packet.atNote ?? "", /that item's own element, so acting on it acts on that item only/u);
  assert.match(packet.atNote ?? "", /to act on the rows a listing keeps, use the control inside one of the rows it keeps/u);
});
