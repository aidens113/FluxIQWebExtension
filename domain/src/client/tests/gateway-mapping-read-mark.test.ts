// A read step's `readsWords` mark, from the saved node to the element the page resolves (t743).
//
// D2b marked a read target's saved words as the value the step reads
// (`runtime/llm-evidence/plan-resolution/read-identity.ts`) and taught the page
// not to refuse such a target when its words changed
// (`apps/extension/src/content/identity/read-words.ts`). Between the two the
// mark was dropped: `elementFingerprint` copies an explicit list of keys, and
// the gateway builds the declared `command.element` from it. So every row here
// joins both ends, on an invoice page whose total a discount changes: the node
// as the resolution saves it goes in, and what comes out is read where the page
// reads it -- the wire target and the dispatched command's `element` -- after
// Core's element-target rewrite, which has no field for the mark.

import assert from "node:assert/strict";
import test from "node:test";
import { normalizeAutomationStudioElementTarget } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import { elementFingerprint, outputTargetFromPayload } from "../../output-nodes";
import { webAutomationActionFromGatewayCommand } from "../gateway-mapping";

const TOTAL = "#summary > p:nth-of-type(2)";

/** The invoice total's identity as a text read saves it: its words kept, marked as the value read. */
const savedTotal: JsonObject = {
  tagName: "p",
  selector: TOTAL,
  visibleText: "Total 40.00",
  classNames: ["summary-line", "total"],
  attributes: { class: "summary-line total" },
  readsWords: true
};

/** An extract node reading the total's words, as the resolution saves it. */
function readNode(element: JsonObject = savedTotal): JsonObject {
  return { selector: TOTAL, element, extract: { mode: "text" } };
}

/** `prepareElementTargetAction` with no runtime candidates: `target` normalized, everything else untouched. */
function preparedByCore(parameters: JsonObject): JsonObject {
  const target = normalizeAutomationStudioElementTarget(parameters.target, { source: "runtime" })
    ?? normalizeAutomationStudioElementTarget(parameters, { source: "runtime" });
  assert.ok(target, "Core found an element target to prepare");
  return { ...parameters, target: target as unknown as JsonObject };
}

function dispatched(commandId: string, parameters: JsonObject, target = outputTargetFromPayload(parameters)) {
  const command = webAutomationActionFromGatewayCommand({ commandId, actionType: "web.dom.extract", ...(target ? { target } : {}), parameters });
  assert.equal("status" in command, false, `the read was not refused: ${JSON.stringify(command)}`);
  return command as Exclude<typeof command, { status: "rejected" }>;
}

test("the normalizer keeps a read's mark, and only `true` is a mark", () => {
  assert.equal(elementFingerprint(savedTotal)?.readsWords, true);
  assert.equal(elementFingerprint({ ...savedTotal, readsWords: false })?.readsWords, undefined);
  assert.equal(elementFingerprint({ ...savedTotal, readsWords: "true" })?.readsWords, undefined);
  assert.equal("readsWords" in (elementFingerprint({ ...savedTotal, readsWords: undefined }) ?? {}), false, "an unmarked target carries no key at all");
});

test("a saved read reaches the page marked, through Core's rewrite, the wire target and the declared field", () => {
  const prepared = preparedByCore(readNode());
  const wireTarget = outputTargetFromPayload(prepared);
  assert.equal((wireTarget?.element as JsonObject | undefined)?.readsWords, true, "the wire target");
  const command = dispatched("read", prepared, wireTarget);
  assert.equal(command.element?.readsWords, true, "the declared field");
  assert.equal(command.element?.visibleText, "Total 40.00", "the words travel beside the mark");
  assert.equal(command.element?.selector, TOTAL);
});

test("a read whose wire target carried no element is still marked on the declared field", () => {
  const command = dispatched("read:bare-wire-target", preparedByCore(readNode()), { selector: TOTAL });
  assert.equal(command.element?.readsWords, true);
});

test("a repair that renamed a read's element keeps the mark: it says what the step does, not what the element is", () => {
  const repaired = { kind: "element", source: "runtime", fingerprint: { selector: "#summary > p.total", tagName: "p", accessibleName: "Amount due" } };
  const stored = { ...readNode(), target: repaired };
  for (const [shape, parameters] of [["as the node stores it", stored], ["as Core dispatches it", preparedByCore(stored)]] as const) {
    const wireTarget = outputTargetFromPayload(parameters);
    const command = dispatched(`repair:${shape}`, parameters, wireTarget);
    assert.equal(command.element?.accessibleName, "Amount due", `${shape}: the repair's identity won`);
    assert.equal(command.element?.readsWords, true, `${shape}: the declared field`);
    assert.equal((wireTarget?.element as JsonObject | undefined)?.readsWords, true, `${shape}: the wire target`);
    const bare = dispatched(`repair:${shape}:bare`, parameters, { selector: "#summary > p.total" });
    assert.equal(bare.element?.readsWords, true, `${shape}: a bare wire target`);
  }
});

test("a press is never marked, through every hop", () => {
  const { readsWords: _mark, ...unmarked } = savedTotal;
  const prepared = preparedByCore(readNode(unmarked));
  const wireTarget = outputTargetFromPayload(prepared);
  assert.equal((wireTarget?.element as JsonObject | undefined)?.readsWords, undefined);
  assert.equal(dispatched("unmarked", prepared, wireTarget).element?.readsWords, undefined);
});
