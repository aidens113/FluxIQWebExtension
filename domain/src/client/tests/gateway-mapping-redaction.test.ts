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
