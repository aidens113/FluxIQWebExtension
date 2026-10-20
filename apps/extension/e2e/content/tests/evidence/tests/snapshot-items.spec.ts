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
//
// t730 moved them off the synthetic basic form onto realistic pages: the job
// board's home page (a search form with two labelled fields and a submit, under
// its consent wall) and, for a native select, the auction site's header.

import { webAutomationActionFromGatewayCommand, webAutomationExpectationActionPayload, webAutomationExpectationCondition } from "@fluxiq-web-extension/domain";
import { expect, test } from "../../../index.js";
import type { ContentHarness } from "../../../index.js";
import type { JsonObject } from "../../../../../src/shared/protocol.js";
import { capture } from "./captured-snapshot.js";
import type { CapturedElement, CapturedSnapshot } from "./captured-snapshot.js";

/** The job board's search form, its submit and its heading, by the selectors the content script gives them. */
const SEARCH_FORM = "main > form";
const FIND_JOBS = "main > form > button";
const WHAT = "input[name=\"q\"]";
const HEADING = "main > h1";
const HEADING_TEXT = "Find the role, not the noise";
const CATEGORY = "select[name=\"_sacat\"]";

function bySelector(snapshot: CapturedSnapshot, selector: string): CapturedElement {
  const element = snapshot.interactiveElements.find((candidate) => candidate.selector === selector);
  if (!element) throw new Error(`The snapshot carried no element with selector ${selector}.`);
  return element;
}

/** One row for an item the snapshot carries beside `evidence`: the harness is passed for the address it opened. */
type SnapshotRow = {
  item: string;
  scenario: string;
  assert(snapshot: CapturedSnapshot, harness: ContentHarness): Promise<void> | void;
};

const SNAPSHOT_ROWS: SnapshotRow[] = [
  {
    item: "visible text",
    scenario: "job-board",
    assert: (snapshot) => {
      expect(bySelector(snapshot, HEADING)).toMatchObject({ text: HEADING_TEXT, visibleText: HEADING_TEXT });
      expect(bySelector(snapshot, FIND_JOBS)).toMatchObject({ text: "Find jobs", visibleText: "Find jobs" });
    }
  },
  {
    item: "visible text is not invented for a control that renders none",
    scenario: "job-board",
    assert: (snapshot) => {
      // The label reads "What" and the placeholder suggests keywords, but the input itself renders no text of its own.
      const what = bySelector(snapshot, WHAT);
      expect(what).toMatchObject({ accessibleName: "What", label: "What" });
      expect(what.text).toBeUndefined();
      expect(what.visibleText).toBeUndefined();
    }
  },
  {
    item: "current URL",
    scenario: "job-board",
    assert: (snapshot, harness) => {
      expect(snapshot.url).toBe(harness.url);
      // The page's address and its navigation evidence are one reading, not two.
      expect(snapshot.evidence?.navigation.url).toBe(snapshot.url);
    }
  },
  {
    item: "page title",
    scenario: "job-board",
    assert: (snapshot) => {
      expect(snapshot.title).toBe("Rolefinch - Jobs, salaries and company reviews");
    }
  },
  {
    item: "selected elements at rest",
    scenario: "auction-marketplace",
    assert: (snapshot) => {
      // A select always holds an option, so its selection is evidence before anyone touches it.
      expect(bySelector(snapshot, CATEGORY)).toMatchObject({
        selectedValue: "0",
        options: [{ value: "0", label: "All Categories" }, { value: "625", label: "Cameras & Photography" }, { value: "15230", label: "Film Photography" }]
      });
      // Nothing else is selected: no page selection, no selection on a control that has none, and focus on the body.
      expect(bySelector(snapshot, "input[name=\"_nkw\"]").selectedValue).toBeUndefined();
      expect(snapshot.selectedText).toBeUndefined();
      expect(snapshot.focusedElement?.tagName).toBe("body");
    }
  },
  {
    item: "relevant attributes",
    scenario: "job-board",
    assert: async (snapshot, harness) => {
      // Every attribute the page wrote, in the order it wrote them, whole
      // (t200): the id rotates with the seed, so the page itself is the oracle.
      const written = (selector: string) => harness.page.locator(selector).evaluate((element) => Object.fromEntries([...element.attributes].map((attribute) => [attribute.name, attribute.value])));
      const what = bySelector(snapshot, WHAT).attributes;
      expect(what).toEqual(await written(WHAT));
      expect(Object.keys(what ?? {})).toEqual(Object.keys(await written(WHAT)));
      expect(what).toMatchObject({ name: "q", placeholder: "Job title, keywords or company" });
      expect(bySelector(snapshot, FIND_JOBS).attributes).toEqual(await written(FIND_JOBS));
    }
  },
  {
    item: "relevant attributes are not invented on an element that has none",
    scenario: "job-board",
    assert: (snapshot) => {
      const heading = snapshot.interactiveElements.find((element) => element.tagName === "h1");
      expect(heading?.text).toBe(HEADING_TEXT);
      expect(heading?.attributes).toBeUndefined();
    }
  }
];

for (const row of SNAPSHOT_ROWS) {
  test(`${row.scenario}: ${row.item}`, async ({ openHarness }) => {
    const harness = await openHarness(row.scenario);
    await row.assert(await capture(harness), harness);
  });
}

test("job-board: a page selection and a focused control are carried as the selected elements", async ({ openHarness, page }) => {
  const harness = await openHarness("job-board");
  // The selection first: focusing a text control afterwards moves the selection into it.
  await page.evaluate(() => {
    const heading = document.querySelector("main h1");
    if (!heading) throw new Error("the job board's home page has no heading to select");
    window.getSelection()?.selectAllChildren(heading);
  });
  expect((await capture(harness)).selectedText).toBe(HEADING_TEXT);

  await page.locator(WHAT).focus();
  expect((await capture(harness)).focusedElement).toMatchObject({ tagName: "input", selector: WHAT });
});

test("job-board: a page with no title reports an empty title, not one borrowed from its heading", async ({ openHarness, page }) => {
  const harness = await openHarness("job-board");
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

test("job-board: expected-state evidence carries the claim and what the page showed when it holds", async ({ openHarness }) => {
  const harness = await openHarness("job-board");
  const reply = await harness.runAction(expectedStateCheck("expected-state-holds", { selector: HEADING, assert: { kind: "text", expected: HEADING_TEXT } }));
  expect(reply).toMatchObject({
    status: "succeeded",
    validation: { status: "passed", expected: `"${HEADING}" contains "${HEADING_TEXT}"`, actual: `"${HEADING}" reads "${HEADING_TEXT}"` }
  });
  expect(reply.failure).toBeUndefined();
});

test("job-board: expected-state evidence on a page not in that state is a mismatch carrying both sides", async ({ openHarness }) => {
  const harness = await openHarness("job-board");
  // The search form is expected gone, as it would be after a search replaced the page; nothing was searched.
  const reply = await harness.runAction(expectedStateCheck("expected-state-missing", { selector: SEARCH_FORM, assert: { kind: "absent" } }));
  expect(reply).toMatchObject({
    status: "failed",
    validation: { status: "failed", expected: `no element matches "${SEARCH_FORM}"`, actual: `"${SEARCH_FORM}" is still present` },
    failure: {
      category: "unexpected_state", code: "web.validation.state_mismatch",
      expected: `no element matches "${SEARCH_FORM}"`, actual: `"${SEARCH_FORM}" is still present`
    }
  });
});
