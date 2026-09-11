// The recorder keeps what the user did and drops what a script did: `input`
// and `change` events that are not trusted -- a page script's, Playwright's
// selectOption, or the content script's own replay of a type, clear, or select
// action -- are never recorded, while real keyboard input is. Recording is
// stopped before every assertion, because stopping flushes the debounced
// `dom.input`: nothing can still be pending when the log is read.

import { expect, test } from "../index.js";

const NAME = '[data-testid="name"]';
const PLAN = '[data-testid="plan"]';
const NOTES = '[data-testid="notes"]';
const QUIET = { captureMutations: false, captureInputValues: true, captureSnapshots: false };

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
