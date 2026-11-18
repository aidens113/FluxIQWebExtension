import assert from "node:assert/strict";
import test from "node:test";
import { CONTENT_REVOKED_MESSAGE } from "../../../shared/own-pages";
import { revokeTabContent } from "..";

test("revoking a tab sends the one message, even to a tab the gate would refuse, and reads nothing", async () => {
  const globals = globalThis as unknown as Record<string, unknown>;
  const previous = Object.getOwnPropertyDescriptor(globals, "chrome");
  const sends: Array<{ tabId: number; message: unknown }> = [];
  let answer: unknown = { ok: true };
  const sendMessage = (tabId: number, message: unknown, callback: (response: unknown) => void) => {
    sends.push({ tabId, message });
    callback(answer);
  };
  globals["chrome"] = {
    runtime: {},
    tabs: { sendMessage }
  };
  try {
    assert.equal(await revokeTabContent(7), true);
    assert.deepEqual(sends, [{ tabId: 7, message: { type: CONTENT_REVOKED_MESSAGE } }]);
    answer = undefined;
    assert.equal(await revokeTabContent(8), false, "no script listening is not an error");
  } finally {
    if (previous) Object.defineProperty(globals, "chrome", previous);
    else delete globals["chrome"];
  }
});
