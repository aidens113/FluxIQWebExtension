// The line facts say what the written view says, line for line (t174/F37):
// the same handles, kinds, words and state tokens, so a comparison of two
// pages speaks of the lines the model was shown.

import assert from "node:assert/strict";
import test from "node:test";
import { quotedWords } from "../../element";
import { webLlmLineFacts } from "../facts";
import { bodyLines, fixturePacket, type FixtureElement } from "../../tests/packet-fixture";

const ELEMENTS: FixtureElement[] = [
  { tag: "h2", text: "Pick a colour" },
  { tag: "span", text: "Space Grey" },
  { tag: "div", text: "Space Grey", cursor: "pointer", marked: true },
  { tag: "input", inputType: "checkbox", name: "Gift wrap", checked: false },
  { tag: "img", name: "Kettle in grey" },
  { tag: "button", text: "Buy", attributes: [["disabled", ""]] }
];

test("each fact is its line as the view writes it", () => {
  const facts = webLlmLineFacts(fixturePacket(ELEMENTS));
  const written = bodyLines(ELEMENTS).filter((line) => /^t\d/u.test(line));
  assert.equal(facts.length, written.length);
  facts.forEach((fact, index) => {
    const rebuilt = [fact.handle, fact.kind, fact.words === undefined ? undefined : quotedWords(fact.words), ...fact.tokens].filter((part) => part !== undefined).join(" ");
    assert.equal(rebuilt, written[index]);
  });
  assert.deepEqual(facts.map((fact) => fact.kind), ["h2", undefined, "clickable", "checkbox", "img", "button"]);
  assert.deepEqual(facts[2]!.tokens, ["marked"]);
  assert.deepEqual(facts[3]!.tokens, ["unchecked"]);
  assert.deepEqual(facts[5]!.tokens, ["disabled"]);
});
