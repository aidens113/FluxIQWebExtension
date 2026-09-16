// T1 coverage of the dialog verb's evidence: the dialog the page-world
// override handled rides on the result's `dialog`, never on `extracted`, and a
// prompt's `promptText` -- the answer the prompt returned, not the page's
// message -- is withheld to its length the way a sensitive typed value is
// (decision D2).
//
// The verb takes every page capability as an injected dependency, so this runs
// in Node with no DOM. The override answering a real `confirm()` and `prompt()`
// is proven by `e2e/content/tests/upload-dialog.spec.ts`.

import assert from "node:assert/strict";
import test from "node:test";
import { webAutomationActionResultPayload } from "@fluxiq-web-extension/domain/client";
import { dialogAction } from "../dialog";
import type { ActionResultEvidence, ObservedDialog } from "../../action-runtime";
import type { ContentActionDependencies } from "../types";
import type { BrowserActionCommand, BrowserActionResult, BrowserActionValidation } from "../../types";

const COMMAND: BrowserActionCommand = { commandId: "cmd-dialog", actionType: "web.dom.dialog", dialog: { response: "dismiss" } };
/** Stands in for the text a prompt returned; no row may see it on a result or on the wire. */
const ANSWER = "SYNTHETIC_PROMPT_ANSWER";
const AT = 1_700_000_000_000;

type Recorded =
  | { builder: "success"; validation: BrowserActionValidation; evidence: ActionResultEvidence | undefined }
  | { builder: "rejected"; code: string; evidence: ActionResultEvidence | undefined };

/** Dependencies with a dialog control that arms as told and reports `observed`, and result builders that record what they were handed. */
function dependencies(armed: boolean, observed: ObservedDialog | undefined): { deps: ContentActionDependencies; calls: Recorded[] } {
  const calls: Recorded[] = [];
  const built = (status: BrowserActionResult["status"]): BrowserActionResult => ({
    commandId: COMMAND.commandId,
    actionType: COMMAND.actionType,
    status,
    validation: { status: "none", reason: "evidence-only" },
    startedAt: 1,
    finishedAt: 2
  });
  const provided: Partial<ContentActionDependencies> = {
    dialogControl: { arm: () => armed, observed: () => observed },
    captureSnapshot: () => ({
      url: "https://example.test/",
      title: "Example",
      viewport: { width: 1280, height: 720, scrollX: 0, scrollY: 0 },
      interactiveElements: []
    }),
    success: (_action, _startedAt, _message, validation, evidence) => {
      calls.push({ builder: "success", validation, evidence });
      return built("succeeded");
    },
    rejected: (_action, _startedAt, code, _expected, _actual, evidence) => {
      calls.push({ builder: "rejected", code, evidence });
      return built("failed");
    }
  };
  const deps = new Proxy(provided as ContentActionDependencies, {
    get(target, property: string | symbol) {
      const found = (target as unknown as Record<string | symbol, unknown>)[property];
      if (found !== undefined || typeof property === "symbol") return found;
      return () => {
        throw new Error(`the dialog verb reached an unexpected capability: ${property}`);
      };
    }
  });
  return { deps, calls };
}

/** The one builder call a verb made, as the result the domain copies onto the wire. */
function onlyCall(calls: readonly Recorded[]): { call: Recorded; payload: Record<string, unknown> } {
  assert.equal(calls.length, 1);
  const [call] = calls;
  assert.ok(call);
  const payload = webAutomationActionResultPayload({
    commandId: COMMAND.commandId,
    actionType: COMMAND.actionType,
    status: call.builder === "success" ? "succeeded" : "failed",
    validation: call.builder === "success" ? call.validation : { status: "none", reason: "not-yet-validated" },
    ...(call.evidence?.dialog ? { dialog: call.evidence.dialog } : {}),
    ...(call.evidence?.extracted === undefined ? {} : { extracted: call.evidence.extracted }),
    startedAt: 1,
    finishedAt: 2
  });
  return { call, payload };
}

test("the handled dialog rides on dialog, and the result carries no extracted", () => {
  const confirm: ObservedDialog = { kind: "confirm", message: "Delete this draft?", response: "accept", at: AT };
  const { deps, calls } = dependencies(true, confirm);
  dialogAction(COMMAND, deps, 1);

  const { call, payload } = onlyCall(calls);
  assert.equal(call.builder, "success");
  assert.deepEqual(call.evidence?.dialog, confirm);
  assert.equal(call.evidence !== undefined && "extracted" in call.evidence, false, "the verb put dialog evidence on extracted");
  assert.deepEqual(payload.dialog, confirm);
  assert.equal("extracted" in payload, false);
});

test("a prompt's answer is withheld to its length, and the page's message is kept", () => {
  const prompt: ObservedDialog = { kind: "prompt", message: "Name this report", response: "accept", promptText: ANSWER, at: AT };
  const { deps, calls } = dependencies(true, prompt);
  dialogAction(COMMAND, deps, 1);

  const { call, payload } = onlyCall(calls);
  const withheld = { kind: "prompt", message: "Name this report", response: "accept", promptText: `a withheld value of ${ANSWER.length} characters`, at: AT };
  assert.deepEqual(call.evidence?.dialog, withheld);
  assert.deepEqual(payload.dialog, withheld);
  assert.equal(JSON.stringify(call.evidence).includes(ANSWER), false, "the answer reached the evidence");
  assert.equal(JSON.stringify(payload).includes(ANSWER), false, "the answer reached the wire");
});

test("an empty answer says so, and a dismissed prompt carries no answer at all", () => {
  const empty = dependencies(true, { kind: "prompt", message: "Name this report", response: "accept", promptText: "", at: AT });
  dialogAction(COMMAND, empty.deps, 1);
  assert.equal(onlyCall(empty.calls).call.evidence?.dialog?.promptText, "an empty value");

  const dismissed = dependencies(true, { kind: "prompt", message: "Name this report", response: "dismiss", at: AT });
  dialogAction(COMMAND, dismissed.deps, 1);
  const dialog = onlyCall(dismissed.calls).call.evidence?.dialog;
  assert.equal(dialog !== undefined && "promptText" in dialog, false);
});

test("a refused arming still reports the handled dialog, withheld the same way", () => {
  const { deps, calls } = dependencies(false, { kind: "prompt", message: "Name this report", response: "accept", promptText: ANSWER, at: AT });
  dialogAction(COMMAND, deps, 1);

  const { call } = onlyCall(calls);
  assert.equal(call.builder, "rejected");
  if (call.builder !== "rejected") return;
  assert.equal(call.code, "dialog_override_missing");
  assert.equal(call.evidence?.dialog?.promptText, `a withheld value of ${ANSWER.length} characters`);
  assert.equal(JSON.stringify(call.evidence).includes(ANSWER), false);
});

test("before any dialog was handled there is no dialog evidence", () => {
  const { deps, calls } = dependencies(true, undefined);
  dialogAction(COMMAND, deps, 1);

  const { call } = onlyCall(calls);
  assert.equal(call.evidence !== undefined && "dialog" in call.evidence, false);
  assert.equal(call.evidence !== undefined && "extracted" in call.evidence, false);
});
