import { expect, type Locator, type Page } from "@playwright/test";
import { resolveScenarioWorkflow, type ScenarioStep } from "@fluxiq-web-extension/test-contracts";
import type { RunningScenarioLab } from "../src/server.js";
import { keyboardFormsScenario, type KeyboardFormsState } from "../src/scenarios/keyboard-forms/index.js";
import { readFinalState, test } from "./lab-fixture.js";

const startUrl = (lab: RunningScenarioLab) => `${lab.origin}${keyboardFormsScenario.startPath}`;

const finalState = (lab: RunningScenarioLab) => readFinalState<KeyboardFormsState>(lab, "keyboard-forms");

function targetOf(page: Page, step: ScenarioStep): Locator {
  if (!step.target?.startsWith("testid:")) throw new Error(`Step ${step.id} needs a testid target`);
  return page.getByTestId(step.target.slice("testid:".length));
}

/** One manifest step with plain Playwright, as the recording lane drives it: `type` fills, `press` is a trusted key. */
async function perform(page: Page, step: ScenarioStep): Promise<void> {
  switch (step.operation) {
    case "type": return targetOf(page, step).fill(String(step.value));
    case "press": return targetOf(page, step).press(String(step.value));
    case "check": return targetOf(page, step).setChecked(step.value === true);
    case "waitForState": return targetOf(page, step).waitFor({ state: "visible", timeout: step.timeoutMs ?? 3_000 });
    case "checkpoint": return;
    default: throw new Error(`The keyboard-forms spec does not drive ${step.operation}`);
  }
}

/** Runs a manifest workflow from the start page, then checks its `finalState` facts on the page. */
async function runWorkflow(page: Page, lab: RunningScenarioLab, workflowId?: string): Promise<void> {
  const workflow = resolveScenarioWorkflow(keyboardFormsScenario.manifest, workflowId === undefined ? {} : { workflowId });
  await page.goto(startUrl(lab));
  for (const step of workflow.recordingScript) await perform(page, step);
  for (const fact of workflow.expected.finalState ?? []) {
    expect(fact.predicate).toBe("text");
    await expect(page.getByTestId(fact.subject), fact.id).toHaveText(String(fact.value));
  }
}

test("W02 primary workflow: Enter submits the profile form, then the checkbox and radio group are set", async ({ page, lab, networkGuard: _guard }) => {
  await runWorkflow(page, lab);
  const state = await finalState(lab);
  // Native implicit submission reports the form's default button as the submitter.
  expect(state.profile).toEqual({ displayName: "Ada Lovelace", outcome: "saved", submissionCount: 1, lastSubmitter: "save-profile" });
  expect(state.preferences).toEqual({ emailUpdates: true, contactMethod: "sms", country: null });
});

test("W02: the Save profile button submits too, and an empty display name is rejected", async ({ page, lab, networkGuard: _guard }) => {
  await page.goto(startUrl(lab));
  const save = page.getByRole("button", { name: "Save profile" });
  await save.click();
  await expect(page.getByTestId("profile-status")).toHaveText("Display name is required");
  await page.getByLabel("Display name").fill("Grace Hopper");
  await save.click();
  await expect(page.getByTestId("profile-status")).toHaveText("Saved: Grace Hopper");
  expect((await finalState(lab)).profile).toEqual({ displayName: "Grace Hopper", outcome: "saved", submissionCount: 2, lastSubmitter: "save-profile" });
});

test("W03 combobox workflow: ArrowDown and Enter choose a filtered option without submitting the form", async ({ page, lab, networkGuard: _guard }) => {
  await runWorkflow(page, lab, "combobox");
  const combobox = page.getByRole("combobox", { name: "Country" });
  await expect(combobox).toHaveValue("Netherlands");
  await expect(combobox).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByTestId("country-listbox")).toBeHidden();
  const state = await finalState(lab);
  expect(state.preferences).toEqual({ emailUpdates: false, contactMethod: "email", country: "NL" });
  expect(state.profile.submissionCount).toBe(0);
});

test("W03 with typed keystrokes: the listbox opens on keydown and filters on every input event", async ({ page, lab, networkGuard: _guard }) => {
  await page.goto(startUrl(lab));
  const combobox = page.getByRole("combobox", { name: "Country" });
  // `fill` sends an input event but no keydown: the list filters but stays closed.
  await combobox.fill("Ne");
  await expect(page.getByTestId("country-listbox")).toBeHidden();
  await combobox.fill("");
  await combobox.pressSequentially("N");
  await expect(page.getByRole("listbox", { name: "Country" })).toBeVisible();
  await expect(combobox).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("option")).toHaveText(["Nepal", "Netherlands", "New Zealand", "Norway"]);
  await combobox.pressSequentially("e");
  await expect(page.getByRole("option")).toHaveText(["Nepal", "Netherlands", "New Zealand"]);
  await combobox.press("ArrowDown");
  await expect(combobox).toHaveAttribute("aria-activedescendant", "country-option-np");
  await combobox.press("ArrowDown");
  await expect(combobox).toHaveAttribute("aria-activedescendant", "country-option-nl");
  await expect(page.getByRole("option", { name: "Netherlands" })).toHaveAttribute("aria-selected", "true");
  await combobox.press("Enter");
  await expect(page.getByTestId("country-status")).toHaveText("Country: Netherlands");
  await expect(combobox).toHaveValue("Netherlands");
  await expect(page.getByTestId("profile-status")).toHaveText("Not saved");
  expect(await finalState(lab)).toMatchObject({ profile: { submissionCount: 0 }, preferences: { country: "NL" } });
});

test("W03: an option can also be chosen by click once typing has opened the listbox", async ({ page, lab, networkGuard: _guard }) => {
  await page.goto(startUrl(lab));
  const combobox = page.getByRole("combobox", { name: "Country" });
  await combobox.pressSequentially("No");
  await expect(page.getByRole("option")).toHaveText(["Norway"]);
  await page.getByRole("option", { name: "Norway" }).click();
  await expect(page.getByTestId("country-status")).toHaveText("Country: Norway");
  await expect(combobox).toHaveValue("Norway");
  await expect(combobox).toBeFocused();
  await expect(page.getByTestId("country-listbox")).toBeHidden();
  expect(await finalState(lab)).toMatchObject({ profile: { submissionCount: 0 }, preferences: { country: "NO" } });
});

test("D5 evidence: untrusted events drive the combobox, but an untrusted Enter never submits the form", async ({ page, lab, networkGuard: _guard }) => {
  await page.goto(startUrl(lab));
  const evidence = await page.evaluate(() => {
    const form = document.querySelector('[data-testid="settings-form"]') as HTMLFormElement;
    const name = document.querySelector('[data-testid="display-name"]') as HTMLInputElement;
    const combobox = document.querySelector('[data-testid="country"]') as HTMLInputElement;
    const listbox = document.querySelector('[data-testid="country-listbox"]') as HTMLElement;
    let submits = 0;
    form.addEventListener("submit", () => { submits += 1; });
    const key = (target: Element, type: string, value: string) => target.dispatchEvent(new KeyboardEvent(type, { key: value, bubbles: true, cancelable: true }));
    // What the extension's keypress action does today: an untrusted keydown and keyup.
    name.focus();
    name.value = "Ada Lovelace";
    key(name, "keydown", "Enter");
    key(name, "keyup", "Enter");
    const submitsAfterUntrustedEnter = submits;
    // D5 typing emulation: per character keydown, value change, input, keyup.
    combobox.focus();
    for (const character of "Ne") {
      key(combobox, "keydown", character);
      combobox.value += character;
      combobox.dispatchEvent(new InputEvent("input", { bubbles: true, data: character, inputType: "insertText" }));
      key(combobox, "keyup", character);
    }
    const openedByUntrustedKeydown = !listbox.hidden;
    key(combobox, "keydown", "ArrowDown");
    key(combobox, "keydown", "ArrowDown");
    const highlighted = combobox.getAttribute("aria-activedescendant");
    const enterDefaultPrevented = !key(combobox, "keydown", "Enter");
    return { submitsAfterUntrustedEnter, openedByUntrustedKeydown, highlighted, enterDefaultPrevented, submitsAfterCombobox: submits };
  });
  expect(evidence).toEqual({ submitsAfterUntrustedEnter: 0, openedByUntrustedKeydown: true, highlighted: "country-option-nl", enterDefaultPrevented: true, submitsAfterCombobox: 0 });
  await expect(page.getByTestId("country-status")).toHaveText("Country: Netherlands");
  // `form.requestSubmit()`, D5's Enter emulation, submits but reports no submitter; native Enter reports the default button.
  await page.evaluate(() => (document.querySelector('[data-testid="settings-form"]') as HTMLFormElement).requestSubmit());
  await expect(page.getByTestId("profile-status")).toHaveText("Saved: Ada Lovelace");
  expect((await finalState(lab)).profile).toEqual({ displayName: "Ada Lovelace", outcome: "saved", submissionCount: 1, lastSubmitter: null });
});

test("D5 evidence: radio-group arrow keys move the selection only for trusted input", async ({ page, lab, networkGuard: _guard }) => {
  await page.goto(startUrl(lab));
  const email = page.getByRole("radio", { name: "Email" });
  await email.focus();
  await email.dispatchEvent("keydown", { key: "ArrowDown" });
  await expect(email).toBeChecked();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("radio", { name: "Text message" })).toBeChecked();
  await expect(page.getByTestId("contact-method-status")).toHaveText("Contact method: Text message");
  expect((await finalState(lab)).preferences.contactMethod).toBe("sms");
});
