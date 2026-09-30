// Which control on a layer the defence may press, for the layers whose way out
// depends on what the layer says (`way-out.ts`): a notice that the page refused
// a press for going too fast is closed by its OK, never by its "Try again", and
// OK on any other dialog is never pressed.
//
// The layer is faked at what `way-out.ts` and `layer-text.ts` read: a subtree
// answering `querySelectorAll("*")` in document order, each element's own
// attributes, text nodes, child count and painted boxes. The rate-limit layer
// is social-network-feed's, as its `requests-script.ts` draws it, before and
// after its countdown reaches zero.

import assert from "node:assert/strict";
import test from "node:test";
import { boundedLayerText } from "../layer-text";
import { dismissControlIn, hasDismissalControl } from "../way-out";

/** An element: its text before its children, its children, and its text after them. */
type Spec = { name: string; text?: string; attributes?: Record<string, string>; children?: Spec[]; tail?: string };

type Fake = {
  name: string;
  attributes: Record<string, string>;
  children: Fake[];
  ownText: string;
  tail: string;
};

const TEXT_NODE = 3;

/** A fake element tree whose nodes answer what the way-out scan reads. */
function layer(spec: Spec): Element {
  const build = (node: Spec): Fake => ({
    name: node.name,
    attributes: node.attributes ?? {},
    children: (node.children ?? []).map(build),
    ownText: node.text ?? "",
    tail: node.tail ?? ""
  });
  const elements = new Map<Fake, Element>();
  const descendants = (fake: Fake): Fake[] => fake.children.flatMap((child) => [child, ...descendants(child)]);
  const textOf = (fake: Fake): string => fake.ownText + fake.children.map(textOf).join("") + fake.tail;
  const element = (fake: Fake): Element => {
    const found = elements.get(fake);
    if (found) return found;
    const made = {
      name: fake.name,
      nodeType: 1,
      shadowRoot: null,
      ownerDocument: { location: { href: "http://127.0.0.1:4000/scenarios/social-network-feed/requests" } },
      get childElementCount() {
        return fake.children.length;
      },
      get textContent() {
        return textOf(fake);
      },
      get childNodes() {
        return [
          ...(fake.ownText ? [{ nodeType: TEXT_NODE, textContent: fake.ownText }] : []),
          ...fake.children.map(element),
          ...(fake.tail ? [{ nodeType: TEXT_NODE, textContent: fake.tail }] : [])
        ];
      },
      querySelectorAll: (selector: string) => (selector === "*" ? descendants(fake).map(element) : []),
      getClientRects: () => [{ width: 10, height: 10 }],
      hasAttribute: (name: string) => name in fake.attributes,
      getAttribute: (name: string) => fake.attributes[name] ?? null,
      closest: () => null
    };
    elements.set(fake, made as unknown as Element);
    return made as unknown as Element;
  };
  return element(build(spec));
}

function feedNotice(seconds: number, footer: Spec[]): Element {
  return layer({
    name: "scrim",
    children: [{
      name: "dialog",
      attributes: { role: "alertdialog", "aria-modal": "true" },
      children: [
        { name: "title", text: "You're going too fast" },
        { name: "body", children: [
          { name: "p1", text: "It looks like you were misusing this feature by going too fast. You've been temporarily blocked from using it." },
          { name: "p2", text: "You can try again in ", children: [{ name: "count", text: String(seconds) }], tail: " seconds." }
        ] },
        { name: "foot", children: footer }
      ]
    }]
  });
}

const OK: Spec = { name: "ok", text: "OK", attributes: { role: "button", tabindex: "0" } };
const TRY_AGAIN: Spec = { name: "try-again", text: "Try again", attributes: { role: "button", tabindex: "0", "aria-label": "Try again" } };

function nameOf(element: Element | undefined): string | undefined {
  return (element as unknown as { name?: string } | undefined)?.name;
}

test("a layer's words are read in document order, so a countdown in its own span stays in its sentence", () => {
  // Live run `run-munq51ik-a7ebd077`: read element by element, the notice said
  // "try again in seconds. 12" and the wait it named was lost.
  const text = boundedLayerText(feedNotice(12, [OK]));
  assert.match(text, /You can try again in 12 seconds\. OK$/u);
  assert.equal(text.startsWith("You're going too fast It looks like"), true, text);
});

test("the feed's going-too-fast notice is closed by its OK, and counts as a dialog with a way out", () => {
  const notice = feedNotice(12, [OK]);
  assert.equal(nameOf(dismissControlIn(notice)), "ok");
  assert.equal(hasDismissalControl(notice), true);
});

test("once the countdown ends, OK is still the way out and Try again is never pressed, even when it comes first", () => {
  assert.equal(nameOf(dismissControlIn(feedNotice(0, [OK, TRY_AGAIN]))), "ok");
  assert.equal(nameOf(dismissControlIn(feedNotice(0, [TRY_AGAIN, OK]))), "ok");
});

test("a notice offering only Try again has no way out the defence may press", () => {
  assert.equal(dismissControlIn(feedNotice(0, [TRY_AGAIN])), undefined);
});

test("OK on any other dialog is never pressed", () => {
  const invitation = layer({
    name: "scrim",
    children: [{
      name: "dialog",
      attributes: { role: "dialog", "aria-modal": "true" },
      children: [
        { name: "body", text: "Priya Nair invited you to the Riverside Allotment Society." },
        { name: "foot", children: [{ ...OK }] }
      ]
    }]
  });
  const deletion = layer({
    name: "dialog",
    attributes: { role: "alertdialog" },
    children: [
      { name: "body", text: "Delete this post? This cannot be undone." },
      { name: "foot", children: [{ ...OK }, { name: "cancel", text: "Cancel", attributes: { role: "button" } }] }
    ]
  });
  assert.equal(dismissControlIn(invitation), undefined);
  assert.equal(hasDismissalControl(invitation), false);
  assert.equal(dismissControlIn(deletion), undefined);
});
