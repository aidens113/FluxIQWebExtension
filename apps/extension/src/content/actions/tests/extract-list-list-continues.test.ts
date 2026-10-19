// T1 coverage that the extract-list verb carries a read's `listContinues` --
// whether a read of one page saw its list go on past it -- onto its summary as
// two closed words, and that the fact survives the domain's field-by-field wire
// copy. A read whose list ended sends nothing. The fact itself is decided in
// `../../extraction/read-coverage/`.

import assert from "node:assert/strict";
import test from "node:test";
import { webAutomationActionResultPayload } from "@fluxiq-web-extension/domain/client";
import { extractListAction } from "../extract-list";
import type { ActionResultEvidence } from "../../action-runtime";
import type { ListExtractionOutcome } from "../../extraction";
import type { ContentActionDependencies } from "../types";
import type { BrowserActionCommand, BrowserActionResult, BrowserActionValidation } from "../../types";

const COMMAND: BrowserActionCommand = {
  commandId: "cmd-list-continues",
  actionType: "web.dom.extract_list",
  extractList: { item: ".recipe", fields: { title: ".title" }, minItems: 0 }
};

async function summaryOf(outcome: ListExtractionOutcome): Promise<NonNullable<BrowserActionResult["extraction"]> | undefined> {
  let evidence: ActionResultEvidence | undefined;
  const built = (status: BrowserActionResult["status"]): BrowserActionResult => ({
    commandId: COMMAND.commandId, actionType: COMMAND.actionType, status, validation: { status: "none", reason: "evidence-only" }, startedAt: 1, finishedAt: 2
  });
  const settle = (status: BrowserActionResult["status"]) => (_action: unknown, _startedAt: unknown, _message: unknown, _validation: BrowserActionValidation, seen: ActionResultEvidence | undefined) => {
    evidence = seen;
    return built(status);
  };
  const deps = {
    extractList: async () => outcome,
    captureSnapshot: () => ({ url: "https://recipes.test/", title: "Recipes", viewport: { width: 1280, height: 720, scrollX: 0, scrollY: 0 }, interactiveElements: [] }),
    success: settle("succeeded"),
    timedOut: settle("timed_out"),
    failure: () => built("failed")
  } as unknown as ContentActionDependencies;
  await extractListAction(COMMAND, deps, 0);
  return (evidence as { extraction?: NonNullable<BrowserActionResult["extraction"]> } | undefined)?.extraction;
}

function outcome(extra: Partial<ListExtractionOutcome>): ListExtractionOutcome {
  return { records: [{ title: "Lentil soup" }], pagesRead: 1, truncated: false, timedOut: false, missingFields: [], filtered: 4, itemsSeen: 5, ...extra };
}

test("a read of one page whose list goes on carries the fact, and it survives the wire copy", async () => {
  const summary = await summaryOf(outcome({ listContinues: { kind: "infinite_scroll", evidence: "declared_feed" } }));
  assert.deepEqual(summary?.listContinues, { kind: "infinite_scroll", evidence: "declared_feed" });
  const wire = webAutomationActionResultPayload({
    commandId: COMMAND.commandId, actionType: COMMAND.actionType, status: "succeeded", validation: { status: "none", reason: "evidence-only" }, extraction: summary!, startedAt: 1, finishedAt: 2
  });
  assert.deepEqual((wire.extraction as { listContinues?: unknown } | undefined)?.listContinues, { kind: "infinite_scroll", evidence: "declared_feed" });
});

test("a read whose list ended sends no fact", async () => {
  const summary = await summaryOf(outcome({}));
  assert.equal("listContinues" in (summary ?? {}), false);
});
