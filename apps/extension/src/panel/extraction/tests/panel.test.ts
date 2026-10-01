import assert from "node:assert/strict";
import test from "node:test";
import { EXTRACTION_RUNTIME_MESSAGES as M } from "../../../shared/extraction-messages";
import { mountExtractionPanel } from "../panel";
import { proposalFixture } from "./proposal-fixture";
import { withDialogDom } from "./dialog-dom";

function deferred<T>() { let resolve!: (value: T) => void; let reject!: (reason: Error) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
const picked = { sessionId: "s1", tabId: 11, form: "list", state: "picked", proposal: proposalFixture(), preview: [{ name: "Fixture name", price: "12" }] };

test("entry opens a root-mounted modal and leaves browser page selection alone", async () => withDialogDom(async (world) => {
  const handle = mountExtractionPanel(world.native(world.host));
  handle.setAvailable(true);
  await world.flush();
  const entry = world.get("extractDataButton");
  entry.focus(); entry.dispatch("click");
  await world.flush();
  assert.equal(world.get("extractionPanel").parentNode, world.document.body);
  assert.equal(world.host.inert, true);
  assert.equal(world.document.activeElement, world.get("extractionStatus"));
  world.document.focused = false;
  const calls = world.document.focusCalls.length;
  await world.tick();
  assert.equal(world.document.focusCalls.length, calls);
  assert.equal(world.sent.filter((message) => message.type === M.cancel).length, 0);
}));

test("restored picked session opens without recording/start, retains field caret after preview render", async () => withDialogDom(async (world) => {
  world.reply = () => ({ ok: true, session: picked });
  mountExtractionPanel(world.native(world.host));
  await world.flush();
  assert.equal(world.get("extractionPanel").parentNode, world.document.body);
  assert.equal(world.sent.filter((message) => message.type === M.start).length, 0);
  const name = world.get("extractionFields").querySelector(".extraction-field-label")!;
  name.focus(); name.setSelectionRange(1, 3);
  name.value = "New name"; name.dispatch("change");
  const current = world.get("extractionFields").querySelector(".extraction-field-label")!;
  assert.equal(world.document.activeElement, current);
  assert.equal(current.selectionStart, 1);
  assert.equal(current.selectionEnd, 3);
}));

test("failed cancellation immediately erases preview but keeps a retryable visible shell", async () => withDialogDom(async (world) => {
  const cancel = deferred<unknown>();
  world.reply = (message) => message.type === M.cancel ? cancel.promise : { ok: true, session: picked };
  mountExtractionPanel(world.native(world.host));
  await world.flush();
  world.get("extractionCancelButton").dispatch("click");
  await world.flush();
  assert.equal(world.get("extractionPanel").hidden, false);
  assert.equal(world.get("extractionPreviewBody").textContent, "");
  assert.equal(world.get("extractionCloseButton").disabled, true);
  cancel.reject(new Error("Cancel did not answer"));
  await world.flush();
  assert.equal(world.get("extractionPanel").hidden, false);
  assert.match(world.get("extractionNotice").textContent, /Cancel did not answer/u);
  world.reply = () => ({ ok: true });
  world.get("extractionCloseButton").dispatch("click");
  await world.flush();
  assert.equal(world.get("extractionPanel").hidden, true);
  assert.equal(world.host.inert, false);
}));

test("confirmation freezes editable controls and keeps captured count receipt visible", async () => withDialogDom(async (world) => {
  const confirm = deferred<unknown>();
  world.reply = (message) => message.type === M.confirm ? confirm.promise : { ok: true, session: picked };
  mountExtractionPanel(world.native(world.host));
  await world.flush();
  world.get("extractionConfirmButton").focus(); world.get("extractionConfirmButton").dispatch("click");
  await world.flush();
  assert.equal(world.get("extractionLabel").disabled, true);
  assert.equal(world.get("extractionFields").querySelector(".extraction-field-label")!.disabled, true);
  assert.equal(world.get("extractionCloseButton").disabled, true);
  confirm.resolve({ ok: true, datasetId: "data", label: "Orders", recordCount: 2, pagesRead: 1, truncated: false, durationMs: 1 });
  await world.flush();
  assert.equal(world.get("extractionPanel").hidden, false);
  assert.match(world.get("extractionStatus").textContent, /2 records/u);
  assert.equal(world.get("extractionPreviewBody").textContent, "");
}));

test("late mount session cannot reopen a cancelled pick", async () => withDialogDom(async (world) => {
  const initial = deferred<unknown>();
  let reads = 0;
  world.reply = (message) => message.type === M.getSession && reads++ === 0 ? initial.promise : { ok: true };
  const handle = mountExtractionPanel(world.native(world.host)); handle.setAvailable(true);
  world.get("extractDataButton").dispatch("click"); await world.flush();
  world.get("extractionCancelButton").dispatch("click"); await world.flush();
  initial.resolve({ ok: true, session: picked }); await world.flush();
  assert.equal(world.get("extractionPanel").hidden, true);
  assert.equal(world.timers.size, 0);
}));


test("prepare stays busy, page pick begins once, IME/busy Escape does not cancel", async () => withDialogDom(async (world) => {
  const prepare = deferred<void>();
  const handle = mountExtractionPanel(world.native(world.host), { prepare: () => prepare.promise });
  handle.setAvailable(true); await world.flush();
  world.get("extractDataButton").dispatch("click"); await world.flush();
  assert.equal(world.get("extractionCloseButton").disabled, true);
  world.document.emit("keydown", { key: "Escape", isComposing: true });
  world.document.emit("keydown", { key: "Escape" });
  world.get("extractionCloseButton").dispatch("click"); world.get("extractDataButton").dispatch("click");
  assert.equal(world.sent.filter((message) => message.type === M.cancel).length, 0);
  assert.equal(world.sent.filter((message) => message.type === M.start).length, 0);
  prepare.resolve(); await world.flush();
  assert.equal(world.sent.filter((message) => message.type === M.start).length, 1);
  assert.equal(world.get("extractionCloseButton").disabled, false);
  world.get("extractionCloseButton").dispatch("click"); await world.flush();
}));

test("late polling proposal is dropped after cancel acknowledgement", async () => withDialogDom(async (world) => {
  const poll = deferred<unknown>(); let reads = 0;
  world.reply = (message) => message.type === M.getSession && reads++ > 0 ? poll.promise : { ok: true };
  const handle = mountExtractionPanel(world.native(world.host)); handle.setAvailable(true); await world.flush();
  world.get("extractDataButton").dispatch("click"); await world.flush(); await world.tick();
  world.get("extractionCloseButton").dispatch("click"); await world.flush();
  poll.resolve({ ok: true, session: picked }); await world.flush();
  assert.equal(world.get("extractionPanel").hidden, true);
  assert.equal(world.timers.size, 0);
  assert.equal(world.get("extractionPreviewBody").textContent, "");
  assert.equal(world.document.observers.size, 0);
}));

test("old preview cannot contaminate a newer pick with the same columns", async () => withDialogDom(async (world) => {
  const oldPreview = deferred<unknown>();
  let currentSession = picked;
  world.reply = (message) => message.type === M.getSession && message.fields ? oldPreview.promise : { ok: true, session: currentSession };
  const handle = mountExtractionPanel(world.native(world.host)); handle.setAvailable(true); await world.flush();
  const field = world.get("extractionFields").querySelector(".extraction-field")!;
  const exclude = field.querySelectorAll("input").find((input) => input.type === "radio" && input.value === "exclude")!;
  exclude.focus(); exclude.checked = true; exclude.dispatch("change"); await world.flush();
  assert.doesNotMatch(world.get("extractionPreviewBody").textContent, /Fixture name/u);
  world.get("extractionCloseButton").dispatch("click"); await world.flush();
  currentSession = { ...picked, sessionId: "s2", proposal: { ...picked.proposal, fields: picked.proposal.fields.map((column) => column.key === "name" ? { ...column, spec: { ...column.spec, handling: "exclude" as const } } : column) }, preview: [{ name: "Fixture name", price: "NEW PRICE" }] };
  world.get("extractDataButton").dispatch("click"); await world.flush(); await world.tick();
  assert.match(world.get("extractionPreviewBody").textContent, /NEW PRICE/u);
  oldPreview.resolve({ ok: true, session: { ...picked, preview: [{ name: "OLD PREVIEW", price: "OLD PREVIEW" }] } }); await world.flush();
  assert.doesNotMatch(world.get("extractionPreviewBody").textContent, /OLD PREVIEW/u);
  world.get("extractionCloseButton").dispatch("click"); await world.flush();
}));

test("preview refresh preserves deliberate external focus and field removal chooses neighbour", async () => withDialogDom(async (world) => {
  const preview = deferred<unknown>();
  world.reply = (message) => message.type === M.getSession && message.fields ? preview.promise : { ok: true, session: picked };
  mountExtractionPanel(world.native(world.host)); await world.flush();
  const field = world.get("extractionFields").querySelector(".extraction-field")!;
  const exclude = field.querySelectorAll("input").find((input) => input.type === "radio" && input.value === "exclude")!;
  exclude.focus(); exclude.checked = true; exclude.dispatch("change"); await world.flush();
  world.get("extractionCancelButton").focus();
  const count = world.document.focusCalls.length;
  preview.resolve({ ok: true, session: picked }); await world.flush();
  assert.equal(world.document.activeElement, world.get("extractionCancelButton"));
  assert.equal(world.document.focusCalls.length, count);
  const remove = world.get("extractionFields").querySelector(".extraction-field-remove")!;
  remove.focus(); remove.dispatch("click"); await world.flush();
  assert.equal(world.document.activeElement, world.get("extractionFields").querySelector(".extraction-field-label"));
  world.get("extractionCloseButton").dispatch("click"); await world.flush();
}));

test("host move and unavailable opener close to current visible selected tab", async () => withDialogDom(async (world) => {
  const tab = world.document.createElement("button"); tab.setAttribute("role", "tab"); tab.setAttribute("aria-selected", "true"); world.document.body.append(tab);
  const handle = mountExtractionPanel(world.native(world.host)); handle.setAvailable(true); await world.flush();
  world.get("extractDataButton").focus(); world.get("extractDataButton").dispatch("click"); await world.flush();
  const bar = world.document.createElement("section"); world.document.body.append(bar); bar.append(world.host);
  assert.equal(world.get("extractionPanel").parentElement, world.document.body);
  handle.setAvailable(false, "Connect to FluxIQ");
  world.get("extractionCloseButton").dispatch("click"); await world.flush();
  assert.equal(world.document.activeElement, tab);
  assert.equal(world.get("extractionPanel").parentElement, world.host);
  assert.equal(world.host.parentElement, bar);
}));

test("page-cancelled session closes without duplicate cancel", async () => withDialogDom(async (world) => {
  let session: unknown = { sessionId: "s1", tabId: 11, form: "list", state: "picking" };
  world.reply = () => ({ ok: true, session });
  mountExtractionPanel(world.native(world.host)); await world.flush();
  session = undefined; await world.tick();
  assert.equal(world.get("extractionPanel").hidden, true);
  assert.equal(world.sent.filter((message) => message.type === M.cancel).length, 0);
  assert.equal(world.host.inert, false);
}));


test("prepare refusal keeps an operable modal error and never starts page pick", async () => withDialogDom(async (world) => {
  const handle = mountExtractionPanel(world.native(world.host), { prepare: async () => { throw new Error("Recording refused"); } });
  handle.setAvailable(true); await world.flush();
  world.get("extractDataButton").dispatch("click"); await world.flush();
  assert.equal(world.get("extractionPanel").hidden, false);
  assert.match(world.get("extractionNotice").textContent, /Recording refused/u);
  assert.equal(world.get("extractionCloseButton").disabled, false);
  assert.equal(world.sent.filter((message) => message.type === M.start).length, 0);
  world.get("extractionCloseButton").dispatch("click"); await world.flush();
}));

test("failed Confirm re-enables edits without accepting changes to submitted draft", async () => withDialogDom(async (world) => {
  const confirm = deferred<unknown>();
  world.reply = (message) => message.type === M.confirm ? confirm.promise : { ok: true, session: picked };
  mountExtractionPanel(world.native(world.host)); await world.flush();
  world.get("extractionConfirmButton").dispatch("click"); await world.flush();
  world.get("extractionLabel").value = "Unsaved during confirmation"; world.get("extractionLabel").dispatch("input");
  confirm.reject(new Error("Confirm refused")); await world.flush();
  assert.equal(world.get("extractionLabel").disabled, false);
  assert.equal(world.get("extractionLabel").value, "Extracted data");
  assert.match(world.get("extractionNotice").textContent, /Confirm refused/u);
  assert.equal(world.get("extractionPanel").hidden, false);
  world.get("extractionCloseButton").dispatch("click"); await world.flush();
}));

test("old preview completion cannot erase or refocus captured receipt", async () => withDialogDom(async (world) => {
  const preview = deferred<unknown>();
  world.reply = (message) => message.type === M.getSession && message.fields ? preview.promise
    : message.type === M.confirm ? { ok: true, datasetId: "data", label: "Orders", recordCount: 0, pagesRead: 1, truncated: false, durationMs: 1 }
      : { ok: true, session: picked };
  mountExtractionPanel(world.native(world.host)); await world.flush();
  const field = world.get("extractionFields").querySelector(".extraction-field")!;
  const exclude = field.querySelectorAll("input").find((input) => input.type === "radio" && input.value === "exclude")!;
  exclude.focus(); exclude.checked = true; exclude.dispatch("change"); await world.flush();
  world.get("extractionConfirmButton").focus(); world.get("extractionConfirmButton").dispatch("click"); await world.flush();
  const count = world.document.focusCalls.length;
  preview.resolve({ ok: true, session: picked }); await world.flush();
  assert.match(world.get("extractionStatus").textContent, /no records/u);
  assert.equal(world.get("extractionPreviewBody").textContent, "");
  assert.equal(world.document.focusCalls.length, count);
  assert.equal(world.document.activeElement, world.get("extractionStatus"));
  world.get("extractionCloseButton").dispatch("click"); await world.flush();
}));

test("restored recorded session never opens a modal or leaves inert background", async () => withDialogDom(async (world) => {
  world.reply = () => ({ ok: true, session: { ...picked, state: "recorded" } });
  mountExtractionPanel(world.native(world.host)); await world.flush();
  assert.equal(world.get("extractionPanel").hidden, true);
  assert.equal(world.host.inert, false);
  assert.equal(world.document.observers.size, 0);
}));

test("Firefox document recreation resumes background pick without prepare/start/cancel", async () => {
  let session: unknown = { sessionId: "s1", tabId: 11, form: "list", state: "picking" };
  await withDialogDom(async (world) => {
    world.reply = () => ({ ok: true, session });
    mountExtractionPanel(world.native(world.host)); await world.flush();
    assert.equal(world.get("extractionPanel").hidden, false);
    world.document.focused = false;
    assert.equal(world.sent.filter((message) => message.type === M.cancel).length, 0);
  });
  session = picked;
  await withDialogDom(async (world) => {
    world.reply = () => ({ ok: true, session });
    let prepared = 0;
    mountExtractionPanel(world.native(world.host), { prepare: async () => { prepared++; } }); await world.flush();
    assert.equal(world.get("extractionPanel").hidden, false);
    assert.equal(world.document.activeElement, world.get("extractionLabel"));
    assert.equal(prepared, 0);
    assert.equal(world.sent.filter((message) => message.type === M.start || message.type === M.cancel).length, 0);
  });
});
