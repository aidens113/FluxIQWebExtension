// Real captures. Not fixtures written to match a reader.
//
// A shared type stops the two sides of the wire spelling a field differently.
// It does not prove that anything is ever *in* the field: a shape both sides
// satisfy can be populated by neither, and every reader's own tests can be
// written against a capture that never exercises the item they read. That is
// how five page-evidence items came to be read at paths no producer wrote,
// with a green suite on both sides.
//
// So these are not hand-written. Each is the `evidence` of a snapshot taken by
// the real content-script bundle, running in headless Chromium on a Scenario
// Lab fixture, through the harness in `apps/extension/e2e/content/`. They are
// pasted here verbatim with one mechanical edit: the Lab binds a fresh port per
// run, so `http://127.0.0.1:<port>` is rewritten to `http://127.0.0.1:4173`
// throughout. Nothing else was touched, which is the point -- a value here that
// looks odd is what the browser actually sent.
//
// ## Regenerating them
//
// Only when the producer changes what it emits -- a new item, a renamed field,
// a different bound. Not to make a failing test pass: a capture that disagrees
// with a reader is the capture telling the truth.
//
// There is deliberately no committed script. The recipe is four lines in a
// content-harness spec, run under `pnpm --filter @fluxiq-web-extension/extension
// test:content`, which builds the bundle and starts the Lab itself:
//
//     const harness = await openHarness("modal-flows");
//     // ...drive the page into the state the row below describes...
//     const snapshot = await harness.capture() as { evidence?: unknown };
//     console.log(JSON.stringify(snapshot.evidence, null, 2));
//
// The three states are: `modal-flows` after arming `web.dom.dialog` with
// `accept`, clicking `[data-testid="delete-draft"]` and then
// `[data-testid="open-invite"]`; `infinite-feed` after scrolling to the bottom
// and waiting for `[data-testid="feed"]` to read `aria-busy="true"`;
// `sensitive-input` untouched. Rewrite the Lab's port to 4173 and paste the
// result in. Whoever does this should read the diff: a field that disappears is
// a producer regression, and this file is where it shows.
//
// The compiler checks each against `WebAutomationPageEvidence`, so a contract
// that drifts from what the browser produces fails here rather than in
// production. `domain/src/tests/page-evidence-joinery.test.ts` drives them into
// both domain readers, and
// `apps/extension/src/background/connection/tests/page-evidence-capture.test.ts`
// drives them into the extension's cross-frame merge, so producer and consumers
// are joined by data and not only by a type.
//
// ## What each capture holds, and why these three
//
// | Capture | Page and state | The items only it exercises |
// | --- | --- | --- |
// | `modal-flows` | An ARIA modal opened over a consent banner, after a native `confirm` was answered | `dialogs.open`, `dialogs.modal`, `dialogs.lastNative`, `overlays`, a five-landmark `regions` |
// | `infinite-feed` | Caught inside the 300 ms fetch after scrolling to the bottom | `loading.busy`, `loading.busyRegions`, `loading.indicators`, `repeating` |
// | `sensitive-input` | A login and payment form at rest | `forms` with `autocomplete` and `sensitive` controls |
//
// ## What no capture here holds, and why
//
// Absence is a fact about the producer, not an oversight, so it is written down
// rather than filled in by hand:
//
//  - `elements.truncated: true` -- no Lab fixture reaches the capture's element
//    cap. Its state and packet consequences are covered by constructed funnels
//    in `web-state/tests/` and `llm-evidence/tests/limits.test.ts`.
//  - `dialogs.armPending` -- true only between writing an arming and the
//    page-world override taking it, which happens on the dispatching call
//    stack. A capture can only see it where the override is missing.
//  - `loading.pendingNavigation: true` and `navigation.redirects` -- a capture
//    mid-navigation cannot be requested through the harness, which waits for
//    the page.
//  - `navigation.referrer` -- the fixtures are opened directly, so there is no
//    referring page.
//  - `navigation.visibility: "hidden"` -- a headless page is visible.
//  - a native `<dialog open>` (`open[].native: true`) -- no fixture uses one;
//    `modal-flows` authors its modal with ARIA.

import type { WebAutomationPageEvidence } from "./types";

/** The Scenario Lab fixture each capture was taken from. */
export type WebAutomationPageEvidenceCaptureName = "modal-flows" | "infinite-feed" | "sensitive-input";

export const WEB_AUTOMATION_PAGE_EVIDENCE_CAPTURES: Record<WebAutomationPageEvidenceCaptureName, WebAutomationPageEvidence> = {
  "modal-flows": {
    "elements": {
      "scanned": 49,
      "candidates": 46,
      "matched": 36,
      "returned": 36,
      "truncated": false,
      "changed": 14,
      "recentlyInteracted": 2
    },
    "loading": {
      "documentState": "complete",
      "busy": false,
      "busyRegions": [],
      "indicators": [],
      "pendingNavigation": false
    },
    "navigation": {
      "url": "http://127.0.0.1:4173/scenarios/modal-flows/",
      "origin": "http://127.0.0.1:4173",
      "path": "/scenarios/modal-flows/",
      "type": "navigate",
      "historyLength": 2,
      "visibility": "visible"
    },
    "dialogs": {
      "open": [
        {
          "selector": "#invite-dialog",
          "role": "dialog",
          "modal": true,
          "native": false,
          "label": "Invite a collaborator",
          "bounds": { "x": 392, "y": 233.55, "width": 496, "height": 252.91 }
        }
      ],
      "modal": true,
      "lastNative": {
        "kind": "confirm",
        "message": "Delete this draft? This cannot be undone.",
        "response": "accept",
        "at": 1789244311829
      }
    },
    "overlays": {
      "tested": 12,
      "blockedCount": 6,
      "blockers": [
        {
          "selector": "[data-testid=\"invite-backdrop\"]",
          "bounds": { "x": 0, "y": 0, "width": 1280, "height": 720 },
          "blocks": 6,
          "blocked": [
            "[data-testid=\"open-invite\"]",
            "[data-testid=\"consent-accept\"]",
            "[data-testid=\"consent-reject\"]",
            "[data-testid=\"publish-draft\"]",
            "[data-testid=\"add-section\"]"
          ]
        }
      ]
    },
    "regions": [
      {
        "role": "banner",
        "selector": "body > div:nth-of-type(1) > header",
        "bounds": { "x": 256, "y": 32, "width": 768, "height": 219.44 }
      },
      {
        "role": "main",
        "selector": "body > div:nth-of-type(1) > main",
        "bounds": { "x": 256, "y": 271.34, "width": 768, "height": 333.91 }
      },
      {
        "role": "region",
        "selector": "body > div:nth-of-type(1) > main > section",
        "label": "Sections",
        "bounds": { "x": 256, "y": 271.34, "width": 768, "height": 125.91 }
      },
      {
        "role": "contentinfo",
        "selector": "body > div:nth-of-type(1) > footer",
        "label": "Draft actions",
        "bounds": { "x": 0, "y": 665, "width": 1280, "height": 55 }
      },
      {
        "role": "region",
        "selector": "[data-testid=\"consent-banner\"]",
        "label": "We use cookies",
        "bounds": { "x": 0, "y": 575.61, "width": 1280, "height": 144.39 }
      }
    ],
    "forms": [
      {
        "selector": "[data-testid=\"invite-form\"]",
        "controlCount": 4,
        "controls": [
          {
            "selector": "[data-testid=\"invite-email\"]",
            "controlType": "email",
            "name": "email",
            "label": "Email address",
            "required": true,
            "hasValue": false,
            "autocomplete": "off"
          },
          {
            "selector": "[data-testid=\"invite-role\"]",
            "controlType": "select",
            "name": "role",
            "label": "Role",
            "hasValue": true
          },
          { "selector": "[data-testid=\"invite-cancel\"]", "controlType": "button", "label": "Cancel" },
          { "selector": "[data-testid=\"invite-confirm\"]", "controlType": "submit", "label": "Confirm" }
        ],
        "submit": "[data-testid=\"invite-confirm\"]"
      }
    ]
  },
  "infinite-feed": {
    "elements": {
      "scanned": 78,
      "candidates": 75,
      "matched": 67,
      "returned": 67,
      "truncated": false,
      "changed": 0,
      "recentlyInteracted": 0
    },
    "loading": {
      "documentState": "complete",
      "busy": true,
      "busyRegions": ["[data-testid=\"feed\"]"],
      "indicators": [{ "selector": "[data-testid=\"feed-loading\"]", "kind": "status", "label": "Loading more posts..." }],
      "pendingNavigation": false
    },
    "navigation": {
      "url": "http://127.0.0.1:4173/scenarios/infinite-feed/",
      "origin": "http://127.0.0.1:4173",
      "path": "/scenarios/infinite-feed/",
      "type": "navigate",
      "historyLength": 2,
      "visibility": "visible"
    },
    "regions": [
      {
        "role": "main",
        "selector": "body > main",
        "bounds": { "x": 256, "y": 32, "width": 768, "height": 1790.44 }
      }
    ],
    "repeating": [
      {
        "containerSelector": "[data-testid=\"feed-page-1\"]",
        "signature": "article||feed-item|feed-item",
        "itemCount": 10,
        "representative": {
          "selector": "[data-testid=\"feed-item\"]",
          "testId": "feed-item",
          "text": "Night market #1 Aiko Tanaka - 2026-03-01 09:00 UTC Notes from Saturday's repair cafe."
        },
        "fields": ["feed-item-title", "feed-item-author", "feed-item-time", "feed-item-summary"]
      }
    ]
  },
  "sensitive-input": {
    "elements": {
      "scanned": 21,
      "candidates": 19,
      "matched": 13,
      "returned": 13,
      "truncated": false,
      "changed": 0,
      "recentlyInteracted": 0
    },
    "loading": {
      "documentState": "complete",
      "busy": false,
      "busyRegions": [],
      "indicators": [],
      "pendingNavigation": false
    },
    "navigation": {
      "url": "http://127.0.0.1:4173/scenarios/sensitive-input/",
      "origin": "http://127.0.0.1:4173",
      "path": "/scenarios/sensitive-input/",
      "type": "navigate",
      "historyLength": 2,
      "visibility": "visible"
    },
    "regions": [
      {
        "role": "main",
        "selector": "body > main",
        "bounds": { "x": 256, "y": 32, "width": 768, "height": 307.44 }
      }
    ],
    "forms": [
      {
        "selector": "[data-testid=\"sensitive-form\"]",
        "controlCount": 5,
        "controls": [
          {
            "selector": "input[name=\"username\"]",
            "controlType": "text",
            "name": "username",
            "label": "Email",
            "hasValue": true,
            "autocomplete": "off"
          },
          {
            "selector": "[data-testid=\"password\"]",
            "controlType": "password",
            "name": "password",
            "label": "Password",
            "hasValue": true,
            "sensitive": true
          },
          {
            "selector": "[data-testid=\"payment\"]",
            "controlType": "text",
            "name": "payment",
            "label": "Test card",
            "hasValue": true,
            "autocomplete": "cc-number",
            "sensitive": true
          },
          {
            "selector": "[data-testid=\"billing\"]",
            "controlType": "text",
            "name": "billing",
            "label": "Billing card",
            "hasValue": true,
            "autocomplete": "billing cc-number",
            "sensitive": true
          },
          {
            "selector": "body > main > form > button",
            "controlType": "submit",
            "label": "Submit synthetic values"
          }
        ],
        "submit": "body > main > form > button"
      }
    ]
  }
};
