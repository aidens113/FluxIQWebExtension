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
import type { Page } from "@playwright/test";
import { PLANTED_UNLOCK_CODE } from "../../../../scenario-lab/src/scenarios/sensitive-input/index.js";
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
  // This row sits in the evidence spec because the brief that added it owns
  // this file; redaction.spec.ts is the thematic home for recorded-value leaks.
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
