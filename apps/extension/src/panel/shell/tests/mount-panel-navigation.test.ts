import assert from "node:assert/strict";
import test from "node:test";
import { FakeElement, fake, withFakeDocument } from "../../chat/tests/fake-dom";
import { targetCore } from "../../chat/conversation/tests/target-core";
import { statusWith } from "../../tests/status-fixture";
import { RUNTIME_MESSAGES as M } from "../../../shared/constants";
import { AUTOMATION_PANEL_MESSAGES as S } from "../../../shared/protocol";
import { mountPanel } from "../mount-panel";
import { CHAT_PROJECT_NAVIGATION } from "../../chat/project-navigation";
import { ACTIVITY_MESSAGES, type ClientGatewayActivity } from "../../../shared/activity/index";

const settle = async () => { for (let i = 0; i < 25; i++) await Promise.resolve(); };

test("mounted extension-view project event opens actual scoped Chat and authorized empty readiness", async () => mounted(async ({ root, byId, navigate, core }) => {
  assert.equal(byId("panelScreen-chat").hidden, true);
  navigate({ projectId: "new-project", instruction: "invalid extra field" });
  assert.equal(byId("panelScreen-chat").hidden, true);
  navigate({ projectId: "new-project" });
  assert.equal(byId("panelScreen-chat").hidden, false);
  assert.equal(byId("panelScreen-automations").hidden, true);
  await settle();
  const chat = root.byClass("chat-panel")[0]!;
  assert.equal(chat.getAttribute(CHAT_PROJECT_NAVIGATION.projectAttribute), "new-project");
  assert.equal(chat.getAttribute(CHAT_PROJECT_NAVIGATION.scopeStateAttribute), "ready");
  assert.equal(byId("conversationInput").disabled, false);
  assert.ok(core.sent.some(message => message.type === M.panelConversationRead && message.projectId === "new-project"));
}));

async function mounted(body: (view: Awaited<ReturnType<typeof create>>) => void | Promise<void>) {
  await withFakeDocument(async () => {
    const globals = globalThis as unknown as Record<string, unknown>;
    const before = { chrome: globals.chrome, window: globals.window, setInterval: globals.setInterval, clearInterval: globals.clearInterval };
    const intervals = new Map<object, { run(): void; ms: number }>();
    globals.setInterval = (run: () => void, ms: number) => { const handle = {}; intervals.set(handle, { run, ms }); return handle; };
    globals.clearInterval = (handle: object) => intervals.delete(handle);
    const doc = document as unknown as { createElement(tag: string): FakeElement; createElementNS(ns: string, tag: string): FakeElement; activeElement: FakeElement; focused: boolean; focusCalls: FakeElement[]; body: FakeElement; documentElement: FakeElement };
    const make = doc.createElement;
    doc.focused = true;
    doc.focusCalls = [];
    const matches = (el: FakeElement, selector: string): boolean => selector.split(",").some((raw) => {
      const part = raw.trim();
      if (part === "[hidden]") return el.hidden;
      if (part === "[inert]") return Boolean((el as unknown as { inert: boolean }).inert);
      if (part.startsWith(".")) return el.className.split(/\s+/u).includes(part.slice(1));
      if (part.startsWith("#")) return el.id === part.slice(1);
      return el.tagName.toLowerCase() === part;
    });
    doc.createElement = (tag) => {
      const el = make(tag);
      const captures = new Map<string, Array<(event: { type: string; [key: string]: unknown }) => void>>();
      const add = el.addEventListener.bind(el);
      Object.defineProperties(el, { ownerDocument: { value: doc }, parentElement: { get: () => el.parentNode }, isConnected: { get: () => el === doc.body || doc.body?.descendants().includes(el) } });
      const closest = (selector: string) => { for (let node: FakeElement | null = el; node; node = node.parentNode) if (matches(node, selector)) return node; return null; };
      Object.assign(el, {
        contains: (node: FakeElement) => node === el || el.descendants().includes(node), closest, click: () => el.dispatch("click"),
        getClientRects: () => el.isConnected && !closest("[hidden], [inert]") ? [{}] : [],
        querySelectorAll: (selector: string) => el.descendants().filter((node) => matches(node, selector)),
        querySelector: (selector: string) => el.descendants().find((node) => matches(node, selector)) ?? null,
        classList: { contains: (name: string) => el.className.split(/\s+/u).includes(name), toggle: (name: string, on: boolean) => { const names = new Set(el.className.split(/\s+/u).filter(Boolean)); if (on) names.add(name); else names.delete(name); el.className = [...names].join(" "); } }
      });
      el.focus = () => { if (!el.disabled && !closest("[hidden], [inert]")) { doc.activeElement = el; doc.focusCalls.push(el); } };
      const remove = el.removeChild.bind(el);
      el.removeChild = (node) => { if (node === doc.activeElement || (node instanceof FakeElement && node.descendants().includes(doc.activeElement))) doc.activeElement = doc.body; remove(node); };
      el.addEventListener = (type, listener, capture?: unknown) => { if (capture) captures.set(type, [...(captures.get(type) ?? []), listener]); else add(type, listener); };
      Object.assign(el, { capture: captures });
      el.dispatch = (type, fields = {}) => {
        const path: FakeElement[] = []; for (let node: FakeElement | null = el; node; node = node.parentNode) path.push(node);
        const event = { type, target: el, ...fields };
        for (const node of [...path].reverse()) for (const listener of (node as unknown as { capture: typeof captures }).capture.get(type) ?? []) listener(event);
        for (const node of path) for (const listener of node.listeners.get(type) ?? []) listener(event);
      };
      return el;
    };
    doc.createElementNS = (_ns, tag) => doc.createElement(tag);
    doc.body = doc.createElement("body"); doc.documentElement = doc.createElement("html"); doc.activeElement = doc.body;
    Object.assign(doc, { hasFocus: () => doc.focused, addEventListener: () => {}, removeEventListener: () => {} });
    const events = new Map<string, (event?: Event) => void>();
    globals.window = { addEventListener: (type: string, listener: (event?: Event) => void) => events.set(type, listener), dispatchEvent: (event: Event) => { events.get(event.type)?.(event); return true; }, setTimeout, clearTimeout };
    try { await body(await create(doc, globals, intervals)); } finally { events.get("pagehide")?.(); await settle(); Object.assign(globals, before); }
  });
}

async function create(doc: { body: FakeElement; activeElement: FakeElement; focused: boolean; focusCalls: FakeElement[] }, globals: Record<string, unknown>, intervals: Map<object, { run(): void; ms: number }>) {
  const core = targetCore([{ conversationId: "conv-f", subjectKind: "flow", subjectId: "f", turns: [{ turnId: "old-turn", author: "person", text: "Keep my history" }] }]);
  const status = statusWith({ connectionState: "connected", paired: true });
  const listeners = new Set<(message: unknown) => void>();
  let refuseChat = false;
  let flows = [{ flowId: "f", name: "Orders" }];
  let runs: Array<{ runId: string; flowId: string; status: string; adaptationCount: number }> = [];
  const messages: Array<{ type: string }> = [];
  globals.chrome = { runtime: { onMessage: { addListener: (listener: (message: unknown) => void) => listeners.add(listener), removeListener: (listener: (message: unknown) => void) => listeners.delete(listener) }, sendMessage: (message: { type: string }, done: (reply: unknown) => void) => {
    messages.push(message);
    if (message.type === M.getStatus) done({ ok: true, status });
    else if (message.type === S.listAutomations) done({ ok: true, payload: { flows, runs } });
    else if (message.type === S.runDetail) done({ ok: true, payload: { runDetail: { summary: runs[0], adaptationIds: ["learned"], datasets: [{ datasetId: "d", label: "Data" }] }, adaptations: [] } });
    else if (message.type === "extractionGetSession") done({ ok: true });
    else if (refuseChat && message.type === M.panelConversationRead) done({ ok: false, error: "Unknown FluxIQ extension message." });
    else void core.request(message).then((reply) => done(reply.ok ? reply.value : { ok: false }));
  } } };
  const root = fake(document.createElement("div")); doc.body.append(root);
  mountPanel(root as unknown as HTMLElement, "sidepanel");
  await settle();
  const byId = (id: string) => root.descendants().find((node) => node.id === id)!;
  const tab = byId("panelTab-automations"); tab.focus(); tab.dispatch("click"); await settle();
  const row = root.byClass("automation-row")[0]!;
  assert.ok(row, "actual shell loaded automation rows");
  return { root, doc, row, core, byId, messages, navigate: (detail: unknown) => (globals.window as EventTarget).dispatchEvent(new CustomEvent(CHAT_PROJECT_NAVIGATION.event, { detail })), pendingRun: () => { runs = [{ runId: "r", flowId: "f", status: "completed", adaptationCount: 1 }]; }, refuse: () => { refuseChat = true; }, push: () => { for (const listener of listeners) listener({ type: M.statusChanged, status }); },
    status,
    activity: (current: ClientGatewayActivity | null) => { for (const listener of listeners) listener({ type: ACTIVITY_MESSAGES.changed, state: { current, display: null, recent: current ? [current] : [], overlay: "expanded", live: true } }); }, refreshRows: async (next: typeof flows) => { flows = next; for (const timer of [...intervals.values()]) if (timer.ms === 30_000) timer.run(); await settle(); } };
}

test("focused row descendant activation opens target, shows Chat, then focuses enabled composer", async () => mounted(async ({ row, core, byId, doc }) => {
  const box = byId("conversationInput");
  const focus = box.focus.bind(box);
  box.focus = () => { assert.equal(byId("panelScreen-chat").hidden, false); assert.equal(byId("panelScreen-automations").hidden, true); assert.match(box.placeholder, /Orders/u); focus(); };
  row.focus(); row.children[0]!.dispatch("click");
  assert.ok(doc.activeElement === box, "focused row hands off after showing Chat");
  await settle();
  assert.ok(core.sent.some((message) => message.type === M.panelConversationRead && message.kind === "list" && message.subjectId === "f"));
}));

test("unavailable composer hands focused activation to selected visible Chat tab", async () => mounted(async (view) => {
  view.refuse(); view.row.focus(); view.row.dispatch("click"); await settle();
  view.byId("panelTab-automations").dispatch("click"); await settle();
  view.row.focus(); view.row.dispatch("click");
  assert.ok(view.doc.activeElement === view.byId("panelTab-chat"), "unavailable composer uses Chat tab");
  assert.equal(view.byId("panelTab-chat").getAttribute("aria-selected"), "true");
}));

test("external focus, unfocused document and hidden source never hand off", async () => {
  for (const condition of ["external", "unfocused", "hidden", "document-hidden"] as const) await mounted(({ row, doc, root }) => {
    const outside = fake(document.createElement("input")); doc.body.append(outside);
    row.focus();
    if (condition === "external") outside.focus();
    if (condition === "unfocused") doc.focused = false;
    if (condition === "hidden") root.hidden = true;
    if (condition === "document-hidden") Object.assign(document, { visibilityState: "hidden" });
    const count = doc.focusCalls.length;
    row.dispatch("click");
    assert.equal(doc.focusCalls.length, count, condition);
  });
});

test("passive status/reconnect draws preserve external focus after navigation", async () => mounted(async ({ row, doc, push }) => {
  row.focus(); row.dispatch("click");
  const outside = fake(document.createElement("input")); doc.body.append(outside); outside.focus();
  const count = doc.focusCalls.length;
  push(); await settle();
  assert.equal(doc.activeElement, outside);
  assert.equal(doc.focusCalls.length, count);
}));

test("native keyboard click follows the same exact focused-row handoff", async () => mounted(({ row, byId, doc }) => {
  row.focus(); row.dispatch("click", { detail: 0 });
  assert.ok(doc.activeElement === byId("conversationInput"));
}));

test("unconsumed capture expires before a later programmatic row handler", async () => mounted(async ({ row, doc }) => {
  const handlers = row.listeners.get("click")!;
  row.listeners.set("click", []);
  row.focus(); row.dispatch("click"); await settle();
  const count = doc.focusCalls.length;
  for (const handler of handlers) handler({ type: "click", target: row });
  assert.equal(doc.focusCalls.length, count, "old capture cannot authorize passive navigation focus");
}));

test("list rename synchronizes open chat labels without read/history/draft/selection/focus/scroll reset", async () => mounted(async ({ row, root, byId, doc, core, refreshRows }) => {
  row.focus(); row.dispatch("click"); await settle();
  const box = byId("conversationInput"); box.value = "Keep this draft";
  Object.assign(box, { selectionStart: 3, selectionEnd: 8 }); box.focus();
  const scroller = root.byClass("chat-scroll")[0]!;
  scroller.scrollHeight = 1200; scroller.clientHeight = 200; scroller.scrollTop = 140; scroller.dispatch("wheel"); scroller.dispatch("scroll");
  const message = root.byClass("chat-msg")[0]!;
  const calls = core.sent.length;
  const focusCalls = doc.focusCalls.length;
  await refreshRows([{ flowId: "f", name: "New orders" }]);
  assert.equal(root.byClass("chat-context-name")[0]!.textContent, "New orders");
  assert.equal(root.byClass("chat-context-name")[0]!.getAttribute("title"), "New orders");
  assert.equal(box.placeholder, "Message FluxIQ about New orders");
  assert.equal(root.byClass("strip-run")[0]!.getAttribute("aria-label"), "Run New orders");
  assert.ok(root.byClass("chat-msg")[0] === message);
  assert.equal(box.value, "Keep this draft");
  assert.equal((box as unknown as HTMLTextAreaElement).selectionStart, 3);
  assert.equal((box as unknown as HTMLTextAreaElement).selectionEnd, 8);
  assert.equal(scroller.scrollTop, 140);
  assert.equal(root.byClass("chat-jump")[0]!.hidden, false);
  assert.equal(core.sent.length, calls);
  assert.equal(doc.focusCalls.length, focusCalls);
  assert.ok(doc.activeElement === box);
  await refreshRows([{ flowId: "f", name: "New orders" }]);
  assert.equal(core.sent.length, calls);
}));

test("missing current-list flow retains conversation and draft; return refreshes remembered name", async () => mounted(async ({ row, root, byId, core, doc, refreshRows }) => {
  row.focus(); row.dispatch("click"); await settle();
  const box = byId("conversationInput"); box.value = "Historical draft";
  const message = root.byClass("chat-msg")[0]!;
  const outside = fake(document.createElement("input")); doc.body.append(outside); outside.focus();
  const calls = core.sent.length;
  await refreshRows([]);
  assert.match(root.byClass("strip-lines")[0]!.textContent, /unavailable in the current list/u);
  assert.equal(root.byClass("strip-run")[0]!.disabled, true);
  assert.equal(root.byClass("chat-context-name")[0]!.textContent, "Orders");
  assert.ok(root.byClass("chat-msg")[0] === message);
  assert.equal(box.value, "Historical draft");
  assert.ok(doc.activeElement === outside);
  await refreshRows([{ flowId: "f", name: "Returned orders" }]);
  assert.doesNotMatch(root.byClass("strip-lines")[0]!.textContent, /unavailable/u);
  assert.equal(root.byClass("chat-context-name")[0]!.textContent, "Returned orders");
  assert.equal(box.value, "Historical draft");
  assert.equal(core.sent.length, calls);
  assert.ok(doc.activeElement === outside);
}));

test("passive name echo adds no detail read while existing learned-run polling continues", async () => mounted(async ({ row, root, messages, pendingRun, refreshRows }) => {
  row.focus(); row.dispatch("click"); await settle();
  pendingRun(); await refreshRows([{ flowId: "f", name: "Orders" }]);
  const count = messages.filter((message) => message.type === S.runDetail).length;
  const exports = root.byClass("strip-exports")[0]!.descendants().filter((node) => node.tagName === "BUTTON");
  await refreshRows([{ flowId: "f", name: "Renamed orders" }]);
  assert.equal(messages.filter((message) => message.type === S.runDetail).length - count, 1, "only the existing poll's pending validation detail read");
  assert.deepEqual(root.byClass("strip-exports")[0]!.descendants().filter((node) => node.tagName === "BUTTON"), exports);
}));

test("passive marker does not suppress different reentrant flow or later explicit navigation", async () => mounted(async ({ row, root, core, refreshRows }) => {
  await refreshRows([{ flowId: "f", name: "Orders" }, { flowId: "second", name: "Second" }]);
  core.thread("conv-f")!.turns = [];
  row.focus(); row.dispatch("click"); await settle();
  const second = root.byClass("automation-row")[1]!;
  const name = root.byClass("chat-empty-title")[0]!;
  const text = Object.getOwnPropertyDescriptor(FakeElement.prototype, "textContent")!;
  let triggered = false;
  Object.defineProperty(name, "textContent", { get: () => text.get!.call(name), set: (value: string) => { text.set!.call(name, value); if (value === "Ask about Renamed first" && !triggered) { triggered = true; second.dispatch("click"); } } });
  await refreshRows([{ flowId: "f", name: "Renamed first" }, { flowId: "second", name: "Second" }]);
  assert.equal(root.byClass("strip-run")[0]!.getAttribute("aria-label"), "Run Second", "different reentrant navigation reaches strip during marker");
  row.dispatch("click"); await settle();
  assert.equal(root.byClass("strip-run")[0]!.getAttribute("aria-label"), "Run Renamed first", "marker is restored before later explicit navigation");
}));

test("the empty latest chat's Extract shows Automations with the extraction sheet open, under its kept ids", async () => mounted(async ({ root, doc, byId, messages }) => {
  // The open sheet moves itself to the body (`panel/extraction/dialog-focus.ts`) and watches it.
  const globals = globalThis as unknown as Record<string, unknown>;
  const observer = globals.MutationObserver;
  globals.MutationObserver = class { observe(): void {} disconnect(): void {} };
  const inBody = (id: string) => doc.body.descendants().find((node) => node.id === id);
  byId("panelTab-chat").dispatch("click"); await settle();
  assert.equal(byId("panelScreen-chat").hidden, false);
  assert.ok(messages.some((message) => message.type === M.panelModelReadiness), "the empty latest chat read the model keys");
  const extract = root.byClass("chat-start").find((button) => button.getAttribute("data-start") === "extract")!;
  assert.equal(extract.textContent, "Extract data from this page");
  assert.equal(byId("extractionPanel").hidden, true);
  try {
    extract.dispatch("click"); await settle();
    assert.equal(byId("panelScreen-automations").hidden, false);
    assert.equal(byId("panelScreen-chat").hidden, true);
    assert.equal(byId("panelTab-automations").getAttribute("aria-selected"), "true");
    assert.equal(inBody("extractionPanel")?.hidden, false, "the sheet is open");
    for (const id of ["extractDataButton", "extractionStatus", "extractionCloseButton", "extractionConfirmButton"]) assert.ok(inBody(id), id);
  } finally {
    inBody("extractionCloseButton")?.dispatch("click");
    globals.MutationObserver = observer;
  }
}));

function runEvent(id: string, sequence: number, fields: Partial<ClientGatewayActivity> = {}): ClientGatewayActivity {
  return { activityId: `run:${id}`, sequence, subject: { kind: "run", id, projectId: "p", flowId: "f" }, phase: "running", label: "Running step 1 of 2", at: "2026-10-08T00:00:00.000Z", ...fields };
}

test("a run that starts while Automations shows switches to Chat once, not on every event", async () => mounted(async ({ byId, activity }) => {
  assert.equal(byId("panelScreen-chat").hidden, true);
  activity(runEvent("r1", 1)); await settle();
  assert.equal(byId("panelScreen-chat").hidden, false);
  assert.equal(byId("panelTab-chat").getAttribute("aria-selected"), "true");
  byId("panelTab-automations").dispatch("click"); await settle();
  activity(runEvent("r1", 2)); await settle();
  assert.equal(byId("panelScreen-chat").hidden, true, "a later event of the same run leaves the person's tab alone");
  activity(runEvent("r1", 3, { final: true })); await settle();
  assert.equal(byId("panelScreen-chat").hidden, true);
  activity(runEvent("r2", 4)); await settle();
  assert.equal(byId("panelScreen-chat").hidden, false, "the next run is followed again");
}));

test("a run that starts while Settings shows closes them and shows Chat; a build does not", async () => mounted(async ({ byId, activity }) => {
  byId("settingsButton").dispatch("click"); await settle();
  assert.equal(byId("panelScreen-chat").hidden, true);
  assert.equal(byId("panelScreen-automations").hidden, true);
  activity({ ...runEvent("f", 1), activityId: "build:f", subject: { kind: "build", id: "f", projectId: "p", flowId: "f" } }); await settle();
  assert.equal(byId("panelScreen-chat").hidden, true, "a build started elsewhere never moves the panel");
  activity(runEvent("r", 2)); await settle();
  assert.equal(byId("panelScreen-chat").hidden, false);
}));

test("a run that starts during a recording, or for another project, does not switch", async () => mounted(async ({ byId, activity, status, push }) => {
  Object.assign(status, { recordingState: "recording", projectId: "p" }); push(); await settle();
  activity(runEvent("during", 1)); await settle();
  assert.equal(byId("panelScreen-chat").hidden, true);
  Object.assign(status, { recordingState: "paused" }); push(); await settle();
  activity(runEvent("paused", 2)); await settle();
  assert.equal(byId("panelScreen-chat").hidden, true);
  Object.assign(status, { recordingState: "idle" }); push(); await settle();
  assert.equal(byId("panelScreen-automations").hidden, false, "the ended recording is reviewed on Automations");
  activity({ ...runEvent("elsewhere", 3), subject: { kind: "run", id: "elsewhere", projectId: "q", flowId: "f" } }); await settle();
  assert.equal(byId("panelScreen-chat").hidden, true, "another project's run is not this panel's");
}));

test("typing in a Settings field holds the switch until the person leaves the field", async () => mounted(async ({ byId, activity, doc }) => {
  byId("settingsButton").dispatch("click"); await settle();
  const field = byId("gatewayUrl"); field.focus();
  assert.ok(doc.activeElement === field);
  activity(runEvent("r", 1)); await settle();
  assert.equal(byId("panelScreen-chat").hidden, true);
  assert.ok(doc.activeElement === field, "the field keeps the focus");
  doc.body.focus(); doc.activeElement = doc.body;
  activity(runEvent("r", 2)); await settle();
  assert.equal(byId("panelScreen-chat").hidden, false);
}));

test("focus on a control the switch hides moves to the Chat tab", async () => mounted(async ({ byId, activity, doc, row: control }) => {
  const tab = byId("panelTab-automations");
  control.focus();
  assert.ok(doc.activeElement === control);
  activity(runEvent("r", 1)); await settle();
  assert.equal(byId("panelScreen-chat").hidden, false);
  assert.ok(doc.activeElement === byId("panelTab-chat"));
  assert.notEqual(tab.getAttribute("aria-selected"), "true");
}));

test("a followed run of another automation shows its steps: the chat leaves that automation's thread for the latest", async () => mounted(async ({ row, byId, activity, doc }) => {
  row.children[0]!.dispatch("click"); await settle();
  const box = byId("conversationInput");
  assert.match(box.placeholder, /Orders/u, "the chat is on the Orders automation's thread");
  doc.activeElement = doc.body;
  byId("panelTab-automations").dispatch("click"); await settle();
  activity({ ...runEvent("other", 1), subject: { kind: "run", id: "other", projectId: "p", flowId: "g" } }); await settle();
  assert.equal(byId("panelScreen-chat").hidden, false);
  assert.equal(box.placeholder, "Message FluxIQ", "the latest chat shows a run that speaks through no thread");
}));

test("a followed run of the automation on screen keeps its thread", async () => mounted(async ({ row, byId, activity, doc }) => {
  row.children[0]!.dispatch("click"); await settle();
  doc.activeElement = doc.body;
  byId("panelTab-automations").dispatch("click"); await settle();
  activity(runEvent("same", 1)); await settle();
  assert.equal(byId("panelScreen-chat").hidden, false);
  assert.match(byId("conversationInput").placeholder, /Orders/u);
}));
