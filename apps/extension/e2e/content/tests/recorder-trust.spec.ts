// The recorder keeps what the user did and drops what a script did: `input`
// and `change` events that are not trusted -- a page script's, Playwright's
// selectOption, or the content script's own replay of a type, clear, or select
// action -- are never recorded, while real keyboard input is. Recording is
// stopped before every assertion, because stopping flushes the debounced
// `dom.input`: nothing can still be pending when the log is read.

import { writeFile } from "node:fs/promises";
import { expect, test } from "../index.js";

const NAME = '[data-testid="name"]';
const PLAN = '[data-testid="plan"]';
const NOTES = '[data-testid="notes"]';
const UPLOAD_FILE = '[data-testid="upload-file"]';
const QUIET = { captureMutations: false, captureInputValues: true, captureSnapshots: false };

// A chosen file's local name is page data: a file input's value is Chrome's
// `C:\fakepath\<name>`. The recorder describes the control, never its value,
// even with input-value capture on. The file is set from disk, so Chromium sets
// it itself and the change is trusted, as a user's choice is.
test("a chosen file is recorded as a trusted change on a file input that carries no file name or value", async ({ openHarness, page }) => {
  const harness = await openHarness("file-transfer");
  const chosen = test.info().outputPath("local-receipt.csv");
  await writeFile(chosen, "a,b\n1,2\n", "utf8");
  await harness.setRecording(true, { captureMutations: false, captureInputValues: true, captureSnapshots: true });
  await page.locator(UPLOAD_FILE).setInputFiles(chosen);
  await harness.setRecording(false);
  const changes = await harness.recordedEvents("dom.change");
  expect(changes.length).toBeGreaterThan(0);
  for (const change of changes) {
    expect(change).toMatchObject({ element: { inputType: "file", hasValue: true } });
    expect(change).not.toHaveProperty("inputValue");
  }
  const wire = JSON.stringify(await harness.messages());
  expect(wire.includes("fakepath"), "no message carries Chrome's fake path").toBe(false);
  expect(wire.includes("local-receipt.csv"), "no message carries the chosen file's name").toBe(false);
  const snapshot = JSON.stringify(await harness.capture());
  expect(snapshot.includes("fakepath"), "the snapshot carries no file input value").toBe(false);
});

test("untrusted input and change events are not recorded, while a real key press is", async ({ openHarness, page }) => {
  const harness = await openHarness("basic-form");
  await harness.setRecording(true, QUIET);
  await page.evaluate(({ name, plan }) => {
    const field = document.querySelector<HTMLInputElement>(name);
    const select = document.querySelector<HTMLSelectElement>(plan);
    if (!field || !select) throw new Error("basic-form is missing its name field or plan select.");
    field.value = "scripted";
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(new Event("change", { bubbles: true }));
    select.value = "team";
    select.dispatchEvent(new Event("input", { bubbles: true }));
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }, { name: NAME, plan: PLAN });
  await page.locator(PLAN).selectOption("enterprise");
  // The control: one real key in the same session is recorded.
  await page.locator(NAME).press("x");
  await harness.setRecording(false);
  const events = await harness.recordedEvents();
  expect(events.map((event) => event.kind)).toEqual(["dom.keydown", "dom.input"]);
  expect(events[1]).toMatchObject({ element: { selector: NAME } });
});

test("real typing is recorded as one debounced dom.input and a dom.keydown per key", async ({ openHarness, page }) => {
  const harness = await openHarness("basic-form");
  await harness.setRecording(true, QUIET);
  await page.locator(NAME).focus();
  await page.keyboard.type("Ada");
  await harness.setRecording(false);
  const events = await harness.recordedEvents();
  expect(events.map((event) => event.kind)).toEqual(["dom.keydown", "dom.keydown", "dom.keydown", "dom.input"]);
  expect(events.slice(0, 3).map((event) => event.key)).toEqual(["A", "d", "a"]);
  expect(events[3]).toMatchObject({ kind: "dom.input", inputValue: "Ada", element: { selector: NAME } });
});

// P1: typed text is debounced, so a key pressed right after it was recorded
// first and the replay pressed the key on a field that did not hold the text.
test("W02 and W03: text typed just before an acting key is recorded before that key", async ({ openHarness, page }) => {
  const harness = await openHarness("keyboard-forms");
  await harness.setRecording(true, QUIET);
  await page.locator('[data-testid="display-name"]').focus();
  await page.keyboard.type("Ada");
  await page.keyboard.press("Enter");
  await page.locator('[data-testid="country"]').focus();
  await page.keyboard.type("Ne");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await harness.setRecording(false);
  const keyOrder = (await harness.recordedEvents())
    .filter((event) => event.kind === "dom.keydown" || event.kind === "dom.input")
    .map((event) => (event.kind === "dom.input" ? `input:${event.inputValue}` : `key:${event.key}`));
  expect(keyOrder).toEqual(["key:A", "key:d", "key:a", "input:Ada", "key:Enter", "key:N", "key:e", "input:Ne", "key:ArrowDown", "key:ArrowDown"]);
});

test("Shift and Backspace are part of typing, so the text stays one debounced dom.input", async ({ openHarness, page }) => {
  const harness = await openHarness("basic-form");
  await harness.setRecording(true, QUIET);
  await page.locator(NAME).focus();
  await page.keyboard.type("Ad");
  await page.keyboard.down("Shift");
  await page.keyboard.press("KeyX");
  await page.keyboard.up("Shift");
  await page.keyboard.press("Backspace");
  await page.keyboard.type("a");
  await harness.setRecording(false);
  await expect(page.locator(NAME)).toHaveValue("Ada");
  const events = await harness.recordedEvents();
  expect(events.map((event) => event.kind === "dom.input" ? `input:${event.inputValue}` : `${event.kind}:${event.key}`))
    .toEqual(["dom.keydown:A", "dom.keydown:d", "dom.keydown:Shift", "dom.keydown:X", "dom.keydown:Backspace", "dom.keydown:a", "input:Ada"]);
});

test("a real keyboard change on a select is recorded as dom.change", async ({ openHarness, page }) => {
  const harness = await openHarness("basic-form");
  await harness.setRecording(true, QUIET);
  await page.locator(PLAN).focus();
  await page.keyboard.press("ArrowDown");
  await harness.setRecording(false);
  await expect(page.locator(PLAN)).toHaveValue("team");
  const changes = await harness.recordedEvents("dom.change");
  expect(changes).toHaveLength(1);
  expect(changes[0]).toMatchObject({ inputValue: "team", element: { selector: PLAN } });
});

test("replaying type, clear, and select actions records nothing a second time", async ({ openHarness, page }) => {
  const harness = await openHarness("basic-form");
  await page.locator(NOTES).fill("draft");
  await harness.setRecording(true, QUIET);
  const replies = [
    await harness.runAction({ commandId: "replay-type", actionType: "web.dom.type", selector: NAME, text: "Grace" }),
    await harness.runAction({ commandId: "replay-clear", actionType: "web.dom.clear", selector: NOTES }),
    await harness.runAction({ commandId: "replay-select", actionType: "web.dom.select", selector: PLAN, value: "enterprise" })
  ];
  await harness.setRecording(false);
  expect(replies.map((reply) => reply.status)).toEqual(["succeeded", "succeeded", "succeeded"]);
  await expect(page.locator(NAME)).toHaveValue("Grace");
  await expect(page.locator(NOTES)).toHaveValue("");
  await expect(page.locator(PLAN)).toHaveValue("enterprise");
  expect(await harness.recordedEvents()).toEqual([]);
});
