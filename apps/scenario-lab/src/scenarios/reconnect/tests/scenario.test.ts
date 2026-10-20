import assert from "node:assert/strict";
import test from "node:test";
import { reconnectScenario as scenario } from "../scenario.js";

const context = { runToken: "reconnect-unit-token", seed: 109 };

test("disconnect, queue and reconnect record the events in order and end connected with the queued event replayed", () => {
  const seeded = scenario.createState(109);
  assert.deepEqual(seeded, { connected: true, sequence: 10_900, events: [] });
  const disconnected = scenario.mutate(seeded, "disconnect", {});
  assert.deepEqual(disconnected, { connected: false, sequence: 10_901, events: ["disconnect"] });
  const queued = scenario.mutate(disconnected, "queue", {});
  assert.equal(queued.connected, false, "queuing does not reconnect");
  const reconnected = scenario.mutate(queued, "reconnect", {});
  assert.deepEqual(reconnected, { connected: true, sequence: 10_903, events: ["disconnect", "queued", "reconnect", "replayed"] });
  assert.equal(scenario.mutate(reconnected, "unknown", {}), reconnected);
  assert.deepEqual(seeded, scenario.createState(109), "mutate must not modify its input");
});

test("the page offers one button per recorded step, named as the recording targets them, each bound to its operation", () => {
  const html = scenario.render(scenario.createState(109), context);
  const targets = scenario.manifest.recordingScript.filter(({ operation }) => operation === "click").map(({ target }) => target);
  assert.deepEqual(targets, ["role:button[name=Disconnect]", "role:button[name=Queue event]", "role:button[name=Reconnect]"]);
  for (const [operation, name] of [["disconnect", "Disconnect"], ["queue", "Queue event"], ["reconnect", "Reconnect"]]) {
    assert.ok(html.includes(`<button data-op="${operation}">${name}</button>`), operation);
  }
  assert.match(html, /<ol data-testid="events"><\/ol>/u);
});
