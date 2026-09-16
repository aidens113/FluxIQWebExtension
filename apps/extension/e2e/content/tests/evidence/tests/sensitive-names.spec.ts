// What page evidence may never quote: the contents of a sensitive control,
// reached by any of the routes that compute a name, a context or a state.
//
// Each row injects its own synthetic markers, captures, and searches the whole
// wire -- every descriptor and its `context`, every evidence item, and the
// reply around them -- for the fixture's pre-filled secrets and its own. The
// ordinary controls beside the marked ones keep their words, so a blanket drop
// fails these rows as surely as a leak does.

import type { Page } from "@playwright/test";
import { PLANTED_UNLOCK_CODE } from "../../../../../../scenario-lab/src/scenarios/sensitive-input/index.js";
import { expect, test } from "../../../index.js";
import { capture } from "./captured-snapshot.js";

/**
 * The sensitive-input fixture's own pre-filled secrets: the password, the card,
 * the multi-token billing card, and the code planted in every saved card's
 * password control, whose three values all begin with it.
 */
const FIXTURE_SECRETS = ["SYNTHETIC_PASSWORD_DO_NOT_USE", "4111111111111111", "4222222222222220", PLANTED_UNLOCK_CODE];
/**
 * Written below into sensitive controls, and into marked text, that page
 * evidence or a descriptor names something by -- the last into the reference a
 * landmark is named by; no snapshot or reply may carry any.
 */
const NAMING_SECRETS = [
  "SYNTHETIC_NAMING_NOTE", "SYNTHETIC_NAMING_OPTION_LABEL", "SYNTHETIC_NAMING_OPTION_VALUE", "SYNTHETIC_NAMING_BUTTON_WORDS",
  "SYNTHETIC_NAMING_REGION_WORDS"
];

test("sensitive-input: no name in page evidence quotes a sensitive control's contents, whichever route computes it", async ({ openHarness, page }) => {
  const harness = await openHarness("sensitive-input");
  // Every route by which `accessibleNameFor` reads page content, each reaching
  // it through a different evidence reader: a form control named through
  // `aria-labelledby` by a span holding a sensitive textarea, and by one holding
  // a select the shared rule marks by an `autocomplete` token; a button whose own
  // text holds a marked span; and a landmark named through a reference holding
  // one. The ordinary select beside them keeps its words, so the filter is not a
  // blanket drop.
  await page.evaluate(() => {
    const form = document.querySelector('[data-testid="sensitive-form"]');
    if (!form) throw new Error("sensitive-input has no sensitive form");
    form.insertAdjacentHTML(
      "beforeend",
      '<span id="hint-name">Hint <textarea data-sensitive="true">SYNTHETIC_NAMING_NOTE</textarea></span>' +
        '<button type="button" data-testid="hint" aria-labelledby="hint-name">?</button>' +
        '<span id="answer-name">Security answer <select autocomplete="one-time-code"><option value="SYNTHETIC_NAMING_OPTION_VALUE">SYNTHETIC_NAMING_OPTION_LABEL</option></select></span>' +
        '<button type="button" data-testid="answer" aria-labelledby="answer-name">?</button>' +
        '<span id="contact-name">Contact time <select><option value="mornings">Mornings</option></select></span>' +
        '<button type="button" data-testid="contact" aria-labelledby="contact-name">?</button>' +
        '<button type="button" data-testid="reveal">Reveal <span data-sensitive="true">SYNTHETIC_NAMING_BUTTON_WORDS</span></button>'
    );
    document.body.insertAdjacentHTML(
      "beforeend",
      '<div role="region" data-testid="saved-notes" aria-labelledby="saved-notes-name"><span id="saved-notes-name">Saved notes <span data-sensitive="true">SYNTHETIC_NAMING_REGION_WORDS</span></span></div>'
    );
  });

  const snapshot = await capture(harness);
  const reply = await harness.runAction({ commandId: "capture-naming", actionType: "web.dom.capture_snapshot" });
  expect(reply).toMatchObject({ status: "succeeded" });
  // The whole of both: descriptors and their `context`, every evidence item, and the reply around them.
  for (const wire of [JSON.stringify(snapshot), JSON.stringify(reply)]) {
    for (const secret of [...FIXTURE_SECRETS, ...NAMING_SECRETS]) expect(wire).not.toContain(secret);
  }

  // Each name keeps the words around what was left out.
  const controls = (snapshot.evidence?.forms ?? []).flatMap((form) => form.controls);
  const labelOf = (testId: string) => controls.find((control) => control.selector === `[data-testid="${testId}"]`)?.label;
  expect(labelOf("hint")).toBe("Hint");
  expect(labelOf("answer")).toBe("Security answer");
  expect(labelOf("contact")).toBe("Contact time Mornings");
  expect(labelOf("reveal")).toBe("Reveal");
  expect(snapshot.evidence?.regions).toEqual(expect.arrayContaining([
    expect.objectContaining({ role: "region", selector: "[data-testid=\"saved-notes\"]", label: "Saved notes" })
  ]));
  // Every descriptor inside the region names its landmark by the same words.
  // The fixture's own saved cards sit in a named <section>, which is a region
  // too, so the descriptors are narrowed by where they sit and not by the name
  // under test: selecting them by that name would assert nothing.
  const inRegion = snapshot.interactiveElements.filter((element) => element.context?.landmark === "region");
  const inSavedNotes = new Set(await page.evaluate(
    (selectors) => selectors.filter((selector) => document.querySelector(selector)?.closest('[data-testid="saved-notes"]')),
    inRegion.map((element) => element.selector)
  ));
  expect(inSavedNotes.size).toBeGreaterThan(0);
  for (const element of inRegion) {
    if (inSavedNotes.has(element.selector)) expect(element.context).toMatchObject({ landmarkName: "Saved notes" });
  }
});

/** Written below into marked text that a descriptor's `context` or `label` is read from; no snapshot or reply may carry any. */
const CONTEXT_SECRETS = [
  "SYNTHETIC_CONTEXT_LEGEND_WORDS", "SYNTHETIC_CONTEXT_HEADING_WORDS", "SYNTHETIC_CONTEXT_COLUMN_WORDS",
  "SYNTHETIC_CONTEXT_LABEL_WORDS", "SYNTHETIC_CONTEXT_NEARBY_WORDS"
];

test("sensitive-input: no descriptor's context or label quotes a sensitive control's contents", async ({ openHarness, page }) => {
  const harness = await openHarness("sensitive-input");
  // Every other place `identity/context.ts` and `identity/label.ts` read page
  // text, each holding a marked span: a fieldset's legend, the heading before a
  // control, a table's column header, a `<label for>`, and the short text beside
  // an unlabelled control. The label's text is also the control's accessible
  // name, and so the forms evidence's `label`.
  await page.evaluate(() => {
    const main = document.querySelector("main");
    if (!main) throw new Error("sensitive-input has no main");
    main.insertAdjacentHTML(
      "beforeend",
      '<fieldset><legend>Delivery <span data-sensitive="true">SYNTHETIC_CONTEXT_LEGEND_WORDS</span></legend><input data-testid="street" name="street"></fieldset>' +
        '<section><h2>Account <span data-sensitive="true">SYNTHETIC_CONTEXT_HEADING_WORDS</span></h2><button type="button" data-testid="account-save">Save</button></section>' +
        '<table><thead><tr><th>Card <span data-sensitive="true">SYNTHETIC_CONTEXT_COLUMN_WORDS</span></th></tr></thead>' +
        '<tbody><tr><td><button type="button" data-testid="card-remove">Remove</button></td></tr></tbody></table>' +
        '<label for="nickname">Nickname <span data-sensitive="true">SYNTHETIC_CONTEXT_LABEL_WORDS</span></label><input id="nickname" name="nickname">' +
        '<div><span>Alias</span><span data-sensitive="true">SYNTHETIC_CONTEXT_NEARBY_WORDS</span><input data-testid="alias" name="alias"></div>'
    );
  });

  const snapshot = await capture(harness);
  const reply = await harness.runAction({ commandId: "capture-context", actionType: "web.dom.capture_snapshot" });
  expect(reply).toMatchObject({ status: "succeeded" });
  // The whole of both: descriptors and their `context`, every evidence item, and the reply around them.
  for (const wire of [JSON.stringify(snapshot), JSON.stringify(reply)]) {
    for (const secret of [...FIXTURE_SECRETS, ...CONTEXT_SECRETS]) expect(wire).not.toContain(secret);
  }

  // Each keeps the words around what was left out.
  const described = (selector: string) => snapshot.interactiveElements.find((element) => element.selector === selector);
  expect(described('[data-testid="street"]')).toMatchObject({ context: { fieldsetLegend: "Delivery" } });
  expect(described('[data-testid="account-save"]')).toMatchObject({ context: { heading: "Account" } });
  expect(described('[data-testid="card-remove"]')).toMatchObject({ context: { tablePosition: { row: 2, column: 1, columnHeader: "Card" } } });
  expect(described("#nickname")).toMatchObject({ label: "Nickname", accessibleName: "Nickname" });
  expect(described('[data-testid="alias"]')).toMatchObject({ label: "Alias" });
});

/**
 * Written below into the controls of a group marked `data-sensitive` -- a
 * select's two option values and the words the page renders for them, and the
 * text typed into a field in the same group. No snapshot, action reply or
 * recorded message may carry any.
 */
const TYPED_IN_MARKED_GROUP = "synthetic-typed-in-marked-group";
const MARKED_GROUP_SECRETS = [
  "SYNTHETIC_MARKED_OPTION_VALUE", "SYNTHETIC_MARKED_OPTION_LABEL",
  "SYNTHETIC_MARKED_OTHER_VALUE", "SYNTHETIC_MARKED_OTHER_LABEL",
  TYPED_IN_MARKED_GROUP
];
/** Typed into the ordinary field in the same session, which must still be carried. */
const CONTROL_TEXT = "synthetic-control-text";

/** The three controls inside the marked group, and the ordinary three beside it. */
const MARKED = { text: '[data-testid="marked-text"]', select: '[data-testid="marked-select"]', check: '[data-testid="marked-check"]' };
const PLAIN = { text: '[data-testid="plain-text"]', select: '[data-testid="plain-select"]', check: '[data-testid="plain-check"]' };

/**
 * A group marked `data-sensitive` holding a text field, a select and a
 * checkbox, and an ordinary group holding the same three.
 *
 * Not one of the three is marked itself. The group is, so what its controls
 * hold is part of what it holds and is withheld as a marked control's own
 * contents are (D2) -- the case the descriptor's value reader already covers
 * for text, extended to the two state readers beside it. The ordinary group is
 * the other direction of the same rule: it keeps everything, so a blanket drop
 * fails these rows as surely as a leak does. The two groups are given different
 * shapes so they cannot be read as one repeating run.
 */
async function injectMarkedGroup(page: Page): Promise<void> {
  await page.evaluate(() => {
    const main = document.querySelector("main");
    if (!main) throw new Error("sensitive-input has no main");
    main.insertAdjacentHTML(
      "beforeend",
      '<div data-sensitive="true" data-testid="marked-group">' +
        '<label>Recovery phrase <input type="text" data-testid="marked-text" name="recovery"></label>' +
        '<label>Security answer <select data-testid="marked-select" name="answer">' +
          '<option value="SYNTHETIC_MARKED_OPTION_VALUE">SYNTHETIC_MARKED_OPTION_LABEL</option>' +
          '<option value="SYNTHETIC_MARKED_OTHER_VALUE">SYNTHETIC_MARKED_OTHER_LABEL</option>' +
        '</select></label>' +
        '<label><input type="checkbox" data-testid="marked-check" checked> Remember this device</label>' +
      '</div>' +
      '<section data-testid="plain-group"><p>Preferences</p>' +
        '<label>Nickname <input type="text" data-testid="plain-text" name="nickname"></label>' +
        '<label>Contact time <select data-testid="plain-select" name="contact">' +
          '<option value="mornings">Mornings</option><option value="evenings">Evenings</option>' +
        '</select></label>' +
        '<label><input type="checkbox" data-testid="plain-check" checked> Email me</label>' +
      '</section>'
    );
  });
}

test("sensitive-input: no descriptor carries the checked state, options or selection of a control inside a marked element", async ({ openHarness, page }) => {
  const harness = await openHarness("sensitive-input");
  await injectMarkedGroup(page);

  const snapshot = await capture(harness);
  const reply = await harness.runAction({ commandId: "capture-marked-state", actionType: "web.dom.capture_snapshot" });
  expect(reply).toMatchObject({ status: "succeeded" });
  // The whole of both: every descriptor, every evidence item, and the reply around them.
  for (const wire of [JSON.stringify(snapshot), JSON.stringify(reply)]) {
    for (const secret of [...FIXTURE_SECRETS, ...MARKED_GROUP_SECRETS]) expect(wire).not.toContain(secret);
  }

  const described = (selector: string) => snapshot.interactiveElements.find((element) => element.selector === selector);
  const markedSelect = described(MARKED.select);
  expect(markedSelect, `${MARKED.select} is missing from the snapshot, so this row proves nothing`).toBeTruthy();
  expect(markedSelect?.options).toBeUndefined();
  expect(markedSelect?.selectedValue).toBeUndefined();
  expect(markedSelect?.value).toBeUndefined();
  // Presence still travels, as it does for a marked control itself.
  expect(markedSelect?.hasValue).toBe(true);
  const markedCheck = described(MARKED.check);
  expect(markedCheck, `${MARKED.check} is missing from the snapshot, so this row proves nothing`).toBeTruthy();
  expect(markedCheck?.checked).toBeUndefined();

  // The ordinary group keeps the state the marked one withholds.
  expect(described(PLAIN.select)).toMatchObject({
    options: [{ value: "mornings", label: "Mornings" }, { value: "evenings", label: "Evenings" }],
    selectedValue: "mornings"
  });
  expect(described(PLAIN.check)).toMatchObject({ checked: true });
});

test("sensitive-input: no recorded event carries the value, checked state or options of a control inside a marked element", async ({ openHarness, page }) => {
  const harness = await openHarness("sensitive-input");
  await injectMarkedGroup(page);
  // The recorder's three routes into what a control holds: the debounced
  // `dom.input`, the `dom.change` a toggle and a select report through, and the
  // keydown path -- which carries typed text one character at a time and so
  // never passes a value reader at all.
  //
  // This row sits with the evidence specs because the brief that added it owns
  // them; redaction.spec.ts is the thematic home for recorded-value leaks.
  await harness.setRecording(true, { captureMutations: false, captureInputValues: true, captureSnapshots: false });
  await page.locator(MARKED.text).focus();
  await page.keyboard.type(TYPED_IN_MARKED_GROUP);
  // Tab acts on the text rather than typing it, so it sends the debounced input.
  await page.keyboard.press("Tab");
  await page.locator(MARKED.check).click();
  // A real key press, not selectOption: the synthetic events that dispatches are
  // untrusted, and the recorder ignores those by design.
  await page.locator(MARKED.select).focus();
  await page.keyboard.press("ArrowDown");
  // The control: an ordinary field typed into in the same session is recorded in full.
  await page.locator(PLAIN.text).focus();
  await page.keyboard.type(CONTROL_TEXT);
  await harness.setRecording(false);

  const wire = JSON.stringify(await harness.messages());
  for (const secret of [...FIXTURE_SECRETS, ...MARKED_GROUP_SECRETS]) expect(wire).not.toContain(secret);
  expect(wire).toContain(CONTROL_TEXT);

  const typed = (await harness.recordedEvents("dom.input")).filter((event) => event.element?.selector === MARKED.text);
  expect(typed).toHaveLength(1);
  expect(typed[0]?.inputValue).toBeUndefined();
  expect(typed[0]?.element?.value).toBeUndefined();
  // Presence still travels: the recording knows the field was typed into.
  expect(typed[0]?.element?.hasValue).toBe(true);

  // Every character key pressed in the group is withheld; the key that left it
  // carries no content of its own and still travels.
  const presses = (await harness.recordedEvents("dom.keydown")).filter((event) => event.element?.selector === MARKED.text);
  expect(presses.length).toBeGreaterThanOrEqual(TYPED_IN_MARKED_GROUP.length);
  expect(presses.map((event) => event.key).filter((key) => key !== undefined)).toEqual(["Tab"]);

  const changes = await harness.recordedEvents("dom.change");
  const toggled = changes.find((event) => event.element?.selector === MARKED.check);
  expect(toggled, "no dom.change was recorded for the checkbox in the marked group").toBeTruthy();
  expect(toggled?.element?.checked).toBeUndefined();
  expect(toggled?.inputValue).toBeUndefined();
  const selected = changes.find((event) => event.element?.selector === MARKED.select);
  expect(selected, "no dom.change was recorded for the select in the marked group").toBeTruthy();
  expect(selected?.element?.options).toBeUndefined();
  expect(selected?.element?.selectedValue).toBeUndefined();
  expect(selected?.inputValue).toBeUndefined();

  // The control at the event level: the ordinary field's value is recorded.
  const control = (await harness.recordedEvents("dom.input")).filter((event) => event.element?.selector === PLAIN.text);
  expect(control).toHaveLength(1);
  expect(control[0]?.inputValue).toBe(CONTROL_TEXT);
});
