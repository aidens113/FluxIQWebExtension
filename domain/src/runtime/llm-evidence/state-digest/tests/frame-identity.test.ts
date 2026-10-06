import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeWebLlmSnapshot } from "../../sanitize";
import { webLlmStateDigest } from "../state-digest";

// The browser renumbers a child frame whenever it reloads. In run
// `run-muwaobm2-882cadd9` one unchanged Farbazaar page digested as a new state
// after every reset (`[frame 10]`, `[frame 11]`, `[frame 12]`), so the page
// never read as having come back. A frame is digested by what it is -- the top
// document, or the n-th distinct child frame of this capture -- never its id.

function frameElement(frameId: number, selector: string, text: string) {
  return { tagName: "button", selector: `frame[${frameId}] >> ${selector}`, visibleText: text, attributes: { "data-fluxiq-frame-id": String(frameId) } };
}

function page(frameElements: Array<Record<string, unknown>>) {
  return {
    url: "https://shop.example.test/product",
    title: "Product",
    interactiveElements: [
      { tagName: "a", selector: "#home", visibleText: "Home", href: "/" },
      ...frameElements,
    ],
  };
}

function digest(snapshot: Record<string, unknown>): string {
  return webLlmStateDigest(sanitizeWebLlmSnapshot(snapshot));
}

test("a child frame renumbered by a reload digests the same", () => {
  const first = digest(page([frameElement(10, "#accept", "Accept"), frameElement(10, "#reject", "Reject")]));
  const second = digest(page([frameElement(11, "#accept", "Accept"), frameElement(11, "#reject", "Reject")]));
  assert.equal(second, first);
});

test("two child frames renumbered in the same order digest the same", () => {
  const first = digest(page([frameElement(10, "#accept", "Accept"), frameElement(12, "#pay", "Pay")]));
  const second = digest(page([frameElement(14, "#accept", "Accept"), frameElement(15, "#pay", "Pay")]));
  assert.equal(second, first);
});

test("controls split across two child frames digest apart from the same controls in one frame", () => {
  const oneFrame = digest(page([frameElement(10, "#accept", "Accept"), frameElement(10, "#pay", "Pay")]));
  const twoFrames = digest(page([frameElement(10, "#accept", "Accept"), frameElement(11, "#pay", "Pay")]));
  assert.notEqual(twoFrames, oneFrame);
});

test("a control moving from the top document into a child frame changes the digest", () => {
  const top = digest(page([{ tagName: "button", selector: "#accept", visibleText: "Accept" }]));
  const framed = digest(page([frameElement(10, "#accept", "Accept")]));
  assert.notEqual(framed, top);
});

test("top-document controls digest the same whatever the child frames are numbered", () => {
  const withoutFrames = digest(page([]));
  assert.equal(digest(page([])), withoutFrames);
  assert.equal(
    digest(page([frameElement(3, "#accept", "Accept")])),
    digest(page([frameElement(30, "#accept", "Accept")]))
  );
});
