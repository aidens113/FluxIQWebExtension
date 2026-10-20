// The recorder keeps what the user did and drops what a script did: `input`
// and `change` events that are not trusted -- a page script's, Playwright's
// selectOption, or the content script's own replay of a type, clear, or select
// action -- are never recorded, while real keyboard input is. Recording is
// stopped before every assertion, because stopping flushes the debounced
// `dom.input`: nothing can still be pending when the log is read.
//
// Pages (t730: browser specs open only the ten realistic scenarios): the
// everything-store home page -- the header's search box and its "Search in"
// department select, and the footer's newsletter form, which the store submits
// in place, so an acting Enter leaves the recording on the same document. The
// chosen-file row uses the store's "Search with an image" dialog, which the
// `redesigned-header` mode adds, with its file input hidden inside a label as
// real upload controls ship. The store's consent banner, app banner and
// notifications prompt are answered first through its `/api` mutations.

import { writeFile } from "node:fs/promises";
import { expect, test } from "../index.js";
import type { ContentHarness } from "../index.js";

const STORE = "/scenarios/everything-store/";
const SEARCH_BOX = 'input[name="k"]';
const DEPARTMENT = 'select[name="i"]';
const NEWSLETTER_EMAIL = 'form[data-newsletter] input[name="email"]';
const IMAGE_FILE = '[role="dialog"][aria-label="Search with an image"] input[type="file"]';
const QUIET = { captureMutations: false, captureInputValues: true, captureSnapshots: false };

/** Sends one of the scenario's own page mutations, as its page script would. */
async function mutate(harness: ContentHarness, operation: string, payload: Record<string, unknown> = {}): Promise<void> {
  const response = await fetch(`${harness.lab.origin}/api/${harness.scenarioId}/${operation}`, {
    method: "POST",
    headers: { authorization: `Bearer ${harness.lab.runToken}`, "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`${harness.scenarioId} answered ${response.status} to ${operation}.`);
}

/** Opens the store's home page with consent given and the app banner and notifications prompt answered, optionally in one of its modes. */
async function openCalmStore(openHarness: (id: string) => Promise<ContentHarness>, mode?: string): Promise<ContentHarness> {
  const harness = await openHarness("everything-store");
  // A mode starts a fresh account, so it comes before the answers.
  if (mode) await mutate(harness, "set-mode", { mode });
  await mutate(harness, "consent", { choice: "accept" });
  await mutate(harness, "dismiss-nudge", { nudge: "app-banner" });
  await mutate(harness, "dismiss-nudge", { nudge: "notifications" });
  await harness.page.goto(new URL(STORE, harness.lab.origin).href);
  return harness;
}

/** The `selector` an event's element descriptor carries names the element `requested` names on the page. */
async function sameElement(harness: ContentHarness, reported: unknown, requested: string): Promise<boolean> {
  if (typeof reported !== "string") return false;
  return await harness.page.evaluate(([a, b]) => {
    const found = document.querySelector(a);
    return found !== null && found === document.querySelector(b);
  }, [reported, requested] as const);
}

// A chosen file's local name is page data: a file input's value is Chrome's
// `C:\fakepath\<name>`. The recorder describes the control, never its value,
// even with input-value capture on. The file is set from disk, so Chromium sets
// it itself and the change is trusted, as a user's choice is.
test("a chosen file is recorded as a trusted change on a file input that carries no file name or value", async ({ openHarness, page }) => {
  const harness = await openCalmStore(openHarness, "redesigned-header");
  await page.getByRole("button", { name: "Search with your camera" }).click();
  await expect(page.getByRole("dialog", { name: "Search with an image" })).toBeVisible();
  const chosen = test.info().outputPath("local-receipt.png");
  await writeFile(chosen, Buffer.from("89504e470d0a1a0a", "hex"));
  await harness.setRecording(true, { captureMutations: false, captureInputValues: true, captureSnapshots: true });
  await page.locator(IMAGE_FILE).setInputFiles(chosen);
  await harness.setRecording(false);
  const changes = await harness.recordedEvents("dom.change");
  expect(changes.length).toBeGreaterThan(0);
  for (const change of changes) {
    expect(change).toMatchObject({ element: { inputType: "file", hasValue: true } });
    expect(change).not.toHaveProperty("inputValue");
  }
  const wire = JSON.stringify(await harness.messages());
  expect(wire.includes("fakepath"), "no message carries Chrome's fake path").toBe(false);
  expect(wire.includes("local-receipt.png"), "no message carries the chosen file's name").toBe(false);
  const snapshot = JSON.stringify(await harness.capture());
  expect(snapshot.includes("fakepath"), "the snapshot carries no file input value").toBe(false);
});

test("untrusted input and change events are not recorded, while a real key press is", async ({ openHarness, page }) => {
  const harness = await openCalmStore(openHarness);
  await harness.setRecording(true, QUIET);
  await page.evaluate(({ box, department }) => {
    const field = document.querySelector<HTMLInputElement>(box);
    const select = document.querySelector<HTMLSelectElement>(department);
    if (!field || !select) throw new Error("The store header is missing its search box or department select.");
    field.value = "scripted";
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(new Event("change", { bubbles: true }));
    select.value = "home";
    select.dispatchEvent(new Event("input", { bubbles: true }));
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }, { box: SEARCH_BOX, department: DEPARTMENT });
  await page.locator(DEPARTMENT).selectOption("toys");
  // The control: one real key in the same session is recorded.
  await page.locator(SEARCH_BOX).press("x");
  await harness.setRecording(false);
  const events = await harness.recordedEvents();
  expect(events.map((event) => event.kind)).toEqual(["dom.keydown", "dom.input"]);
  expect(await sameElement(harness, events[1]?.element?.selector, SEARCH_BOX)).toBe(true);
});

test("real typing is recorded as one debounced dom.input and a dom.keydown per key", async ({ openHarness, page }) => {
  const harness = await openCalmStore(openHarness);
  await harness.setRecording(true, QUIET);
  await page.locator(SEARCH_BOX).focus();
  await page.keyboard.type("Ada");
  await harness.setRecording(false);
  const events = await harness.recordedEvents();
  expect(events.map((event) => event.kind)).toEqual(["dom.keydown", "dom.keydown", "dom.keydown", "dom.input"]);
  expect(events.slice(0, 3).map((event) => event.key)).toEqual(["A", "d", "a"]);
  expect(events[3]).toMatchObject({ kind: "dom.input", inputValue: "Ada" });
  expect(await sameElement(harness, events[3]?.element?.selector, SEARCH_BOX)).toBe(true);
});

// P1: typed text is debounced, so a key pressed right after it was recorded
// first and the replay pressed the key on a field that did not hold the text.
// Here Enter sends the newsletter form (the store answers it in place) and the
// arrow keys move through the search box's suggestions list.
test("W02 and W03: text typed just before an acting key is recorded before that key", async ({ openHarness, page }) => {
  const harness = await openCalmStore(openHarness);
  await harness.setRecording(true, QUIET);
  await page.locator(NEWSLETTER_EMAIL).focus();
  await page.keyboard.type("Ada");
  await page.keyboard.press("Enter");
  await page.locator(SEARCH_BOX).focus();
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
  const harness = await openCalmStore(openHarness);
  await harness.setRecording(true, QUIET);
  await page.locator(SEARCH_BOX).focus();
  await page.keyboard.type("Ad");
  await page.keyboard.down("Shift");
  await page.keyboard.press("KeyX");
  await page.keyboard.up("Shift");
  await page.keyboard.press("Backspace");
  await page.keyboard.type("a");
  await harness.setRecording(false);
  await expect(page.locator(SEARCH_BOX)).toHaveValue("Ada");
  const events = await harness.recordedEvents();
  expect(events.map((event) => event.kind === "dom.input" ? `input:${event.inputValue}` : `${event.kind}:${event.key}`))
    .toEqual(["dom.keydown:A", "dom.keydown:d", "dom.keydown:Shift", "dom.keydown:X", "dom.keydown:Backspace", "dom.keydown:a", "input:Ada"]);
});

test("a real keyboard change on a select is recorded as dom.change", async ({ openHarness, page }) => {
  const harness = await openCalmStore(openHarness);
  await harness.setRecording(true, QUIET);
  await page.locator(DEPARTMENT).focus();
  await page.keyboard.press("ArrowDown");
  await harness.setRecording(false);
  await expect(page.locator(DEPARTMENT)).toHaveValue("electronics");
  const changes = await harness.recordedEvents("dom.change");
  expect(changes).toHaveLength(1);
  expect(changes[0]).toMatchObject({ inputValue: "electronics" });
  expect(await sameElement(harness, changes[0]?.element?.selector, DEPARTMENT)).toBe(true);
});

test("replaying type, clear, and select actions records nothing a second time", async ({ openHarness, page }) => {
  const harness = await openCalmStore(openHarness);
  await page.locator(NEWSLETTER_EMAIL).fill("draft");
  await harness.setRecording(true, QUIET);
  const replies = [
    await harness.runAction({ commandId: "replay-type", actionType: "web.dom.type", selector: SEARCH_BOX, text: "Grace" }),
    await harness.runAction({ commandId: "replay-clear", actionType: "web.dom.clear", selector: NEWSLETTER_EMAIL }),
    await harness.runAction({ commandId: "replay-select", actionType: "web.dom.select", selector: DEPARTMENT, value: "toys" })
  ];
  await harness.setRecording(false);
  expect(replies.map((reply) => reply.status)).toEqual(["succeeded", "succeeded", "succeeded"]);
  await expect(page.locator(SEARCH_BOX)).toHaveValue("Grace");
  await expect(page.locator(NEWSLETTER_EMAIL)).toHaveValue("");
  await expect(page.locator(DEPARTMENT)).toHaveValue("toys");
  expect(await harness.recordedEvents()).toEqual([]);
});
