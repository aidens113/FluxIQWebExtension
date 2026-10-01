import assert from "node:assert/strict";
import test from "node:test";
import { handleExtractionControl } from "../extraction";
import { EXTRACTION_RUNTIME_MESSAGES as M } from "../../shared/extraction-messages";
import { harness, startAndPick, sidepanel, responseOf, AUTOMATION_TAB } from "./extraction-harness";
test("unbound discovery selects automation active tab rather than globally latest other tab", async () => {
  const h = harness(), id = await startAndPick(h);
  const other = { ...h.manager, status: () => ({ ...h.manager.status(), activeTabId: AUTOMATION_TAB + 1 }) } as typeof h.manager;
  await handleExtractionControl({ type: M.start }, sidepanel, other, h.deps);
  const reply = responseOf(await handleExtractionControl({ type: M.getSession }, sidepanel, h.manager, h.deps)); assert.equal((reply.session as { sessionId: string }).sessionId, id);
});

test("missing explicit selected ID never discovers another session", async () => {
  const h = harness(); await startAndPick(h);
  const reply = responseOf(await handleExtractionControl({ type: M.getSession, sessionId: "missing" }, sidepanel, h.manager, h.deps)); assert.equal(reply.session, undefined);
});
test("no automation tab discovers no global latest session", async () => {
  const h = harness(); await startAndPick(h); const other = { ...h.manager, status: () => ({ ...h.manager.status(), activeTabId: undefined }) } as typeof h.manager;
  const reply = responseOf(await handleExtractionControl({ type: M.getSession }, sidepanel, other, h.deps)); assert.equal(reply.session, undefined);
});
test("actual start acknowledgement includes its stored immutable binding tuple", async () => {
  const h = harness(); const reply = responseOf(await handleExtractionControl({ type: M.start }, sidepanel, h.manager, h.deps));
  const stored = h.deps.sessions.get(reply.sessionId as string); assert.ok(stored); assert.equal(reply.tabId, stored.tabId); assert.equal(reply.form, stored.form);
});

test("explicit malformed ID cannot become active-tab discovery", async () => {
  const h = harness(); await startAndPick(h); const reply = responseOf(await handleExtractionControl({ type: M.getSession, sessionId: "" }, sidepanel, h.manager, h.deps)); assert.equal(reply.session, undefined);
});
