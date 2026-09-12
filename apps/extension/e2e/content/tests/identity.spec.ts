// What the content script now says about an element's identity: the test id,
// accessible name, label, implicit role and page context that Phase 1.3 added
// to `DomElementDescriptor`. Each case reads one element through the read-only
// `web.dom.extract` verb, whose reply carries exactly the descriptor the
// background worker receives.
//
// identity-drift is the point of the suite: the same Save action is described
// in all five renderings, so what survives each drift is visible per mode --
// the test id in one, the name in another, and, when both are gone, the
// context. ambiguous-targets pins the opposite case, two controls whose name
// signals are identical. The remaining fixtures cover context a settings form
// has none of (a fieldset legend, a list position, a table position), and
// sensitive-input proves value *presence* is reported without the value.

import { expect, test } from "../index.js";
import type { ContentHarness } from "../index.js";

type Descriptor = NonNullable<Awaited<ReturnType<ContentHarness["runAction"]>>["element"]>;

/** The descriptor for one element, read through `web.dom.extract`, which changes nothing. */
async function describe(harness: ContentHarness, selector: string): Promise<Descriptor> {
  const reply = await harness.runAction({ commandId: `identity:${selector}`, actionType: "web.dom.extract", selector });
  if (reply.status !== "succeeded" || !reply.element) {
    throw new Error(`extract did not describe ${selector}: ${reply.status} ${reply.message ?? ""}`);
  }
  return reply.element;
}

/** Arms an identity-drift mode through the fixture's own `set-mode`, then reloads the page. */
async function armMode(harness: ContentHarness, mode: string): Promise<void> {
  const response = await fetch(`${harness.lab.origin}/api/identity-drift/set-mode`, {
    method: "POST",
    headers: { authorization: `Bearer ${harness.lab.runToken}`, "content-type": "application/json" },
    body: JSON.stringify({ mode })
  });
  expect(response.ok, `arming ${mode} answered ${response.status}`).toBe(true);
  await harness.page.goto(harness.url);
  await expect
    .poll(async () => (await harness.messages()).some((message) => message.type === "fluxiq.contentReady"))
    .toBe(true);
}

/** Each drifted rendering of the Save action, with the signals it leaves intact. */
const DRIFT_MODES = [
  { mode: "selector-only", selector: "#workspace-settings-submit", testId: "settings-submit", accessibleName: "Save changes", landmark: "region", heading: "General" },
  { mode: "text-only", selector: "#save-settings", testId: undefined, accessibleName: "Apply changes", landmark: "region", heading: "General" },
  { mode: "moved", selector: "#save-settings", testId: undefined, accessibleName: "Save changes", landmark: "form", heading: "Advanced" },
  { mode: "wrapped-aria", selector: "#save-settings", testId: undefined, accessibleName: "Save changes", landmark: "region", heading: "General" }
] as const;

test("identity-drift baseline: the Save action carries test id, name, role and context", async ({ openHarness }) => {
  const harness = await openHarness("identity-drift");
  const save = await describe(harness, '[data-testid="save-changes"]');
  expect(save).toMatchObject({
    testId: "save-changes",
    accessibleName: "Save changes",
    implicitRole: "button",
    context: { formId: "settings-form", landmark: "region", heading: "General" }
  });
  // The button has no label of its own: its name is its content.
  expect(save.label).toBeUndefined();
  // The form declares neither, so neither is invented.
  expect(save.context?.formName).toBeUndefined();
  expect(save.context?.formAction).toBeUndefined();
});

test("identity-drift baseline: a labelled field takes its name from its label", async ({ openHarness }) => {
  const harness = await openHarness("identity-drift");
  const field = await describe(harness, '[data-testid="display-name"]');
  expect(field).toMatchObject({
    testId: "display-name",
    label: "Workspace name",
    accessibleName: "Workspace name",
    implicitRole: "textbox",
    hasValue: true,
    attributes: { "aria-describedby": "display-name-hint" },
    context: { formId: "settings-form", heading: "General" }
  });
  const label = await describe(harness, 'label[for="display-name"]');
  expect(label.attributes?.for).toBe("display-name");
});

for (const drift of DRIFT_MODES) {
  test(`identity-drift ${drift.mode}: the Save action keeps the signals the drift leaves`, async ({ openHarness }) => {
    const harness = await openHarness("identity-drift");
    await armMode(harness, drift.mode);
    const save = await describe(harness, drift.selector);
    expect(save.testId).toBe(drift.testId);
    expect(save).toMatchObject({
      accessibleName: drift.accessibleName,
      implicitRole: "button",
      context: { formId: "settings-form", landmark: drift.landmark, heading: drift.heading }
    });
  });
}

test("identity-drift wrapped-aria: the name is the aria-labelledby target's text", async ({ openHarness }) => {
  const harness = await openHarness("identity-drift");
  await armMode(harness, "wrapped-aria");
  const save = await describe(harness, "#save-settings");
  expect(save.attributes?.["aria-labelledby"]).toBe("save-settings-label");
  expect(save.accessibleName).toBe("Save changes");
  // The reference is what carries the name here: the target is a plain <span>,
  // whose role takes no name from its content, so it holds the text and has no
  // accessible name of its own. Following `aria-labelledby` is the only way the
  // button's name survives this rendering.
  const target = await describe(harness, "#save-settings-label");
  expect(target).toMatchObject({ tagName: "span", text: "Save changes" });
  expect(target.accessibleName).toBeUndefined();
});

test("ambiguous-targets: identical controls share every name signal", async ({ openHarness }) => {
  const harness = await openHarness("ambiguous-targets");
  const primary = await describe(harness, '[data-testid="choice-primary"]');
  const secondary = await describe(harness, '[data-testid="choice-secondary"]');
  for (const button of [primary, secondary]) {
    expect(button).toMatchObject({
      accessibleName: "Continue",
      implicitRole: "button",
      context: { landmark: "region", heading: "Ambiguous targets" }
    });
  }
  expect(primary.testId).toBe("choice-primary");
  expect(secondary.testId).toBe("choice-secondary");
  expect(primary.xpath).not.toBe(secondary.xpath);
  // Both sit in a named `region`, and the context records the landmark's role
  // only, so the context alone does not tell these two apart: resolution has to
  // fall back to the test id, the selector or the xpath.
  expect(primary.context).toEqual(secondary.context);
});

test("ambiguous-targets: a wrapping <label> names both duplicate fields", async ({ openHarness }) => {
  const harness = await openHarness("ambiguous-targets");
  for (const testId of ["email-primary", "email-secondary"]) {
    expect(await describe(harness, `[data-testid="${testId}"]`)).toMatchObject({
      testId,
      label: "Email",
      accessibleName: "Email",
      implicitRole: "textbox",
      hasValue: false,
      context: { landmark: "main", heading: "Ambiguous targets" }
    });
  }
});

test("keyboard-forms: a fieldset legend, a list position and a dressed-up control", async ({ openHarness }) => {
  const harness = await openHarness("keyboard-forms");
  expect(await describe(harness, '[data-testid="contact-email"]')).toMatchObject({
    label: "Email",
    accessibleName: "Email",
    implicitRole: "radio",
    context: { fieldsetLegend: "Preferred contact method", landmark: "form", heading: "Profile and preferences" }
  });
  expect(await describe(harness, "#country-option-nz")).toMatchObject({
    role: "option",
    implicitRole: "listitem",
    accessibleName: "New Zealand",
    context: { listPosition: { index: 9, total: 12 } }
  });
  // The written role and the markup's own role are separate signals.
  expect(await describe(harness, "#country")).toMatchObject({
    role: "combobox",
    implicitRole: "textbox",
    accessibleName: "Country",
    label: "Country"
  });
});

test("data-table: a cell's context is its row, its column and the column's header", async ({ openHarness }) => {
  const harness = await openHarness("data-table");
  expect(await describe(harness, '[data-testid="sort-category"]')).toMatchObject({
    implicitRole: "button",
    accessibleName: "Category",
    context: { tablePosition: { row: 1, column: 2, columnHeader: "Category" } }
  });
  expect(await describe(harness, '[data-testid="inventory-body"] tr:first-child td:nth-child(2)')).toMatchObject({
    implicitRole: "cell",
    context: { tablePosition: { row: 2, column: 2, columnHeader: "Category" } }
  });
});

test("sensitive-input: value presence is reported, the value is not part of identity", async ({ openHarness }) => {
  const harness = await openHarness("sensitive-input");
  const password = await describe(harness, '[data-testid="password"]');
  expect(password).toMatchObject({ label: "Password", accessibleName: "Password", hasValue: true });
  // A password field has no implicit ARIA role, and no identity signal may be
  // built from its value: `label` and `accessibleName` come from the wrapping
  // <label>, and `hasValue` is a boolean. Redacting the descriptor's `value`
  // itself is Phase 1.4, so this case deliberately asserts nothing about it.
  expect(password.implicitRole).toBeUndefined();
  expect(password.accessibleName).not.toContain("SYNTHETIC");
  expect(password.label).not.toContain("SYNTHETIC");
  expect(await describe(harness, '[data-testid="payment"]')).toMatchObject({
    label: "Test card",
    accessibleName: "Test card",
    hasValue: true
  });
});
