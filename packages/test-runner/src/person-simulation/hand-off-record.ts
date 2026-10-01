// What the Lab's person did each time FluxIQ handed it a check, as the run's
// evidence records it (`snapshots/person-hand-offs.json`). Identifiers, closed
// words, counts and the Lab's own sentences only: nothing a page showed.

import type { ExpectedPersonHandOff } from "@fluxiq-web-extension/test-contracts";
import type { PersonPermissionAnswer } from "./permission-answer.js";

/** Where the bundle keeps the record, relative to its root. */
export const PERSON_HAND_OFFS_SNAPSHOT = "snapshots/person-hand-offs.json";

/**
 * What the person did at one hand-off.
 *
 * - `cleared`: found the check, did what a person does, and saw it go.
 * - `could-not-clear`: found the check and did what a person does, and it
 *   stayed. The person answers Stop: the run does not go on past a check.
 * - `declined`: the row says the person declines; they answer Stop without
 *   touching the check.
 * - `declined-tampered`: the check already showed the automation's hand on it
 *   (a guess typed, a new image asked for), so the hand-off was not what
 *   happened and the person answers Stop.
 * - `no-check-visible`: no tab of the scenario showed a check the Lab knows.
 *   FluxIQ asked a person where none was needed, and the person answers Stop.
 * - `failed`: the Lab could not play the person at all (no person module, a
 *   step the page refused); it answers Stop and says why in `note`.
 */
export const PERSON_HAND_OFF_ACTS = ["cleared", "could-not-clear", "declined", "declined-tampered", "no-check-visible", "failed"] as const;
export type PersonHandOffAct = (typeof PERSON_HAND_OFF_ACTS)[number];

/** The build asks on the Flow's thread and a run on its own, so the thread's subject says which; anything else is `unknown`. */
export type PersonHandOffStage = "build" | "run" | "unknown";

export type PersonHandOff = Readonly<{
  askId: string;
  stage: PersonHandOffStage;
  /** What the thread is about, as Core names it: `flow` and the Flow's id for a build, `run` and the run's id for a run. */
  subject: Readonly<{ kind: string; id: string }> | null;
  scenarioId: string;
  /** The check the person found on screen, by its id in the scenario's person module; `null` when none showed. */
  check: string | null;
  did: PersonHandOffAct;
  cleared: boolean;
  /** The option the person pressed, or `null` when the answer did not reach Core. */
  answer: "person_done" | "person_stop" | null;
  /** Where it was pressed, when it reached Core: in the extension's chat, or through Core's `answer-ask`. */
  via?: "chat" | "core";
  /** From the ask being raised to the person's answer, to a tenth of a second. */
  secondsWaited: number;
  /** The Lab's own reason for anything but `cleared`, bounded; never page text. */
  note: string | null;
}>;

/**
 * The whole record for one run. `expected` is the hand-off the row or task
 * declared (`expectedPersonHandOff`), and `null` for one that declared none.
 * `playable` is whether the scenario has a person module the Lab can play.
 * `pollFailures` counts the times the Lab could not read Core's threads, and
 * `lastPollFailure` says the last reason, so a hand-off the Lab never saw is
 * not mistaken for one FluxIQ never raised.
 */
export type PersonHandOffSnapshot = Readonly<{
  scenarioId: string;
  expected: ExpectedPersonHandOff | null;
  playable: boolean;
  handOffs: readonly PersonHandOff[];
  pollFailures: number;
  lastPollFailure: string | null;
}>;

/**
 * What the Lab's person writes: the hand-off record, and beside it, as a list
 * of its own, each answer it gave to a permission ask (`permission-answer.ts`).
 * Kept apart from `handOffs` so the hand-off invariant, which reads a
 * `PersonHandOffSnapshot`, scores nothing new; empty for a run whose person
 * was not given the task's permission point.
 */
export type LabPersonSnapshot = PersonHandOffSnapshot & Readonly<{ permissionAnswers: readonly PersonPermissionAnswer[] }>;
