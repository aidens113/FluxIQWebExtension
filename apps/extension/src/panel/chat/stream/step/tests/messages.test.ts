// Which events become FluxIQ's step messages, and what each says: every
// explained decision is a message with its reason, the action after it is
// that message's outcome, checks and repairs are messages, a decision still
// being made and Core's bookkeeping are not, a message is keyed by the event
// that opened it and updated in place, and no raw id is ever shown.

import assert from "node:assert/strict";
import test from "node:test";
import type { ClientGatewayActivity } from "../../../../../shared/activity/index";
import { activityEvent, eventTime } from "../../../tests/activity-fixture";
import { stepMessages, type StepMessage } from "../messages";

type Detail = NonNullable<ClientGatewayActivity["detail"]>;

const decide = (sequence: number) => activityEvent(sequence, { phase: "thinking", detail: { kind: "thought", title: "Deciding the next step", status: "started" } });
const thought = (sequence: number, title: string, text: string, phase: ClientGatewayActivity["phase"] = "exploring") =>
  activityEvent(sequence, { phase, label: title, detail: { kind: "thought", title, text, status: "succeeded" } });
const tool = (sequence: number, title: string, status: Detail["status"], fields: Partial<Detail> = {}) =>
  activityEvent(sequence, { phase: "exploring", detail: { kind: "tool", title, ref: "core.run_node", ...(status === undefined ? {} : { status }), ...fields } });

const QUOTE = "Clicking “Get a free quote”";

function said(messages: StepMessage[]): Array<[string, string | undefined, string | null]> {
  return messages.map((message) => [message.title, message.text, message.outcome === null ? null : message.outcome.status]);
}

test("each explained decision is one message with its reason; the action after it is its outcome", () => {
  const events = [
    activityEvent(1, { detail: { kind: "step", title: "Build started", status: "started" } }),
    decide(2),
    thought(3, QUOTE, "The quote form is behind this button, so I'm opening it."),
    tool(4, QUOTE, "started"),
    tool(5, QUOTE, "succeeded", { text: "Result: web.click.succeeded" }),
    decide(6),
    thought(7, "Typing the postcode", "The form asks where the job is.", "building"),
    tool(8, "Typing the postcode", "failed", { text: "The field was covered by a banner." })
  ];
  const messages = stepMessages(events, 100);
  assert.deepEqual(said(messages), [
    [QUOTE, "The quote form is behind this button, so I'm opening it.", "succeeded"],
    ["Typing the postcode", "The form asks where the job is.", "failed"]
  ]);
  assert.deepEqual(messages.map((message) => message.kind), ["decision", "decision"]);
  assert.equal(messages[0]!.outcome?.text, undefined, "a result code is not words");
  assert.equal(messages[1]!.outcome?.text, "The field was covered by a banner.");
  assert.deepEqual(messages.map((message) => message.key), ["step:build-1#3", "step:build-1#7"]);
  assert.deepEqual(messages.map((message) => message.latest), [false, true]);
});

test("a decision still being made, a pure status change, a build's start and finish, and bookkeeping are not messages", () => {
  const events = [
    activityEvent(1, { detail: { kind: "step", title: "Build started", status: "started" } }),
    decide(2),
    activityEvent(3),
    activityEvent(4, { detail: { kind: "tool", title: "Using core.state_digest", ref: "core.state_digest", status: "succeeded" } }),
    activityEvent(5, { detail: { kind: "check", title: "Answer check before repeating a look", status: "succeeded" } }),
    activityEvent(6, { detail: { kind: "thought", title: "Deciding the next step", status: "succeeded" } }),
    activityEvent(7, { phase: "done", final: true, detail: { kind: "step", title: "Build finished", status: "succeeded" } })
  ];
  assert.deepEqual(stepMessages(events, 100), []);
});

test("checks and repairs are messages with their verdict and diagnosis; a check that started is updated in place", () => {
  const events = [
    thought(1, "Fixing the search click", "The button moved after the banner closed.", "repairing"),
    activityEvent(2, { phase: "verifying", detail: { kind: "check", title: "Completion check", status: "started" } }),
    activityEvent(3, { phase: "verifying", detail: { kind: "check", title: "Completion check", text: "The quote form is open with the postcode filled.", status: "succeeded" } }),
    activityEvent(4, { phase: "verifying", detail: { kind: "check", title: "Completion check", text: "No price was shown.", status: "failed" } }),
    activityEvent(5, { phase: "failed", final: true, detail: { kind: "step", title: "Build failed", status: "failed" } })
  ];
  const messages = stepMessages(events, 100);
  assert.deepEqual(messages.map((message) => [message.kind, message.title, message.text]), [
    ["repair", "Fixing the search click", "The button moved after the banner closed."],
    ["check", "Checked the result", "The quote form is open with the postcode filled."],
    ["check", "The result didn't pass its check", "No price was shown."],
    ["step", "The build failed", undefined]
  ]);
  assert.equal(messages[1]!.key, "step:build-1#2", "the check keeps the key of the event that opened it");
  assert.equal(messages[1]!.sequence, 3);
});

test("an action with no decision before it is its own message, in words; a second action is not folded into the first decision", () => {
  const events = [
    tool(1, "Using core.run_node", "started"),
    tool(2, "Using core.run_node", "succeeded", { text: "Result: web.click.succeeded" }),
    thought(3, "Opening the results", "The list is on the next page."),
    activityEvent(4, { phase: "exploring", detail: { kind: "tool", title: "Opening the results", ref: "web.navigate", status: "succeeded" } }),
    activityEvent(5, { phase: "exploring", detail: { kind: "tool", title: "Using web.inspect_current_page", ref: "web.inspect_current_page", status: "succeeded" } })
  ];
  const messages = stepMessages(events, 100);
  assert.deepEqual(said(messages), [
    ["Clicked on the page", undefined, "succeeded"],
    ["Opening the results", "The list is on the next page.", "succeeded"],
    ["Looked at the page", undefined, "succeeded"]
  ]);
  assert.deepEqual(messages.map((message) => message.kind), ["action", "decision", "action"]);
  for (const message of messages) assert.doesNotMatch(`${message.title} ${message.text ?? ""}`, /\b[a-z]+\.[a-z_]+/u, "no raw id");
});

test("a run's steps are messages; one Core started is over once anything after it happened", () => {
  const run = (sequence: number, index: number, label: string) => activityEvent(sequence, {
    activityId: "run:r1",
    subject: { kind: "run", id: "r1", projectId: "p" },
    phase: "running",
    step: { index, count: 3, label },
    detail: { kind: "step", title: label, status: "started" }
  });
  const messages = stepMessages([run(1, 1, "Open the shop"), run(2, 2, "Search for lamps")], 100);
  assert.deepEqual(said(messages), [["Step 1: Open the shop", undefined, "succeeded"], ["Step 2: Search for lamps", undefined, "started"]]);
});

test("units of work never share a message, and at most the limit are kept, the newest", () => {
  const events = [
    thought(1, "Clicking Search", "It runs the search."),
    tool(2, "Clicking Search", "started"),
    activityEvent(3, { activityId: "run:r9", detail: { kind: "tool", title: "Clicking Search", ref: "core.run_node", status: "succeeded" } }),
    tool(4, "Clicking Search", "succeeded")
  ];
  const messages = stepMessages(events, 100);
  assert.deepEqual(messages.map((message) => [message.key, message.outcome?.status]), [["step:build-1#1", "succeeded"], ["step:run:r9#3", "succeeded"]]);
  const many = Array.from({ length: 30 }, (_, index) => thought(index + 1, `Step ${index + 1}`, "Because."));
  assert.deepEqual(stepMessages(many, 2).map((message) => message.key), ["step:build-1#29", "step:build-1#30"]);
  assert.deepEqual(stepMessages(many, 0), []);
});

test("messages keep their keys and order as events arrive; an unreadable time takes the one before", () => {
  const events = [thought(1, "Looking for the form", "It should be on the home page.")];
  const first = stepMessages(events, 100);
  events.push(tool(2, "Looking for the form", "started"), activityEvent(3, { at: "not a time", phase: "exploring", detail: { kind: "note", title: "Found the form" } }));
  const later = stepMessages(events, 100);
  assert.equal(later[0]!.key, first[0]!.key);
  assert.equal(later[0]!.at, first[0]!.at);
  assert.equal(later[1]!.at, eventTime(2), "the time of the event before it");
  assert.deepEqual(later.map((message) => message.title), ["Looking for the form", "Found the form"]);
});
