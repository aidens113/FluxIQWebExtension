// The page-level evidence a snapshot carries (Phase 1.4 steps 2 and 3), item by
// item, on the four fixtures the plan names.
//
// Every one of these was audited as absent or partial: dialogs and modals,
// blocking overlays, loading state, page regions and repeating structures had
// no representation anywhere, and the forms model, navigation state, element
// change, interaction recency and the truncation totals existed only inside the
// recorder or not as fields anything downstream could read. So the suite is a
// table -- one row per item per fixture -- rather than a handful of examples:
// an item that quietly stops being produced fails its own row, and the rows
// that assert an item is *absent* are as load-bearing as the rest, because
// evidence invented where the page has none is worse than none at all.
//
// The rows below run against a page at rest. Four items cannot be: a dialog has
// to be opened, a native confirm has to be answered, a page has to be caught
// mid-load, and change and recency need two captures with an interaction
// between them. Each of those has a test of its own underneath.
//
// Six of the audit's sixteen items were audited as present, and for that
// reason had no row: visible text, the current URL, the page title, selected
// elements and relevant attributes, which live on the snapshot beside
// `evidence` rather than inside it, and expected-state evidence, which is the
// verdict of the `web.dom.assert` check an authored expected state becomes. An
// item nothing asserts stops arriving with every gate green, so
// `SNAPSHOT_ROWS` pins the first five and the tests at the foot pin the sixth.

import { webAutomationActionFromGatewayCommand, webAutomationExpectationActionPayload, webAutomationExpectationCondition } from "@fluxiq-web-extension/domain";
import { expect, test } from "../index.js";
import type { ContentHarness } from "../index.js";
import type { PageEvidence } from "../../../src/content/evidence/index.js";
import type { DomSnapshot, JsonObject } from "../../../src/shared/protocol.js";

/** A descriptor plus the two activity flags `content/types.ts` widens it by. */
type CapturedElement = DomSnapshot["interactiveElements"][number] & {
  changed?: boolean | undefined;
  recentlyInteracted?: boolean | undefined;
};

/** The snapshot as the content script builds it: the protocol shape plus what `content/types.ts` widens it by. */
type CapturedSnapshot = Omit<DomSnapshot, "interactiveElements"> & {
  evidence?: PageEvidence | undefined;
  interactiveElements: CapturedElement[];
};

async function capture(harness: ContentHarness): Promise<CapturedSnapshot> {
  return await harness.capture() as CapturedSnapshot;
}

async function evidenceOf(harness: ContentHarness): Promise<PageEvidence> {
  const snapshot = await capture(harness);
  const evidence = snapshot.evidence;
  if (!evidence) throw new Error(`The snapshot of ${harness.scenarioId} carried no page evidence.`);
  return evidence;
}

/** One row: the evidence item, the fixture it is asserted on, and what it must say there. */
type EvidenceRow = {
  item: string;
  scenario: string;
  assert(evidence: PageEvidence): void;
};

const ROWS: EvidenceRow[] = [
  {
    item: "element totals and truncation",
    scenario: "product-catalog",
    assert: (evidence) => {
      const { scanned, candidates, matched, returned, truncated } = evidence.elements;
      // The pre-filter totals are the point: each stage of the funnel is
      // reported, so a reader can tell a small page from a truncated large one.
      expect(scanned).toBeGreaterThan(candidates);
      expect(candidates).toBeGreaterThanOrEqual(matched);
      expect(matched).toBeGreaterThanOrEqual(returned);
      expect(returned).toBeGreaterThan(0);
      expect(truncated).toBe(matched > returned);
      expect(truncated).toBe(false);
    }
  },
  {
    item: "element totals agree with the element list",
    scenario: "intermediate-state",
    assert: (evidence) => {
      expect(evidence.elements.changed).toBe(0);
      expect(evidence.elements.recentlyInteracted).toBe(0);
    }
  },
  {
    item: "loading state at rest",
    scenario: "product-catalog",
    assert: (evidence) => {
      expect(evidence.loading).toMatchObject({
        documentState: "complete",
        busy: false,
        pendingNavigation: false,
        busyRegions: [],
        indicators: []
      });
    }
  },
  {
    item: "navigation state",
    scenario: "product-catalog",
    assert: (evidence) => {
      expect(evidence.navigation).toMatchObject({
        path: "/scenarios/product-catalog/",
        type: "navigate",
        visibility: "visible"
      });
      expect(evidence.navigation.url).toContain("/scenarios/product-catalog/");
      expect(evidence.navigation.origin).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
      expect(evidence.navigation.historyLength).toBeGreaterThanOrEqual(1);
    }
  },
  {
    item: "landmarks and regions",
    scenario: "product-catalog",
    assert: (evidence) => {
      const regions = evidence.regions ?? [];
      expect(regions.map((region) => region.role)).toEqual(
        expect.arrayContaining(["banner", "main", "search", "region", "navigation"])
      );
      expect(regions).toEqual(expect.arrayContaining([
        expect.objectContaining({ role: "search", label: "Product search" }),
        expect.objectContaining({ role: "region", label: "All products" }),
        expect.objectContaining({ role: "navigation", label: "Pagination" })
      ]));
      // A landmark carries where it is, so a reader can say which half of the page it is in.
      const main = regions.find((region) => region.role === "main");
      expect(main?.bounds?.height).toBeGreaterThan(0);
    }
  },
  {
    item: "repeating structures",
    scenario: "product-catalog",
    assert: (evidence) => {
      const repeating = evidence.repeating ?? [];
      // Biggest run first: eight product cards, then the three numbered pages.
      expect(repeating[0]).toMatchObject({
        containerSelector: "[data-testid=\"product-list\"]",
        itemCount: 8,
        representative: { testId: "product-card" }
      });
      // The fields of a row are named, which is what aims `web.dom.extract_list`.
      expect(repeating[0]?.fields).toEqual(
        expect.arrayContaining(["product-name", "product-link", "product-price", "product-rating", "stock-badge"])
      );
      // A numbered run is one template, not three singletons: the signature reads the shape of the id.
      expect(repeating[1]).toMatchObject({
        containerSelector: "[data-testid=\"pagination\"]",
        itemCount: 3,
        representative: { testId: "pagination-page-1" }
      });
      expect(repeating[1]?.signature).toContain("pagination-page-#");
    }
  },
  {
    item: "repeating structures",
    scenario: "infinite-feed",
    assert: (evidence) => {
      expect(evidence.repeating?.[0]).toMatchObject({
        containerSelector: "[data-testid=\"feed-page-1\"]",
        itemCount: 10,
        representative: { testId: "feed-item" }
      });
      expect(evidence.repeating?.[0]?.fields).toEqual(
        expect.arrayContaining(["feed-item-title", "feed-item-author", "feed-item-time", "feed-item-summary"])
      );
    }
  },
  {
    item: "repeating structures are not invented where nothing repeats",
    scenario: "intermediate-state",
    assert: (evidence) => {
      expect(evidence.repeating).toBeUndefined();
    }
  },
  {
    item: "forms model",
    scenario: "intermediate-state",
    assert: (evidence) => {
      expect(evidence.forms).toHaveLength(1);
      expect(evidence.forms?.[0]).toMatchObject({
        selector: "[data-testid=\"claim-form\"]",
        label: "Claim details",
        controlCount: 3,
        submit: "[data-testid=\"submit-claim\"]"
      });
      expect(evidence.forms?.[0]?.controls).toEqual([
        expect.objectContaining({ selector: "[data-testid=\"employee-name\"]", controlType: "text", name: "employee", label: "Employee name", required: true, hasValue: false }),
        expect.objectContaining({ selector: "[data-testid=\"claim-amount\"]", controlType: "text", name: "amount", label: "Amount (USD)", required: true, hasValue: false }),
        expect.objectContaining({ selector: "[data-testid=\"submit-claim\"]", controlType: "submit" })
      ]);
      // Nothing sensitive on this form, and never a value on any of them.
      for (const control of evidence.forms?.[0]?.controls ?? []) {
        expect(control).not.toHaveProperty("value");
        expect(control.sensitive).toBeUndefined();
      }
    }
  },
  {
    item: "forms model groups by the owning form",
    scenario: "product-catalog",
    assert: (evidence) => {
      // The in-stock checkbox sits in a fieldset outside the form, so the
      // search form owns two controls and not three.
      expect(evidence.forms).toHaveLength(1);
      expect(evidence.forms?.[0]).toMatchObject({ selector: "[data-testid=\"search-form\"]", label: "Product search", controlCount: 2 });
      expect(evidence.forms?.[0]?.controls.map((control) => control.controlType)).toEqual(["search", "submit"]);
    }
  },
  {
    item: "forms are not invented where the page has none",
    scenario: "infinite-feed",
    assert: (evidence) => {
      expect(evidence.forms).toBeUndefined();
    }
  },
  {
    item: "blocking overlays",
    scenario: "modal-flows",
    assert: (evidence) => {
      // The consent banner is fixed to the bottom above the action bar, so
      // Publish draft paints, reports visible bounds, and cannot be clicked.
      const blocker = evidence.overlays?.blockers[0];
      expect(blocker).toMatchObject({ selector: "[data-testid=\"consent-banner\"]" });
      expect(blocker?.blocked).toContain("[data-testid=\"publish-draft\"]");
      expect(evidence.overlays?.blockedCount).toBeGreaterThanOrEqual(1);
      expect(evidence.overlays?.tested).toBeGreaterThan(0);
    }
  },
  {
    item: "blocking overlays are not reported on a page with none",
    scenario: "product-catalog",
    assert: (evidence) => {
      expect(evidence.overlays).toBeUndefined();
    }
  },
  {
    item: "dialogs are not reported before one opens",
    scenario: "modal-flows",
    assert: (evidence) => {
      // The invite dialog is in the DOM from the start, behind a hidden
      // backdrop. A dialog nobody can see is not a dialog.
      expect(evidence.dialogs).toBeUndefined();
    }
  }
];

for (const row of ROWS) {
  test(`${row.scenario}: ${row.item}`, async ({ openHarness }) => {
    const harness = await openHarness(row.scenario);
    row.assert(await evidenceOf(harness));
  });
}

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

test("modal-flows: an open modal is reported with its role, name and modality", async ({ openHarness, page }) => {
  const harness = await openHarness("modal-flows");
  await page.locator("[data-testid=\"open-invite\"]").click();
  await expect(page.locator("[data-testid=\"invite-dialog\"]")).toBeVisible();

  const evidence = await evidenceOf(harness);
  expect(evidence.dialogs?.modal).toBe(true);
  expect(evidence.dialogs?.open).toEqual([
    expect.objectContaining({
      // The dialog carries an id, which is the most stable selector there is.
      selector: "#invite-dialog",
      role: "dialog",
      modal: true,
      native: false,
      label: "Invite a collaborator"
    })
  ]);
  // A modal makes the page behind it unreachable, and the occlusion test says so.
  expect(evidence.overlays?.blockedCount).toBeGreaterThan(0);
});

test("modal-flows: the native dialog the page-world override answered is carried as evidence", async ({ openHarness, page }) => {
  const harness = await openHarness("modal-flows");
  const before = await evidenceOf(harness);
  expect(before.dialogs?.lastNative).toBeUndefined();

  await harness.runAction({ commandId: "arm-accept", actionType: "web.dom.dialog", dialog: { response: "accept" } });
  await page.locator("[data-testid=\"delete-draft\"]").click();
  await expect(page.locator("[data-testid=\"draft-status\"]")).toHaveText("Draft deleted");

  const evidence = await evidenceOf(harness);
  expect(evidence.dialogs?.lastNative).toMatchObject({
    kind: "confirm",
    message: "Delete this draft? This cannot be undone.",
    response: "accept"
  });
  expect(evidence.dialogs?.lastNative?.at).toBeGreaterThan(0);
  // The arming was taken by the override on the dispatching call stack, so
  // nothing is left pending; a standing `armPending` would mean it is absent.
  expect(evidence.dialogs?.armPending).toBeUndefined();
  // A native dialog is not a page dialog: nothing was open in the DOM.
  expect(evidence.dialogs?.open).toEqual([]);
  expect(evidence.dialogs?.modal).toBe(false);
});

test("intermediate-state: a page caught mid-work reports itself busy with the indicator that says so", async ({ openHarness, page }) => {
  const harness = await openHarness("intermediate-state");
  await page.locator("[data-testid=\"employee-name\"]").fill("Ada Lovelace");
  await page.locator("[data-testid=\"claim-amount\"]").fill("42.50");
  await page.locator("[data-testid=\"submit-claim\"]").click();
  // The processing step stands for 800 ms before the result replaces it.
  await expect(page.locator("[data-testid=\"processing\"]")).toBeVisible();

  const evidence = await evidenceOf(harness);
  expect(evidence.loading.busy).toBe(true);
  expect(evidence.loading.indicators).toEqual(expect.arrayContaining([
    expect.objectContaining({ kind: "progressbar", label: "Processing your claim" })
  ]));
  // The step is a named region while it is on screen, so a reader can point at it.
  expect(evidence.regions).toEqual(expect.arrayContaining([
    expect.objectContaining({ role: "region", label: "Processing your claim" })
  ]));
});

test("infinite-feed: a region the page marks aria-busy is reported while it loads", async ({ openHarness, page }) => {
  const harness = await openHarness("infinite-feed");
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  // The feed sets aria-busy and unhides its status before the 300 ms fetch
  // delay, so waiting on the page's own flag lands inside the loading window.
  await page.waitForFunction(() => document.querySelector("[data-testid=\"feed\"]")?.getAttribute("aria-busy") === "true");

  const evidence = await evidenceOf(harness);
  expect(evidence.loading.busy).toBe(true);
  expect(evidence.loading.busyRegions).toContain("[data-testid=\"feed\"]");
  expect(evidence.loading.indicators).toEqual(expect.arrayContaining([
    expect.objectContaining({ kind: "status", selector: "[data-testid=\"feed-loading\"]" })
  ]));
});

test("modal-flows: change and recency are fields of a running snapshot, not of a recording", async ({ openHarness, page }) => {
  const harness = await openHarness("modal-flows");
  // No recording is started anywhere in this test: before Phase 1.4 both
  // signals existed only while the recorder was listening, so a running action
  // could not see either.
  const first = await capture(harness);
  expect(first.evidence?.elements.changed).toBe(0);
  expect(first.interactiveElements.every((element) => element.changed === undefined)).toBe(true);

  await page.locator("[data-testid=\"add-section\"]").click();
  await expect(page.locator("[data-testid=\"section-count\"]")).toHaveText("1 section");

  const second = await capture(harness);
  expect(second.evidence?.elements.changed).toBeGreaterThan(0);
  expect(second.evidence?.elements.recentlyInteracted).toBeGreaterThan(0);

  const byTestId = (testId: string) => second.interactiveElements.find((element) => element.testId === testId);
  expect(byTestId("section-count")?.changed).toBe(true);
  expect(byTestId("add-section")?.recentlyInteracted).toBe(true);
  // The button's own text did not change, so recency and change are independent.
  expect(byTestId("add-section")?.changed).toBeUndefined();

  // And the run the click created is now a repeating structure the page had none of.
  await page.locator("[data-testid=\"add-section\"]").click();
  await page.locator("[data-testid=\"add-section\"]").click();
  await expect(page.locator("[data-testid=\"section-count\"]")).toHaveText("3 sections");
  const third = await evidenceOf(harness);
  expect(third.repeating?.[0]).toMatchObject({
    containerSelector: "[data-testid=\"section-list\"]",
    itemCount: 3,
    representative: { testId: "section-item", text: "Section 1" }
  });
});

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
