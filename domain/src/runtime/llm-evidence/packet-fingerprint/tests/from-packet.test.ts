import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeWebLlmSnapshotWithBindings } from "../../sanitize";
import { webPacketElementFingerprint } from "..";

test("a selected packet fingerprint carries the screened stable record key", () => {
  const page = sanitizeWebLlmSnapshotWithBindings({ url: "https://library.test/sheets", interactiveElements: [
    { tagName: "button", selector: "#open", accessibleName: "Open sheet", context: { record: { key: "sheet-A", keyAttribute: "data-sheet-id", text: "Waiting" } } }
  ] });
  const element = page.evidence.elements[0]!;
  const recordIdentity = page.recordIdentities?.get(element.target);
  const fingerprint = webPacketElementFingerprint(element, { selector: "#open", recordIdentity });
  assert.deepEqual(fingerprint.context?.record, { key: "sheet-A", keyAttribute: "data-sheet-id", text: "Waiting" });
  fingerprint.context!.record!.text = "Ready";
  assert.equal(recordIdentity?.text, "Waiting", "selected fingerprints do not mutate the binding");
});
