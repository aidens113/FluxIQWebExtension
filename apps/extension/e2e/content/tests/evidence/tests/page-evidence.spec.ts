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
// between them. Those live in `live-page.spec.ts`.
//
// Six of the audit's sixteen items were audited as present, and for that
// reason had no row here: visible text, the current URL, the page title,
// selected elements and relevant attributes, which live on the snapshot beside
// `evidence` rather than inside it, and expected-state evidence, which is the
// verdict of the `web.dom.assert` check an authored expected state becomes. An
// item nothing asserts stops arriving with every gate green, so all six are
// pinned in `snapshot-items.spec.ts`.

import { expect, test } from "../../../index.js";
import type { PageEvidence } from "../../../../../src/content/evidence/index.js";
import { evidenceOf } from "./captured-snapshot.js";

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
