// The word a pressed way out is recorded by (t401): the allow-list phrase its
// label begins with, never the label itself, which is page text.

import assert from "node:assert/strict";
import test from "node:test";
import { WEB_AUTOMATION_CLEARED_CONTROL_WORDS } from "@fluxiq-web-extension/domain/client";
import { clearedControlWord } from "../control-word";
import { h } from "./fake-layer";

test("a label is recorded by the phrase it begins with", () => {
  const cases: Array<[string, string]> = [
    ["No thanks, I would rather pay full price", "No thanks"],
    ["Not now", "Not now"],
    ["Close", "Close"],
    ["✕", "Close"],
    ["Minimize chat", "Minimise"],
    ["Remind me later", "Remind me later"],
    ["Continue without accepting", "Continue without accepting"],
    ["Reject all", "Reject"],
    ["Use necessary cookies only", "Necessary only"],
    ["OK", "OK"],
    ["Got it", "Got it"]
  ];
  for (const [label, word] of cases) {
    assert.equal(clearedControlWord(h("div", { role: "button" }, label)), word, label);
  }
});

test("an accessible name is read before the text, and a control that says nothing is a Close", () => {
  assert.equal(clearedControlWord(h("div", { "aria-label": "Dismiss" }, [h("svg")])), "Dismiss");
  assert.equal(clearedControlWord(h("div", { "data-dismiss": "modal" }, [h("svg")])), "Close");
});

test("every recorded word is one the domain lets travel", () => {
  const words = new Set<string>(WEB_AUTOMATION_CLEARED_CONTROL_WORDS);
  for (const label of ["Close", "Dismiss", "Minimise", "Hide", "Not now", "No thanks", "Maybe later", "Remind me later", "Later", "Skip", "Not interested", "Continue without", "Continue without accepting", "Reject", "Decline", "Refuse", "Deny", "Only allow essential", "OK", "Got it", "Understood"]) {
    assert.equal(words.has(clearedControlWord(h("div", {}, label))), true, label);
  }
});
