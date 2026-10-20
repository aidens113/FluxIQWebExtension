// B5 in a real page: a checkbox's checked state and a landmark's name, from the
// element the recorder describes to the target the domain dispatches.
//
// Each hop has its own unit test -- `content/identity/tests/context.test.ts`,
// `background/connection/tests/gateway-payloads.test.ts` and
// `domain/src/output-nodes/tests/targets.test.ts` -- and every one of them
// starts from a hand-written object. That is how `context` once shipped
// captured at one end and dropped at the other (reports/x-identity-wire.md).
// These rows start from Chromium's own DOM, go through the background worker's
// projection and a JSON round trip, then through the domain's step builder and
// normalizer, and read the result where a replay reads it.
//
// The page is everything-store's checkout (AGENTS.md: realistic scenarios
// only), which has every construct the rows need and draws them itself: a
// gift-card box that starts unticked and a Plus-trial box that starts ticked, a
// delivery radio group, a region named by reference to its heading ("Paying
// with ..."), and the cookie banner -- a region named by `aria-label` -- whose
// Customize panel holds boxes that toggle without reloading the page. The
// checkout's own boxes post a mutation and reload, which would wipe the
// recorded events before a row could read them, so the recorded toggle is the
// banner's.
//
// The recorded toggle is followed through its `dom.change`, not its `dom.click`,
// and that choice is measured rather than assumed. The recorder emits a click
// from `pointerdown` (`content/dom-events.ts`), before the browser flips the
// box, so that click's descriptor holds the state the box was in *before* the
// click. The `change` fires after the flip, and it is the event the domain maps
// to `web.dom.check` (`domain/src/io/input-model.ts`), whose `checked`
// parameter `output-nodes/payloads.ts` reads off the recorded element.
//
// The sensitive checkbox is bigbox-retail's (t730 C2): armed into its
// `account-recovery` rendering, the sign-in wall opens a "Forgot your
// password?" section, named by its heading, whose "Your security details" group
// the page marks `data-sensitive` and whose "Remember this device" box starts
// ticked. The box is not marked itself; the group around it is.

import { WEB_AUTOMATION_INPUT_IDS, outputTargetFromPayload, webAutomationActionFromGatewayCommand, webAutomationOutputPayload } from "@fluxiq-web-extension/domain/client";
import { gatewayRecordingEventFromPayload, recordedInputId } from "../../../src/background/connection/index.js";
import type { DomElementDescriptor, JsonObject, RecordingEventPayload } from "../../../src/shared/protocol.js";
import { expect, test } from "../index.js";
import type { ContentHarness } from "../index.js";
import { describe, labMutate, openPath } from "./identity-fixtures.js";

const GIFT_CARD = 'section[aria-labelledby="pay-heading"] input[type="checkbox"]';
const PLUS_TRIAL = 'section:not([aria-labelledby]) > input[type="checkbox"]';
const DELIVERY = 'input[name="delivery"]:checked';
const SEARCH = 'input[name="k"]';
const PERFORMANCE = '[data-consent-prefs] label:nth-of-type(2) input[type="checkbox"]';

/** everything-store's checkout for the cart as the account left it, with the cookie banner still unanswered. */
async function openCheckout(openHarness: (scenarioId: string) => Promise<ContentHarness>): Promise<ContentHarness> {
  const harness = await openHarness("everything-store");
  await labMutate(harness, "dismiss-nudge", { nudge: "app-banner" });
  await labMutate(harness, "dismiss-nudge", { nudge: "notifications" });
  await labMutate(harness, "start-checkout", { pipeline: "cart" });
  await openPath(harness, "checkout");
  return harness;
}

/** The cookie banner's purposes, opened through its own Customize button. */
async function openCookiePurposes(harness: ContentHarness): Promise<void> {
  await harness.page.click('[data-consent="customize"]');
  await expect(harness.page.locator(PERFORMANCE)).toBeVisible();
}

/** The ticked box inside the group bigbox-retail's recovery panel marks `data-sensitive`. */
const REMEMBER_DEVICE = 'input[type="checkbox"][name="rememberDevice"]';

/** bigbox-retail's sign-in wall armed into its `account-recovery` rendering, with the privacy choices declined. */
async function openAccountRecovery(openHarness: (scenarioId: string) => Promise<ContentHarness>): Promise<ContentHarness> {
  const harness = await openHarness("bigbox-retail");
  // Arming starts the shopper over, so it goes first.
  await labMutate(harness, "set-mode", { mode: "account-recovery" });
  await labMutate(harness, "consent", { choice: "reject" });
  await openPath(harness, "checkout");
  await expect(harness.page.getByRole("heading", { name: "Forgot your password?" })).toBeVisible();
  return harness;
}

/**
 * The descriptor for one element, taken from the snapshot. Extraction refuses a
 * sensitive control in every mode (decision D2 of the data-extraction plan), so
 * `web.dom.extract` -- the route `describe` uses -- cannot describe one. The
 * snapshot carries the same `describeElement` output, and is where the
 * background worker reads it, so the rows below still judge the descriptor the
 * recorder produces. The control is found by the `name` the page gives it,
 * because its generated id changes with the seed.
 */
async function describeInSnapshot(harness: ContentHarness, name: string): Promise<DomElementDescriptor> {
  const element = (await harness.capture()).interactiveElements.find((candidate) => candidate.attributes?.name === name);
  if (!element) throw new Error(`the snapshot of ${harness.scenarioId} carries no descriptor for the control named ${name}`);
  return element;
}

/** A recorded change for one described element, as the content script sends it. */
function recordedChange(harness: ContentHarness, element: DomElementDescriptor): RecordingEventPayload {
  return { kind: "dom.change", sequence: 1, url: harness.url, title: "B5", eventTimestampMs: 1, element };
}

/** The recording event's payload as Core stores it: the background worker's projection, after the JSON trip. */
function wirePayload(payload: RecordingEventPayload): JsonObject {
  const sent = gatewayRecordingEventFromPayload(payload).payload;
  if (!sent) throw new Error("the recording event carries no payload");
  return JSON.parse(JSON.stringify(sent)) as JsonObject;
}

function wireElement(payload: RecordingEventPayload): JsonObject {
  const element = wirePayload(payload).element;
  if (!element || typeof element !== "object" || Array.isArray(element)) throw new Error("the recording event carries no element");
  return element;
}

/** The element a replay dispatches, built from recorded parameters the way the domain builds it. */
function dispatchedElement(parameters: JsonObject): Record<string, unknown> {
  const element = outputTargetFromPayload(parameters)?.element;
  if (!element || typeof element !== "object" || Array.isArray(element)) throw new Error("the dispatched target carries no element");
  return element as Record<string, unknown>;
}

test.describe("B5: a toggle's state and its landmark's name, from the page to the dispatched target", () => {
  test("the recorder describes a checked state for a checkbox and a radio, and for nothing else", async ({ openHarness }) => {
    const harness = await openCheckout(openHarness);
    expect((await describe(harness, PLUS_TRIAL)).checked, "the Plus trial box starts ticked").toBe(true);
    expect((await describe(harness, GIFT_CARD)).checked, "an unchecked box says so rather than saying nothing").toBe(false);
    expect((await describe(harness, DELIVERY)).checked).toBe(true);
    expect("checked" in await describe(harness, SEARCH), "a text field has no checked state").toBe(false);
  });

  test("the recorder names the landmark around a control, by reference and by aria-label", async ({ openHarness, page }) => {
    const harness = await openCheckout(openHarness);
    // By reference: the section's `aria-labelledby` points at its heading, so the name is the heading's words.
    const heading = (await page.locator("#pay-heading").textContent())?.trim();
    expect(heading).toMatch(/^Paying with /u);
    expect((await describe(harness, GIFT_CARD)).context).toMatchObject({ landmark: "region", landmarkName: heading });
    // By aria-label: the cookie banner is a region the page names in an attribute.
    await openCookiePurposes(harness);
    expect((await describe(harness, PERFORMANCE)).context).toMatchObject({ landmark: "region", landmarkName: "Cookie preferences" });
  });

  test("a sensitive checkbox is described without its state, and its toggle never becomes a guessed check", async ({ openHarness }) => {
    const harness = await openAccountRecovery(openHarness);
    expect(await harness.page.locator(REMEMBER_DEVICE).isChecked(), "the box really is checked").toBe(true);
    const described = await describeInSnapshot(harness, "rememberDevice");
    expect("checked" in described, "the recorder withholds a sensitive control's state").toBe(false);
    const recorded = recordedChange(harness, described);
    expect("checked" in wireElement(recorded)).toBe(false);
    const parameters = webAutomationOutputPayload("web.dom.check", wirePayload(recorded));
    expect("checked" in parameters, "with no state, the domain keeps the toggle as evidence").toBe(false);
    const dispatched = dispatchedElement(parameters);
    expect("checked" in dispatched).toBe(false);
    expect(dispatched.context, "its landmark's name is page chrome and still travels").toMatchObject({ landmark: "region", landmarkName: "Forgot your password?" });
  });

  test("a recorded toggle becomes a check step carrying the state it was left in, and its landmark's name", async ({ openHarness, page }) => {
    const harness = await openCheckout(openHarness);
    await openCookiePurposes(harness);
    const performance = await describe(harness, PERFORMANCE);
    expect(performance.checked, "Performance starts unticked").toBe(false);
    await harness.setRecording(true);
    await page.locator(PERFORMANCE).click();
    const changeOnPerformance = async () => (await harness.recordedEvents("dom.change")).find((event) => event.element?.selector === performance.selector);
    await expect.poll(async () => Boolean(await changeOnPerformance()), "the recorder sent the checkbox's change").toBe(true);
    const recorded = await changeOnPerformance();
    if (!recorded) throw new Error(`no recorded change on ${performance.selector}`);
    const leftChecked = await page.locator(PERFORMANCE).isChecked();
    expect(leftChecked, "the click ticked a box that started unticked").toBe(true);
    expect(recordedInputId(recorded)).toBe(WEB_AUTOMATION_INPUT_IDS.checkboxToggled);

    const parameters = webAutomationOutputPayload("web.dom.check", wirePayload(recorded));
    expect(parameters.checked, "the state a replay has to reproduce").toBe(leftChecked);
    // The state reaches the page on the command itself, which is where
    // `content/actions/check.ts` reads it. The step's element has carried no
    // state since t425 (`output-nodes/payloads.ts`: every signal the recorder
    // captured, "never what the control held or the state it was left in").
    const command = webAutomationActionFromGatewayCommand({ commandId: "b5:replayed-toggle", actionType: "web.dom.check", parameters });
    if ("status" in command) throw new Error(`the domain rejected the replayed toggle: ${command.message}`);
    expect(command.checked, "the state check.ts sets on replay").toBe(leftChecked);
    const dispatched = dispatchedElement(parameters);
    expect("checked" in dispatched, "the element describes the control, not its state").toBe(false);
    expect(dispatched.context).toMatchObject({ landmark: "region", landmarkName: "Cookie preferences" });
  });
});
