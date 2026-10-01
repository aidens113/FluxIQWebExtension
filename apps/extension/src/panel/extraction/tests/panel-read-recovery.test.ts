import assert from "node:assert/strict";
import test from "node:test";
import { EXTRACTION_RUNTIME_MESSAGES as M } from "../../../shared/extraction-messages";
import { mountExtractionPanel } from "../panel";
import { proposalFixture } from "./proposal-fixture";
import { withDialogDom } from "./dialog-dom";

type World = Parameters<Parameters<typeof withDialogDom>[0]>[0];
const picked = { state: "picked", proposal: proposalFixture(), preview: [{ name: "Synthetic name", price: "Synthetic price", sku: "Synthetic sku" }] };
function deferred<T>() { let resolve!: (value: T) => void, reject!: (reason: Error) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function exclude(world: World, key: string) {
  const row = world.get("extractionFields").querySelectorAll(".extraction-field").find(row => row.dataset.field === key)!;
  const radio = row.querySelectorAll("input").find(input => input.type === "radio" && input.value === "exclude")!;
  radio.checked = true; radio.dispatch("change");
}

test("hidden mount-read failure offers visible recovery without opening sheet", async () => withDialogDom(async world => {
  world.reply = () => Promise.reject(new Error("synthetic-private-diagnostic"));
  mountExtractionPanel(world.native(world.host)); await world.flush();
  assert.equal(world.get("extractionPanel").hidden, true);
  assert.equal(world.host.inert, false);
  const retry = world.host.descendants().find(element => element.id === "extractionReadRetry");
  assert.ok(retry, "explicit existing-session Retry is mounted near entry");
  assert.equal(world.get("extractionReadRetry").closest("[hidden]"), null);
  assert.equal(world.host.textContent.includes("synthetic-private-diagnostic"), false);
}));

test("obsolete preview refusal after newer success cannot publish an error", async () => withDialogDom(async world => {
  const old = deferred<unknown>(); let reads = 0;
  world.reply = message => message.type === M.getSession && message.fields ? ++reads === 1 ? old.promise : { ok: true, session: picked } : { ok: true, session: picked };
  mountExtractionPanel(world.native(world.host)); await world.flush();
  exclude(world, "name"); await world.flush(); exclude(world, "price"); await world.flush();
  old.reject(new Error("synthetic-obsolete-error")); await world.flush();
  assert.equal(world.get("extractionNotice").hidden, true);
}));

test("current preview success clears the prior preview error", async () => withDialogDom(async world => {
  let reads = 0;
  world.reply = message => message.type === M.getSession && message.fields && ++reads === 1 ? Promise.reject(new Error("synthetic-preview-error")) : { ok: true, session: picked };
  mountExtractionPanel(world.native(world.host)); await world.flush(); exclude(world, "name"); await world.flush();
  assert.equal(world.get("extractionNotice").hidden, false);
  exclude(world, "price"); await world.flush();
  assert.equal(world.get("extractionNotice").hidden, true);
}));

test("explicit hidden recovery reads existing picked session without prepare/start", async () => withDialogDom(async world => {
  let failed = true, prepared = 0; world.reply = () => failed ? Promise.reject(new Error("private diagnostic")) : { ok: true, session: picked };
  mountExtractionPanel(world.native(world.host), { prepare: async () => { prepared++; } }); await world.flush(); const old = world.get("extractionReadRetry");
  assert.equal(old.parentElement, world.get("extractionEntryRecovery")); failed = false; old.dispatch("click"); await world.flush();
  assert.equal(world.get("extractionPanel").hidden, false); assert.equal(world.get("extractionEntryRecovery").hidden, true);
  assert.equal(prepared, 0); assert.equal(world.sent.filter(message => message.type === M.start).length, 0);
  const before = world.sent.length; old.dispatch("click"); await world.flush(); assert.equal(world.sent.length, before);
}));

test("picking read failure stops600ms polling and direct retry resumes one timer", async () => withDialogDom(async world => {
  let failed = false; world.reply = () => failed ? Promise.reject(new Error("diagnostic")) : { ok: true, session: { state: "picking" } };
  mountExtractionPanel(world.native(world.host)); await world.flush(); assert.equal(world.timers.size, 1); failed = true; await world.tick();
  assert.equal(world.timers.size, 0); const retry = world.get("extractionReadRetry"); assert.equal(retry.parentElement, world.get("extractionSheetRecovery"));
  failed = false; retry.dispatch("click"); await world.flush(); assert.equal(world.timers.size, 1); assert.equal(world.sent.filter(message => message.type === M.start).length, 0);
}));

test("pending current preview Retry keeps its control disabled and preserves raw typing/privacy", async () => withDialogDom(async world => {
  let failed = true; const preview = deferred<unknown>();
  world.reply = message => message.type === M.getSession && message.fields ? failed ? Promise.reject(new Error("diagnostic")) : preview.promise : { ok: true, session: picked };
  mountExtractionPanel(world.native(world.host)); await world.flush(); exclude(world, "name"); await world.flush();
  const field = world.get("extractionFields").querySelectorAll(".extraction-field").find(row => row.dataset.field === "price")!;
  const input = field.querySelector(".extraction-field-label")!; input.focus(); input.value = "  Kept intent  "; input.setSelectionRange(3, 6); input.dispatch("input");
  const retry = world.get("extractionReadRetry"); failed = false; retry.dispatch("click"); await world.flush(); const before = world.sent.length;
  assert.equal(world.get("extractionReadRetry"), retry); assert.equal(retry.disabled, true); assert.match(retry.textContent, /Refreshing/u); retry.dispatch("click"); await world.flush(); assert.equal(world.sent.length, before);
  preview.resolve({ ok: true, session: picked }); await world.flush();
  const current = world.get("extractionFields").querySelectorAll(".extraction-field").find(row => row.dataset.field === "price")!.querySelector(".extraction-field-label")!;
  assert.equal(current.value, "  Kept intent  "); assert.equal(world.document.activeElement, current); assert.equal(current.selectionStart, 3);
  assert.equal(world.get("extractionNotice").hidden, true); assert.doesNotMatch(world.get("extractionPreviewBody").textContent, /Synthetic name/u);
}));

test("obsolete Retry cannot start read after cancel or captured receipt", async () => withDialogDom(async world => {
  world.reply = message => message.type === M.getSession && message.fields ? Promise.reject(new Error("diagnostic")) : message.type === M.confirm ? { ok: true } : { ok: true, session: picked };
  const handle = mountExtractionPanel(world.native(world.host)); handle.setAvailable(true); await world.flush(); exclude(world, "name"); await world.flush(); const old = world.get("extractionReadRetry");
  world.get("extractionConfirmButton").dispatch("click"); await world.flush(); const before = world.sent.length; old.dispatch("click"); await world.flush();
  assert.equal(world.sent.length, before); assert.match(world.get("extractionStatus").textContent, /recorded/u);
  world.get("extractionCloseButton").dispatch("click"); await world.flush(); old.dispatch("click"); await world.flush(); assert.equal(world.get("extractionPanel").hidden, true);
}));

test("prepare retry runs preparation/start once and preserves original refusal text", async () => withDialogDom(async world => {
  let failed = true, prepared = 0; world.reply = message => ({ ok: true, ...(message.type === M.getSession ? {} : {}) });
  const handle = mountExtractionPanel(world.native(world.host), { prepare: async () => { prepared++; if (failed) throw new Error("Recording refused"); } }); handle.setAvailable(true); await world.flush();
  world.get("extractDataButton").dispatch("click"); await world.flush(); assert.equal(world.get("extractionNotice").textContent, "Recording refused"); const retry = world.get("extractionReadRetry"); assert.equal(retry.textContent, "Try starting again");
  failed = false; retry.dispatch("click"); retry.dispatch("click"); await world.flush(); assert.equal(prepared, 2); assert.equal(world.sent.filter(message => message.type === M.start).length, 1);
}));

for (const exists of [true, false]) test("uncertain start retry verifies session and never repeats successful prepare: " + exists, async () => withDialogDom(async world => {
  let started = 0, prepared = 0, verified = false;
  world.reply = message => { if (message.type === M.start) { started++; if (started === 1) return Promise.reject(new Error("diagnostic")); return { ok: true }; } return { ok: true, ...(verified && exists ? { session: picked } : {}) }; };
  const handle = mountExtractionPanel(world.native(world.host), { prepare: async () => { prepared++; } }); handle.setAvailable(true); await world.flush(); world.get("extractDataButton").dispatch("click"); await world.flush(); verified = true;
  const retry = world.get("extractionReadRetry"); assert.equal(retry.textContent, "Retry picking item"); retry.dispatch("click"); await world.flush(); assert.equal(prepared, 1); assert.equal(started, exists ? 1 : 2);
}));

test("old preview result cannot clear failed Confirm feedback", async () => withDialogDom(async world => {
  const preview = deferred<unknown>(); world.reply = message => message.type === M.getSession && message.fields ? preview.promise : message.type === M.confirm ? { ok: false, error: "Confirm refused" } : { ok: true, session: picked };
  mountExtractionPanel(world.native(world.host)); await world.flush(); exclude(world, "name"); await world.flush(); world.get("extractionConfirmButton").dispatch("click"); await world.flush();
  preview.resolve({ ok: true, session: picked }); await world.flush(); assert.equal(world.get("extractionNotice").textContent, "Confirm refused"); assert.equal(world.get("extractionNotice").hidden, false);
}));

for (const hidden of [false, true]) test("preview retry completion leaves browser-page or hidden-document focus free: " + hidden, async () => withDialogDom(async world => {
  let failed = true; const preview = deferred<unknown>(); world.reply = message => message.type === M.getSession && message.fields ? failed ? Promise.reject(new Error("diagnostic")) : preview.promise : { ok: true, session: picked };
  mountExtractionPanel(world.native(world.host)); await world.flush(); exclude(world, "name"); await world.flush(); const retry = world.get("extractionReadRetry"); retry.focus(); failed = false; retry.dispatch("click"); await world.flush();
  world.document.focused = hidden; if (hidden) world.document.visibilityState = "hidden"; const calls = world.document.focusCalls.length;
  preview.resolve({ ok: true, session: picked }); await world.flush(); assert.equal(world.document.focusCalls.length, calls);
}));

test("retired preview retry control is replaced for new failure and cannot issue current action", async () => withDialogDom(async world => {
  world.reply = message => message.type === M.getSession && message.fields ? Promise.reject(new Error("diagnostic")) : { ok: true, session: picked };
  mountExtractionPanel(world.native(world.host)); await world.flush(); exclude(world, "name"); await world.flush(); const old = world.get("extractionReadRetry"); old.focus(); exclude(world, "price"); await world.flush();
  const current = world.get("extractionReadRetry"); assert.notEqual(current, old); const before = world.sent.length; old.dispatch("click"); await world.flush(); assert.equal(world.sent.length, before);
  assert.equal(world.document.activeElement, world.get("extractionLabel"));
}));

test("actual fulfilled background refusal remains user-facing while unexpected rejection is fixed", async () => withDialogDom(async world => {
  let authoritative = true; world.reply = () => authoritative ? { ok: false, error: "Background declined item" } : Promise.reject(new Error("private diagnostic"));
  mountExtractionPanel(world.native(world.host)); await world.flush(); assert.equal(world.get("extractionEntryRecovery").textContent.includes("Background declined item"), true);
  authoritative = false; world.get("extractionReadRetry").dispatch("click"); await world.flush(); assert.equal(world.get("extractionEntryRecovery").textContent.includes("private diagnostic"), false); assert.match(world.get("extractionEntryRecovery").textContent, /Couldn't read/u);
}));

test("restored picked session awaiting proposal keeps the original sheet/polling recovery", async () => withDialogDom(async world => {
  world.reply = () => ({ ok: true, session: { state: "picked" } });
  mountExtractionPanel(world.native(world.host)); await world.flush();
  assert.equal(world.get("extractionPanel").hidden, false);
  assert.equal(world.timers.size, 1);
  assert.equal(world.sent.filter(message => message.type === M.start).length, 0);
}));
