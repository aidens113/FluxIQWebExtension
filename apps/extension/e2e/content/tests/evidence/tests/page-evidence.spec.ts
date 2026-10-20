// The page-level evidence a snapshot carries (Phase 1.4 steps 2 and 3), item by
// item, on realistic pages.
//
// Every one of these was audited as absent or partial: dialogs and modals,
// blocking overlays, loading state, page regions and repeating structures had
// no representation anywhere, and the forms model, navigation state, element
// change, interaction recency and the truncation totals existed only inside the
// recorder or not as fields anything downstream could read. So the suite is a
// table -- one row per item per page -- rather than a handful of examples: an
// item that quietly stops being produced fails its own row, and the rows that
// assert an item is *absent* are as load-bearing as the rest, because evidence
// invented where the page has none is worse than none at all.
//
// t730 moved the rows off the synthetic fixtures onto the ten realistic sites.
// Where a site's own interruptions (a consent wall, a notifications prompt)
// would stand between a row and the page it is about, they are answered first
// through the site's own `/api` operations, as a returning visitor would
// already have answered them; the rows about a covering layer leave it up.
//
// The rows below run against a page at rest. Four items cannot be: a dialog has
// to be opened, a native confirm has to be answered, a page has to be caught
// mid-load, and change and recency need two captures with an interaction
// between them. Those live in `live-page.spec.ts`.
//
// Six of the audit's sixteen items were audited as present, and for that
// reason had no row here: visible text, the current URL, the page title,
// selected elements and relevant attributes, which live on the snapshot beside
// `evidence` rather than inside it, and expected-state evidence, which is the
// verdict of the `web.dom.assert` check an authored expected state becomes. An
// item nothing asserts stops arriving with every gate green, so all six are
// pinned in `snapshot-items.spec.ts`.

import type { Page } from "@playwright/test";
import { expect, test } from "../../../index.js";
import type { ContentHarness } from "../../../index.js";
import type { PageEvidence } from "../../../../../src/content/evidence/index.js";
import { evidenceOf } from "./captured-snapshot.js";

/** Sends one of the site's own state operations, as its page script does. */
async function mutate(harness: ContentHarness, operation: string, payload: Record<string, unknown> = {}): Promise<void> {
  const response = await fetch(`${harness.lab.origin}/api/${harness.scenarioId}/${operation}`, {
    method: "POST",
    headers: { authorization: `Bearer ${harness.lab.runToken}`, "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`${harness.scenarioId} answered ${response.status} to ${operation}.`);
}

/** Opens a page of the scenario other than its start page, with the content script already installed. */
async function open(harness: ContentHarness, path: string, ready: string): Promise<void> {
  await harness.page.goto(new URL(`/scenarios/${harness.scenarioId}/${path}`, harness.lab.origin).href);
  await harness.page.waitForSelector(ready, { state: "attached" });
}

/** An element's text as one line, the way the evidence reads a row. */
function lineOf(page: Page, selector: string): Promise<string> {
  return page.locator(selector).evaluate((element) => (element.textContent ?? "").replace(/\s+/gu, " ").trim());
}

/** One row: the evidence item, the scenario, how its page is reached, and what the evidence must say there. */
type EvidenceRow = {
  item: string;
  scenario: string;
  prepare?(harness: ContentHarness): Promise<void>;
  assert(evidence: PageEvidence, page: Page): Promise<void> | void;
};

const BIGBOX_RESULTS = "search?q=paper+towels";
const AUCTION_RESULTS = "sch/i.html?_nkw=kestrel";
const SENT_INVITATIONS = "mynetwork/invitation-manager/sent/";
const CLASSIFIEDS_RESULTS = "search/?query=bike";
const CLASSIFIEDS_READY = "section[aria-label=\"Collection of Marketplace items\"] a[href*=\"/item/\"]";

const ROWS: EvidenceRow[] = [
  {
    item: "element totals and truncation",
    scenario: "bigbox-retail",
    assert: (evidence) => {
      const { scanned, candidates, matched, returned, truncated } = evidence.elements;
      // Each stage of the funnel is reported, so a reader can tell a small page
      // from a truncated large one. Since t200 the walk is the candidate set,
      // so the first two stages agree; matched is the part of it that renders.
      expect(candidates).toBeLessThanOrEqual(scanned);
      expect(matched).toBeLessThan(candidates);
      expect(returned).toBe(matched);
      expect(returned).toBeGreaterThan(300);
      expect(truncated).toBe(matched > returned);
      expect(truncated).toBe(false);
    }
  },
  {
    item: "element totals agree with the element list",
    scenario: "job-board",
    assert: (evidence) => {
      expect(evidence.elements.changed).toBe(0);
      expect(evidence.elements.recentlyInteracted).toBe(0);
    }
  },
  {
    item: "loading state at rest",
    scenario: "job-board",
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
    scenario: "job-board",
    assert: (evidence) => {
      expect(evidence.navigation).toMatchObject({
        path: "/scenarios/job-board/",
        type: "navigate",
        visibility: "visible"
      });
      expect(evidence.navigation.url).toContain("/scenarios/job-board/");
      expect(evidence.navigation.origin).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
      expect(evidence.navigation.historyLength).toBeGreaterThanOrEqual(1);
    }
  },
  {
    item: "landmarks and regions",
    scenario: "auction-marketplace",
    prepare: (harness) => open(harness, AUCTION_RESULTS, "nav[aria-label=\"Results pagination\"]"),
    assert: (evidence) => {
      const regions = evidence.regions ?? [];
      expect(regions.map((region) => region.role)).toEqual(
        expect.arrayContaining(["banner", "search", "main", "complementary", "region", "navigation", "contentinfo"])
      );
      expect(regions).toEqual(expect.arrayContaining([
        expect.objectContaining({ role: "complementary", label: "Filters" }),
        expect.objectContaining({ role: "region", label: "Condition" }),
        expect.objectContaining({ role: "navigation", label: "Buying format" }),
        expect.objectContaining({ role: "navigation", label: "Results pagination" }),
        // The consent banner is a labelled region of its own, outside main.
        expect.objectContaining({ role: "region", label: "Cookie consent" })
      ]));
      // A landmark carries where it is, so a reader can say which half of the page it is in.
      const main = regions.find((region) => region.role === "main");
      expect(main?.bounds?.height).toBeGreaterThan(0);
    }
  },
  {
    item: "repeating structures",
    scenario: "professional-network",
    prepare: (harness) => open(harness, SENT_INVITATIONS, "section ul > li button"),
    assert: async (evidence, page) => {
      // The sent invitations load ten at a time: the run is those ten rows, and
      // it comes after the two shorter menus the page draws above it.
      const repeating = evidence.repeating ?? [];
      const rows = repeating.find((run) => run.itemCount === 10);
      expect(rows, JSON.stringify(repeating.map((run) => [run.containerSelector, run.itemCount]))).toBeDefined();
      expect(repeating.indexOf(rows!)).toBeGreaterThan(0);
      expect(await page.locator(`${rows!.containerSelector} > li`).count()).toBe(10);
      expect(rows?.representative.selector).toBe(`${rows!.containerSelector} > li:nth-of-type(1)`);
      expect(rows?.representative.text).toBe(await lineOf(page, rows!.representative.selector));
      // The rows carry no test ids, so no field is named for them: none is invented.
      expect(rows?.fields).toBeUndefined();
      expect(rows?.representative.testId).toBeUndefined();
    }
  },
  {
    item: "repeating structures named by a numbered test id",
    scenario: "everything-store",
    prepare: async (harness) => {
      // A placed order of three lines: the confirmation numbers its lines
      // `order-line-1` to `order-line-3`, one template with a numbered id.
      await mutate(harness, "add-to-cart", { sku: "B0D7KX2M4P", quantity: 1 });
      await mutate(harness, "start-checkout", { pipeline: "cart" });
      await mutate(harness, "place-order");
      const state = (await harness.finalState()).state as { orders?: Array<{ orderId: string }> };
      const orderId = state.orders?.[0]?.orderId;
      if (!orderId) throw new Error("everything-store placed no order.");
      await open(harness, `thankyou?orderId=${encodeURIComponent(orderId)}`, "[data-testid=\"order-line-3\"]");
    },
    assert: (evidence) => {
      const lines = evidence.repeating?.find((run) => run.representative.testId === "order-line-1");
      expect(lines).toMatchObject({ itemCount: 3, representative: { testId: "order-line-1" } });
      // A numbered run is one template, not three singletons: the signature reads the shape of the id.
      expect(lines?.signature).toContain("order-line-#");
    }
  },
  {
    item: "repeating structures in an infinite feed",
    scenario: "social-network-feed",
    // The home page starts as skeletons; the first batch of five arrives at 700 ms.
    prepare: (harness) => expect(harness.page.locator("[role=feed] > [role=article]")).toHaveCount(5),
    assert: async (evidence, page) => {
      const run = evidence.repeating?.find((candidate) => candidate.signature.includes("article"));
      expect(run, JSON.stringify(evidence.repeating?.map((candidate) => candidate.signature))).toMatchObject({ itemCount: 5 });
      await expect(page.locator(run!.containerSelector)).toHaveAttribute("role", "feed");
      await expect(page.locator(run!.representative.selector!)).toHaveAttribute("aria-posinset", "1");
      expect(run?.representative.text).toBe(await lineOf(page, run!.representative.selector!));
    }
  },
  {
    item: "repeating structures are not invented where nothing repeats",
    scenario: "job-board",
    assert: (evidence) => {
      expect(evidence.repeating).toBeUndefined();
    }
  },
  {
    item: "forms model",
    scenario: "company-website",
    prepare: async (harness) => {
      await mutate(harness, "set-consent", { choice: "all" });
      await mutate(harness, "dismiss-newsletter");
      await mutate(harness, "dismiss-chat-greeting");
      await harness.page.reload();
      await harness.page.locator("header button", { hasText: "Get a free quote" }).click();
      await expect(harness.page.getByRole("dialog", { name: "Get a free quote" })).toBeVisible();
    },
    assert: (evidence) => {
      // The quote drawer is the page's one form. It carries no name of its own,
      // and none is invented for it.
      expect(evidence.forms).toHaveLength(1);
      const form = evidence.forms?.[0];
      expect(form).toMatchObject({ selector: "main > div > section > form", controlCount: 14 });
      expect(form?.label).toBeUndefined();
      expect(form?.controls.map((control) => [control.controlType, control.name ?? null, control.label ?? null])).toEqual([
        ["fieldset", null, null],
        ["text", "fullName", "Full name"],
        ["email", "email", "Email address"],
        ["tel", "phone", "Phone number"],
        ["text", "postcode", "Postcode of the property"],
        ["text", "companyWebsite", "Company website"],
        ["fieldset", null, null],
        ["textarea", "details", "Tell us about the job (optional)"],
        ["radio", "contactBy", "Phone"],
        ["radio", "contactBy", "Email"],
        ["radio", "contactBy", "Text message"],
        ["fieldset", null, null],
        ["checkbox", "marketing", "Yes, send me Kestrel Lane offers and seasonal reminders by email"],
        ["checkbox", "privacy", "I agree to Kestrel Lane contacting me about this request, as set out in the privacy notice"]
      ]);
      expect(form?.controls).toEqual(expect.arrayContaining([
        expect.objectContaining({ selector: "input[name=\"email\"]", autocomplete: "email", hasValue: false }),
        expect.objectContaining({ selector: "input[name=\"phone\"]", autocomplete: "tel", hasValue: false })
      ]));
      // Nothing sensitive on this form, and never a value on any of them.
      for (const control of form?.controls ?? []) {
        expect(control).not.toHaveProperty("value");
        expect(control.sensitive).toBeUndefined();
      }
    }
  },
  {
    item: "forms model marks a password control sensitive and quotes no value",
    scenario: "photo-social",
    prepare: async (harness) => {
      await open(harness, "accounts/login/", "input[name=\"password\"]");
      await harness.page.locator("input[name=\"username\"]").fill("glaze.notes");
      await harness.page.locator("input[name=\"password\"]").fill("kiln-hunter-2");
    },
    assert: (evidence) => {
      expect(evidence.forms).toHaveLength(1);
      expect(evidence.forms?.[0]?.controls).toEqual([
        expect.objectContaining({ selector: "input[name=\"username\"]", controlType: "text", name: "username", label: "Phone number, username, or email", hasValue: true }),
        expect.objectContaining({ selector: "input[name=\"password\"]", controlType: "password", name: "password", label: "Password", hasValue: true, sensitive: true })
      ]);
      expect(JSON.stringify(evidence)).not.toContain("kiln-hunter-2");
      expect(JSON.stringify(evidence)).not.toContain("glaze.notes");
    }
  },
  {
    item: "forms model groups by the owning form",
    scenario: "bigbox-retail",
    prepare: (harness) => open(harness, BIGBOX_RESULTS, "main > div > aside input[type=checkbox]"),
    assert: async (evidence, page) => {
      // The facet checkboxes sit in the results sidebar outside any form, so
      // the header's search form owns its two controls and nothing else.
      const facets = page.locator("main > div > aside input[type=checkbox]");
      expect(await facets.count()).toBeGreaterThan(0);
      expect(await facets.evaluateAll((boxes) => boxes.every((box) => (box as HTMLInputElement).form === null))).toBe(true);
      expect(evidence.forms).toHaveLength(1);
      expect(evidence.forms?.[0]).toMatchObject({ selector: "body > div:nth-of-type(1) > header > div > form", controlCount: 2 });
      expect(evidence.forms?.[0]?.controls.map((control) => control.controlType)).toEqual(["search", "submit"]);
    }
  },
  {
    item: "forms are not invented where the page has none",
    scenario: "local-classifieds",
    prepare: (harness) => open(harness, CLASSIFIEDS_RESULTS, CLASSIFIEDS_READY),
    assert: async (evidence, page) => {
      // The page has search boxes and price fields, but no form element holds them.
      expect(await page.getByRole("searchbox").count()).toBeGreaterThan(0);
      expect(await page.evaluate(() => document.forms.length)).toBe(0);
      expect(evidence.forms).toBeUndefined();
    }
  },
  {
    item: "blocking overlays",
    scenario: "job-board",
    assert: (evidence) => {
      // The consent wall covers the whole viewport until it is answered, so the
      // search form under it paints, reports visible bounds, and cannot be used.
      const blocker = evidence.overlays?.blockers[0];
      expect(blocker).toMatchObject({ selector: "body > rf-consent", kind: "consent" });
      expect(blocker?.blocked).toEqual(expect.arrayContaining(["input[name=\"q\"]", "main > form > button"]));
      expect(evidence.overlays?.blockedCount).toBeGreaterThanOrEqual(blocker?.blocked?.length ?? 1);
      expect(evidence.overlays?.tested).toBeGreaterThan(evidence.overlays?.blockedCount ?? 0);
    }
  },
  {
    item: "blocking overlays are not reported on a page with none",
    scenario: "local-classifieds",
    prepare: async (harness) => {
      // A returning visitor: cookies and the notifications prompt already answered.
      await mutate(harness, "consent", { choice: "all" });
      await mutate(harness, "notifications", { choice: "not-now" });
      await open(harness, CLASSIFIEDS_RESULTS, CLASSIFIEDS_READY);
    },
    assert: (evidence) => {
      expect(evidence.overlays).toBeUndefined();
    }
  },
  {
    item: "dialogs are not reported before one opens",
    scenario: "professional-network",
    prepare: (harness) => open(harness, SENT_INVITATIONS, "section ul > li button"),
    assert: async (evidence, page) => {
      // The withdraw and connect dialogs are in the DOM from the start, inside
      // a hidden container. A dialog nobody can see is not a dialog.
      const dialogs = page.locator("[role=dialog]");
      expect(await dialogs.count()).toBeGreaterThanOrEqual(2);
      expect(await dialogs.evaluateAll((all) => all.every((dialog) => dialog.closest("[hidden]") !== null))).toBe(true);
      expect(evidence.dialogs).toBeUndefined();
    }
  }
];

for (const row of ROWS) {
  test(`${row.scenario}: ${row.item}`, async ({ openHarness, page }) => {
    const harness = await openHarness(row.scenario);
    await row.prepare?.(harness);
    await row.assert(await evidenceOf(harness), page);
  });
}
