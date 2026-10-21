import assert from "node:assert/strict";
import test from "node:test";
import { DECLARED_EXTENSION_SESSION_VIEW } from "../declared-session-view.js";

test("the declared view is the web extension's: its client type, the web actions it serves and its domain", () => {
  assert.equal(DECLARED_EXTENSION_SESSION_VIEW.clientType, "extension");
  assert.ok(DECLARED_EXTENSION_SESSION_VIEW.capabilities?.some((capability) => capability.id === "web.actions" && capability.actionTypes?.includes("web.dom.extract_list")));
  assert.equal(DECLARED_EXTENSION_SESSION_VIEW.metadata?.domainId, "web-automation");
});
