// A press the page refused quotes the line the page answered with, through the
// real runtime (t174-w82, cause 14 of `run-murwd8le-79e735a8`).
//
// Steps 0020 and 0027 of that run came back `refused_by_page` with only
// `page_busy_try_later` and `page_needs_something_first`: "Network busy, please
// try again" and `t968 "Please select a Color."` were only on the page beside
// the refusal, among a hundred other lines. The refusal now quotes them in its
// `detail.notice`, in the view's own words, screened as every page word is.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { WEB_AUTOMATION_FAILURE_CODES } from "../../../../failure";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_RUN_NODE_TOOL_ID, type WebLlmEvidenceGateway } from "../../..";
import { shownHandle } from "../../../page-view/tests/shown-page-lines";

const PROJECT = { projectId: "project.one", flowId: "flow.one" };
const CLICK = "web.output.dom-click";
const SNAPSHOT = "web.output.dom-capture_snapshot";
const ITEM = "https://shop.test/item/1005008123450";

test("a press the page refused for wanting something first quotes the line it wrote", async () => {
  const stubbed = stub(WEB_AUTOMATION_FAILURE_CODES.REFUSED_BY_PAGE, "Please select a Color.");
  const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);
  const looked = await look(runtime);
  const refused = await press(runtime, shownHandle(looked.evidence, "Add to cart"));
  assert.equal(refused.effectApplied, false);
  const value = refused.evidence as JsonObject;
  assert.equal(value.code, "refused_by_page");
  const detail = value.detail as JsonObject;
  assert.equal(detail.reason, "page_needs_something_first");
  const warning = shownHandle(value, "Please select a Color.");
  assert.deepEqual(detail.notice, [`${warning} "Please select a Color."`]);
  // The run's own record keeps the closed reason it always had.
  assert.equal(refused.resultReason, "page_needs_something_first");
});

test("a press the page refused as busy quotes its busy line, and keeps the reason Core retries on", async () => {
  const stubbed = stub(WEB_AUTOMATION_FAILURE_CODES.RATE_LIMITED, "Network busy, please try again");
  const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);
  const looked = await look(runtime);
  const refused = await press(runtime, shownHandle(looked.evidence, "Add to cart"));
  const value = refused.evidence as JsonObject;
  const detail = value.detail as JsonObject;
  assert.equal(detail.reason, "page_busy_try_later");
  assert.deepEqual(detail.notice, [`${shownHandle(value, "Network busy, please try again")} "Network busy, please try again"`]);
});

test("a notice shaped like a secret is quoted withheld, as the page shows it", async () => {
  const stubbed = stub(WEB_AUTOMATION_FAILURE_CODES.REFUSED_BY_PAGE, "Card 4111 1111 1111 1111 declined");
  const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);
  const looked = await look(runtime);
  const refused = await press(runtime, shownHandle(looked.evidence, "Add to cart"));
  const notice = ((refused.evidence as JsonObject).detail as JsonObject).notice as string[];
  assert.equal(notice.length, 1);
  assert.match(notice[0]!, /withheld/u);
  assert.doesNotMatch(JSON.stringify(refused.evidence), /4111/u);
});

test("a refusal whose page wrote nothing new says no notice, and any other refusal never does", async () => {
  const quiet = stub(WEB_AUTOMATION_FAILURE_CODES.REFUSED_BY_PAGE, undefined);
  const runtime = createWebAutomationLlmEvidenceRuntime(quiet.gateway);
  const refused = await press(runtime, shownHandle((await look(runtime)).evidence, "Add to cart"));
  assert.equal("notice" in ((refused.evidence as JsonObject).detail as JsonObject), false);

  const gone = stub(WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_FOUND, "Item removed");
  const other = createWebAutomationLlmEvidenceRuntime(gone.gateway);
  const missing = await press(other, shownHandle((await look(other)).evidence, "Add to cart"));
  const detail = (missing.evidence as JsonObject).detail as JsonObject | undefined;
  assert.equal(detail !== undefined && "notice" in detail, false);
});

async function look(runtime: ReturnType<typeof createWebAutomationLlmEvidenceRuntime>) {
  return runtime.executeTool({ ...PROJECT, callId: "call.look", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: SNAPSHOT, parameters: {}, consequences: [] } });
}

async function press(runtime: ReturnType<typeof createWebAutomationLlmEvidenceRuntime>, handle: string) {
  return runtime.executeTool({ ...PROJECT, callId: `call.press.${handle}`, toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: CLICK, parameters: { target: { handle } }, consequences: [] } });
}

/** A product page whose Add to cart the page refuses with `code`, writing `notice` beside it. */
function stub(code: string, notice: string | undefined) {
  let written: string | undefined;
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType === "web.dom.capture_snapshot") return { status: "succeeded", payload: { snapshot: page(written) } };
      if (command.actionType === "web.dom.click") {
        written = notice;
        return { status: "failed", error: "refused", failure: { code, expected: "the page accepts the press", actual: "the page answered" } };
      }
      return { status: "succeeded", payload: { value: "ok" } };
    }
  };
  return { gateway };
}

function page(notice: string | undefined): JsonObject {
  return {
    url: ITEM,
    title: "Hub",
    viewport: { width: 1000, height: 1000, scrollX: 0, scrollY: 0 },
    interactiveElements: [
      { tagName: "div", selector: "#swatch-grey", visibleText: "Space Grey", cursor: "pointer" },
      { tagName: "button", selector: "#add", visibleText: "Add to cart" },
      ...(notice === undefined ? [] : [{ tagName: "span", selector: "#tip", visibleText: notice }]),
      { tagName: "span", selector: "#ships", visibleText: "Ships from Spain" }
    ]
  };
}
