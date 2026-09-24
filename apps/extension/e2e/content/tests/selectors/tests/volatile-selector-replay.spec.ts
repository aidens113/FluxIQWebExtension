// A Flow must not be written down against an identifier the page will draw
// again, and one that already was must still be resolvable.
//
// The everything store renders its ids the way a component framework does --
// `:r13b8o:`, seeded from the build (`scenarios/everything-store/style/
// element-ids.ts`) exactly as React's `useId` seeds one from a render counter
// -- so opening the same fixture under two lab seeds is the same page rendered
// twice with different generated ids, which is what the rule has to survive.
// The fixture is not touched by this spec; the seed is the whole of the
// difference.
//
// The control is the notifications modal's "Not now" button, because that is
// the control the failure was found on. On 2026-09-23 a built Flow carried
//
//     #\:r13b8o\: > div > div:nth-of-type(2) > button:nth-of-type(1)
//
// for it (`test-runs/run-muesyox4-930bef98`, `snapshots/flow-lane.json`). The
// button has no id, no test id and no name of its own, so the selector was hung
// on the nearest ancestor that had one -- the modal's scrim, whose id the store
// had generated. That address names nothing on any other rendering of its own
// page, so the Flow was unreplayable the moment it was written.
//
// Three properties, in the order they matter:
//
//  1. the selector authored for that button quotes no generated token, and
//     names the same button the old address named on the rendering it was
//     written on -- the fix loses nothing where the old one worked;
//  2. on a re-rendered page the old address matches nothing and the authored
//     one matches the button, and a replayed click acts on it;
//  3. a Flow that already carries the old address is still resolved, and is
//     scored on what still means something: a regenerated token is set aside
//     rather than read as the page naming a different control. Measured against
//     the same recording with an authored-looking token in its place, which
//     Core does weigh -- and which scores materially lower on the same page,
//     against the same candidates, for no other reason.
//
// What it does not prove: anything about a page whose structure changed as well
// as its ids. A structural path is what is left once a generated anchor is
// refused, and it is weaker than a real id -- which is why property 3 exists.

import { expect, test } from "../../../index.js";
import type { ContentHarness } from "../../../index.js";
import { describe, recordedElement, type Descriptor } from "../../identity-fixtures.js";

/** The lab seeds this spec renders the store under: the failing run's, and another. */
const RECORDED_SEED = 241;
const REPLAYED_SEED = 977;

/** The store's notifications modal, which opens four seconds after each page load. */
const MODAL = '[role="dialog"][aria-modal="true"]';
const MODAL_OPENS_MS = 15_000;

/** React's `useId` shape, which is the store's too. A selector must never quote one. */
const GENERATED_TOKEN = /:r[0-9a-z]*:/iu;

/** Waits for the notifications prompt and answers with the id its scrim was given. */
async function openNotifications(harness: ContentHarness): Promise<string> {
  await expect
    .poll(async () => await harness.page.evaluate((modal) => document.querySelector(modal) !== null, MODAL), { timeout: MODAL_OPENS_MS })
    .toBe(true);
  const scrimId = await harness.page.evaluate((modal) => document.querySelector(modal)?.parentElement?.id ?? "", MODAL);
  expect(scrimId, "the store gives its modal scrim a generated id").toMatch(GENERATED_TOKEN);
  return scrimId;
}

/** The address a Flow built before this rule carried: the scrim's generated id, then four structural steps. */
async function generatedAddress(harness: ContentHarness, scrimId: string): Promise<string> {
  const escaped = await harness.page.evaluate((id) => CSS.escape(id), scrimId);
  return `#${escaped} > div > div:nth-of-type(2) > button:nth-of-type(1)`;
}

/** How many elements a selector matches in the page, and the text of the one that does. */
async function matched(harness: ContentHarness, selector: string): Promise<{ count: number; text: string | null }> {
  return await harness.page.evaluate((value) => {
    let matches: Element[] = [];
    try { matches = [...document.querySelectorAll(value)]; } catch { matches = []; }
    return { count: matches.length, text: matches.length === 1 ? (matches[0]?.textContent ?? "") : null };
  }, selector);
}

test("the button under a generated id is authored without it, and the address still names that button", async ({ openHarness }) => {
  const harness = await openHarness("everything-store", { seed: RECORDED_SEED });
  // The store opens this modal four seconds after each page load, so the page
  // holds one set of buttons before it and another after. The failing run's
  // first two attempts fell in the first window and its failure counted "6
  // control(s) of the same family"; the counts below are what that number was.
  const beforeModal = await harness.page.evaluate(() => document.querySelectorAll("button").length);
  const scrimId = await openNotifications(harness);
  const afterModal = await harness.page.evaluate(() => document.querySelectorAll("button").length);
  const oldAddress = await generatedAddress(harness, scrimId);

  const recorded = await describe(harness, oldAddress);
  expect(recorded.text, "the old address names the modal's first button").toBe("Not now");

  expect(recorded.selector, "the authored selector quotes no generated token").not.toMatch(GENERATED_TOKEN);
  expect(recorded.selector).not.toContain(scrimId);
  expect(recorded.xpath ?? "", "nor does the xpath anchor on one").not.toMatch(GENERATED_TOKEN);

  const authored = await matched(harness, recorded.selector);
  expect(authored.count, "and it names exactly one element on the rendering it was written on").toBe(1);
  expect(authored.text, "which is the button the old address named").toBe("Not now");

  test.info().annotations.push({
    type: "measurement",
    description: `seed ${RECORDED_SEED}: scrim ${scrimId}; authored ${recorded.selector}; was ${oldAddress}; ` +
      `buttons on the page before the modal ${beforeModal}, after it ${afterModal}`
  });
});

test("after the page re-renders with different generated ids, the old address is dead and the authored one replays", async ({ openHarness }) => {
  const recording = await openHarness("everything-store", { seed: RECORDED_SEED });
  const recordedScrim = await openNotifications(recording);
  const oldAddress = await generatedAddress(recording, recordedScrim);
  const recorded = await describe(recording, oldAddress);

  const replay = await openHarness("everything-store", { seed: REPLAYED_SEED });
  const replayedScrim = await openNotifications(replay);
  expect(replayedScrim, "the re-rendered page drew a different token").not.toBe(recordedScrim);

  expect((await matched(replay, oldAddress)).count, "the old address matches nothing here").toBe(0);
  const authored = await matched(replay, recorded.selector);
  expect(authored.count, "the authored selector matches one element").toBe(1);
  expect(authored.text, "and it is the same button").toBe("Not now");

  const reply = await replay.runAction({
    commandId: "replay-not-now",
    actionType: "web.dom.click",
    selector: recorded.selector,
    options: recordedElement(recorded)
  });
  expect(reply.status, `the replayed click: ${reply.message ?? ""}`).toBe("succeeded");
  await expect.poll(async () => await replay.page.evaluate((modal) => document.querySelector(modal) === null, MODAL)).toBe(true);

  test.info().annotations.push({
    type: "measurement",
    description: `seed ${RECORDED_SEED} -> ${REPLAYED_SEED}: scrim ${recordedScrim} -> ${replayedScrim}; ` +
      `old address matched 0; authored matched 1; click ${reply.status} by ${reply.resolution?.strategy ?? "?"}`
  });
});

// What is left once a generated anchor is refused is a positional path, and a
// positional path is only as stable as the structure it counts through. This
// modal is appended to `body`, and the store also prepends an app banner two
// seconds into every page load, so dismissing that banner renumbers `body`'s
// children and the authored selector stops matching. That is the honest limit
// of the authoring fix, and it is written down here rather than left to be
// discovered: the recording's fingerprint is what carries the step across it.
test("a structural path is not stability on its own, and the fingerprint is what carries the step when it moves", async ({ openHarness }) => {
  const recording = await openHarness("everything-store", { seed: RECORDED_SEED });
  const recordedScrim = await openNotifications(recording);
  const recorded = await describe(recording, await generatedAddress(recording, recordedScrim));

  const replay = await openHarness("everything-store", { seed: REPLAYED_SEED });
  // The store's own dismiss control, clicked in the two seconds between the
  // banner appearing and the modal covering it, which is how a shopper answers
  // it too. The banner leaves `body`, so everything after it is renumbered.
  await replay.page.locator('[data-action="dismiss-app"]').click();
  await expect.poll(async () => await replay.page.evaluate(() => document.querySelector('[data-action="dismiss-app"]') === null)).toBe(true);
  await openNotifications(replay);

  const moved = await matched(replay, recorded.selector);
  const reply = await replay.runAction({
    commandId: "replay-not-now-moved",
    actionType: "web.dom.click",
    selector: recorded.selector,
    options: recordedElement(recorded)
  });
  expect(reply.status, `the replayed click after the structure moved: ${reply.message ?? ""}`).toBe("succeeded");
  await expect.poll(async () => await replay.page.evaluate((modal) => document.querySelector(modal) === null, MODAL)).toBe(true);

  test.info().annotations.push({
    type: "measurement",
    description: `after the banner was dismissed the authored selector matched ${moved.count}; ` +
      `the click ${reply.status} by ${reply.resolution?.strategy ?? "?"} ` +
      `(best ${reply.resolution?.bestScore ?? "-"}, candidates ${reply.resolution?.candidateCount ?? "-"})`
  });
});

test("a Flow that already carries the generated address is resolved, and scored without the token the page redrew", async ({ openHarness }) => {
  const recording = await openHarness("everything-store", { seed: RECORDED_SEED });
  const recordedScrim = await openNotifications(recording);
  const oldAddress = await generatedAddress(recording, recordedScrim);
  const recorded = await describe(recording, oldAddress);

  // The descriptor as a Flow built before this rule holds it: the address it
  // was written with, and the xpath anchored on the same token.
  const asBuilt: Descriptor = { ...recorded, selector: oldAddress, xpath: `//*[@id="${recordedScrim}"]/div[1]/div[2]/button[1]` };
  // The same recording with one field changed: a token of the same length that
  // reads like something an author wrote. Everything else -- the page, the
  // candidates, the words, the classes -- is identical, so the difference
  // between the two measurements is the rule and nothing else.
  const asAuthoredToken: Descriptor = { ...asBuilt, selector: oldAddress.replace(recordedScrim, "consent-modal"), id: "consent-modal" };

  const replay = await openHarness("everything-store", { seed: REPLAYED_SEED });
  await openNotifications(replay);

  const generated = await replay.runAction({
    commandId: "replay-as-built-generated",
    actionType: "web.dom.extract",
    selector: asBuilt.selector,
    options: recordedElement(asBuilt)
  });
  const authoredToken = await replay.runAction({
    commandId: "replay-as-built-authored-token",
    actionType: "web.dom.extract",
    selector: asAuthoredToken.selector,
    options: recordedElement(asAuthoredToken)
  });

  expect(generated.status, `the pre-existing Flow's target: ${generated.message ?? ""}`).toBe("succeeded");
  expect(generated.element?.text, "resolved to the button it meant").toBe("Not now");

  test.info().annotations.push({
    type: "measurement",
    description: `pre-built address, generated token: ${generated.status} ` +
      `(strategy ${generated.resolution?.strategy ?? "?"}, best ${generated.resolution?.bestScore ?? "-"}, candidates ${generated.resolution?.candidateCount ?? "-"}); ` +
      `same recording with an authored-looking token: ${authoredToken.status} ` +
      `(strategy ${authoredToken.resolution?.strategy ?? "?"}, best ${authoredToken.resolution?.bestScore ?? "-"})`
  });

  const generatedScore = generated.resolution?.bestScore;
  const authoredScore = authoredToken.resolution?.bestScore;
  if (generatedScore !== undefined && authoredScore !== undefined) {
    expect(generatedScore, "a token the page regenerated is set aside; one it contradicts is charged").toBeGreaterThan(authoredScore);
  }
});
