// src/page-evidence/tests/capture.test.ts
import assert from "node:assert/strict";
import test from "node:test";

// src/page-evidence/capture.ts
var WEB_AUTOMATION_PAGE_EVIDENCE_CAPTURES = {
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
          "selector": '[data-testid="invite-backdrop"]',
          "bounds": { "x": 0, "y": 0, "width": 1280, "height": 720 },
          "blocks": 6,
          "blocked": [
            '[data-testid="open-invite"]',
            '[data-testid="consent-accept"]',
            '[data-testid="consent-reject"]',
            '[data-testid="publish-draft"]',
            '[data-testid="add-section"]'
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
        "selector": '[data-testid="consent-banner"]',
        "label": "We use cookies",
        "bounds": { "x": 0, "y": 575.61, "width": 1280, "height": 144.39 }
      }
    ],
    "forms": [
      {
        "selector": '[data-testid="invite-form"]',
        "controlCount": 4,
        "controls": [
          {
            "selector": '[data-testid="invite-email"]',
            "controlType": "email",
            "name": "email",
            "label": "Email address",
            "required": true,
            "hasValue": false,
            "autocomplete": "off"
          },
          {
            "selector": '[data-testid="invite-role"]',
            "controlType": "select",
            "name": "role",
            "label": "Role",
            "hasValue": true
          },
          { "selector": '[data-testid="invite-cancel"]', "controlType": "button", "label": "Cancel" },
          { "selector": '[data-testid="invite-confirm"]', "controlType": "submit", "label": "Confirm" }
        ],
        "submit": '[data-testid="invite-confirm"]'
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
      "busyRegions": ['[data-testid="feed"]'],
      "indicators": [{ "selector": '[data-testid="feed-loading"]', "kind": "status", "label": "Loading more posts..." }],
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
        "containerSelector": '[data-testid="feed-page-1"]',
        "signature": "article||feed-item|feed-item",
        "itemCount": 10,
        "representative": {
          "selector": '[data-testid="feed-item"]',
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
        "selector": '[data-testid="sensitive-form"]',
        "controlCount": 5,
        "controls": [
          {
            "selector": 'input[name="username"]',
            "controlType": "text",
            "name": "username",
            "label": "Email",
            "hasValue": true,
            "autocomplete": "off"
          },
          {
            "selector": '[data-testid="password"]',
            "controlType": "password",
            "name": "password",
            "label": "Password",
            "hasValue": true,
            "sensitive": true
          },
          {
            "selector": '[data-testid="payment"]',
            "controlType": "text",
            "name": "payment",
            "label": "Test card",
            "hasValue": true,
            "autocomplete": "cc-number",
            "sensitive": true
          },
          {
            "selector": '[data-testid="billing"]',
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

// src/page-evidence/tests/capture.test.ts
var CAPTURES = Object.entries(WEB_AUTOMATION_PAGE_EVIDENCE_CAPTURES);
var EXERCISED = [
  { field: "elements.scanned", reach: (e) => e.elements.scanned },
  { field: "elements.candidates", reach: (e) => e.elements.candidates },
  { field: "elements.matched", reach: (e) => e.elements.matched },
  { field: "elements.returned", reach: (e) => e.elements.returned },
  { field: "elements.truncated", reach: (e) => e.elements.truncated },
  { field: "elements.changed", reach: (e) => e.elements.changed },
  { field: "elements.recentlyInteracted", reach: (e) => e.elements.recentlyInteracted },
  { field: "loading.documentState", reach: (e) => e.loading.documentState },
  { field: "loading.busy", reach: (e) => e.loading.busy },
  { field: "loading.busyRegions[]", reach: (e) => e.loading.busyRegions[0] },
  { field: "loading.indicators[].selector", reach: (e) => e.loading.indicators[0]?.selector },
  { field: "loading.indicators[].kind", reach: (e) => e.loading.indicators[0]?.kind },
  { field: "loading.indicators[].label", reach: (e) => e.loading.indicators[0]?.label },
  { field: "loading.pendingNavigation", reach: (e) => e.loading.pendingNavigation },
  { field: "navigation.url", reach: (e) => e.navigation.url },
  { field: "navigation.origin", reach: (e) => e.navigation.origin },
  { field: "navigation.path", reach: (e) => e.navigation.path },
  { field: "navigation.type", reach: (e) => e.navigation.type },
  { field: "navigation.historyLength", reach: (e) => e.navigation.historyLength },
  { field: "navigation.visibility", reach: (e) => e.navigation.visibility },
  { field: "dialogs.open[].selector", reach: (e) => e.dialogs?.open[0]?.selector },
  { field: "dialogs.open[].role", reach: (e) => e.dialogs?.open[0]?.role },
  { field: "dialogs.open[].modal", reach: (e) => e.dialogs?.open[0]?.modal },
  { field: "dialogs.open[].native", reach: (e) => e.dialogs?.open[0]?.native },
  { field: "dialogs.open[].label", reach: (e) => e.dialogs?.open[0]?.label },
  { field: "dialogs.open[].bounds", reach: (e) => e.dialogs?.open[0]?.bounds },
  { field: "dialogs.modal", reach: (e) => e.dialogs?.modal },
  { field: "dialogs.lastNative.kind", reach: (e) => e.dialogs?.lastNative?.kind },
  { field: "dialogs.lastNative.message", reach: (e) => e.dialogs?.lastNative?.message },
  { field: "dialogs.lastNative.response", reach: (e) => e.dialogs?.lastNative?.response },
  { field: "dialogs.lastNative.at", reach: (e) => e.dialogs?.lastNative?.at },
  { field: "overlays.tested", reach: (e) => e.overlays?.tested },
  { field: "overlays.blockedCount", reach: (e) => e.overlays?.blockedCount },
  { field: "overlays.blockers[].selector", reach: (e) => e.overlays?.blockers[0]?.selector },
  { field: "overlays.blockers[].bounds", reach: (e) => e.overlays?.blockers[0]?.bounds },
  { field: "overlays.blockers[].blocks", reach: (e) => e.overlays?.blockers[0]?.blocks },
  { field: "overlays.blockers[].blocked[]", reach: (e) => e.overlays?.blockers[0]?.blocked[0] },
  { field: "regions[].role", reach: (e) => e.regions?.[0]?.role },
  { field: "regions[].selector", reach: (e) => e.regions?.[0]?.selector },
  { field: "regions[].bounds", reach: (e) => e.regions?.[0]?.bounds },
  { field: "regions[].label", reach: (e) => e.regions?.find((region) => region.label)?.label },
  { field: "repeating[].containerSelector", reach: (e) => e.repeating?.[0]?.containerSelector },
  { field: "repeating[].signature", reach: (e) => e.repeating?.[0]?.signature },
  { field: "repeating[].itemCount", reach: (e) => e.repeating?.[0]?.itemCount },
  { field: "repeating[].representative.selector", reach: (e) => e.repeating?.[0]?.representative.selector },
  { field: "repeating[].representative.testId", reach: (e) => e.repeating?.[0]?.representative.testId },
  { field: "repeating[].representative.text", reach: (e) => e.repeating?.[0]?.representative.text },
  { field: "repeating[].fields[]", reach: (e) => e.repeating?.[0]?.fields?.[0] },
  { field: "forms[].selector", reach: (e) => e.forms?.[0]?.selector },
  { field: "forms[].controlCount", reach: (e) => e.forms?.[0]?.controlCount },
  { field: "forms[].submit", reach: (e) => e.forms?.[0]?.submit },
  { field: "forms[].controls[].selector", reach: (e) => e.forms?.[0]?.controls[0]?.selector },
  { field: "forms[].controls[].controlType", reach: (e) => e.forms?.[0]?.controls[0]?.controlType },
  { field: "forms[].controls[].name", reach: (e) => e.forms?.[0]?.controls[0]?.name },
  { field: "forms[].controls[].label", reach: (e) => e.forms?.[0]?.controls[0]?.label },
  { field: "forms[].controls[].required", reach: (e) => e.forms?.[0]?.controls.find((control) => control.required)?.required },
  { field: "forms[].controls[].hasValue", reach: (e) => e.forms?.[0]?.controls[0]?.hasValue },
  { field: "forms[].controls[].autocomplete", reach: (e) => e.forms?.[0]?.controls.find((control) => control.autocomplete)?.autocomplete },
  { field: "forms[].controls[].sensitive", reach: (e) => e.forms?.[0]?.controls.find((control) => control.sensitive)?.sensitive }
];
var NOT_EXERCISED = [
  { field: "navigation.referrer", reach: (e) => e.navigation.referrer, why: "the harness opens each fixture directly, so there is no referring page. The packet's origin-and-path reduction of it is covered in llm-evidence/tests/page-evidence.test.ts." },
  { field: "navigation.redirects", reach: (e) => e.navigation.redirects, why: "no Lab fixture redirects. The producer omits the field at zero." },
  { field: "dialogs.armPending", reach: (e) => e.dialogs?.armPending, why: "true only between writing an arming and the page-world override taking it, which happens on the dispatching call stack. It is observable only where the override is absent." },
  { field: "overlays.blockers[].role", reach: (e) => e.overlays?.blockers[0]?.role, why: "modal-flows' backdrop is a plain div with neither a role nor a name; the field is optional for exactly that case." },
  { field: "overlays.blockers[].label", reach: (e) => e.overlays?.blockers[0]?.label, why: "same blocker, same reason." },
  { field: "forms[].name", reach: (e) => e.forms?.[0]?.name, why: "neither fixture form carries a name attribute." },
  { field: "forms[].label", reach: (e) => e.forms?.[0]?.label, why: "neither fixture form carries an accessible name. intermediate-state's does, and e2e/content/tests/evidence.spec.ts asserts it there." },
  { field: "forms[].action", reach: (e) => e.forms?.[0]?.action, why: "neither fixture form posts anywhere." },
  { field: "forms[].method", reach: (e) => e.forms?.[0]?.method, why: "same." },
  { field: "forms[].controls[].disabled", reach: (e) => e.forms?.[0]?.controls.find((control) => control.disabled)?.disabled, why: "no fixture form disables a control." }
];
var ITEMS = {
  elements: "always",
  loading: "always",
  navigation: "always",
  dialogs: "when the page has one",
  overlays: "when the page has one",
  regions: "when the page has one",
  repeating: "when the page has one",
  forms: "when the page has one"
};
function reachesInAnyCapture(reach) {
  return CAPTURES.some(([, evidence]) => reach(evidence) !== void 0);
}
test("every item the contract declares is carried by a real capture, and the three unconditional ones by all of them", () => {
  for (const [item, when] of Object.entries(ITEMS)) {
    const carrying = CAPTURES.filter(([, evidence]) => evidence[item] !== void 0).map(([name]) => name);
    assert.notDeepEqual(carrying, [], `no capture carries \`${item}\`, so nothing proves the producer writes it`);
    if (when === "always") {
      assert.equal(carrying.length, CAPTURES.length, `\`${item}\` is not optional, so every capture should carry it`);
    }
  }
});
test("every capture is a real one: three of them, each from a named Scenario Lab fixture", () => {
  assert.deepEqual(CAPTURES.map(([name]) => name), ["modal-flows", "infinite-feed", "sensitive-input"]);
  for (const [name, evidence] of CAPTURES) {
    assert.equal(typeof evidence.elements.scanned, "number", name);
    assert.ok(evidence.loading.documentState, name);
    assert.ok(evidence.navigation.url.startsWith("http://127.0.0.1:4173/scenarios/"), `${name}: the Lab's per-run port should have been rewritten to 4173`);
  }
});
test("the captures between them populate every contract field the data join claims to cover", () => {
  const missing = EXERCISED.filter((row) => !reachesInAnyCapture(row.reach)).map((row) => row.field);
  assert.deepEqual(missing, [], "these fields are declared and read but no real capture carries one, so nothing proves a producer writes them");
});
test("the fields no capture reaches are the ones written down, and no others", () => {
  const nowReached = NOT_EXERCISED.filter((row) => reachesInAnyCapture(row.reach)).map((row) => row.field);
  assert.deepEqual(nowReached, [], "a capture now carries these, so move the row into EXERCISED and delete its excuse");
});
test("no capture carries a form control's value, only whether it holds one", () => {
  for (const [name, evidence] of CAPTURES) {
    for (const form of evidence.forms ?? []) {
      for (const control of form.controls) {
        assert.equal("value" in control, false, `${name}: ${control.selector} carries a value`);
      }
    }
  }
  const sensitive = CAPTURES.flatMap(([, evidence]) => evidence.forms ?? []).flatMap((form) => form.controls).filter((control) => control.sensitive);
  assert.ok(sensitive.length >= 2, "sensitive-input's password and card fields should both be marked");
});
