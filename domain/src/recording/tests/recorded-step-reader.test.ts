// Core plus the real web reading gives the answer Core alone used to give. These
// are the cases that lived in Core's `instruction-led/tests/recording-steps.test.ts`
// when Core read the browser's fields itself, moved with the code, asserting the
// same bytes.

import assert from "node:assert/strict";
import test from "node:test";
import { supportingRecordingSteps, type TimelineEntry } from "fluxiq/automation";
import { createWebAutomationOutputNodeImplementationBundle } from "../../output-nodes";
import { webRecordedStepReader } from "../recorded-step-reader";

let sequence = 0;
function event(eventType: string, element: Record<string, unknown>): TimelineEntry {
  sequence += 1;
  return { id: `e${sequence}`, recordingId: "r", timestamp: sequence, monotonicOffsetMs: sequence, sequence, sourceId: "s", type: "domain_event", eventType, payload: { url: "https://shop.example/cart?session=SECRET123", element } } as unknown as TimelineEntry;
}
function action(actionType: string, fingerprint: Record<string, unknown>): TimelineEntry {
  sequence += 1;
  return { id: `a${sequence}`, recordingId: "r", timestamp: sequence, monotonicOffsetMs: sequence, sequence, sourceId: "s", type: "action", actionType, parameters: { text: "TYPED-SECRET" }, origin: "operator", startedAt: sequence, target: { type: "element", elementTarget: { kind: "element", fingerprint } } } as unknown as TimelineEntry;
}
const stepsOf = (timeline: readonly TimelineEntry[]) => supportingRecordingSteps(timeline, webRecordedStepReader);

test("the bundle gives Core this reading", () => {
  assert.equal(createWebAutomationOutputNodeImplementationBundle().recordedStepReader, webRecordedStepReader);
});

test("keeps kind, label and role in order and drops values, addresses and page text", () => {
  const { steps, withheldSteps } = stepsOf([
    event("web.element.clicked", { name: "  Add to   cart ", role: "button", visibleText: "Add to cart for $19.99 today", selector: "#a" }),
    event("web.element.input_changed", { name: "Quantity", role: "spinbutton", value: "7", inputValue: "7", visibleText: "7", text: "7" }),
    event("web.page.navigated", {}),
    event("web.element.focused", { name: "Quantity" }),
    event("web.dom.mutated", {})
  ]);
  assert.deepEqual(steps, [
    { kind: "clicked", label: "Add to cart", role: "button" },
    { kind: "input_changed", label: "Quantity", role: "spinbutton", valueEntered: true },
    { kind: "navigated" }
  ]);
  assert.equal(withheldSteps, 0);
  const text = JSON.stringify(steps);
  for (const leak of ["SECRET123", "shop.example", "$19.99", "\"7\""]) assert.ok(!text.includes(leak), leak);
});

test("omits password and payment steps entirely and counts them", () => {
  const { steps, withheldSteps } = stepsOf([
    event("web.element.input_changed", { name: "Password", role: "textbox", attributes: { type: "password" } }),
    event("web.element.input_changed", { name: "Number", role: "textbox", attributes: { autocomplete: "cc-number" } }),
    event("web.element.input_changed", { name: "Card verification code", role: "textbox" }),
    event("web.element.clicked", { name: "Sign in", role: "button" })
  ]);
  assert.deepEqual(steps, [{ kind: "clicked", label: "Sign in", role: "button" }]);
  assert.equal(withheldSteps, 3);
});

test("withholds a password field whatever it is called, by its type", () => {
  const { steps, withheldSteps } = stepsOf([event("web.element.input_changed", { name: "Word", role: "textbox", attributes: { type: "PassWord" } })]);
  assert.deepEqual(steps, []);
  assert.equal(withheldSteps, 1);
});

test("withholds on every word a control is known by", () => {
  for (const control of [
    { attributes: { name: "user_password" } },
    { attributes: { id: "cvv" } },
    { attributes: { placeholder: "Security code" } },
    { id: "iban-field" },
    { name: "otp" },
    { accessibleName: "Credit card" },
    { label: "Your PIN" }
  ]) {
    const { steps, withheldSteps } = stepsOf([event("web.element.input_changed", { role: "textbox", ...control })]);
    assert.deepEqual(steps, [], JSON.stringify(control));
    assert.equal(withheldSteps, 1, JSON.stringify(control));
  }
});

test("labels an entering step by name alone and drops labels that look like addresses, emails or numbers", () => {
  const { steps } = stepsOf([
    event("web.element.input_changed", { visibleText: "typed words", role: "textbox" }),
    event("web.element.clicked", { visibleText: "https://x.example/a?token=1", role: "link" }),
    event("web.element.clicked", { visibleText: "me@example.com", role: "link" }),
    event("web.element.clicked", { visibleText: "x".repeat(300), role: "link" })
  ]);
  assert.deepEqual(steps[0], { kind: "input_changed", role: "textbox", valueEntered: true });
  assert.deepEqual(steps[1], { kind: "clicked", role: "link" });
  assert.deepEqual(steps[2], { kind: "clicked", role: "link" });
  assert.ok(steps[3]!.label!.length <= 80);
});

test("marks a step a later one undid: a repeated toggle, a replaced entry, an explicit back", () => {
  const { steps } = stepsOf([
    action("click", { accessibleName: "Gift wrap", role: "checkbox" }),
    action("click", { accessibleName: "Gift wrap", role: "checkbox" }),
    action("type", { accessibleName: "Search", role: "searchbox" }),
    action("type", { accessibleName: "Search", role: "searchbox" }),
    action("click", { accessibleName: "Next", role: "button" }),
    action("go_back", {})
  ]);
  assert.deepEqual(steps.map((step) => [step.kind, step.undone ?? false, step.undoes ?? 0]), [
    ["click", true, 0], ["click", false, 1], ["type", true, 0], ["type", false, 0], ["click", true, 0], ["go_back", false, 5]
  ]);
  assert.ok(!JSON.stringify(steps).includes("TYPED-SECRET"));
});

test("reads the labels where the web domain's recorded actions carry them: parameters.element, implicitRole", () => {
  sequence += 1;
  const recorded = (actionType: string, element: Record<string, unknown>): TimelineEntry => ({ id: `w${sequence += 1}`, recordingId: "r", timestamp: sequence, monotonicOffsetMs: sequence, sequence, sourceId: "s", type: "action", actionType, parameters: { selector: "#x", value: "TYPED-VALUE", element }, origin: "operator", startedAt: sequence }) as unknown as TimelineEntry;
  const { steps } = stepsOf([
    recorded("web.dom.click", { tagName: "button", implicitRole: "button", accessibleName: "Remote", visibleText: "Remote 12 jobs" }),
    recorded("web.dom.select", { tagName: "select", implicitRole: "combobox", name: "sort", accessibleName: "Sort by", label: "Sort by", attributes: { name: "sort" } }),
    recorded("web.dom.scroll", {})
  ]);
  assert.deepEqual(steps, [
    { kind: "click", label: "Remote", role: "button" },
    { kind: "select", label: "Sort by", role: "combobox", valueEntered: true }
  ]);
  assert.ok(!JSON.stringify(steps).includes("TYPED-VALUE"));
});

test("a stored target's fingerprint outranks the parameters' element, and a target's own label fills a gap", () => {
  const entry = { id: "t", recordingId: "r", timestamp: 1, monotonicOffsetMs: 1, sequence: 1, sourceId: "s", type: "action", actionType: "web.dom.click", parameters: { element: { accessibleName: "Old", role: "link" } }, origin: "operator", startedAt: 1, target: { type: "element", label: "From the target", elementTarget: { kind: "element", fingerprint: { accessibleName: "New" } } } } as unknown as TimelineEntry;
  assert.deepEqual(stepsOf([entry]).steps, [{ kind: "click", label: "New", role: "link" }]);
  const labelled = { ...entry, parameters: {}, target: { type: "element", label: "From the target" } } as unknown as TimelineEntry;
  assert.deepEqual(stepsOf([labelled]).steps, [{ kind: "click", label: "From the target" }]);
});

test("marks a picked item replaced from the same opener, and a different item between two picks of one", () => {
  const click = (label: string, role: string) => action("web.dom.click", { accessibleName: label, role });
  const { steps } = stepsOf([
    click("Job type", "button"), click("Full-time", "link"),
    click("Job type", "button"), click("Any job type", "link"),
    click("date", "link"), click("relevance", "link"), click("Try again", "button"), click("date", "link")
  ]);
  assert.deepEqual(steps.map((step) => [step.label, step.undone ?? false, step.undoes ?? 0]), [
    ["Job type", false, 0], ["Full-time", true, 0], ["Job type", false, 0], ["Any job type", false, 2],
    ["date", false, 0], ["relevance", true, 0], ["Try again", false, 0], ["date", false, 6]
  ]);
});
