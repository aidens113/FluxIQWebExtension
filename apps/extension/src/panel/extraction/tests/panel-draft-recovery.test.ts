import assert from "node:assert/strict";
import test from "node:test";
import { EXTRACTION_RUNTIME_MESSAGES as M } from "../../../shared/extraction-messages";
import { mountExtractionPanel } from "../panel";
import { proposalFixture } from "./proposal-fixture";
import { withDialogDom } from "./dialog-dom";

type World = Parameters<Parameters<typeof withDialogDom>[0]>[0];
const picked = { state: "picked", proposal: proposalFixture(), preview: [{ name: "Synthetic name", price: "Synthetic price" }] };
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function field(world: World, key: string) {
  const row = world.get("extractionFields").querySelectorAll(".extraction-field").find(row => row.dataset.field === key);
  assert.ok(row, "current synthetic column exists");
  return row;
}
function name(world: World, key: string) { return field(world, key).querySelector(".extraction-field-label")!; }
function exclude(world: World, key: string) {
  const radio = field(world, key).querySelectorAll("input").find(input => input.type === "radio" && input.value === "exclude")!;
  radio.checked = true; radio.dispatch("change");
}

test("delayed preview redraw preserves uncommitted raw column text and caret", async () => withDialogDom(async world => {
  const preview = deferred<unknown>();
  world.reply = message => message.type === M.getSession && message.fields ? preview.promise : { ok: true, session: picked };
  mountExtractionPanel(world.native(world.host)); await world.flush();
  exclude(world, "name"); await world.flush();
  const input = name(world, "price"); input.focus(); input.value = "  Unit price now  "; input.setSelectionRange(3, 7); input.dispatch("input");
  const reads = world.sent.length;
  preview.resolve({ ok: true, session: picked }); await world.flush();
  const current = name(world, "price");
  assert.equal(current.value, "  Unit price now  ");
  assert.equal(world.document.activeElement, current);
  assert.equal(current.selectionStart, 3); assert.equal(current.selectionEnd, 7);
  assert.equal(world.sent.length, reads, "typing does not start another preview read");
}));

test("retained old same-key handler cannot rename a new pick", async () => withDialogDom(async world => {
  world.reply = message => ({ ok: true, ...(message.type === M.getSession ? { session: picked } : {}) });
  const handle = mountExtractionPanel(world.native(world.host)); handle.setAvailable(true); await world.flush();
  const old = name(world, "name");
  world.get("extractionCloseButton").dispatch("click"); await world.flush();
  world.get("extractDataButton").dispatch("click"); await world.flush(); await world.tick();
  old.value = "Foreign draft"; old.dispatch("change");
  assert.equal(name(world, "name").value, "Name");
}));

test("retained field callback after captured receipt is inert instead of throwing", async () => withDialogDom(async world => {
  world.reply = message => message.type === M.confirm ? { ok: true } : { ok: true, session: picked };
  mountExtractionPanel(world.native(world.host)); await world.flush();
  const old = field(world, "name").querySelector(".extraction-field-remove")!;
  world.get("extractionConfirmButton").dispatch("click"); await world.flush();
  assert.doesNotThrow(() => old.dispatch("click"));
  assert.match(world.get("extractionStatus").textContent, /recorded/u);
}));

for (const raw of ["", "   "]) test("raw blank intent survives redraw and explicit commit retains settled label: " + JSON.stringify(raw), async () => withDialogDom(async world => {
  const preview = deferred<unknown>();
  world.reply = message => message.type === M.getSession && message.fields ? preview.promise : { ok: true, session: picked };
  mountExtractionPanel(world.native(world.host)); await world.flush();
  name(world, "price").value = " Settled price "; name(world, "price").dispatch("change");
  exclude(world, "name"); await world.flush();
  const input = name(world, "price"); input.focus(); input.value = raw; input.dispatch("input");
  preview.resolve({ ok: true, session: picked }); await world.flush();
  assert.equal(name(world, "price").value, raw);
  name(world, "price").dispatch("change"); assert.equal(name(world, "price").value, "Settled price");
}));

test("Confirm explicitly normalizes pending raw names and retains duplicate key derivation", async () => withDialogDom(async world => {
  world.reply = message => message.type === M.confirm ? { ok: true } : { ok: true, session: picked };
  mountExtractionPanel(world.native(world.host)); await world.flush();
  for (const key of ["name", "price"]) { const input = name(world, key); input.value = "  Same name  "; input.dispatch("input"); }
  world.get("extractionConfirmButton").dispatch("click"); await world.flush();
  const request = world.sent.find(message => message.type === M.confirm)!.request as { fields: { label: string; key: string }[] };
  const same = request.fields.filter(field => field.label === "Same name");
  assert.equal(same.length, 2); assert.notEqual(same[0]!.key, same[1]!.key);
  assert.equal(JSON.stringify(request).includes("Synthetic price"), false);
  assert.equal(JSON.stringify(request).includes("Synthetic name"), false);
}));

test("failed Confirm restores settled raw intent and rejects edits while submitted", async () => withDialogDom(async world => {
  const confirmed = deferred<unknown>();
  world.reply = message => message.type === M.confirm ? confirmed.promise : { ok: true, session: picked };
  mountExtractionPanel(world.native(world.host)); await world.flush();
  const old = name(world, "name"); old.value = "  Kept name  "; old.dispatch("input");
  world.get("extractionConfirmButton").dispatch("click"); await world.flush();
  const busy = name(world, "name"); busy.value = "Busy edit"; busy.dispatch("input"); busy.dispatch("change"); old.value = "Retired edit"; old.dispatch("change");
  confirmed.reject(new Error("Synthetic refusal")); await world.flush();
  assert.equal(name(world, "name").value, "Kept name");
  assert.equal(name(world, "name").disabled, false);
  assert.match(world.get("extractionNotice").textContent, /Synthetic refusal/u);
  assert.equal(world.sent.filter(message => message.type === M.confirm).length, 1);
}));

test("same-draft replaced handlers cannot overwrite newer committed text or remove a field", async () => withDialogDom(async world => {
  world.reply = () => ({ ok: true, session: picked }); mountExtractionPanel(world.native(world.host)); await world.flush();
  const oldRow = field(world, "name"), oldInput = name(world, "name"), oldRemove = oldRow.querySelector(".extraction-field-remove")!;
  oldInput.value = "First"; oldInput.dispatch("change");
  const current = name(world, "name"); current.value = "Second"; current.dispatch("input"); current.dispatch("change");
  const before = world.sent.length; oldInput.value = "Obsolete"; oldInput.dispatch("input"); oldInput.dispatch("change"); oldRemove.dispatch("click");
  assert.equal(name(world, "name").value, "Second"); assert.equal(world.sent.length, before);
}));

for (const action of ["input", "kind", "handling", "remove"] as const) test("old pick's " + action + " callback cannot edit matching new pick", async () => withDialogDom(async world => {
  world.reply = message => ({ ok: true, ...(message.type === M.getSession ? { session: picked } : {}) });
  const handle = mountExtractionPanel(world.native(world.host)); handle.setAvailable(true); await world.flush();
  const old = field(world, "name"); world.get("extractionCloseButton").dispatch("click"); await world.flush();
  world.get("extractDataButton").dispatch("click"); await world.flush(); await world.tick(); const before = world.sent.length;
  if (action === "input") { const input = old.querySelector(".extraction-field-label")!; input.value = "Foreign"; input.dispatch("input"); }
  if (action === "kind") { const kind = old.querySelector(".extraction-field-kind")!; kind.value = "link"; kind.dispatch("change"); }
  if (action === "handling") { const radio = old.querySelectorAll("input").find(input => input.type === "radio" && input.value === "exclude")!; radio.checked = true; radio.dispatch("change"); }
  if (action === "remove") old.querySelector(".extraction-field-remove")!.dispatch("click");
  assert.equal(name(world, "name").value, "Name"); assert.equal(world.sent.length, before);
  assert.match(world.get("extractionPreviewBody").textContent, /Synthetic name/u);
}));

test("retained cancelled handlers are inert and raw intent does not leak into the next pick", async () => withDialogDom(async world => {
  world.reply = message => ({ ok: true, ...(message.type === M.getSession ? { session: picked } : {}) });
  const handle = mountExtractionPanel(world.native(world.host)); handle.setAvailable(true); await world.flush();
  const old = name(world, "name"); old.value = "Uncommitted"; old.dispatch("input");
  world.get("extractionCloseButton").dispatch("click"); await world.flush();
  assert.doesNotThrow(() => { old.dispatch("input"); old.dispatch("change"); });
  world.get("extractDataButton").dispatch("click"); await world.flush(); await world.tick();
  assert.equal(name(world, "name").value, "Name");
}));

test("raw intent survives synchronous privacy redraw while excluded values remain absent", async () => withDialogDom(async world => {
  world.reply = message => ({ ok: true, ...(message.type === M.getSession ? { session: picked } : {}) });
  mountExtractionPanel(world.native(world.host)); await world.flush();
  const input = name(world, "price"); input.value = "  Price intent  "; input.dispatch("input");
  exclude(world, "name"); await world.flush();
  assert.equal(name(world, "price").value, "  Price intent  ");
  assert.doesNotMatch(world.get("extractionPreviewBody").textContent, /Synthetic name/u);
  const include = field(world, "name").querySelectorAll("input").find(input => input.type === "radio" && input.value === "include")!;
  include.checked = true; include.dispatch("change"); await world.flush();
  assert.doesNotMatch(world.get("extractionPreviewBody").textContent, /Synthetic name/u);
  name(world, "price").dispatch("change"); assert.equal(name(world, "price").value, "Price intent");
}));

for (const hidden of [false, true]) test("preview raw-value redraw leaves page/hidden document focus alone: " + hidden, async () => withDialogDom(async world => {
  const preview = deferred<unknown>(); world.reply = message => message.type === M.getSession && message.fields ? preview.promise : { ok: true, session: picked };
  mountExtractionPanel(world.native(world.host)); await world.flush(); exclude(world, "name"); await world.flush();
  const input = name(world, "price"); input.focus(); input.value = "Raw intent"; input.dispatch("input");
  world.document.focused = !hidden ? false : true; if (hidden) world.document.visibilityState = "hidden";
  const calls = world.document.focusCalls.length; preview.resolve({ ok: true, session: picked }); await world.flush();
  assert.equal(name(world, "price").value, "Raw intent"); assert.equal(world.document.focusCalls.length, calls);
}));

test("field removal clears raw intent and preserves neighbour focus and last-field Confirm disabled state", async () => withDialogDom(async world => {
  world.reply = message => ({ ok: true, ...(message.type === M.getSession ? { session: picked } : {}) });
  mountExtractionPanel(world.native(world.host)); await world.flush();
  const input = name(world, "name"); input.value = "Removed intent"; input.dispatch("input");
  const remove = field(world, "name").querySelector(".extraction-field-remove")!; remove.focus(); remove.dispatch("click"); await world.flush();
  assert.equal(world.document.activeElement, name(world, "detail")); assert.equal(world.get("extractionFields").textContent.includes("Removed intent"), false);
  for (const key of ["detail", "price", "sku", "card"]) { field(world, key).querySelector(".extraction-field-remove")!.dispatch("click"); await world.flush(); }
  assert.equal(world.get("extractionConfirmButton").disabled, true);
}));

test("fresh current kind and handling controls remain operable without settling raw typing early", async () => withDialogDom(async world => {
  world.reply = message => ({ ok: true, ...(message.type === M.getSession ? { session: picked } : {}) });
  mountExtractionPanel(world.native(world.host)); await world.flush();
  const input = name(world, "name"); input.value = "  Typed name  "; input.dispatch("input");
  const kind = field(world, "price").querySelector(".extraction-field-kind")!; kind.value = "text"; kind.dispatch("change"); await world.flush();
  assert.equal(name(world, "name").value, "  Typed name  ");
  assert.doesNotMatch(world.get("extractionPreviewBody").textContent, /Synthetic price/u);
  exclude(world, "name"); await world.flush(); assert.doesNotMatch(world.get("extractionPreviewBody").textContent, /Synthetic name/u);
  assert.equal(name(world, "name").value, "  Typed name  ");
  world.get("extractionConfirmButton").dispatch("click"); await world.flush();
  const request = world.sent.find(message => message.type === M.confirm)!.request as { fields: { label: string; kind: string; handling: string }[] };
  assert.equal(request.fields.find(field => field.label === "Typed name")?.handling, "exclude");
  assert.equal(request.fields.find(field => field.label === "Price")?.kind, "text");
}));

test("old handlers cannot settle pending raw intent after unrelated same-draft redraw", async () => withDialogDom(async world => {
  world.reply = () => ({ ok: true, session: picked }); mountExtractionPanel(world.native(world.host)); await world.flush();
  const old = name(world, "name"); old.value = "  Pending current  "; old.dispatch("input");
  world.get("extractionPaginate").checked = true; world.get("extractionPaginate").dispatch("change");
  old.value = "Retired commit"; old.dispatch("change");
  assert.equal(name(world, "name").value, "  Pending current  ");
  name(world, "name").dispatch("change"); assert.equal(name(world, "name").value, "Pending current");
}));
