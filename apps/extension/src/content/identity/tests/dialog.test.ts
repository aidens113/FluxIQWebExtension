// The dialog a control sits in, and the gate both acting paths put to it (t469).
//
// Lane D round 8 (`run-mv5jnc5m-a47c3e59`, playback step 0062): a step saved on
// the chat panel's "Close chat" close button resolved, with the chat gone, to
// the notifications prompt's close button -- scored 0.729 against a runner-up
// of 0.113 -- and pressed it. Every signal a fingerprint holds agreed or nearly
// agreed; what differed was the dialog around each one.
//
// The rows pin three things: what names a dialog (`dialogName`), the gate
// itself (`agreesWithRecordedDialog`), and that both acting paths ask it -- the
// Level 1 veto and the Level 2 ranking -- on the pair the run pressed. A
// control in no dialog is unaffected throughout. The whole resolution on the
// real page is
// `e2e/content/tests/dialog-identity/tests/dialog-bound-identity.spec.ts`.

import assert from "node:assert/strict";
import test from "node:test";
import { agreesWithRecordedDialog, dialogName } from "../dialog";
import { scoreTargetCandidates, type RecordedIdentity } from "../score";
import { vetoCandidate } from "../veto";

type Child = StubElement | string;

/** An element that answers the lookups `dialog.ts` and the name and text readers make, and nothing else. */
type StubElement = Element & { readonly stubChildren: StubElement[] };

function node(tagName: string, attributes: Record<string, string> = {}, ...children: Child[]): StubElement {
  const elements: StubElement[] = [];
  const text = children.map((child) => typeof child === "string" ? child : child.textContent ?? "").join("");
  const self = {
    tagName: tagName.toUpperCase(),
    localName: tagName,
    nodeType: 1,
    parentElement: null as Element | null,
    parentNode: null as Node | null,
    id: attributes.id ?? "",
    textContent: text,
    childNodes: [] as Node[],
    get children() { return elements; },
    get stubChildren() { return elements; },
    getAttribute: (name: string) => attributes[name] ?? null,
    hasAttribute: (name: string) => name in attributes,
    getAttributeNames: () => Object.keys(attributes),
    closest: () => null,
    querySelectorAll: () => [],
    matches: () => false,
    getRootNode: () => ({ nodeType: 9 })
  };
  for (const child of children) {
    if (typeof child === "string") continue;
    (child as unknown as { parentElement: Element; parentNode: Node }).parentElement = self as unknown as Element;
    (child as unknown as { parentElement: Element; parentNode: Node }).parentNode = self as unknown as Node;
    elements.push(child);
  }
  return self as unknown as StubElement;
}

/** A close button as social-network-feed draws both of them: a `div` with role `button`, a ✕, and a name. */
function closeButton(name: string): StubElement {
  return node("div", { role: "button", tabindex: "0", "aria-label": name, class: "x1pycuky xu37y6r" }, "✕");
}

/** The chat panel: a non-modal dialog named by its `aria-label`. */
function chatPanel(): { dialog: StubElement; close: StubElement } {
  const close = closeButton("Close chat");
  const dialog = node("div", { role: "dialog", "aria-label": "Chat with Elena Sokolova" }, node("div", {}, close));
  return { dialog, close };
}

/** The notifications prompt: a modal dialog named only by its heading (its `aria-labelledby` id is the page's, drawn fresh). */
function notificationsPrompt(): { dialog: StubElement; close: StubElement } {
  const close = closeButton("Close");
  const dialog = node("div", { role: "dialog", "aria-modal": "true" }, node("div", {}, node("h2", {}, "Turn on notifications?"), close));
  return { dialog, close };
}

/** Step 0062's saved fingerprint, as a recording made since t469 carries it: with the dialog its control sat in. */
const CLOSE_CHAT: RecordedIdentity = {
  tagName: "div", role: "button", accessibleName: "Close chat", visibleText: "✕",
  classNames: ["x1pycuky", "xu37y6r"], context: { dialog: "Chat with Elena Sokolova" }
};

/** What `candidateFingerprint` makes of either close button. */
const asCandidate = (element: Element, candidateId: string, accessibleName: string) => ({
  element,
  fingerprint: { candidateId, tagName: "div", role: "button", classNames: ["x1pycuky", "xu37y6r"], visibleText: "✕", accessibleName, isVisibleOnViewport: true }
});

// --- What names a dialog ------------------------------------------------------

test("a control in a dialog is named by the dialog's accessible name", () => {
  assert.equal(dialogName(chatPanel().close), "Chat with Elena Sokolova");
});

test("a dialog its author never labelled is named by its first heading", () => {
  assert.equal(dialogName(notificationsPrompt().close), "Turn on notifications?");
});

test("a <dialog>, an alertdialog and an aria-modal element are each a dialog", () => {
  for (const [tag, attributes] of [["dialog", {}], ["div", { role: "alertdialog" }], ["section", { "aria-modal": "true" }]] as const) {
    const control = closeButton("Close");
    node(tag, { ...attributes, "aria-label": "Going too fast" }, control);
    assert.equal(dialogName(control), "Going too fast", `${tag} ${JSON.stringify(attributes)}`);
  }
});

test("a control in no dialog has no dialog name", () => {
  const control = closeButton("Close");
  node("main", {}, node("div", {}, control));
  assert.equal(dialogName(control), undefined);
});

test("a dialog with neither a name nor a heading names nothing, so nothing is recorded for it", () => {
  const control = closeButton("Close");
  node("div", { role: "dialog" }, node("p", {}, "Some words"), control);
  assert.equal(dialogName(control), undefined);
});

test("the dialog element itself counts: a press recorded on a dialog is in it", () => {
  assert.equal(dialogName(chatPanel().dialog), "Chat with Elena Sokolova");
});

// --- The gate -----------------------------------------------------------------

test("a saved Close in dialog A is not accepted on a Close in dialog B", () => {
  assert.equal(agreesWithRecordedDialog("Chat with Elena Sokolova", notificationsPrompt().close), false);
});

test("a saved Close in dialog A is accepted in dialog A rendered again", () => {
  // A fresh tree: nothing is carried over from the one the recording was made on.
  assert.equal(agreesWithRecordedDialog("Chat with Elena Sokolova", chatPanel().close), true);
});

test("a saved control in a dialog is not accepted on a look-alike in no dialog", () => {
  const control = closeButton("Close chat");
  node("main", {}, control);
  assert.equal(agreesWithRecordedDialog("Chat with Elena Sokolova", control), false);
});

test("a recording that named no dialog gates nothing, whichever dialog the candidate is in", () => {
  assert.equal(agreesWithRecordedDialog(undefined, notificationsPrompt().close), true);
  assert.equal(agreesWithRecordedDialog(undefined, chatPanel().close), true);
  assert.equal(agreesWithRecordedDialog("  ", chatPanel().close), true);
});

// --- Both acting paths, on the pair step 0062 pressed --------------------------

test("the Level 1 veto refuses the notifications prompt's Close for a step saved on Close chat", () => {
  const prompt = asCandidate(notificationsPrompt().close, "prompt-close", "Close");
  assert.equal(vetoCandidate(CLOSE_CHAT, prompt).refusedBecause, "other-dialog");
  // The gate is what refuses it: without the dialog, the same pair is accepted,
  // because the ✕ agrees exactly -- which is how the run pressed it.
  assert.equal(vetoCandidate({ ...CLOSE_CHAT, context: undefined }, prompt).refusedBecause, undefined);
});

test("the Level 1 veto accepts Close chat in the chat panel rendered again", () => {
  const chat = asCandidate(chatPanel().close, "chat-close", "Close chat");
  const verdict = vetoCandidate(CLOSE_CHAT, chat);
  assert.equal(verdict.refusedBecause, undefined);
  assert.ok(verdict.measurement && verdict.measurement.score > 0.9, `scored ${verdict.measurement?.score}`);
});

test("the Level 2 ranking never ranks the prompt's Close, and with the chat gone finds nothing", () => {
  const prompt = asCandidate(notificationsPrompt().close, "prompt-close", "Close");
  const selection = scoreTargetCandidates(CLOSE_CHAT, [prompt]);
  assert.equal(selection.outcome, "unmatched");
  assert.deepEqual(selection.ranked, []);
  // Without the dialog the prompt's Close is resolved, as step 0062 resolved it.
  assert.equal(scoreTargetCandidates({ ...CLOSE_CHAT, context: undefined }, [prompt]).outcome, "resolved");
});

test("the Level 2 ranking resolves Close chat with both dialogs open", () => {
  const prompt = asCandidate(notificationsPrompt().close, "prompt-close", "Close");
  const chat = asCandidate(chatPanel().close, "chat-close", "Close chat");
  const selection = scoreTargetCandidates(CLOSE_CHAT, [prompt, chat]);
  assert.equal(selection.outcome, "resolved");
  assert.equal(selection.outcome === "resolved" ? selection.chosen.element : undefined, chat.element);
  assert.equal(selection.ranked.length, 1, "the prompt's Close is not ranked at all");
});

test("a control saved in no dialog is weighed exactly as before", () => {
  const saved: RecordedIdentity = { ...CLOSE_CHAT, context: undefined };
  const inDialog = asCandidate(chatPanel().close, "chat-close", "Close chat");
  const loose = closeButton("Close chat");
  node("main", {}, loose);
  const onPage = asCandidate(loose, "page-close", "Close chat");
  assert.equal(vetoCandidate(saved, inDialog).refusedBecause, undefined);
  assert.equal(vetoCandidate(saved, onPage).refusedBecause, undefined);
  assert.equal(vetoCandidate({ ...saved, context: {} }, onPage).refusedBecause, undefined);
});
