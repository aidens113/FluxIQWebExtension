import assert from "node:assert/strict";
import test from "node:test";
import { WITHHELD_PARITY_REASON, screenParityReason } from "../index.js";

test("Core's fixed reasons pass through unchanged", () => {
  for (const reason of [
    "Core did not derive it in the replay",
    "the event does not say which session it belongs to",
    "no session stands in for session-3",
    "sequence 12 is missing from the trace",
    "the trace lacks the command it belongs to (sequence 4 is missing)",
    "the replay cannot reproduce lifecycle event session.connected",
    "the replay took 3 artifacts where the recording took 4, or different ones",
    "delivered in another order than recorded within its causal chain (an input and its disposition)",
    "delivered in another order than recorded within its causal chain (one command's messages and outcomes)",
    "the disposition was recorded under schema version 1, which does not record what Core delivered for the message; every field it records matched",
    "the event does not say which session it belongs to, and the trace cannot be shown to hold one session: its outbound envelopes and lifecycle records name more than one session id",
    "the event does not say which session it belongs to, and the trace cannot be shown to hold one session: events are sent or received after the session disconnected",
    "/payload/metadata/trace/artifacts/4/sha256 was withheld at capture, and Core's handling of the message depended on it",
    "/payload/[withheld secret key 0], /payload/a~1b was withheld at capture, and Core's handling of the message depended on it",
  ]) assert.equal(screenParityReason(reason), reason);
});

test("a reason with free text keeps only its fixed head", () => {
  assert.equal(screenParityReason("the replayed gateway refused to issue it: Session abc is not paired for value 'secret'"), "the replayed gateway refused to issue it (error text withheld)");
  assert.equal(screenParityReason("the replayed command failed: boom"), "the replayed command failed (error text withheld)");
  assert.equal(screenParityReason("the same input, a different derivation: payload.value.delivered.result"), "the same input, a different derivation");
  assert.equal(screenParityReason("only ids or times Core minted differ: payload.value.id"), "only ids or times Core minted differ");
  assert.equal(screenParityReason("sequence 9 was lost at capture (buffer_overflow: 12 events dropped near \"x\")"), "sequence 9 was lost at capture (buffer_overflow)");
});

test("an unknown reason is withheld", () => {
  assert.equal(screenParityReason("page said: hello world"), WITHHELD_PARITY_REASON);
  assert.equal(screenParityReason("no session stands in for session-3 and the token abc"), WITHHELD_PARITY_REASON);
  assert.equal(screenParityReason("the event does not say which session it belongs to, and the trace cannot be shown to hold one session: session abc"), WITHHELD_PARITY_REASON);
  assert.equal(screenParityReason("/payload/note: \"hi\" was withheld at capture, and Core's handling of the message depended on it"), WITHHELD_PARITY_REASON);
});
