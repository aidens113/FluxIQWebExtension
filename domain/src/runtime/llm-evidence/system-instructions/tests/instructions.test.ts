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

// web-12 (t728): the sentences every domain shares moved to Core's task prose,
// which places each in the task kinds that act or write steps. Saying them here
// too would repeat them in every request.
test("the rules every domain shares are Core's now, and are not repeated here", () => {
  for (const moved of [
    /Written instructions define the automation/u,
    /recording/u,
    /Repetitive work is a loop/u,
    /never act on every item/u,
    /evidence of an item's type/u,
    /\{"\$input": name\}/u,
    /amend_draft repeat/u,
    /in a written Flow by its repeat lines/u,
    /Anything a person could do/u,
    /spend money, delete something, or send or publish something/u,
    /Never type a password or other secret/u,
    /Be efficient/u,
    /small cost ceiling/u
  ]) {
    assert.doesNotMatch(text, moved);
  }
});

test("it teaches no realistic fixture", () => {
  assert.doesNotMatch(text, /everything-store|crossborder-marketplace|social-network-feed|expectedDataset|recordingScript/u);
});

test("the version is one Core's seam accepts, and names the web-only text", () => {
  assert.match(version, /^[a-z0-9][a-z0-9._-]{0,63}$/u);
  assert.equal(version, "web-12");
});

// FluxIQ declines optional cookies by default (user, 2026-10-18): a consent
// banner is answered by declining them unless the instruction says otherwise.
test("a consent banner is answered by declining optional cookies unless the instruction says otherwise", () => {
  assert.match(text, /Decline optional cookies on a consent banner/u);
  assert.match(text, /consent banner unless told otherwise/u);
  assert.doesNotMatch(text, /may be accepted or dismissed/u);
});

test("the text holds no control character but a newline, and stays under 3,600 characters", () => {
  assert.doesNotMatch(text, /[\u0000-\u0009\u000b-\u001f\u007f]/u);
  assert.ok(text.length > 0 && text.length <= 3600, `text is ${text.length} characters`);
});

test("it says the model operates a website on the person's behalf", () => {
  assert.match(text, /You operate a real website in the person's own browser/u);
  assert.match(text, /on their behalf/u);
});

test("it reads the page view's header lines and the terms the renderer prints", () => {
  for (const term of ["PAGE", "URL", "VIEW", "COVERING", "DIALOG", "field[search]", "covered-by", "group=", "placeholder", "marked", "selected", "pressed", "current", "- i/n", "--- below the fold ---"]) {
    assert.ok(text.includes(term), `missing ${term}`);
  }
});

test("site search is the site's own search field, and find_on_page reads only the current page", () => {
  assert.match(text, /use the site's own search/u);
  assert.match(text, /find_on_page searches only the page you are already on; it never searches the site/u);
});

// F34 (`run-muqiho5c-e830ce01`): told to close popups first, the model closed a
// popup that was not over Add to cart, called that the add to cart, and never
// pressed it. The press comes first. `run-mvcxf4uz-64cd322c`: told to press a
// refusal's closer and press again, the model pressed the covered control over
// and over; the runtime now closes a layer it can dismiss itself, and only a
// refusal with closeWith asks the model for a closer.
test("a covered control is pressed first, the runtime closes a layer it can dismiss, and only a refusal's closeWith asks for a closer", () => {
  assert.match(text, /Press the control you want even when it is covered-by/u);
  assert.match(text, /a layer that can be dismissed is closed by the runtime first, and the press's read names it/u);
  assert.match(text, /Only a refusal with closeWith needs a closer from you: press one, then make the same press again/u);
  assert.doesNotMatch(text, /a press a layer would take is refused target_covered/u);
  assert.match(text, /never another popup's/u);
  assert.match(text, /Closing or declining a popup is never one of the acts you were asked for/u);
  assert.doesNotMatch(text, /first close that popup/u);
});

// F37 (`run-muqk4u32-0b36e58f`): pressing a marked "Space Grey" un-chose it, and Add to cart's "Please select a Color." went unread.
test("an option already chosen is left alone, and a press's changes and messages are read", () => {
  assert.match(text, /An option already marked, selected or checked is chosen: leave it, as pressing it again can undo it/u);
  assert.match(text, /After a press, read what it changed and any message it shows/u);
});

// S4 of the read-list redesign (web-5): a read reads one page, and a step
// that reads no longer goes through pages by itself. Every page is a loop the
// Flow states: the read, Next page on the same list, and a repeat on the read
// through Next page while it succeeds, which ends when the list does.
test("every page of a list is a loop: read, Next page on the same list, and repeat through Next page while it succeeds", () => {
  const lists = text.split("\n").find((line) => line.startsWith("Lists."));
  assert.ok(lists, "the Lists line is there");
  assert.ok(lists.includes("Every page of a list is a loop the Flow states: read the list, then Next page on the same list, then repeat the read through Next page while it succeeds (most N for 'the first N pages'), each row kept once"));
  assert.match(lists, /^Lists\. Every page of a list is a loop/u);
  assert.doesNotMatch(text, /paginate/u);
});

// web-6 (lane C, `run-mv0pa79q-ef91811b`): a candidate-mode model read all five
// result pages before writing its Flow and ran out of budget. One page read plus
// one Next page is enough evidence while exploring. How a draft or a written
// Flow states the repeat is Core's sentence since web-12.
test("exploring a paged list reads one page and one Next page", () => {
  const lists = text.split("\n").find((line) => line.startsWith("Lists."));
  assert.ok(lists, "the Lists line is there");
  assert.ok(lists.includes("Exploring needs one page read and one Next page to know the loop works"));
  assert.ok(lists.includes("the loop reads the other pages when the Flow runs, so do not read every page while exploring"));
});

test("a robot check is never solved, and the model says that one blocks it", () => {
  assert.match(text, /Never solve a robot check \(CAPTCHA\); say that one blocks you/u);
});

test("Core's own bind-time check accepts it unchanged", () => {
  assert.deepEqual(assertAutomationStudioLlmDomainSystemInstructions(WEB_LLM_SYSTEM_INSTRUCTIONS, "web"), { version, text });
});

test("the runtime this domain binds carries them, so Core places them in every request", () => {
  // No call is made: binding is all this asks of the gateway.
  const runtime = createWebAutomationLlmEvidenceRuntime({ sendCommand: async () => { throw new Error("not called"); } } as unknown as WebLlmEvidenceGateway);
  assert.equal(runtime.systemInstructions, WEB_LLM_SYSTEM_INSTRUCTIONS);
});
