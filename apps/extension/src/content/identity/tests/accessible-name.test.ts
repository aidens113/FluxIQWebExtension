// `accessibleNameFor` reads page content in two places -- the text of what
// `aria-labelledby` references, and the element's own text when its role takes
// a name from content -- and either can hold what a sensitive control holds: a
// sensitive `<textarea>`'s text, a sensitive `<select>`'s option labels, the
// words in an element the shared rule marks. Both read through
// `textOutsideSensitiveControls`, so no caller's name quotes those contents
// (decision D2): not the descriptor, not page evidence, not a resolver's
// candidates.
//
// The runner is Node, so the page is the hand-built stub in
// `content/tests/stub-page.ts`, given here the two lookups the name computation
// makes beyond it: `document.getElementById` for the references, and `closest`
// and `Element` for the `<label>` reader. That a real page's evidence carries
// none of it is the content harness's (`e2e/content/tests/evidence.spec.ts`).

import assert from "node:assert/strict";
import test from "node:test";
import { element, input, withStubPage } from "../../tests/stub-page";

type NameFor = (target: Element) => string | undefined;

const load = () => import("../accessible-name");

/**
 * Runs `body` with `accessibleNameFor` on a page made of `roots`: `document`
 * finds their elements by `id`, and each element answers `closest(tag)` as a
 * real one does, itself included. Every global is put back afterwards.
 */
async function withNamedPage(roots: readonly Element[], body: (nameFor: NameFor) => void): Promise<void> {
  const byId = new Map<string, Element>();
  for (const root of roots) {
    for (const node of [root, ...root.querySelectorAll("*")]) {
      const id = node.getAttribute("id");
      if (id) byId.set(id, node);
      Object.defineProperty(node, "closest", { value: (tag: string) => closestByTag(node, tag) });
    }
  }
  const globals = globalThis as unknown as Record<string, unknown>;
  const installed: Record<string, unknown> = {
    document: { getElementById: (id: string) => byId.get(id) ?? null },
    Element: { [Symbol.hasInstance]: (value: unknown) => (value as { nodeType?: unknown } | null)?.nodeType === 1 }
  };
  const previous = new Map(Object.keys(installed).map((name) => [name, Object.getOwnPropertyDescriptor(globals, name)] as const));
  Object.assign(globals, installed);
  try {
    await withStubPage(load, ({ accessibleNameFor }) => body(accessibleNameFor));
  } finally {
    for (const [name, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globals, name, descriptor);
      else delete globals[name];
    }
  }
}

function closestByTag(start: Element, tag: string): Element | null {
  for (let current: Element | null = start; current; current = current.parentElement) {
    if (current.tagName.toLowerCase() === tag) return current;
  }
  return null;
}

test("a reference holding a sensitive textarea names the element by its own words, never the textarea's text", async () => {
  const reference = element("span", { id: "hint-name" }, "Hint ", element("textarea", { "data-sensitive": "true" }, "SYNTHETIC_NAME_NOTE"));
  const named = element("button", { "aria-labelledby": "hint-name" }, "?");
  const note = element("textarea", { id: "note", "data-sensitive": "true" }, "SYNTHETIC_NAME_NOTE");
  const namedByNote = element("button", { "aria-labelledby": "note" }, "Show");
  await withNamedPage([reference, named, note, namedByNote], (nameFor) => {
    assert.equal(nameFor(named), "Hint");
    // A reference that is the sensitive control gives nothing, so the name comes from the next source.
    assert.equal(nameFor(namedByNote), "Show");
  });
});

test("a reference holding a sensitive select names the element by its own words, never the option labels", async () => {
  const answer = element("span", { id: "answer-name" }, "Security answer ",
    element("select", { autocomplete: "one-time-code" }, element("option", { id: "answer-option" }, "SYNTHETIC_NAME_OPTION")));
  const contact = element("span", { id: "contact-name" }, "Contact time ", element("select", {}, element("option", {}, "Mornings")));
  const named = element("button", { "aria-labelledby": "answer-name" }, "?");
  // An option inside the sensitive select, listed directly, gives nothing; an ordinary select's option is kept.
  const namedByAll = element("button", { "aria-labelledby": "answer-name answer-option contact-name" }, "?");
  await withNamedPage([answer, contact, named, namedByAll], (nameFor) => {
    assert.equal(nameFor(named), "Security answer");
    assert.equal(nameFor(namedByAll), "Security answer Contact time Mornings");
  });
});

test("a label wrapping a sensitive control is named by its own words", async () => {
  const note = element("label", {}, "Recovery note ", element("textarea", { "data-sensitive": "true" }, "SYNTHETIC_NAME_NOTE"));
  const code = element("label", {}, "Backup code ", element("select", { autocomplete: "one-time-code" }, element("option", {}, "SYNTHETIC_NAME_OPTION")));
  const marked = element("label", {}, "Private ", element("span", { "data-sensitive": "true" }, "SYNTHETIC_NAME_WORDS"), "note");
  const contact = element("label", {}, "Contact time ", element("select", {}, element("option", {}, "Mornings")));
  await withNamedPage([note, code, marked, contact], (nameFor) => {
    assert.equal(nameFor(note), "Recovery note");
    assert.equal(nameFor(code), "Backup code");
    assert.equal(nameFor(marked), "Private note");
    assert.equal(nameFor(contact), "Contact time Mornings");
  });
});

test("an element that is, or sits inside, a sensitive control takes no name from its contents", async () => {
  const option = element("option", {}, "SYNTHETIC_NAME_OPTION");
  const select = element("select", { "data-sensitive": "true" }, option);
  const markedButton = element("div", { role: "button", "data-sensitive": "true" }, "SYNTHETIC_NAME_WORDS");
  const ordinaryOption = element("option", {}, "Mornings");
  const ordinarySelect = element("select", {}, ordinaryOption);
  await withNamedPage([select, markedButton, ordinarySelect], (nameFor) => {
    assert.equal(nameFor(option), undefined);
    assert.equal(nameFor(markedButton), undefined);
    assert.equal(nameFor(ordinaryOption), "Mornings");
  });
});

test("an inline svg is named by its own title child, and an svg without one by nothing", async () => {
  const titled = element("svg", { viewBox: "0 0 24 24" }, element("title", {}, " Close  panel "), element("path", { d: "M0 0" }));
  const bare = element("svg", { viewBox: "0 0 24 24", focusable: "false" }, element("path", { d: "M0 0" }));
  const labelled = element("svg", { "aria-label": "Settings" }, element("title", {}, "Gear"));
  await withNamedPage([titled, bare, labelled], (nameFor) => {
    assert.equal(nameFor(titled), "Close panel");
    assert.equal(nameFor(bare), undefined);
    assert.equal(nameFor(labelled), "Settings");
  });
});

// l1 D5: a control that only draws its icon is named by the drawing, as the
// accessible-name calculation names an embedded graphic, so a toggle whose
// icon's label flips has a name in each state. The fixture is a reading app's
// bookmark toggle, drawn as a `div[role=button]` holding one svg.
test("a control whose only content is a labelled svg, or an svg with a title, is named by it; an aria-hidden svg names nothing", async () => {
  const icon = (attributes: Record<string, string>, ...children: Element[]) =>
    element("svg", { viewBox: "0 0 24 24", ...attributes }, ...children, element("path", { d: "M0 0" }));
  const marked = element("div", { role: "button", tabindex: "0" }, icon({ "aria-label": "Bookmark", role: "img" }));
  const unmarked = element("div", { role: "button", tabindex: "0" }, icon({ "aria-label": "Remove bookmark", role: "img" }));
  const titled = element("button", {}, icon({}, element("title", {}, " Open  menu ")));
  // The svg's own name wins over its title, as it does for the svg alone.
  const both = element("button", {}, icon({ "aria-label": "Settings" }, element("title", {}, "Gear")));
  const hidden = element("button", {}, icon({ "aria-hidden": "true" }, element("title", {}, "Decorative")));
  const hiddenLabelled = element("div", { role: "button" }, icon({ "aria-hidden": "true", "aria-label": "Decorative" }));
  const hiddenWrapper = element("button", {}, element("span", { "aria-hidden": "true" }, icon({ "aria-label": "Decorative" })));
  // Drawings and words together read in document order; a hidden icon beside words gives only the words.
  const mixed = element("button", {}, icon({ "aria-label": "Cart" }), element("span", {}, "3 items"));
  const worded = element("button", {}, icon({ "aria-hidden": "true" }, element("title", {}, "Decorative")), "Save");
  // A container still takes no name from content, drawing or not.
  const container = element("div", {}, icon({ "aria-label": "Bookmark" }));
  await withNamedPage([marked, unmarked, titled, both, hidden, hiddenLabelled, hiddenWrapper, mixed, worded, container], (nameFor) => {
    assert.equal(nameFor(marked), "Bookmark");
    assert.equal(nameFor(unmarked), "Remove bookmark");
    assert.equal(nameFor(titled), "Open menu");
    assert.equal(nameFor(both), "Settings");
    assert.equal(nameFor(hidden), undefined);
    assert.equal(nameFor(hiddenLabelled), undefined);
    assert.equal(nameFor(hiddenWrapper), undefined);
    assert.equal(nameFor(mixed), "Cart 3 items");
    assert.equal(nameFor(worded), "Save");
    assert.equal(nameFor(container), undefined);
  });
});

test("a drawing inside a sensitive control lends no name, and a sensitive control beside a drawing keeps its contents out", async () => {
  const icon = (label: string) => element("svg", { "aria-label": label }, element("path", { d: "M0 0" }));
  const inside = element("div", { role: "button", "data-sensitive": "true" }, icon("SYNTHETIC_ICON_NAME"));
  const beside = element("label", {}, icon("Note"), element("textarea", { "data-sensitive": "true" }, "SYNTHETIC_NAME_NOTE"));
  const wrapped = element("label", {}, element("span", {}, icon("Note"), element("textarea", { "data-sensitive": "true" }, "SYNTHETIC_NAME_NOTE")));
  await withNamedPage([inside, beside, wrapped], (nameFor) => {
    assert.equal(nameFor(inside), undefined);
    assert.equal(nameFor(beside), "Note");
    assert.equal(nameFor(wrapped), "Note");
  });
});

test("a push-button input inside a marked group takes no name from its value; outside one it still does", async () => {
  const marked = input("submit", "SYNTHETIC_BUTTON_VALUE");
  const group = element("div", { "data-sensitive": "true" }, marked);
  const ordinary = input("submit", "Continue");
  const form = element("form", {}, ordinary);
  await withNamedPage([group, form], (nameFor) => {
    assert.equal(nameFor(marked), undefined);
    assert.equal(nameFor(ordinary), "Continue");
  });
});
