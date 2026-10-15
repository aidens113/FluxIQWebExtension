// Coverage of supervisor-ending.ts and the ending the pacer settles on. t649 (A8 frozen pair 3,
// `run-mv9zn5ob-d929084d`, 00048): the failure toast read "Build failed: the supervisor ended it
// because it could not finish the Flow" with no reason, though the supervisor had said why.

import assert from "node:assert/strict";
import test from "node:test";

import type { ActivityDisplay, ClientGatewayActivity } from "../../../shared/activity/index";
import { ActivityPacer } from "../pacer";
import { SupervisorEnding } from "../supervisor-ending";
import { FakeClock } from "./fake-clock";

type Agent = NonNullable<ClientGatewayActivity["agent"]>;
const SUPERVISOR: Agent = { role: "supervisor" };
const BUILDER: Agent = { role: "builder", briefId: "brief-1", subflowName: "Add the item" };
const REASON = "The item can't be collected from this branch, so the task cannot be done.";
const ENDED = "Build failed: the supervisor ended it because it could not finish the Flow";

let sequence = 0;
function event(fields: Partial<ClientGatewayActivity> & Pick<ClientGatewayActivity, "phase" | "label">, id = "b1"): ClientGatewayActivity {
  sequence += 1;
  return { activityId: `build:${id}`, sequence, subject: { kind: "build", id, projectId: "p" }, at: "2026-10-15T20:40:00.000Z", ...fields };
}
const finishing = (agent: Agent, text: string, id?: string) =>
  event({ phase: "verifying", label: "Checking whether the Flow is finished", agent, detail: { kind: "thought", title: "Checking whether the Flow is finished", text, status: "succeeded" } }, id);
const deciding = (agent: Agent, title: string, text: string) => event({ phase: "thinking", label: title, agent, detail: { kind: "thought", title, text, status: "succeeded" } });
const ending = (title: string, id?: string) => event({ phase: "failed", label: title, detail: { kind: "step", title, status: "failed" }, final: true }, id);
/** The reason the ending gets from what was remembered, its own status sentence being its label. */
const why = (ends: SupervisorEnding, row: ClientGatewayActivity): string | undefined => ends.observe(row, () => row.label)?.reason;

test("the ending of a build its supervisor ended carries the reason the supervisor gave to finish", () => {
  const ends = new SupervisorEnding();
  assert.equal(ends.observe(finishing(SUPERVISOR, REASON), () => ""), undefined);
  assert.equal(why(ends, ending(ENDED)), REASON);
});

test("no reason for another ending, a builder's words, a later decision, a reason with an id, or another build", () => {
  const ends = new SupervisorEnding();
  ends.observe(finishing(SUPERVISOR, REASON), () => "");
  assert.equal(why(ends, ending("Build failed: it ran out of time")), undefined, "a time limit says its own why");

  ends.observe(finishing(BUILDER, "The part is built."), () => "");
  assert.equal(why(ends, ending(ENDED)), undefined, "a builder finishing its part is not the supervisor ending the build");

  ends.observe(finishing(SUPERVISOR, REASON), () => "");
  ends.observe(deciding(SUPERVISOR, "Sending a changed brief", "One more try at the item."), () => "");
  assert.equal(why(ends, ending(ENDED)), undefined, "a decision after the finishing one replaces it");

  ends.observe(finishing(SUPERVISOR, "Ended on core.submit_subflow"), () => "");
  assert.equal(why(ends, ending(ENDED)), undefined);

  ends.observe(finishing(SUPERVISOR, REASON, "other"), () => "");
  assert.equal(why(ends, ending(ENDED)), undefined, "the reason belongs to its own build");
});

test("the status a supervisor-ended build settles on says it ended, then why", () => {
  const clock = new FakeClock(1_000);
  const shown: ActivityDisplay[] = [];
  const pacer = new ActivityPacer({ clock, onChange: (display) => shown.push(display) });
  pacer.accept(event({ phase: "building", label: "Planning the work" }));
  pacer.accept(finishing(SUPERVISOR, REASON));
  pacer.accept(ending(ENDED));
  const settled = pacer.display();
  assert.deepEqual([settled?.headline, settled?.outcome], ["Build failed", "failed"]);
  assert.equal(settled?.detail, `${ENDED}. ${REASON}`);

  const plain = new ActivityPacer({ clock, onChange: () => undefined });
  plain.accept(event({ phase: "building", label: "Planning the work" }, "b2"));
  plain.accept(ending("Build failed: it ran out of time", "b2"));
  assert.equal(plain.display()?.detail, "Build failed: it ran out of time", "an ending with its own why is said as Core said it");
});

// Round 2 of t649: Core's row saying the supervisor's ending carries its screened reason and what is
// left (`service/project-build/run.ts`); the ending takes that row's words over the finishing decision.
test("Core's own ending row is the why, ahead of the finishing decision; without one, the decision is", () => {
  const coreRow = (text: string, id?: string) => event({ phase: "building", label: "The supervisor ended the build: it could not finish the Flow.", detail: { kind: "note", title: "The supervisor ended the build: it could not finish the Flow.", text, status: "failed" } }, id);
  const said = `${REASON} Nothing this build did is still on the target.`;
  const ends = new SupervisorEnding();
  ends.observe(finishing(SUPERVISOR, "A shorter reason."), () => "");
  ends.observe(coreRow(said), () => "");
  assert.equal(why(ends, ending(ENDED)), said);

  ends.observe(coreRow("Left: web.cart.line_1"), () => "");
  ends.observe(finishing(SUPERVISOR, REASON), () => "");
  assert.equal(why(ends, ending(ENDED)), REASON, "a row whose words carry an id is not said");
});

// Round 3 of t649: Core's last row says why itself (its failure's `endedBecause`, said by Core's
// `progress.ts`), its title cut at 160 characters and its text whole. The ending says Core's whole
// sentence, and adds nothing it already says.
test("a newer Core's last row says why itself: its whole sentence is said, and nothing twice", () => {
  const why = "the item can't be collected from this branch, so the task cannot be done, because the branch takes no orders for it today";
  const sentence = `${ENDED}: ${why}`;
  const cut = `${sentence.slice(0, 159)}…`;
  const last = event({ phase: "failed", label: cut, detail: { kind: "step", title: cut, status: "failed", text: `The supervisor ended it because it could not finish the Flow: ${why}.` }, final: true });
  const ends = new SupervisorEnding();
  ends.observe(event({ phase: "building", label: "The supervisor ended the build: it could not finish the Flow.", detail: { kind: "note", title: "The supervisor ended the build: it could not finish the Flow.", text: `${why.charAt(0).toUpperCase()}${why.slice(1)}. Nothing this build did is still on the target.`, status: "failed" } }), () => "");
  assert.deepEqual(ends.observe(last, () => cut), { sentence });

  const clock = new FakeClock(1_000);
  const pacer = new ActivityPacer({ clock, onChange: () => undefined });
  pacer.accept(event({ phase: "building", label: "Planning the work" }, "b3"));
  pacer.accept(event({ phase: "failed", label: `${ENDED}: the item can't be had`, detail: { kind: "step", title: `${ENDED}: the item can't be had`, status: "failed", text: "The supervisor ended it because it could not finish the Flow: the item can't be had." }, final: true }, "b3"));
  assert.equal(pacer.display()?.detail, `${ENDED}: the item can't be had`, "a title that is whole is said as it is");
});
