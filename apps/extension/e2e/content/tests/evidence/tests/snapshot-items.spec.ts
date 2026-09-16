// The six audited items that were already present, and so have no row in the
// evidence table: visible text, the current URL, the page title, selected
// elements and relevant attributes -- which live on the snapshot beside
// `evidence` rather than inside it -- and expected-state evidence, which is the
// verdict of the `web.dom.assert` check an authored expected state becomes.
//
// They are pinned here because an item nothing asserts stops arriving with
// every gate green. `SNAPSHOT_ROWS` pins the first five on a page at rest, the
// two selection rows underneath pin what only an interaction can show, and the
// tests at the foot pin the sixth.

import { webAutomationActionFromGatewayCommand, webAutomationExpectationActionPayload, webAutomationExpectationCondition } from "@fluxiq-web-extension/domain";
import { expect, test } from "../../../index.js";
import type { ContentHarness } from "../../../index.js";
import type { JsonObject } from "../../../../../src/shared/protocol.js";
import { capture } from "./captured-snapshot.js";
import type { CapturedElement, CapturedSnapshot } from "./captured-snapshot.js";

/** basic-form's controls, by the test ids the fixture gives them. */
const BASIC_FORM = '[data-testid="basic-form"]';
const RESULT = '[data-testid="result"]';

function byTestId(snapshot: CapturedSnapshot, testId: string): CapturedElement {
  const element = snapshot.interactiveElements.find((candidate) => candidate.testId === testId);
  if (!element) throw new Error(`The snapshot carried no element with test id "${testId}".`);
  return element;
}

/** One row for an item the snapshot carries beside `evidence`: the harness is passed for the address it opened. */
type SnapshotRow = {
  item: string;
  scenario: string;
  assert(snapshot: CapturedSnapshot, harness: ContentHarness): void;
};

const SNAPSHOT_ROWS: SnapshotRow[] = [
  {
    item: "visible text",
    scenario: "basic-form",
    assert: (snapshot) => {
      expect(byTestId(snapshot, "result")).toMatchObject({ text: "Not submitted", visibleText: "Not submitted" });
      expect(byTestId(snapshot, "submit")).toMatchObject({ text: "Submit", visibleText: "Submit" });
    }
  },
  {
    item: "visible text is not invented for a control that renders none",
    scenario: "basic-form",
    assert: (snapshot) => {
      // The label reads "Name", but the input itself renders no text of its own.
      const name = byTestId(snapshot, "name");
      expect(name.text).toBeUndefined();
      expect(name.visibleText).toBeUndefined();
    }
  },
  {
    item: "current URL",
    scenario: "basic-form",
    assert: (snapshot, harness) => {
      expect(snapshot.url).toBe(harness.url);
      // The page's address and its navigation evidence are one reading, not two.
      expect(snapshot.evidence?.navigation.url).toBe(snapshot.url);
    }
  },
  {
    item: "page title",
    scenario: "basic-form",
    assert: (snapshot) => {
      expect(snapshot.title).toBe("Basic form");
    }
  },
  {
    item: "selected elements at rest",
    scenario: "basic-form",
    assert: (snapshot) => {
      // A select always holds an option, so its selection is evidence before anyone touches it.
      expect(byTestId(snapshot, "plan")).toMatchObject({
        selectedValue: "starter",
        options: [{ value: "starter", label: "Starter" }, { value: "team", label: "Team" }, { value: "enterprise", label: "Enterprise" }]
      });
      // Nothing else is selected: no page selection, no selection on a control that has none, and focus on the body.
      expect(byTestId(snapshot, "name").selectedValue).toBeUndefined();
      expect(snapshot.selectedText).toBeUndefined();
      expect(snapshot.focusedElement?.tagName).toBe("body");
    }
  },
  {
    item: "relevant attributes",
    scenario: "basic-form",
    assert: (snapshot) => {
      // Exactly the allowlisted attributes: the input is also `required`, which the allowlist does not carry.
      expect(byTestId(snapshot, "name").attributes).toEqual({ name: "name", "data-testid": "name", autocomplete: "off" });
      expect(byTestId(snapshot, "submit").attributes).toEqual({ type: "submit", "data-testid": "submit" });
    }
  },
  {
    item: "relevant attributes are not invented on an element that has none",
    scenario: "basic-form",
    assert: (snapshot) => {
      const heading = snapshot.interactiveElements.find((element) => element.tagName === "h1");
      expect(heading?.text).toBe("Basic form");
      expect(heading?.attributes).toBeUndefined();
    }
  }
];

for (const row of SNAPSHOT_ROWS) {
  test(`${row.scenario}: ${row.item}`, async ({ openHarness }) => {
    const harness = await openHarness(row.scenario);
    row.assert(await capture(harness), harness);
  });
}

test("basic-form: a page selection and a focused control are carried as the selected elements", async ({ openHarness, page }) => {
  const harness = await openHarness("basic-form");
  // The selection first: focusing a text control afterwards moves the selection into it.
  await page.evaluate(() => {
    const heading = document.querySelector("main h1");
    if (!heading) throw new Error("basic-form has no heading to select");
    window.getSelection()?.selectAllChildren(heading);
  });
  expect((await capture(harness)).selectedText).toBe("Basic form");

  await page.locator("[data-testid=\"notes\"]").focus();
  expect((await capture(harness)).focusedElement).toMatchObject({ tagName: "textarea", selector: "[data-testid=\"notes\"]", testId: "notes" });
});

test("basic-form: a page with no title reports an empty title, not one borrowed from its heading", async ({ openHarness, page }) => {
  const harness = await openHarness("basic-form");
  await page.evaluate(() => document.querySelector("title")?.remove());
  expect((await capture(harness)).title).toBe("");
});

/**
 * An authored expected state, in the `{ selector, assert }` shape
 * `domain/src/output-nodes` writes into `parameterValues.expectedState`, turned
 * into the command a live check dispatches by the domain's own functions: the
 * condition reader, the payload it becomes, and the gateway mapping.
 */
function expectedStateCheck(commandId: string, entry: JsonObject): Parameters<ContentHarness["runAction"]>[0] {
  // 0 is the wait Core's transition comparison passes for an expectation that names none.
  const condition = webAutomationExpectationCondition(entry, 0);
  if (!condition) throw new Error(`The domain could not read the expected state ${JSON.stringify(entry)}.`);
  const command = webAutomationActionFromGatewayCommand({ commandId, actionType: "web.dom.assert", parameters: webAutomationExpectationActionPayload(condition) });
  if ("status" in command) throw new Error(`The domain rejected the expected-state check: ${command.message}`);
  return command;
}

test("basic-form: expected-state evidence carries the claim and what the page showed when it holds", async ({ openHarness }) => {
  const harness = await openHarness("basic-form");
  const reply = await harness.runAction(expectedStateCheck("expected-state-holds", { selector: RESULT, assert: { kind: "text", expected: "Not submitted" } }));
  expect(reply).toMatchObject({
    status: "succeeded",
    validation: { status: "passed", expected: `"${RESULT}" contains "Not submitted"`, actual: `"${RESULT}" reads "Not submitted"` }
  });
  expect(reply.failure).toBeUndefined();
});

test("basic-form: expected-state evidence on a page not in that state is a mismatch carrying both sides", async ({ openHarness }) => {
  const harness = await openHarness("basic-form");
  // The form is expected gone, as it would be after a submit that replaced it; nothing was submitted.
  const reply = await harness.runAction(expectedStateCheck("expected-state-missing", { selector: BASIC_FORM, assert: { kind: "absent" } }));
  expect(reply).toMatchObject({
    status: "failed",
    validation: { status: "failed", expected: `no element matches "${BASIC_FORM}"`, actual: `"${BASIC_FORM}" is still present` },
    failure: {
      category: "unexpected_state", code: "web.validation.state_mismatch",
      expected: `no element matches "${BASIC_FORM}"`, actual: `"${BASIC_FORM}" is still present`
    }
  });
});
