// The preview note says whether the sample under it is current.
//
// A column edit re-reads the preview without blocking the sheet. While that
// read is pending the note says "Refreshing preview..." (and that any rows
// shown are from the last read), the table is marked busy, and only the
// settled read writes the count again. A failed read says the sample was not
// refreshed, beside the existing alert and Retry preview; an older selection's
// read can neither mark a newer one pending nor call it stale.

import assert from "node:assert/strict";
import test from "node:test";
import { EXTRACTION_RUNTIME_MESSAGES as M } from "../../../shared/extraction-messages";
import { mountExtractionPanel } from "../panel";
import { proposalFixture } from "./proposal-fixture";
import { withDialogDom } from "./dialog-dom";

type World = Parameters<Parameters<typeof withDialogDom>[0]>[0];
const row = { name: "Synthetic name", price: "Synthetic price", sku: "Synthetic sku" };
const picked = (preview: Record<string, string>[] = [row]) => ({ sessionId: "s1", tabId: 11, form: "list", state: "picked", proposal: proposalFixture(), preview });
function deferred<T>() { let resolve!: (value: T) => void, reject!: (reason: Error) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function exclude(world: World, key: string) {
  const field = world.get("extractionFields").querySelectorAll(".extraction-field").find(item => item.dataset.field === key)!;
  const radio = field.querySelectorAll("input").find(input => input.type === "radio" && input.value === "exclude")!;
  radio.checked = true; radio.dispatch("change");
}
const note = (world: World) => world.get("extractionPreviewNote").textContent;
const busy = (world: World) => world.get("extractionPreviewTable").getAttribute("aria-busy");
const isPreviewRead = (message: Record<string, unknown>) => message.type === M.getSession && message.fields !== undefined;

test("a pending automatic read says Refreshing preview and marks the table busy, then the settled count", async () => withDialogDom(async world => {
  const read = deferred<unknown>();
  world.reply = message => isPreviewRead(message) ? read.promise : { ok: true, session: picked() };
  mountExtractionPanel(world.native(world.host)); await world.flush();
  assert.match(note(world), /^Showing 1 of 8 items\./u);
  assert.equal(busy(world), "false");
  exclude(world, "name"); await world.flush();
  assert.match(note(world), /^Refreshing preview\.\.\. The 1 row below is from the last read\./u);
  assert.doesNotMatch(note(world), /Showing/u, "a retained sample is never presented as current");
  assert.equal(busy(world), "true");
  assert.equal(world.get("extractionConfirmButton").disabled, false, "the read does not block the sheet");
  read.resolve({ ok: true, session: picked() }); await world.flush();
  assert.match(note(world), /^Showing 1 of 8 items\. 2 columns are not previewed/u);
  assert.equal(busy(world), "false");
}));

test("an unchanged count still passes through pending and is written again when the read settles", async () => withDialogDom(async world => {
  const read = deferred<unknown>(); const seen: string[] = [];
  world.reply = message => isPreviewRead(message) ? read.promise : { ok: true, session: picked() };
  mountExtractionPanel(world.native(world.host)); await world.flush();
  seen.push(note(world)); exclude(world, "name"); await world.flush(); seen.push(note(world));
  read.resolve({ ok: true, session: picked() }); await world.flush(); seen.push(note(world));
  assert.deepEqual(seen.map(text => text.split(".")[0]), ["Showing 1 of 8 items", "Refreshing preview", "Showing 1 of 8 items"]);
}));

test("a true empty result is said as empty, not as pending", async () => withDialogDom(async world => {
  const read = deferred<unknown>();
  world.reply = message => isPreviewRead(message) ? read.promise : { ok: true, session: picked() };
  mountExtractionPanel(world.native(world.host)); await world.flush();
  exclude(world, "name"); await world.flush();
  read.resolve({ ok: true, session: picked([]) }); await world.flush();
  assert.match(note(world), /^No preview was read for these columns\./u);
  assert.equal(busy(world), "false");
}));

test("a failed read says the sample was not refreshed and keeps the alert and Retry preview; retry runs pending to settled", async () => withDialogDom(async world => {
  let failed = true; const retried = deferred<unknown>();
  world.reply = message => isPreviewRead(message) ? failed ? Promise.reject(new Error("diagnostic")) : retried.promise : { ok: true, session: picked() };
  mountExtractionPanel(world.native(world.host)); await world.flush();
  exclude(world, "name"); await world.flush();
  assert.match(note(world), /^The preview was not refreshed\. The 1 row below is from the last read\./u);
  assert.equal(busy(world), "false");
  assert.equal(world.get("extractionNotice").hidden, false);
  const retry = world.get("extractionReadRetry"); assert.equal(retry.textContent, "Retry preview");
  assert.doesNotMatch(world.get("extractionPreviewBody").textContent, /Synthetic name/u, "the excluded value left with the edit");
  failed = false; retry.dispatch("click"); await world.flush();
  assert.match(note(world), /^Refreshing preview\.\.\./u); assert.equal(busy(world), "true");
  assert.equal(retry.disabled, true); assert.equal(retry.textContent, "Refreshing preview...");
  retried.resolve({ ok: true, session: picked() }); await world.flush();
  assert.match(note(world), /^Showing 1 of 8 items\./u);
  assert.equal(world.get("extractionNotice").hidden, true);
}));

test("an older selection's read cannot mark the newer one stale or settled", async () => withDialogDom(async world => {
  const reads: ReturnType<typeof deferred<unknown>>[] = [];
  world.reply = message => { if (!isPreviewRead(message)) return { ok: true, session: picked() }; const read = deferred<unknown>(); reads.push(read); return read.promise; };
  mountExtractionPanel(world.native(world.host)); await world.flush();
  exclude(world, "name"); await world.flush(); exclude(world, "price"); await world.flush();
  assert.equal(reads.length, 2);
  reads[0]!.reject(new Error("diagnostic")); await world.flush();
  assert.match(note(world), /^Refreshing preview\.\.\./u, "the old failure does not speak for the new selection");
  assert.equal(world.get("extractionNotice").hidden, true);
  reads[0] = deferred<unknown>();
  reads[1]!.resolve({ ok: true, session: picked() }); await world.flush();
  assert.match(note(world), /^Showing 1 of 8 items\. 3 columns are not previewed/u);
  assert.equal(busy(world), "false");
}));

test("excluding every shown column erases the sample at once and the note never claims a count", async () => withDialogDom(async world => {
  world.reply = message => isPreviewRead(message) ? new Promise(() => undefined) : { ok: true, session: picked() };
  mountExtractionPanel(world.native(world.host)); await world.flush();
  for (const key of ["name", "detail", "price", "sku"]) exclude(world, key);
  await world.flush();
  assert.equal(world.get("extractionPreviewBody").textContent.includes("Synthetic"), false);
  assert.doesNotMatch(note(world), /Showing/u);
}));
