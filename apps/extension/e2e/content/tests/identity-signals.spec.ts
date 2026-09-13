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
// The recorded toggle is followed through its `dom.change`, not its `dom.click`,
// and that choice is measured rather than assumed. The recorder emits a click
// from `pointerdown` (`content/dom-events.ts`), before the browser flips the
// box, so that click's descriptor holds the state the box was in *before* the
// click. The `change` fires after the flip, and it is the event the domain maps
// to `web.dom.check` (`domain/src/io/input-model.ts`), whose `checked`
// parameter `output-nodes/payloads.ts` reads off the recorded element.
//
// The markup is injected into a Scenario Lab page rather than added to a
// fixture. The rows need a region named by reference, a navigation landmark
// named by `aria-label` and three kinds of toggle, and no scenario's recorded
// contract should move for a test of the recorder.

import { WEB_AUTOMATION_INPUT_IDS, outputTargetFromPayload, webAutomationOutputPayload } from "@fluxiq-web-extension/domain/client";
import { gatewayRecordingEventFromPayload, recordedInputId } from "../../../src/background/connection/index.js";
import type { DomElementDescriptor, JsonObject, RecordingEventPayload } from "../../../src/shared/protocol.js";
import { expect, test } from "../index.js";
import type { ContentHarness } from "../index.js";
import { describe } from "./identity-fixtures.js";

const TOGGLES = `
  <section id="b5-billing" aria-labelledby="b5-billing-title">
    <h2 id="b5-billing-title">Billing   details</h2>
    <label><input type="checkbox" id="b5-agree" checked> I agree to the terms</label>
    <label><input type="checkbox" id="b5-news"> Send me news</label>
    <label><input type="radio" name="b5-plan" id="b5-annual" checked> Annual</label>
    <label>Name on the account <input type="text" id="b5-name"></label>
  </section>
  <nav aria-label="Account">
    <label><input type="checkbox" id="b5-secret" data-sensitive="true" checked> Share my health record</label>
  </nav>`;

async function openToggles(openHarness: (scenarioId: string) => Promise<ContentHarness>): Promise<ContentHarness> {
  const harness = await openHarness("ambiguous-targets");
  await harness.page.evaluate((markup) => {
    const host = document.createElement("div");
    host.id = "b5-host";
    host.innerHTML = markup;
    document.body.append(host);
  }, TOGGLES);
  return harness;
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
    const harness = await openToggles(openHarness);
    expect((await describe(harness, "#b5-agree")).checked).toBe(true);
    expect((await describe(harness, "#b5-news")).checked, "an unchecked box says so rather than saying nothing").toBe(false);
    expect((await describe(harness, "#b5-annual")).checked).toBe(true);
    expect("checked" in await describe(harness, "#b5-name"), "a text field has no checked state").toBe(false);
  });

  test("the recorder names the landmark around a control, by reference and by aria-label", async ({ openHarness }) => {
    const harness = await openToggles(openHarness);
    expect((await describe(harness, "#b5-agree")).context).toMatchObject({ landmark: "region", landmarkName: "Billing details" });
    expect((await describe(harness, "#b5-secret")).context).toMatchObject({ landmark: "navigation", landmarkName: "Account" });
  });

  test("a sensitive checkbox is described without its state, and its toggle never becomes a guessed check", async ({ openHarness }) => {
    const harness = await openToggles(openHarness);
    expect(await harness.page.locator("#b5-secret").isChecked(), "the box really is checked").toBe(true);
    const described = await describe(harness, "#b5-secret");
    expect("checked" in described, "the recorder withholds a sensitive control's state").toBe(false);
    const recorded = recordedChange(harness, described);
    expect("checked" in wireElement(recorded)).toBe(false);
    const parameters = webAutomationOutputPayload("web.dom.check", wirePayload(recorded));
    expect("checked" in parameters, "with no state, the domain keeps the toggle as evidence").toBe(false);
    const dispatched = dispatchedElement(parameters);
    expect("checked" in dispatched).toBe(false);
    expect(dispatched.context, "its landmark's name is page chrome and still travels").toMatchObject({ landmark: "navigation", landmarkName: "Account" });
  });

  test("a recorded toggle becomes a check step carrying the state it was left in, and its landmark's name", async ({ openHarness }) => {
    const harness = await openToggles(openHarness);
    await harness.setRecording(true);
    await harness.page.locator("#b5-agree").click();
    const changeOnAgree = async () => (await harness.recordedEvents("dom.change")).find((event) => event.element?.selector === "#b5-agree");
    await expect.poll(async () => Boolean(await changeOnAgree()), "the recorder sent the checkbox's change").toBe(true);
    const recorded = await changeOnAgree();
    if (!recorded) throw new Error("no recorded change on #b5-agree");
    const leftChecked = await harness.page.locator("#b5-agree").isChecked();
    expect(leftChecked, "the click unchecked a box that started checked").toBe(false);
    expect(recordedInputId(recorded)).toBe(WEB_AUTOMATION_INPUT_IDS.checkboxToggled);

    const parameters = webAutomationOutputPayload("web.dom.check", wirePayload(recorded));
    expect(parameters.checked, "the state a replay has to reproduce").toBe(leftChecked);
    const dispatched = dispatchedElement(parameters);
    expect(dispatched.checked).toBe(leftChecked);
    expect(dispatched.context).toMatchObject({ landmark: "region", landmarkName: "Billing details" });
  });
});
