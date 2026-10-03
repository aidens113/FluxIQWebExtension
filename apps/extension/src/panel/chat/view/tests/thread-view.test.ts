// The message list is reconciled, not rebuilt: turns and step messages keep
// their elements across re-reads, the person's turn is a bubble and FluxIQ's
// is formatted, every step is its own message with its reason (no folds, no
// counts) and its action as a card, and a step message and its card are
// updated in place as the action ends.

import assert from "node:assert/strict";
import test from "node:test";
import type { ClientGatewayActivity } from "../../../../shared/activity/index";
import { parseThreadPage, type AskControlsContext, type CoreTurn } from "../../conversation";
import { buildChatStream } from "../../stream";
import { activityEvent, eventTime } from "../../tests/activity-fixture";
import { fake, withFakeDocument } from "../../tests/fake-dom";
import { createThreadView, type TurnControls } from "../thread-view";

const ASK: AskControlsContext = { answering: false, error: undefined, answer: () => undefined, openFluxIQ: () => document.createElement("span") };
const controls = (): TurnControls => ({ ask: ASK, state: "" });

function turn(turnId: string, author: string, text = turnId): CoreTurn {
  return { turnId, author, text, ask: null };
}

const QUOTE = "Clicking “Get a free quote”";
const WHY = "The quote form is behind this button, so I'm opening it.";
const thought = (sequence: number) => activityEvent(sequence, { phase: "exploring", detail: { kind: "thought", title: QUOTE, text: WHY, status: "succeeded" } });
const click = (sequence: number, status: "started" | "succeeded" | "failed") => activityEvent(sequence, { phase: "exploring", detail: { kind: "tool", title: QUOTE, ref: "core.run_node", status } });

test("the person's turn is a bubble; each step is FluxIQ's own message with its reason; the answer is formatted text", async () => {
  await withFakeDocument(() => {
    const view = createThreadView();
    const stream = buildChatStream([
      { turn: turn("t1", "person", "Get me a quote"), at: eventTime(0) },
      { turn: turn("t2", "automation", "Found it:\n- **Quote** for `$12`"), at: eventTime(5) }
    ], [thought(1), click(2, "started"), click(3, "succeeded")]);
    view.render(stream, null, controls);
    const list = fake(view.element);
    const [person, step, answer, live] = list.children;
    assert.equal(person!.getAttribute("data-author"), "person");
    assert.equal(person!.byClass("chat-bubble")[0]!.textContent, "Get me a quote");
    assert.equal(step!.getAttribute("data-kind"), "decision");
    assert.equal(step!.byClass("chat-step-title")[0]!.textContent, QUOTE);
    assert.equal(step!.byClass("chat-step-text")[0]!.textContent, ` — ${WHY}`);
    const card = step!.byClass("chat-card")[0]!;
    assert.equal(card.getAttribute("data-kind"), "click");
    assert.equal(card.byClass("chat-card-target")[0]!.textContent, "Get a free quote");
    assert.equal(card.byClass("chat-card-outcome")[0]!.hidden, false);
    assert.equal(card.byClass("chat-card-outcome")[0]!.textContent, "Done");
    assert.equal(answer!.getAttribute("data-author"), "fluxiq");
    assert.deepEqual(answer!.byClass("chat-answer")[0]!.children.map((node) => node.tagName), ["P", "UL"]);
    assert.equal(list.byClass("chat-work").length + list.byClass("chat-work-label").length, 0, "no fold, no count");
    assert.equal(live!.hidden, true, "no live line when nothing is working");
  });
});

test("an equal turn from a re-read keeps its element; a changed one keeps it too, with new words", async () => {
  await withFakeDocument(() => {
    const view = createThreadView();
    const render = (text: string) => view.render(buildChatStream([{ turn: turn("t1", "automation", text), at: eventTime(0) }], []), null, controls);
    render("Working on it");
    const first = fake(view.element).children[0]!;
    const words = first.byClass("chat-p")[0]!;
    render("Working on it");
    assert.equal(fake(view.element).children[0], first);
    assert.equal(first.byClass("chat-p")[0], words, "same words, same nodes");
    render("Done");
    assert.equal(fake(view.element).children[0], first);
    assert.equal(first.byClass("chat-p")[0]!.textContent, "Done");
  });
});

test("a step message and its card are the same elements from its decision to its outcome and after the answer arrives; nothing reorders", async () => {
  await withFakeDocument(() => {
    const view = createThreadView();
    const ask = { turn: turn("t1", "person"), at: eventTime(0) };
    const events: ClientGatewayActivity[] = [thought(1), click(2, "started")];
    const live = { headline: "Building your Flow", detail: "Thinking about the next step", step: "", waiting: false, action: "" };
    view.render(buildChatStream([ask], events), live, controls, "build-1");
    const list = fake(view.element);
    const step = list.children[1]!;
    const nodes = [step, ...step.descendants()];
    assert.equal(step.byClass("chat-card-outcome")[0]!.textContent, "Working on it");
    assert.equal(list.children[2]!.hidden, false, "the live line is last");

    events.push(click(3, "failed"));
    view.render(buildChatStream([ask], events), live, controls, "build-1");
    assert.equal(list.children[1], step);
    assert.deepEqual([step, ...step.descendants()], nodes, "updated in place, nothing remounted");
    assert.equal(step.byClass("chat-card")[0]!.getAttribute("data-state"), "failed");
    assert.equal(step.byClass("chat-card-outcome")[0]!.textContent, "Didn't work");

    view.render(buildChatStream([ask, { turn: turn("t2", "automation", "All done"), at: eventTime(4) }], events), null, controls);
    assert.deepEqual(list.children.slice(0, 3).map((child) => child.getAttribute("data-author") ?? child.getAttribute("data-kind")), ["person", "decision", "fluxiq"]);
    assert.equal(list.children[1], step, "the message stays once the work settled");
    assert.equal(list.children[3]!.hidden, true);
  });
});

// t195, `run-murdouox-c5294247` (09-failure-panel): a command's answer ended "FluxIQ attached something you can
// see in FluxIQ. Open FluxIQ", which named nothing. Every attachment Core writes today is its own record of the
// command it ran or will run, which the turn's words already say (Core's panel draws none), so no line is shown.
test("an answer carrying Core's record of the command it ran shows no attachment line", async () => {
  await withFakeDocument(() => {
    const page = parseThreadPage({
      conversation: { conversationId: "conv-1", projectId: "project-1", revision: 1 },
      turns: [{ turnId: "t1", author: "automation", text: "I could not build this Flow.", ask: null, attachment: { kind: "panel-capability-result", ref: "flow.createHere" } }],
      hasMore: false
    });
    assert.ok(page);
    const view = createThreadView();
    view.render(buildChatStream([{ turn: page.turns[0]!, at: eventTime(0) }], []), null, controls);
    const answer = fake(view.element).children[0]!;
    assert.equal(answer.byClass("chat-note").length, 0);
    assert.doesNotMatch(answer.textContent, /attached/u);
  });
});
