// T1 coverage of the extract verb's one decision: a read the capability
// refused is reported as a refusal, never as a value (decision D2).
//
// The verb takes every page capability as an injected dependency, so this runs
// in Node with no DOM. What the capability refuses -- a sensitive control in
// every mode, and a container's sensitive contents -- is proven against a real
// page by `e2e/content/tests/actions.spec.ts`.

import assert from "node:assert/strict";
import test from "node:test";
import { extractAction } from "../extract";
import type { ActionResultEvidence, ExtractedElementValue, ResolvedTarget } from "../../action-runtime";
import type { ContentActionDependencies } from "../types";
import type { BrowserActionCommand, BrowserActionResult, BrowserActionValidation, DomElementDescriptor } from "../../types";

const COMMAND: BrowserActionCommand = { commandId: "cmd-extract", actionType: "web.dom.extract", selector: "#secret" };
const ELEMENT = {} as Element;
const DESCRIPTOR: DomElementDescriptor = { selector: "#secret", tagName: "input" } as DomElementDescriptor;
const TARGET: ResolvedTarget = { element: ELEMENT, resolution: { strategy: "selector", candidateCount: 1 } };
/** Stands in for a value the page holds; no row may see it on a refusal. */
const SENTINEL = "SYNTHETIC_EXTRACT_SENTINEL";

type Recorded =
  | { builder: "rejected"; code: string; expected: string; actual: string; evidence: ActionResultEvidence | undefined }
  | { builder: "success"; message: string; validation: BrowserActionValidation; evidence: ActionResultEvidence | undefined };

/** Dependencies whose result builders record what they were handed; any other capability the verb reaches throws. */
function dependencies(read: ExtractedElementValue): { deps: ContentActionDependencies; calls: Recorded[] } {
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
    resolveTarget: () => TARGET,
    describeElement: () => DESCRIPTOR,
    extractElement: () => read,
    captureSnapshot: () => ({
      url: "https://example.test/",
      title: "Example",
      viewport: { width: 1280, height: 720, scrollX: 0, scrollY: 0 },
      interactiveElements: []
    }),
    rejected: (_action, _startedAt, code, expected, actual, evidence) => {
      calls.push({ builder: "rejected", code, expected, actual, evidence });
      return built("failed");
    },
    success: (_action, _startedAt, message, validation, evidence) => {
      calls.push({ builder: "success", message, validation, evidence });
      return built("succeeded");
    }
  };
  const deps = new Proxy(provided as ContentActionDependencies, {
    get(target, property: string | symbol) {
      const found = (target as unknown as Record<string | symbol, unknown>)[property];
      if (found !== undefined || typeof property === "symbol") return found;
      return () => {
        throw new Error(`the extract verb reached an unexpected capability: ${property}`);
      };
    }
  });
  return { deps, calls };
}

test("a refused read is rejected as sensitive_value and carries no extracted", () => {
  const { deps, calls } = dependencies({ ok: false, refusal: "sensitive_value" });
  const result = extractAction(COMMAND, deps, 1);

  assert.equal(result.status, "failed");
  assert.equal(calls.length, 1);
  const [call] = calls;
  assert.equal(call?.builder, "rejected");
  if (call?.builder !== "rejected") return;
  assert.equal(call.code, "sensitive_value");
  assert.equal(call.expected, "a readable element that is not a sensitive control");
  assert.equal(call.actual, "the target is a sensitive control, so its value is never read");
  // The element is described and the resolution rides, so a Flow still learns
  // what was refused and how it was found -- but nothing was read.
  assert.deepEqual(call.evidence, { element: DESCRIPTOR, resolution: TARGET.resolution });
  assert.equal(call.evidence !== undefined && "extracted" in call.evidence, false);
});

test("an allowed read succeeds with an evidence-only validation", () => {
  const { deps, calls } = dependencies({ ok: true, value: SENTINEL });
  const result = extractAction(COMMAND, deps, 1);

  assert.equal(result.status, "succeeded");
  assert.equal(calls.length, 1);
  const [call] = calls;
  assert.equal(call?.builder, "success");
  if (call?.builder !== "success") return;
  assert.equal(call.message, "Value extracted.");
  assert.deepEqual(call.validation, { status: "none", reason: "evidence-only" });
  assert.equal(call.evidence?.extracted, SENTINEL);
  assert.equal(call.evidence?.element, DESCRIPTOR);
  assert.deepEqual(call.evidence?.resolution, TARGET.resolution);
});
