import assert from "node:assert/strict";
import test from "node:test";
import { playPersonCheck, type PlayPersonCheckInput } from "../play-person-check.js";
import { CLICKED_CHECK, FakeTab, TYPED_CHECK, virtualClock } from "./fake-person.js";

function play(tabs: FakeTab[], overrides: Partial<PlayPersonCheckInput> = {}) {
  const clock = virtualClock();
  return { clock, result: playPersonCheck({ module: TYPED_CHECK, tabs: () => tabs, person: "completes", readState: async () => ({ image: 0, wrong: 0 }), now: clock.now, sleep: clock.sleep, ...overrides }) };
}

test("the person types what the check shows, presses the button, and sees the check go with the reload", async () => {
  const blank = new FakeTab([]);
  const store = new FakeTab(["Enter the characters you see below"], (step, tab) => { if (step === "press Continue shopping") tab.load(["Brightaisle"]); });
  const { result } = play([blank, store]);
  assert.deepEqual(await result, { check: "type-the-characters", did: "cleared", cleared: true, note: null });
  assert.deepEqual(store.done, ["front", "type Type characters=CODE-0", "press Continue shopping", "settle"]);
  assert.deepEqual(blank.done, [], "a tab not showing the check is never touched");
});

test("a box that goes before its page reloads is not cleared until the reload has happened", async () => {
  const screen = new FakeTab(["I'm not a robot"], (step, tab) => { if (step.startsWith("click")) tab.showing = ["Checking your browser…"]; });
  const { clock, result } = play([screen], { module: CLICKED_CHECK });
  clock.onTick((at) => { if (at >= 2_300 && screen.loadCount === 0) screen.load(["results for usb c hub"]); });
  assert.equal((await result).did, "cleared");
  assert.ok(clock.at() >= 2_300, `answered at ${clock.at()} ms, before the page had reloaded`);
});

test("a check that never goes is reported, not answered as cleared", async () => {
  const screen = new FakeTab(["I'm not a robot"], (step, tab) => { if (step.startsWith("click")) tab.showing = ["Checking your browser…"]; });
  const played = await play([screen], { module: CLICKED_CHECK }).result;
  assert.deepEqual([played.did, played.cleared], ["could-not-clear", false]);
  assert.equal(played.note, "the check still showed 10000 ms after the person was done");
});

test("no check on any tab is reported after looking, and nothing is touched", async () => {
  const tab = new FakeTab(["Brightaisle"]);
  const { clock, result } = play([tab]);
  assert.deepEqual(await result, { check: null, did: "no-check-visible", cleared: false, note: "no tab of the scenario showed a check the Lab knows" });
  assert.ok(clock.at() >= 8_000, "the person looked for the check's whole drawing time");
  assert.deepEqual(tab.done, []);
});

test("a check drawn a moment after the ask is still found, as company-website's is", async () => {
  const tab = new FakeTab(["Checking you are human…"], (step, page) => { if (step.startsWith("click")) page.load(["Quote received"]); });
  const module = { ...CLICKED_CHECK, checks: [{ ...CLICKED_CHECK.checks[0]!, shows: "Confirm you are human", steps: [{ action: "click" as const, text: "Confirm you are human" }] }] };
  const { clock, result } = play([tab], { module });
  clock.onTick((at) => { if (at >= 2_200 && tab.showing[0] === "Checking you are human…") tab.showing = ["Confirm you are human"]; });
  assert.equal((await result).did, "cleared");
});

test("a declining person, a check the automation already touched, and a scenario with no module are all declined untouched", async () => {
  const check = () => new FakeTab(["Enter the characters you see below"]);
  const declined = check();
  assert.equal((await play([declined], { person: "declines" }).result).did, "declined");
  const tampered = check();
  assert.deepEqual(await play([tampered], { readState: async () => ({ image: 1, wrong: 1 }) }).result, { check: "type-the-characters", did: "declined-tampered", cleared: false, note: "a guess was typed" });
  assert.equal((await play([check()], { module: null }).result).did, "failed");
  assert.deepEqual([...declined.done, ...tampered.done], []);
});

test("a step the page refuses is reported by its first line only, never the markup Playwright quotes after it", async () => {
  const tab = new FakeTab(["Enter the characters you see below"], () => undefined, "press");
  const played = await play([tab]).result;
  assert.equal(played.did, "failed");
  assert.equal(played.note, "a step of the check could not be done: locator failed: press Continue shopping");
  const unreadable = await play([new FakeTab(["Enter the characters you see below"])], { readState: async () => { throw new Error("The Scenario Lab has no state for the scenario (404)"); } }).result;
  assert.match(unreadable.note ?? "", /could not be read for the check: The Scenario Lab has no state/u);
});
