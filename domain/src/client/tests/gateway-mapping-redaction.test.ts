// The wire payload's half of the redaction contract: when a sensitive control's
// comparison is withheld here, and when the producer's own phrasing is let
// through instead.
//
// `tests/gateway-mapping.test.ts` already proves the guard fires -- that a
// producer with its redaction removed cannot reach the wire. What is proved
// here is the other half, added once `redacted` existed on the validation: the
// declaration buys the phrasing back, and **only** the declaration does. Every
// row where it is missing or malformed must withhold, because a flag that could
// be forgotten into permissiveness would hand out the secret it was added to
// keep useful.
//
// Kept apart from that file rather than appended to it: it is a different
// subject, that file is already past the 400-line advisory, and its rows run at
// module scope, where a failed assertion aborts the script and still prints a
// green-looking count. These are `node:test` rows, so a broken fail-safe is
// reported as a failure by name.
//
// The sentinel is not a secret and carries no shape of one. It stands for
// whatever a leaking producer would have written, and each row searches the
// whole serialized payload for it rather than one named field.

import assert from "node:assert/strict";
import test from "node:test";
import type { WebAutomationActionResult, WebAutomationActionValidation } from "../../actions/types";
import { WEB_AUTOMATION_WITHHELD_COMPARISON_TEXT } from "../../sensitivity";
import { webAutomationActionResultPayload } from "../gateway-mapping";

const producerSentinel = "SENTINEL-VALUE-A-PRODUCER-SHOULD-HAVE-WITHHELD";

/** A comparison a verb built without quoting the control's value: a length, never the content. */
const redactedPhrasing = "the field holds a withheld value of 19 characters";

/** A `web.dom.type` result on a control the one sensitivity rule marks. */
function sensitiveResult(validation: WebAutomationActionValidation): WebAutomationActionResult {
  return {
    commandId: "command.sensitive",
    actionType: "web.dom.type",
    status: validation.status === "failed" ? "failed" : "succeeded",
    validation,
    message: "Text entered.",
    url: "https://example.test/checkout",
    element: { tagName: "input", selector: "[data-testid=\"payment\"]", inputType: "text", attributes: { autocomplete: "billing cc-number" } } as never,
    startedAt: 100,
    finishedAt: 140
  };
}

test("a declared redaction keeps the producer's phrasing, which is the whole point of the flag", () => {
  const payload = webAutomationActionResultPayload(sensitiveResult({
    status: "failed",
    expected: redactedPhrasing,
    actual: `${redactedPhrasing}, which is not the text that was sent`,
    redacted: true
  }));
  assert.deepEqual(payload.validation, {
    status: "failed",
    expected: redactedPhrasing,
    actual: `${redactedPhrasing}, which is not the text that was sent`,
    redacted: true
  }, "a length and a verdict, which is what a person debugging a read-back can act on");
  assert.equal(JSON.stringify(payload).includes(WEB_AUTOMATION_WITHHELD_COMPARISON_TEXT), false, "nothing was withheld a second time");
});

// The fail-safe, one row per way the declaration can fail to arrive. Each row
// sends the unredacted strings a producer with its redaction removed would
// send, so a guard that honoured any of these shapes leaks here rather than in
// production.
const absentDeclarations: Array<[what: string, redacted: unknown]> = [
  ["no flag at all, which is every verb nobody has taught it yet", undefined],
  ["a flag that says the opposite", false],
  ["a string that merely looks like the flag", "true"],
  ["a truthy value that is not the boolean", 1]
];

for (const [what, redacted] of absentDeclarations) {
  test(`an absent declaration withholds: ${what}`, () => {
    const validation = { status: "failed", expected: `the field holds "${producerSentinel}"`, actual: `the field holds "${producerSentinel}"` } as Record<string, unknown>;
    if (redacted !== undefined) validation.redacted = redacted;
    const payload = webAutomationActionResultPayload(sensitiveResult(validation as unknown as WebAutomationActionValidation));
    assert.equal(JSON.stringify(payload).includes(producerSentinel), false, "the flag is the only thing that buys the text through, and this is not the flag");
    assert.deepEqual(payload.validation, {
      status: "failed",
      expected: WEB_AUTOMATION_WITHHELD_COMPARISON_TEXT,
      actual: WEB_AUTOMATION_WITHHELD_COMPARISON_TEXT
    }, "and what leaves carries no flag: the flag is the producer's declaration, and this layer is not the producer. Stamping it here made the next guard read this layer's own output as a producer declaration and stand down, which disarmed the adapter for every extension result.");
  });
}

test("the declaration is not a way to keep a comparison on an ordinary control from being read", () => {
  // The flag says "already withheld", never "withhold this". An ordinary
  // control's comparison is untouched either way; a producer that stamps the
  // flag on one changes nothing here, which keeps the flag from becoming a
  // second, weaker way to ask for redaction.
  const ordinary: WebAutomationActionResult = {
    ...sensitiveResult({ status: "passed", expected: "the field holds \"synthetic-control-text\"", actual: "the field holds \"synthetic-control-text\"", redacted: true }),
    element: { tagName: "input", selector: "input[name=\"username\"]", inputType: "text", attributes: { autocomplete: "username" } } as never
  };
  assert.deepEqual(webAutomationActionResultPayload(ordinary).validation, {
    status: "passed",
    expected: "the field holds \"synthetic-control-text\"",
    actual: "the field holds \"synthetic-control-text\"",
    redacted: true
  });
});

test("a validation with no comparison to withhold is untouched, flag or no flag", () => {
  const skipped = webAutomationActionResultPayload(sensitiveResult({ status: "none", reason: "evidence-only" }));
  assert.deepEqual(skipped.validation, { status: "none", reason: "evidence-only" });
});

// -- A read's `extracted` value (D2) -----------------------------------------
// The page refuses every read of a sensitive control; this is the wire's own
// check that it did. A read value is the control's contents rather than prose
// about them, so no declaration buys it through. Each row sends it beside a
// `none` validation, which gives the comparison guard nothing to withhold, and
// beside a declared redaction, which that guard honours: a read guard that
// leaned on either would leak here.

/** A `web.dom.extract` result on an element, carrying what a page that failed to refuse the read would send. */
function extractResult(element: unknown, validation: WebAutomationActionValidation, extracted: string): WebAutomationActionResult {
  return {
    commandId: "command.extract",
    actionType: "web.dom.extract",
    status: "succeeded",
    validation,
    message: "Value extracted.",
    url: "https://example.test/checkout",
    element: element as never,
    extracted,
    startedAt: 100,
    finishedAt: 140
  };
}

const sensitiveElement = sensitiveResult({ status: "none", reason: "evidence-only" }).element;

const readValidations: Array<[what: string, validation: WebAutomationActionValidation]> = [
  ["beside a validation with no comparison", { status: "none", reason: "evidence-only" }],
  ["beside a declared redaction", { status: "passed", expected: redactedPhrasing, actual: redactedPhrasing, redacted: true }]
];

test("a sensitive element's extracted value never reaches the wire", () => {
  for (const [what, validation] of readValidations) {
    const payload = webAutomationActionResultPayload(extractResult(sensitiveElement, validation, producerSentinel));
    assert.equal(JSON.stringify(payload).includes(producerSentinel), false, `${what}: the value read off the control left on the wire`);
    assert.equal("extracted" in payload, false, `${what}: the field is absent, not emptied`);
    assert.deepEqual(payload.element, sensitiveElement, `${what}: the descriptor still rides, so the next reader can ask the rule again`);
  }
});

test("an ordinary element's extracted value is carried", () => {
  const ordinaryElement = { tagName: "input", selector: "input[name=\"username\"]", inputType: "text", attributes: { autocomplete: "username" } };
  for (const [what, validation] of readValidations) {
    const payload = webAutomationActionResultPayload(extractResult(ordinaryElement, validation, "synthetic-control-text"));
    assert.equal(payload.extracted, "synthetic-control-text", `${what}: redaction stays targeted, or no read returns anything`);
  }
});
