// The instructions every model request is given about operating a website
// (t237, `../instructions.ts`): the rules live runs showed a model
// needs, a version Core accepts, and a size that stays a small part of the
// system message.

import assert from "node:assert/strict";
import test from "node:test";
import { assertAutomationStudioLlmDomainSystemInstructions } from "fluxiq/automation-studio";
import { WEB_LLM_SYSTEM_INSTRUCTIONS } from "../instructions";
import type { WebLlmEvidenceGateway } from "../../capture";
import { createWebAutomationLlmEvidenceRuntime } from "../../tools";

const { text, version } = WEB_LLM_SYSTEM_INSTRUCTIONS;

test("the version is one Core's seam accepts, and names the text with loops and written steps", () => {
  assert.match(version, /^[a-z0-9][a-z0-9._-]{0,63}$/u);
  assert.equal(version, "web-4");
});

test("the text holds no control character but a newline, and stays under 2,800 characters", () => {
  assert.doesNotMatch(text, /[\u0000-\u0009\u000b-\u001f\u007f]/u);
  assert.ok(text.length > 0 && text.length <= 2800, `text is ${text.length} characters`);
});

test("it says the model operates a website on the person's behalf", () => {
  assert.match(text, /You operate a real website in the person's own browser/u);
  assert.match(text, /on their behalf/u);
});

test("it reads the page view's header lines and the terms the renderer prints", () => {
  for (const term of ["PAGE", "URL", "VIEW", "COVERING", "DIALOG", "field[search]", "covered-by", "placeholder", "marked", "selected", "pressed", "current", "- i/n", "--- below the fold ---"]) {
    assert.ok(text.includes(term), `missing ${term}`);
  }
});

test("site search is the site's own search field, and find_on_page reads only the current page", () => {
  assert.match(text, /use the site's own search/u);
  assert.match(text, /find_on_page searches only the page you are already on; it never searches the site/u);
});

// F34 (`run-muqiho5c-e830ce01`): told to close popups first, the model closed a
// popup that was not over Add to cart, called that the add to cart, and never
// pressed it. The press comes first; a refusal names the covering layer's closers.
test("a covered control is pressed first, and only a refusal's closeWith closes the layer over it, then the press is made again", () => {
  assert.match(text, /Press the control you want even when it is covered-by/u);
  assert.match(text, /refused target_covered, and its closeWith names that layer's own close controls -- press one, then make the same press again/u);
  assert.match(text, /never another popup's/u);
  assert.match(text, /Closing or declining a popup is never one of the acts you were asked for/u);
  assert.match(text, /consent banner may be accepted or dismissed/u);
  assert.doesNotMatch(text, /first close that popup/u);
});

// F37 (`run-muqk4u32-0b36e58f`): pressing a marked "Space Grey" un-chose it, and Add to cart's "Please select a Color." went unread.
test("an option already chosen is left alone, and a press's changes and messages are read", () => {
  assert.match(text, /An option already marked, selected or checked is chosen: leave it, as pressing it again can undo it/u);
  assert.match(text, /After a press, read what it changed and any message it shows/u);
});

// t252 (D8, run `run-murwcaj0-40e56557`): the model pressed Confirm on a row its
// own listing excluded, so the build itself accepted a request the Flow had to
// leave alone. Repetitive work is a loop over the rows a listing kept: one act
// on one kept row, or the act written without doing it, and values bound.
test("repetitive work is a loop over the rows a listing kept: act on one kept row or write the act, and bind values", () => {
  assert.match(text, /Repetitive work is a loop/u);
  assert.match(text, /list the items with a where that keeps only the ones to act on/u);
  assert.match(text, /act once on one item it kept, or write the act \(write true\) without doing it, then state repeat/u);
  assert.match(text, /never act on every item/u);
  assert.ok(text.includes('{"$input": name}'));
  assert.ok(text.includes('{"$row": field}'));
  assert.doesNotMatch(text, /do it to one item and state repeat/u);
});

test("money, delete and send or publish are asked of the person; no secrets; no robot checks", () => {
  assert.match(text, /spend money, delete something, or send or publish something are asked of the person first/u);
  assert.match(text, /Never type a password or other secret/u);
  assert.match(text, /Never solve a robot check \(CAPTCHA\)/u);
});

test("it asks for few decisions under a cost ceiling", () => {
  assert.match(text, /as few decisions as the task needs/u);
  assert.match(text, /small cost ceiling/u);
});

test("Core's own bind-time check accepts it unchanged", () => {
  assert.deepEqual(assertAutomationStudioLlmDomainSystemInstructions(WEB_LLM_SYSTEM_INSTRUCTIONS, "web"), { version, text });
});

test("the runtime this domain binds carries them, so Core places them in every request", () => {
  // No call is made: binding is all this asks of the gateway.
  const runtime = createWebAutomationLlmEvidenceRuntime({ sendCommand: async () => { throw new Error("not called"); } } as unknown as WebLlmEvidenceGateway);
  assert.equal(runtime.systemInstructions, WEB_LLM_SYSTEM_INSTRUCTIONS);
});
