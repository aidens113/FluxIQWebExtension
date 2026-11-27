// Which controls' words a build has seen change as state, and how their saved identity is marked (t1071 F1,
// `../state-words.ts`). The whole run -- the bigbox cart link whose count and total changed between attempts --
// is held in `../../control-intents/tests/later-attempt.test.ts` and, on the page, in the extension's
// `content/action-runtime/tests/cart-link-replay.test.ts`.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { webAutomationOutputNodeId } from "../../../../../output-nodes";
import { sanitizeWebLlmSnapshotWithBindings, type WebLlmSnapshotBinding } from "../../../sanitize";
import { createWebLlmExtractionHandles } from "../../../structure";
import { createWebLlmTargetPackets, resolveWebPlanNodeParameters } from "../..";

const SCOPE = { projectId: "project.state-words", flowId: "flow.state-words" };
const ORIGIN = "https://shop.test";
const CLICK = webAutomationOutputNodeId("web.dom.click");

type Control = { tag?: string; selector?: string; words: string; href?: string; testId?: string };

function capture(path: string, document: number, controls: readonly Control[]): WebLlmSnapshotBinding {
  const url = `${ORIGIN}${path}`;
  return sanitizeWebLlmSnapshotWithBindings({
    url,
    interactiveElements: controls.map((control): JsonObject => {
      const attributes: Record<string, string> = {};
      if (control.href !== undefined) attributes.href = control.href;
      if (control.testId !== undefined) attributes["data-testid"] = control.testId;
      const described: JsonObject = { tagName: control.tag ?? "a", selector: control.selector ?? "header > a.badge", visibleText: control.words, attributes };
      if (control.href !== undefined) described.href = control.href;
      return described;
    }),
    evidence: { navigation: { url, origin: ORIGIN, path, type: "navigate", timeOrigin: document, historyLength: 1, visibility: "visible" } }
  });
}

function store() {
  const targets = createWebLlmTargetPackets();
  const stores = { targets, extractions: createWebLlmExtractionHandles() };
  const element = async (handle: string, page: string): Promise<JsonObject> => {
    const answer = await resolveWebPlanNodeParameters({ ...SCOPE, nodeDefinitionId: CLICK, parameters: { target: { handle } }, gatedByCaller: true, onPage: `${ORIGIN}${page}` }, stores);
    if (answer.status !== "resolved") assert.fail(JSON.stringify(answer));
    return answer.parameters.element as JsonObject;
  };
  return { targets, stores, element };
}

test("a link seen in two wordings, always leading to one place, keeps its words marked as a value and carries its path", async () => {
  const { targets, element } = store();
  targets.remember(SCOPE, capture("/search?q=towels", 1, [{ words: "Cart 1 $3.97", href: `${ORIGIN}/cart?from=search` }]));
  assert.equal((await element("t1", "/search?q=towels")).readsWords, undefined, "one wording says nothing yet");
  targets.remember(SCOPE, capture("/cart", 2, [{ words: "Cart 2 $5.25", href: `${ORIGIN}/cart` }]));
  const marked = await element("t1", "/cart");
  assert.equal(marked.readsWords, true);
  assert.equal(marked.href, "/cart", "the path, without its query");
  assert.equal(marked.visibleText, "Cart 2 $5.25", "the words stay: the save-time guard still counts them");
});

test("a link whose words change with where it leads is not one control whose words changed", async () => {
  const { targets, element } = store();
  targets.remember(SCOPE, capture("/p/1", 1, [{ words: "Blue towels", href: `${ORIGIN}/p/1/reviews`, testId: "title-link" }]));
  targets.remember(SCOPE, capture("/p/2", 2, [{ words: "Green towels", href: `${ORIGIN}/p/2/reviews`, testId: "title-link" }]));
  assert.equal((await element("t1", "/p/2")).readsWords, undefined, "a template's test id is no stable fact of one control");
});

test("a control with no destination keeps its words as identity", async () => {
  const { targets, element } = store();
  targets.remember(SCOPE, capture("/inbox", 1, [{ tag: "button", selector: "#alerts", words: "Alerts 3" }]));
  targets.remember(SCOPE, capture("/inbox", 2, [{ tag: "button", selector: "#alerts", words: "Alerts 4" }]));
  assert.equal((await element("t1", "/inbox")).readsWords, undefined);
});

test("words a control's own act left in its document are the act's effect, in this attempt and a later one", async () => {
  const { targets, element } = store();
  const toggle = (words: string): Control => ({ selector: "#follow", words, href: `${ORIGIN}/people/ada` });
  const before = capture("/people/ada", 1, [toggle("Follow")]);
  const after = capture("/people/ada", 1, [toggle("Following")]);
  targets.remember(SCOPE, before);
  targets.acted(SCOPE, "t1", before, after);
  targets.remember(SCOPE, after);
  targets.remember(SCOPE, capture("/people/ada", 2, [toggle("Following")]));
  assert.equal((await element("t1", "/people/ada")).readsWords, undefined);
});

test("a selector the capture gave to several links counts for none of them", async () => {
  const { targets, element } = store();
  targets.remember(SCOPE, capture("/list", 1, [{ words: "Open 1", href: `${ORIGIN}/open` }, { words: "Open 2", href: `${ORIGIN}/open` }, { selector: "#solo", words: "Solo", href: `${ORIGIN}/solo` }]));
  targets.remember(SCOPE, capture("/list", 2, [{ words: "Open 3", href: `${ORIGIN}/open` }, { selector: "#solo", words: "Solo", href: `${ORIGIN}/solo` }]));
  assert.equal((await element("t1", "/list")).readsWords, undefined);
});
