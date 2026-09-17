// `elementAnchors` is the one list of identifiers a selector may quote. These
// rows pin its order (id, then test ids in the order the common tools write
// them, then name), that every value goes through `CSS.escape`, and that
// nothing a page shows or a control holds is ever on it.
//
// The runner is Node, so the element is a stub answering only `getAttribute`
// and `localName`, and `CSS.escape` is a marker that shows where escaping ran.
// Whether each anchor is unique on a real page is the content harness's
// (`e2e/content/tests/unique-selectors.spec.ts`).

import assert from "node:assert/strict";
import test from "node:test";
import { elementAnchors } from "../element-anchors";

function stubElement(localName: string, attributes: Record<string, string>): Element {
  return { localName, getAttribute: (name: string) => attributes[name] ?? null } as unknown as Element;
}

/** Runs `body` with a `CSS.escape` that brackets what it escaped, and puts the global back. */
function withMarkedEscape(body: () => void): void {
  const globals = globalThis as unknown as Record<string, unknown>;
  const previous = Object.getOwnPropertyDescriptor(globals, "CSS");
  globals["CSS"] = { escape: (value: string) => `<${value}>` };
  try {
    body();
  } finally {
    if (previous) Object.defineProperty(globals, "CSS", previous);
    else delete globals["CSS"];
  }
}

test("anchors come strongest first: id, data-testid, data-test, data-cy, then name", () => {
  withMarkedEscape(() => {
    const anchors = elementAnchors(stubElement("input", {
      name: "email", "data-cy": "cy", "data-test": "test", "data-testid": "testid", id: "save"
    }));
    assert.deepEqual(anchors, [
      { selector: "#<save>", qualifier: "#<save>" },
      { selector: `[data-testid="<testid>"]`, qualifier: `[data-testid="<testid>"]` },
      { selector: `[data-test="<test>"]`, qualifier: `[data-test="<test>"]` },
      { selector: `[data-cy="<cy>"]`, qualifier: `[data-cy="<cy>"]` },
      { selector: `<input>[name="<email>"]`, qualifier: `[name="<email>"]` }
    ]);
  });
});

test("an element the author named by nothing has no anchors, and an empty identifier is not one", () => {
  withMarkedEscape(() => {
    assert.deepEqual(elementAnchors(stubElement("div", {})), []);
    assert.deepEqual(elementAnchors(stubElement("div", { id: "", "data-testid": "", name: "" })), []);
  });
});

test("no text, value, placeholder, label, title, alt or href is ever quoted", () => {
  withMarkedEscape(() => {
    const secret = "SYNTHETIC_ANCHOR_SECRET";
    const anchors = elementAnchors(stubElement("input", {
      value: secret, placeholder: secret, "aria-label": secret, title: secret, alt: secret, href: secret,
      autocomplete: "cc-number", "data-sensitive": "true"
    }));
    assert.deepEqual(anchors, []);
    assert.ok(!JSON.stringify(anchors).includes(secret));
  });
});
