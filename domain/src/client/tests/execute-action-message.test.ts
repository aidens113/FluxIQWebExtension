// T1 coverage of the one `executeAction` message the extension's background
// sends a tab for a DOM action, which the offline snapshot page
// (`packages/test-runner/src/offline-snapshot-page/`) hands the content code
// unchanged: no frame named means the top frame, and only the top frame.
// Moved here with its subject from the extension's `shared/tests/` (t749).

import assert from "node:assert/strict";
import test from "node:test";
import type { WebAutomationActionCommand } from "../../actions/types";
import { executeActionMessage } from "../execute-action-message";

const READ: WebAutomationActionCommand = { commandId: "read-1", actionType: "web.dom.extract_list", extractList: { item: "article", fields: {}, minItems: 0 } };

test("an action that names no frame goes to the top frame, and to the top frame only", () => {
  assert.deepEqual(executeActionMessage(READ, undefined), { type: "executeAction", action: READ, frameId: 0, topFrameOnly: true });
});

test("an action addressed to a frame carries that frame and lets the frame confirm it", () => {
  assert.deepEqual(executeActionMessage(READ, 7), { type: "executeAction", action: READ, frameId: 7, topFrameOnly: false });
  assert.deepEqual(executeActionMessage(READ, 0), { type: "executeAction", action: READ, frameId: 0, topFrameOnly: false });
});

test("the action travels as given, not copied or rewritten", () => {
  assert.equal(executeActionMessage(READ, undefined).action, READ);
});
