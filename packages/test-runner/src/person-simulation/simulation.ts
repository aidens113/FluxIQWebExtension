import type { ExpectedPersonHandOff, ScenarioPersonChecks } from "@fluxiq-web-extension/test-contracts";
import type { PersonHandOff, PersonHandOffSnapshot } from "./hand-off-record.js";
import { answerPersonAsk, pendingPersonAsks, PERSON_DONE, PERSON_STOP, type PendingPersonAsk, type PersonAskControl, type PersonAskScope } from "./asks.js";
import type { PersonTab } from "./tab.js";
import { playPersonCheck, type PlayedCheck } from "./play-person-check.js";

export type PersonSimulationInput = {
  control: PersonAskControl;
  scope: PersonAskScope;
  scenarioId: string;
  module: ScenarioPersonChecks | null;
  /** The hand-off the row or task declares (`expectedPersonHandOff`); its `person` says whether the person clears or declines. Undeclared, the person clears a check they find. */
  expected: ExpectedPersonHandOff | null;
  tabs: () => readonly PersonTab[];
  readState: () => Promise<unknown>;
  /** Told of each hand-off as it is answered, so the run's timeline shows it where it happened. */
  onHandOff?: (handOff: PersonHandOff) => Promise<void>;
  /** How often Core's threads are read. Core itself waits in two-second steps, so one second answers within its next look. */
  pollMs?: number;
  lookForMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

export type PersonSimulation = {
  /** Stops looking, waits for a hand-off in progress to be answered, and returns the whole record. */
  stop(): Promise<PersonHandOffSnapshot>;
};

const POLL_MS = 1_000;

/**
 * The Lab playing the person, for as long as a build or a run may ask for
 * one.
 *
 * Until now the harness answered no ask at all, so every run that met a check
 * only a person may pass sat on Core's question for five minutes and ended
 * `user_intervention_required`, which read as FluxIQ failing. Here the Lab
 * reads Core's threads the way a person's panel does, and answers each
 * person-needed ask (`control.kind: "person_check"`) once: it finds the tab
 * showing the check, does what a person does there (`playPersonCheck`), and
 * presses Continue once the check has gone -- or Stop when no check the Lab
 * knows was showing, when the check stayed, when the row declares the person
 * declines, or when the check already showed the automation's hand on it.
 *
 * Every other ask is left alone: a permission is the operator's, and the
 * Lab does not answer questions it was not built to answer.
 */
export function startPersonSimulation(input: PersonSimulationInput): PersonSimulation {
  const now = input.now ?? Date.now;
  const handled = new Set<string>();
  const handOffs: PersonHandOff[] = [];
  let pollFailures = 0;
  let lastPollFailure: string | null = null;
  let stopped = false;
  let wake: (() => void) | undefined;
  const loop = (async () => {
    while (!stopped) {
      let asks: PendingPersonAsk[] = [];
      try {
        asks = await pendingPersonAsks(input.control, input.scope);
      } catch (error) {
        // Counted and kept rather than thrown: Core may be between answers, or closing after the lane, and a later look is the retry.
        pollFailures += 1;
        lastPollFailure = firstLine(error);
      }
      for (const ask of asks.filter(({ askId }) => !handled.has(askId))) {
        handled.add(ask.askId);
        const handOff = await handOffOne(input, ask, now);
        handOffs.push(handOff);
        if (input.onHandOff) {
          await input.onHandOff(handOff).catch((error: unknown) => { lastPollFailure = `publishing a hand-off failed: ${firstLine(error)}`; });
        }
      }
      if (stopped) break;
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, input.pollMs ?? POLL_MS);
        wake = () => { clearTimeout(timer); resolve(); };
      });
    }
  })();
  return {
    stop: async () => {
      stopped = true;
      wake?.();
      await loop;
      return Object.freeze({ scenarioId: input.scenarioId, expected: input.expected, playable: input.module !== null, handOffs: Object.freeze([...handOffs]), pollFailures, lastPollFailure });
    },
  };
}

/** One ask, played and answered. The answer is Continue only for a check the person saw go. */
async function handOffOne(input: PersonSimulationInput, ask: PendingPersonAsk, now: () => number): Promise<PersonHandOff> {
  let playedCheck: PlayedCheck;
  try {
    playedCheck = await playPersonCheck({
      module: input.module, tabs: input.tabs, person: input.expected?.person ?? "completes", readState: input.readState,
      ...(input.lookForMs === undefined ? {} : { lookForMs: input.lookForMs }),
      ...(input.now === undefined ? {} : { now: input.now }),
      ...(input.sleep === undefined ? {} : { sleep: input.sleep }),
    });
  } catch (error) {
    playedCheck = { check: null, did: "failed", cleared: false, note: `the Lab could not play the person: ${firstLine(error)}` };
  }
  const option = playedCheck.cleared ? PERSON_DONE : PERSON_STOP;
  let answer: PersonHandOff["answer"] = option;
  let note = playedCheck.note;
  try {
    await answerPersonAsk(input.control, input.scope, ask.askId, option);
  } catch (error) {
    answer = null;
    note = [note, `the answer did not reach Core: ${firstLine(error)}`].filter((part) => part !== null).join("; ");
  }
  return Object.freeze({
    askId: ask.askId, stage: ask.stage, subject: ask.subject, scenarioId: input.scenarioId,
    check: playedCheck.check, did: playedCheck.did, cleared: playedCheck.cleared, answer,
    secondsWaited: Math.max(0, Math.round((now() - ask.createdAt) / 100) / 10),
    note,
  });
}

function firstLine(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).split("\n", 1)[0]!.slice(0, 160);
}
