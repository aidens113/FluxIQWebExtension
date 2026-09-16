// `label.ts` reads two kinds of page text for a control's `label`: the words of
// each `<label>` the page associated with it, and the short text beside an
// unlabelled one. Either can hold what a sensitive control holds -- the words in
// an element the shared rule marks -- and the first is also the accessible name
// and so every page-evidence name. Both follow `content/sensitive-text.ts`
// (decision D2): an associated label leaves a marked element out as it leaves
// out a nested control, a label that sits inside a sensitive control gives
// nothing, and the text beside a control is read less those contents.
//
// The runner is Node, so the page is the hand-built stub in
// `content/tests/stub-page.ts`, given here the lookups `label.ts` makes beyond
// it: a control's `labels`, `matches` and `querySelector` by tag, a
// `previousElementSibling`, and an `Element` global. That a real page's snapshot
// carries none of it is the content harness's
// (`e2e/content/tests/evidence.spec.ts`).

import assert from "node:assert/strict";
import test from "node:test";
import { element, input, withStubPage } from "../../tests/stub-page";

type LabelModule = typeof import("../label");

const load = (): Promise<LabelModule> => import("../label");

/** Runs `body` against `label.ts` on a page made of `roots`; every global it installs is put back afterwards. */
async function withLabelPage(roots: readonly Element[], body: (module: LabelModule) => void): Promise<void> {
  for (const root of roots) {
    for (const node of [root, ...root.querySelectorAll("*")]) giveLookups(node);
  }
  const globals = globalThis as unknown as Record<string, unknown>;
  const previous = Object.getOwnPropertyDescriptor(globals, "Element");
  globals.Element = { [Symbol.hasInstance]: (value: unknown) => (value as { nodeType?: unknown } | null)?.nodeType === 1 };
  try {
    await withStubPage(load, body);
  } finally {
    if (previous) Object.defineProperty(globals, "Element", previous);
    else delete globals.Element;
  }
}

/** `matches` and `querySelector` for a selector list of tag names, and the element sibling before `node`. */
function giveLookups(node: Element): void {
  Object.defineProperties(node, {
    matches: { value: (selector: string) => selector.split(",").includes(node.tagName.toLowerCase()) },
    querySelector: { value: (selector: string) => [...node.querySelectorAll("*")].find((child) => child.matches(selector)) ?? null },
    previousElementSibling: { get: () => previousElement(node) }
  });
}

function previousElement(node: Element): Element | null {
  const siblings = [...(node.parentElement?.childNodes ?? [])].filter((child) => child.nodeType === 1);
  const index = siblings.indexOf(node);
  return index > 0 ? siblings[index - 1] as Element : null;
}

/** `control`, whose `labels` are `labels` -- none, for an unlabelled one. */
function labelled(control: Element, ...labels: Element[]): Element {
  Object.defineProperty(control, "labels", { value: labels });
  return control;
}

const marked = (words: string) => element("span", { "data-sensitive": "true" }, words);

test("an associated label leaves out a marked element's words, as it leaves out a nested control", async () => {
  const nickname = input("text", "Ada");
  const nicknameLabel = element("label", {}, "Nickname ", element("em", {}, marked("SYNTHETIC_LABEL_WORDS")), " (public)");
  labelled(nickname, nicknameLabel);
  const note = element("textarea", { "data-sensitive": "true" }, "SYNTHETIC_LABEL_NOTE");
  const noteLabel = element("label", {}, "Recovery note ", note);
  labelled(note, noteLabel);
  await withLabelPage([nickname, nicknameLabel, noteLabel], ({ associatedLabel, labelText }) => {
    assert.equal(associatedLabel(nickname), "Nickname (public)");
    assert.equal(labelText(nickname), "Nickname (public)");
    // A sensitive control still carries the name its label gives it.
    assert.equal(labelText(note), "Recovery note");
  });
});

test("a label that sits inside a sensitive control gives nothing, associated or beside", async () => {
  const draft = input("text", "");
  const inner = element("label", {}, "SYNTHETIC_LABEL_WORDS");
  const region = element("div", { "data-sensitive": "true" }, inner, draft);
  labelled(draft, inner);
  await withLabelPage([region], ({ associatedLabel, labelText }) => {
    assert.equal(associatedLabel(draft), undefined);
    assert.equal(labelText(draft), undefined);
  });
});

test("the text beside an unlabelled control leaves out a marked element's words", async () => {
  const alias = labelled(input("text", ""));
  const aliasRow = element("div", {}, element("span", {}, "Alias"), marked("SYNTHETIC_NEARBY_WORDS"), alias);
  const handle = labelled(input("text", ""));
  const handleRow = element("div", {}, element("span", {}, "Handle ", marked("SYNTHETIC_NEARBY_WORDS")), handle);
  await withLabelPage([aliasRow, handleRow], ({ labelText }) => {
    // A marked sibling gives no text, so the label is the one before it.
    assert.equal(labelText(alias), "Alias");
    // A sibling holding a marked element is read by its other words.
    assert.equal(labelText(handle), "Handle");
  });
});
