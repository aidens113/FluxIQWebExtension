// Live run `run-mux6nxst-c9bca37c` (step 0014): on Circleway's friend requests,
// styled by atomic classes, each detected column reached the model only as a
// class path -- key `div_x0531l50_x1r2vv8_x4q0id2_div_x1a4yqcp_xa73opb_xtlve1b`,
// label `div.x0531l50.x1r2vv8.x4q0id2 > div.x1a4yqcp...` -- and no value, so
// lane D read the same list 10 to 16 times per build to learn which column was
// which. Each column now carries a short screened sample from the first item
// that has it, and a generated class path is labelled by what the element is
// and that sample. Keys are unchanged: they are what a read writes and a
// retained handle names.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject, JsonValue } from "fluxiq/core";
import {
  createWebAutomationLlmEvidenceRuntime,
  WEB_LLM_DETECT_STRUCTURE_TOOL_ID,
  WEB_LLM_STRUCTURE_RESULT_CODE,
  type WebLlmRepeatingStructure
} from "../..";

const SCOPE = { projectId: "project.one", flowId: "flow.one" };
const URL_ = "http://127.0.0.1:4173/scenarios/social-network-feed/friends/requests/";
const CONTAINER = "body > div:nth-of-type(2) > div";
const BODY = "div.x0531l50.x1r2vv8.x4q0id2";
const MUTUAL_KEY = "div_x0531l50_x1r2vv8_x4q0id2_div_x1a4yqcp_xa73opb_xtlve1b";

function field(key: string, label: string, kind: string, selector: string, extra: JsonObject = {}): JsonObject {
  return { key, label, spec: { kind, selector, required: true, ...extra }, coverage: 1 };
}

/** The detection the page answers, with the class-path keys and labels it writes on an atomic-class site. */
const STRUCTURE = {
  ok: true,
  proposal: {
    container: CONTAINER,
    item: `${CONTAINER} > div.x1a.xrow`,
    itemCount: 2,
    fields: [
      field("div_x0531l50_x1r2vv8_x4q0id2_a_x0ybvghy_x130pqy_x1yfagd", `${BODY} > a.x0ybvghy.x130pqy.x1yfagd`, "text", `:scope > ${BODY} > a.x0ybvghy.x130pqy.x1yfagd`),
      field(MUTUAL_KEY, `${BODY} > div.x1a4yqcp.xa73opb.xtlve1b`, "text", ":scope div.x1a4yqcp.xa73opb.xtlve1b"),
      field("profile_url", `${BODY} > a.x0ybvghy.x130pqy.x1yfagd url`, "link", `:scope > ${BODY} > a.x0ybvghy.x130pqy.x1yfagd`),
      field("confirm", "Confirm", "text", `:scope > ${BODY} > div.x1507i5.x1mgzeci.xu37y6r`),
      field("note", `${BODY} > input.x9k2m1q.xq8z3t1`, "value", `:scope > ${BODY} > input.x9k2m1q.xq8z3t1`)
    ],
    confidence: 0.75
  }
};

/** One request card, as the capture lists it: every rendered element, its parent by index. */
function request(elements: JsonObject[], parent: number, position: number, person: { slug: string; name: string; mutual: string }): void {
  const add = (element: JsonObject): number => elements.push(element) - 1;
  const item = `${CONTAINER} > div:nth-of-type(${position})`;
  const listPosition = { index: position, total: 2 };
  const card = add({ tagName: "div", selector: item, attributes: { class: "xrow x1a" }, parent, context: { listPosition } });
  const body = add({ tagName: "div", selector: `${item} > div`, attributes: { class: "x0531l50 x1r2vv8 x4q0id2" }, parent: card, context: { listPosition } });
  const inBody = `${item} > div`;
  add({ tagName: "a", selector: `${inBody} > a`, accessibleName: person.name, visibleText: person.name, attributes: { class: "x0ybvghy x130pqy x1yfagd", href: `/people/${person.slug}/` }, parent: body, context: { listPosition } });
  add({ tagName: "div", selector: `${inBody} > div:nth-of-type(1)`, visibleText: person.mutual, attributes: { class: "x1a4yqcp xa73opb xtlve1b" }, parent: body, context: { listPosition } });
  add({ tagName: "div", selector: `${inBody} > div:nth-of-type(2)`, role: "button", accessibleName: "Confirm", visibleText: "Confirm", attributes: { class: "x1507i5 x1mgzeci xu37y6r", role: "button" }, parent: body, context: { listPosition } });
  add({ tagName: "input", selector: `${inBody} > input`, inputType: "text", attributes: { class: "x9k2m1q xq8z3t1", type: "text", value: "private note" }, value: "private note", parent: body, context: { listPosition } });
}

function requestsPage(): JsonObject[] {
  const elements: JsonObject[] = [];
  const container = elements.push({ tagName: "div", selector: CONTAINER, attributes: { class: "x9f619 xlist" } }) - 1;
  request(elements, container, 1, { slug: "tom.becker.9", name: "Tom Becker", mutual: "and 4 other mutual friends of yours who also follow Tom here" });
  request(elements, container, 2, { slug: "amara-osei", name: "Amara Osei", mutual: "23 mutual friends" });
  return elements;
}

async function detected(): Promise<WebLlmRepeatingStructure> {
  const runtime = createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.one"],
    structureDetectionSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType !== "web.dom.capture_snapshot") return { status: "succeeded" };
      const snapshot: JsonObject = { url: URL_, title: "Friend requests", interactiveElements: requestsPage() };
      return { status: "succeeded", payload: command.parameters.detectStructure === undefined ? { snapshot } : { snapshot, structure: structuredClone(STRUCTURE) as JsonValue } };
    }
  });
  const result = await runtime.executeTool({ ...SCOPE, callId: "call.detect", toolId: WEB_LLM_DETECT_STRUCTURE_TOOL_ID, value: {} });
  assert.equal(result.resultCode, WEB_LLM_STRUCTURE_RESULT_CODE);
  return result.evidence as WebLlmRepeatingStructure;
}

function shown(packet: WebLlmRepeatingStructure, key: string) {
  const column = packet.fields.find((each) => each.key === key);
  assert.ok(column, `the packet lists ${key}`);
  return column;
}

test("a generated class path is labelled by what its element is and its sample from the first item", async () => {
  const packet = await detected();
  const name = shown(packet, "div_x0531l50_x1r2vv8_x4q0id2_a_x0ybvghy_x130pqy_x1yfagd");
  assert.equal(name.sample, "Tom Becker");
  assert.equal(name.label, "link: 'Tom Becker'");
  const mutual = shown(packet, MUTUAL_KEY);
  // Bounded, cut at a word.
  assert.equal(mutual.sample, "and 4 other mutual friends of yours…");
  assert.equal(mutual.label, "text: 'and 4 other mutual friends of yours…'");
});

test("a link column samples its path; a label the page wrote in words is kept", async () => {
  const packet = await detected();
  assert.equal(shown(packet, "profile_url").sample, "/people/tom.becker.9/");
  const confirm = shown(packet, "confirm");
  assert.equal(confirm.label, "Confirm");
  assert.equal(confirm.sample, "Confirm");
});

test("a form control's value is never sampled, and keys are unchanged", async () => {
  const packet = await detected();
  const note = shown(packet, "note");
  assert.equal(note.sample, undefined);
  assert.equal(JSON.stringify(packet).includes("private note"), false);
  assert.deepEqual(packet.fields.map((each) => each.key), STRUCTURE.proposal.fields.map((each) => each.key));
});
