// Coverage of unit-history.ts: which events tell a unit's story, the order
// they are kept in, and the two bounds -- events per unit (the newest kept)
// and units (the one heard from longest ago dropped first).

import assert from "node:assert/strict";
import test from "node:test";

import type { ClientGatewayActivity } from "../../../shared/activity/index";
import { UnitHistory } from "../unit-history";

type Detail = NonNullable<ClientGatewayActivity["detail"]>;

let sequence = 0;
function event(unit: string, detail?: Detail, fields: Partial<ClientGatewayActivity> = {}): ClientGatewayActivity {
  sequence += 1;
  return {
    activityId: `build:${unit}`,
    sequence,
    subject: { kind: "build", id: unit, projectId: "p" },
    phase: "exploring",
    label: "Working",
    at: "2026-09-30T12:00:00.000Z",
    ...(detail === undefined ? {} : { detail }),
    ...fields
  };
}

const titles = (history: UnitHistory) => history.events().map((kept) => kept.detail?.title ?? `(${kept.phase})`);

test("a unit's story: explained decisions, actions, checks, repairs, steps and its end; not status changes, unexplained decisions or bookkeeping", () => {
  const history = new UnitHistory();
  const kept = [
    history.accept(event("b", undefined)),
    history.accept(event("b", { kind: "thought", title: "Deciding the next step", status: "started" })),
    history.accept(event("b", { kind: "thought", title: "Clicking “Get a quote”", text: "The form is behind it.", status: "succeeded" })),
    history.accept(event("b", { kind: "tool", title: "Clicking “Get a quote”", ref: "core.run_node", status: "started" })),
    history.accept(event("b", { kind: "tool", title: "Using core.state_digest", ref: "core.state_digest", status: "succeeded" })),
    history.accept(event("b", { kind: "tool", title: "Clicking “Get a quote”", ref: "core.run_node", status: "succeeded" })),
    history.accept(event("b", { kind: "thought", title: "Fixing the click", text: "The button moved.", status: "succeeded" }, { phase: "repairing" })),
    history.accept(event("b", { kind: "check", title: "Completion check", text: "The quote form is open.", status: "succeeded" }, { phase: "verifying" })),
    history.accept(event("b", undefined, { phase: "done", final: true }))
  ];
  assert.deepEqual(kept, [false, false, true, true, false, true, true, true, true]);
  assert.deepEqual(titles(history), ["Clicking “Get a quote”", "Clicking “Get a quote”", "Clicking “Get a quote”", "Fixing the click", "Completion check", "(done)"]);
});

test("each unit keeps at most its newest events, and events stay in the order they came, across units", () => {
  const history = new UnitHistory({ units: 5, eventsPerUnit: 3 });
  for (let index = 1; index <= 5; index += 1) history.accept(event("a", { kind: "note", title: `a${index}` }));
  history.accept(event("r", { kind: "note", title: "r1" }));
  history.accept(event("a", { kind: "note", title: "a6" }));
  assert.deepEqual(titles(history), ["a4", "a5", "r1", "a6"]);
});

test("past the unit bound, the unit heard from longest ago goes first", () => {
  const history = new UnitHistory({ units: 2, eventsPerUnit: 10 });
  history.accept(event("one", { kind: "note", title: "one" }));
  history.accept(event("two", { kind: "note", title: "two" }));
  history.accept(event("one", { kind: "note", title: "one again" }));
  history.accept(event("three", { kind: "note", title: "three" }));
  assert.deepEqual(titles(history), ["one", "one again", "three"]);
  const copy = history.events();
  copy.pop();
  assert.equal(history.events().length, 3, "the caller's copy is its own");
});

// A model provider outage, as Core now tells it (live run `run-muq05kas-058193f0`):
// each unanswered request is said in words, and the build's own ending closes
// the story with Core's message. The bare "Deciding the next step" rows never show.
test("a provider outage: each unanswered request and the build's stop are in the story, the bare decision rows are not", () => {
  const history = new UnitHistory();
  const unanswered = { kind: "thought" as const, title: "Deciding the next step", status: "failed" as const, text: "The AI model provider did not answer this request. Asking it again; the build stops if it keeps not answering." };
  const kept = [
    history.accept(event("o", { kind: "thought", title: "Deciding the next step", status: "started" }, { phase: "thinking" })),
    history.accept(event("o", unanswered, { phase: "thinking", label: "The AI model provider did not answer" })),
    history.accept(event("o", { kind: "thought", title: "Deciding the next step", status: "started" }, { phase: "thinking" })),
    history.accept(event("o", unanswered, { phase: "thinking", label: "The AI model provider did not answer" })),
    history.accept(event("o", { kind: "step", title: "Build stopped: the AI model provider is not responding", status: "failed", text: "The build stopped because the AI model provider is not responding: 3 requests in a row got no answer." }, { phase: "failed", final: true }))
  ];
  assert.deepEqual(kept, [false, true, false, true, true]);
  assert.equal(history.events().at(-1)?.detail?.text, "The build stopped because the AI model provider is not responding: 3 requests in a row got no answer.");
});

test("what the person asked the work is kept, though it is no row: the chat shows it as their message", () => {
  const history = new UnitHistory();
  assert.equal(history.accept(event("q", undefined, { phase: "building", label: "Building the Flow", request: "Switch my store to Millbrook." })), true);
  assert.equal(history.accept(event("q", undefined, { phase: "building", label: "Building the Flow", request: "   " })), false);
});
