// The message list is reconciled, not rebuilt: turns keep their elements
// across re-reads, the person's turn is a bubble and FluxIQ's is formatted,
// and a fold the person opened stays the same open element when it moves
// from the live line to the turn that answered.

import assert from "node:assert/strict";
import test from "node:test";
import type { AskControlsContext, CoreTurn } from "../../conversation";
import { buildChatStream, buildChatThread } from "../../stream";
import { activityEvent, eventTime } from "../../tests/activity-fixture";
import { fake, withFakeDocument } from "../../tests/fake-dom";
import { createThreadView, type TurnControls } from "../thread-view";

const ASK: AskControlsContext = { answering: false, error: undefined, answer: () => undefined, openFluxIQ: () => document.createElement("span") };
const controls = (): TurnControls => ({ ask: ASK, state: "" });

function turn(turnId: string, author: string, text = turnId): CoreTurn {
  return { turnId, author, text, ask: null, attachment: false };
}

const LIVE = { headline: "Building your Flow", detail: "Reading the page", step: "" };

test("the person's turn is a bubble; FluxIQ's is formatted text with its work folded above", async () => {
  await withFakeDocument(() => {
    const view = createThreadView(() => undefined);
    const recent = [activityEvent(1, { detail: { kind: "tool", title: "Read the page", ref: "web.dom.extract", status: "succeeded" } })];
    const items = buildChatStream([
      { turn: turn("t1", "person", "Find the cheapest lamp"), at: eventTime(0) },
      { turn: turn("t2", "automation", "Found it:\n- **Lamp** for `$12`"), at: eventTime(5) }
    ], recent);
    view.render(buildChatThread(items, false), null, controls);
    const list = fake(view.element);
    const [person, answer, live] = list.children;
    assert.equal(person!.getAttribute("data-author"), "person");
    assert.equal(person!.byClass("chat-bubble")[0]!.textContent, "Find the cheapest lamp");
    assert.equal(answer!.getAttribute("data-author"), "fluxiq");
    assert.deepEqual(answer!.byClass("chat-answer")[0]!.children.map((node) => node.tagName), ["P", "UL"]);
    assert.equal(answer!.byClass("chat-work-label")[0]!.textContent, "Worked for 1s · 1 step");
    assert.equal(answer!.byClass("chat-step-title")[0]!.textContent, "Read the page");
    assert.equal(answer!.byClass("chat-step-ref").length, 0, "no tool id is shown");
    assert.equal(live!.hidden, true, "no live line when nothing is working");
  });
});

test("an equal turn from a re-read keeps its element; a changed one keeps it too, with new words", async () => {
  await withFakeDocument(() => {
    const view = createThreadView(() => undefined);
    const render = (text: string) => view.render(buildChatThread(buildChatStream([{ turn: turn("t1", "automation", text), at: eventTime(0) }], []), false), null, controls);
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

test("an opened fold under the live line is the same open element under the turn that answered", async () => {
  await withFakeDocument(() => {
    const view = createThreadView(() => undefined);
    const recent = [
      activityEvent(1, { detail: { kind: "tool", title: "Open page", ref: "a", status: "succeeded" } }),
      activityEvent(2, { detail: { kind: "tool", title: "Click", ref: "b", status: "started" } })
    ];
    const ask = { turn: turn("t1", "person"), at: eventTime(0) };
    view.render(buildChatThread(buildChatStream([ask], recent), true), LIVE, controls);
    const list = fake(view.element);
    const live = list.children[list.children.length - 1]!;
    const fold = live.byClass("chat-work")[0]!;
    assert.equal(live.hidden, false);
    assert.equal(fold.byClass("chat-work-label")[0]!.textContent, "2 steps so far");
    fold.open = true;

    view.render(buildChatThread(buildChatStream([ask, { turn: turn("t2", "automation", "All done"), at: eventTime(3) }], recent), false), null, controls);
    const answer = list.children[1]!;
    assert.equal(answer.byClass("chat-work")[0], fold);
    assert.equal(fold.open, true);
    assert.equal(fold.byClass("chat-work-label")[0]!.textContent, "Worked for 1s · 2 steps");
    assert.equal(list.children[list.children.length - 1]!.hidden, true);
    assert.equal(list.children.length, 3);
  });
});
