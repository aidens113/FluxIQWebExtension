// Real structure detections. Not fixtures written to match a reader.
//
// Each `structure` below is what the real content-script bundle answered to
// `web.dom.capture_snapshot` with `detectStructure: {}`, in headless Chromium
// on a Scenario Lab fixture, through the harness in
// `apps/extension/e2e/content/` -- pasted verbatim with one mechanical edit, as
// `domain/src/page-evidence/capture.ts` makes: the Lab binds a fresh port per
// run, so `http://127.0.0.1:<port>` is rewritten to `http://127.0.0.1:4173`.
// `url` and `title` are the snapshot's own; the snapshot's elements are not
// kept, because the detection tool reads only its location.
//
// Regenerate only when the producer changes what it emits. The recipe is a
// content-harness spec that runs, per fixture,
//
//     const reply = await harness.runAction({ commandId: "c", actionType: "web.dom.capture_snapshot", detectStructure: {} });
//     console.log(JSON.stringify({ url: reply.snapshot?.url, title: reply.snapshot?.title, structure: reply.structure }, null, 2));
//
// with `infinite-feed-load-more` armed first through the Lab's
// `set-mode` operation with `{ mode: "load-more" }`.
// `apps/extension/e2e/content/tests/extraction/tests/structure-detection.spec.ts`
// asserts the same answers against the live pages, so a producer change that
// makes these stale fails there first.

import type { WebAutomationStructureDetection } from "../../../../extraction";

export type CapturedDetection = { url: string; title: string; structure: WebAutomationStructureDetection };

export const CAPTURED_DETECTIONS = {
  "product-catalog-largest": {
    url: "http://127.0.0.1:4173/scenarios/product-catalog/",
    title: "Product catalog",
    structure: {
      "ok": true,
      "proposal": {
        "container": "[data-testid=\"product-list\"]",
        "item": "[data-testid=\"product-card\"]",
        "itemCount": 8,
        "fields": [
          {
            "key": "product-image_src",
            "label": "product-image src",
            "spec": {
              "kind": "attribute",
              "selector": "[data-testid=\"product-image\"]",
              "attribute": "src",
              "required": true
            },
            "coverage": 1
          },
          {
            "key": "product-image_alt",
            "label": "product-image alt",
            "spec": {
              "kind": "attribute",
              "selector": "[data-testid=\"product-image\"]",
              "attribute": "alt",
              "required": true
            },
            "coverage": 1
          },
          {
            "key": "product-name",
            "label": "product-name",
            "spec": {
              "kind": "text",
              "selector": "[data-testid=\"product-name\"]",
              "required": true
            },
            "coverage": 1
          },
          {
            "key": "product-link",
            "label": "product-link",
            "spec": {
              "kind": "link",
              "selector": "[data-testid=\"product-link\"]",
              "required": true
            },
            "coverage": 1
          },
          {
            "key": "product-price",
            "label": "product-price",
            "spec": {
              "kind": "text",
              "selector": "[data-testid=\"product-price\"]",
              "required": true
            },
            "coverage": 1
          },
          {
            "key": "product-rating",
            "label": "product-rating",
            "spec": {
              "kind": "text",
              "selector": "[data-testid=\"product-rating\"]",
              "required": true
            },
            "coverage": 1
          },
          {
            "key": "stock-badge",
            "label": "stock-badge",
            "spec": {
              "kind": "text",
              "selector": "[data-testid=\"stock-badge\"]",
              "required": true
            },
            "coverage": 1
          }
        ],
        "pagination": {
          "next": "[data-testid=\"pagination-next\"]",
          "maxPages": 3
        },
        "confidence": 1
      }
    }
  },
  "data-table-largest": {
    url: "http://127.0.0.1:4173/scenarios/data-table/",
    title: "Inventory",
    structure: {
      "ok": true,
      "proposal": {
        "container": "[data-testid=\"inventory-body\"]",
        "item": "[data-testid=\"inventory-row\"]",
        "itemCount": 12,
        "fields": [
          {
            "key": "product",
            "label": "Product",
            "spec": {
              "kind": "column",
              "header": "Product",
              "required": true
            },
            "coverage": 1
          },
          {
            "key": "category",
            "label": "Category",
            "spec": {
              "kind": "column",
              "header": "Category",
              "required": true
            },
            "coverage": 1
          },
          {
            "key": "price",
            "label": "Price",
            "spec": {
              "kind": "column",
              "header": "Price",
              "required": true
            },
            "coverage": 1
          },
          {
            "key": "stock",
            "label": "Stock",
            "spec": {
              "kind": "column",
              "header": "Stock",
              "required": true
            },
            "coverage": 1
          }
        ],
        "confidence": 1
      }
    }
  },
  "member-directory-largest": {
    url: "http://127.0.0.1:4173/scenarios/member-directory/",
    title: "Members · Meridian",
    structure: {
      "ok": true,
      "proposal": {
        "container": "[data-testid=\"member-rows\"]",
        "item": "[data-testid=\"member-rows\"] > tr.css-0dfc6os",
        "itemCount": 240,
        "fields": [
          {
            "key": "member",
            "label": "Member",
            "spec": {
              "kind": "column",
              "header": "Member",
              "required": true
            },
            "coverage": 1
          },
          {
            "key": "role",
            "label": "Role",
            "spec": {
              "kind": "column",
              "header": "Role",
              "required": true
            },
            "coverage": 1
          },
          {
            "key": "team",
            "label": "Team",
            "spec": {
              "kind": "column",
              "header": "Team",
              "required": true
            },
            "coverage": 1
          },
          {
            "key": "status",
            "label": "Status",
            "spec": {
              "kind": "column",
              "header": "Status",
              "required": true
            },
            "coverage": 1
          },
          {
            "key": "last_active",
            "label": "Last active",
            "spec": {
              "kind": "column",
              "header": "Last active",
              "required": true
            },
            "coverage": 1
          },
          {
            "key": "actions",
            "label": "Actions",
            "spec": {
              "kind": "column",
              "header": "Actions",
              "required": true
            },
            "coverage": 1
          }
        ],
        "confidence": 0.75
      }
    }
  },
  "infinite-feed-largest": {
    url: "http://127.0.0.1:4173/scenarios/infinite-feed/",
    title: "Neighbourhood feed",
    structure: {
      "ok": true,
      "proposal": {
        "container": "[data-testid=\"feed-page-1\"]",
        "item": "[data-testid=\"feed-item\"]",
        "itemCount": 10,
        "fields": [
          {
            "key": "feed-item-title",
            "label": "feed-item-title",
            "spec": {
              "kind": "text",
              "selector": "[data-testid=\"feed-item-title\"]",
              "required": true
            },
            "coverage": 1
          },
          {
            "key": "feed-item-author",
            "label": "feed-item-author",
            "spec": {
              "kind": "text",
              "selector": "[data-testid=\"feed-item-author\"]",
              "required": true
            },
            "coverage": 1
          },
          {
            "key": "feed-item-time",
            "label": "feed-item-time",
            "spec": {
              "kind": "text",
              "selector": "[data-testid=\"feed-item-time\"]",
              "required": true
            },
            "coverage": 1
          },
          {
            "key": "feed-item-summary",
            "label": "feed-item-summary",
            "spec": {
              "kind": "text",
              "selector": "[data-testid=\"feed-item-summary\"]",
              "required": true
            },
            "coverage": 1
          }
        ],
        "confidence": 1
      },
      "infiniteScroll": true
    }
  },
  "infinite-feed-load-more": {
    url: "http://127.0.0.1:4173/scenarios/infinite-feed/",
    title: "Neighbourhood feed",
    structure: {
      "ok": true,
      "proposal": {
        "container": "[data-testid=\"feed-page-1\"]",
        "item": "[data-testid=\"feed-item\"]",
        "itemCount": 10,
        "fields": [
          {
            "key": "feed-item-title",
            "label": "feed-item-title",
            "spec": {
              "kind": "text",
              "selector": "[data-testid=\"feed-item-title\"]",
              "required": true
            },
            "coverage": 1
          },
          {
            "key": "feed-item-author",
            "label": "feed-item-author",
            "spec": {
              "kind": "text",
              "selector": "[data-testid=\"feed-item-author\"]",
              "required": true
            },
            "coverage": 1
          },
          {
            "key": "feed-item-time",
            "label": "feed-item-time",
            "spec": {
              "kind": "text",
              "selector": "[data-testid=\"feed-item-time\"]",
              "required": true
            },
            "coverage": 1
          },
          {
            "key": "feed-item-summary",
            "label": "feed-item-summary",
            "spec": {
              "kind": "text",
              "selector": "[data-testid=\"feed-item-summary\"]",
              "required": true
            },
            "coverage": 1
          }
        ],
        "pagination": {
          "mode": "loadMore",
          "control": "[data-testid=\"load-more\"]",
          "maxPages": 50
        },
        "confidence": 1
      }
    }
  }
} satisfies Record<string, CapturedDetection>;

export type CapturedDetectionName = keyof typeof CAPTURED_DETECTIONS;
