import type { PersonCheck, PersonHandOffResponse, ScenarioPersonChecks } from "@fluxiq-web-extension/test-contracts";
import type { PersonHandOffAct } from "./hand-off-record.js";
import type { PersonTab } from "./tab.js";

/** What the person found and did at one hand-off, before they answer. */
export type PlayedCheck = Readonly<{ check: string | null; did: PersonHandOffAct; cleared: boolean; note: string | null }>;

export type PlayPersonCheckInput = {
  /** The scenario's person module, or `null` when it has none. */
  module: ScenarioPersonChecks | null;
  /** The scenario's tabs as they stand, newest first (`scenarioTabs`). */
  tabs: () => readonly PersonTab[];
  /** What this row's person does: clear the check, or decline it. */
  person: PersonHandOffResponse;
  /** The fixture's state, as `/__control/final-state` returns it: what `answer` and `tampered` read. */
  readState: () => Promise<unknown>;
  /** How long to look for the check. A check raised by a click can take seconds to draw (company-website's takes 2.2 s). */
  lookForMs?: number;
  pollMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

const LOOK_FOR_MS = 8_000;
const POLL_MS = 250;
const MAX_NOTE = 200;

/**
 * Plays the person at one hand-off: finds the scenario tab showing a check the
 * fixture's person module knows, does what a person does there, and watches
 * the check go. It never answers Core; the caller does, from what this
 * returns.
 *
 * A person looks at the page before touching it. So a check that already
 * shows the automation's hand on it (`tampered`) is declined, a row whose
 * person declines is declined untouched, and no check at all is reported as
 * such rather than guessed at.
 */
export async function playPersonCheck(input: PlayPersonCheckInput): Promise<PlayedCheck> {
  const now = input.now ?? Date.now;
  const sleep = input.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const pollMs = input.pollMs ?? POLL_MS;
  const { module } = input;
  if (!module) return played(null, "failed", "the scenario has no person module, so the Lab knows no check to play");
  const found = await findCheck(module, input.tabs, input.lookForMs ?? LOOK_FOR_MS, pollMs, now, sleep);
  if (!found) return played(null, "no-check-visible", "no tab of the scenario showed a check the Lab knows");
  const { tab, check } = found;
  if (input.person === "declines") return played(check.id, "declined", "the row declares that the person declines");
  let answer: string | undefined;
  try {
    const state = module.answer || module.tampered ? await input.readState() : undefined;
    const tampered = module.tampered?.(state) ?? null;
    if (tampered) return played(check.id, "declined-tampered", tampered);
    answer = module.answer?.(state);
  } catch (error) {
    return played(check.id, "failed", `the fixture's state could not be read for the check: ${firstLine(error)}`);
  }
  const loadsBefore = tab.loads();
  try {
    await tab.front();
    for (const step of check.steps) {
      if (step.action === "click") await tab.click(step.text);
      else if (step.action === "press-and-hold") await tab.pressAndHold(step.text, step.holdMs);
      else if (step.action === "press") await tab.pressButton(step.button);
      else if (answer === undefined) return played(check.id, "failed", "the check asks for an answer the person module does not give");
      else await tab.typeInto(step.label, answer);
    }
  } catch (error) {
    return played(check.id, "failed", `a step of the check could not be done: ${firstLine(error)}`);
  }
  return await waitForClear(tab, check, loadsBefore, pollMs, now, sleep)
    ? played(check.id, "cleared", null)
    : played(check.id, "could-not-clear", `the check still showed ${check.clearsWithinMs} ms after the person was done`);
}

async function findCheck(module: ScenarioPersonChecks, tabs: () => readonly PersonTab[], lookForMs: number, pollMs: number, now: () => number, sleep: (ms: number) => Promise<void>): Promise<{ tab: PersonTab; check: PersonCheck } | undefined> {
  const deadline = now() + lookForMs;
  for (;;) {
    for (const tab of tabs()) {
      for (const check of module.checks) if (await tab.shows(check.shows)) return { tab, check };
    }
    if (now() >= deadline) return undefined;
    await sleep(pollMs);
  }
}

/**
 * Whether the check went within its own time. A check that leaves by loading
 * a new document is cleared only once that load has happened and the new
 * document does not show it: crossborder's box turns into "Checking your
 * browser…" at once and reloads two seconds later, and an answer given in
 * between would send FluxIQ to read a page that is about to go.
 */
async function waitForClear(tab: PersonTab, check: PersonCheck, loadsBefore: number, pollMs: number, now: () => number, sleep: (ms: number) => Promise<void>): Promise<boolean> {
  const deadline = now() + check.clearsWithinMs;
  for (;;) {
    const moved = check.clears === "in-place" || tab.loads() > loadsBefore;
    if (moved) {
      const settled = await tab.settle(Math.max(1, deadline - now())).then(() => true, () => false);
      if (settled && !(await tab.shows(check.shows))) return true;
    }
    if (now() >= deadline) return false;
    await sleep(pollMs);
  }
}

function played(check: string | null, did: PersonHandOffAct, note: string | null): PlayedCheck {
  return Object.freeze({ check, did, cleared: did === "cleared", note: note === null ? null : note.slice(0, MAX_NOTE) });
}

/** A failure's first line only: Playwright's later lines can quote the page's markup, which the record never carries. */
function firstLine(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).split("\n", 1)[0]!.slice(0, 120);
}
