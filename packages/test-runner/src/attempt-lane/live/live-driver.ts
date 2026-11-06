import type { AttemptStandIn } from "@fluxiq-web-extension/test-contracts";
import type { ChatBrowserSession } from "../../extension-chat-check/index.js";
import { askedChangeOf, attemptEndingOfBuild, judgeAskedAgain, judgeAttemptAnswer, judgeEveryFact, lastingViewOf, readSiteBaseline, readSiteState, siteChange, stillAsked, type AttemptEndingFact, type LastingView, type RunDatasetControl, type SiteChange } from "../../flow-lane/index.js";
import { finalStateFacts } from "../../lane-rules/index.js";
import { playwrightScenarioFactProbe } from "../../scenario-assertions.js";
import type { AttemptDriver, AttemptOutcome, AttemptSavedState, AttemptStart, AttemptTask } from "../driver.js";
import { keptWhateverScored, liveAttemptStage, readTaskAttempt, type AttemptOutcomeRead, type AttemptOutcomeRecord, type AttemptReadControl } from "./attempt/index.js";
import type { AnswerTurnDom } from "./answer-turn-dom.js";
import { followAttempt } from "./follow-attempt.js";
import { panelAnswerPort } from "./panel-answer-port.js";
import { pressPanelRunAgain } from "./press-run-again.js";

/** One attempt's ending, kept for the run's result line and its evidence. */
export type LiveAttemptEnded = Readonly<{
  ordinal: number;
  outcome: AttemptOutcomeRead;
  shown: AnswerTurnDom | null;
  conversationId: string;
  /**
   * `activity` is the site's own record of what landed during this attempt, and `activityBefore` what it already held.
   * `unread` only where scoring the attempt failed and the site could not be read after it either, saying why: never a guess at it.
   */
  site: Readonly<{ before: LastingView; after: LastingView; change: SiteChange; activity: unknown; activityBefore: unknown }> | Readonly<{ unread: string }>;
}>;

/** The site as it was read after the attempt, or why it could not be: kept with an attempt whose scoring already failed. */
async function siteOrWhyUnread<Site>(read: () => Promise<Site>): Promise<Site | { unread: string }> {
  try {
    return await read();
  } catch (error) {
    return { unread: error instanceof Error ? error.message : String(error) };
  }
}

/** One attempt's Lab person, running until `finish` (`./attempt-person.ts`). */
export type LiveAttemptPersonRun = { finish(): Promise<void> };

/** The Lab's way of playing the scenario's declared person: `playable` says there is one to wait for, and `start` begins it for one attempt. */
export type LiveAttemptPerson = { playable: boolean; start(ordinal: number): Promise<LiveAttemptPersonRun> };

export type LiveAttemptDriverInput = {
  control: AttemptReadControl & RunDatasetControl;
  session: ChatBrowserSession;
  projectId: string;
  origin: string;
  runToken: string;
  /** Puts the fixture back to its seed: the attempt's baseline. */
  resetSite(): Promise<void>;
  /** Types the instruction into the real chat, as a person does, and answers the thread it went to. */
  send(instruction: string): Promise<{ conversationId: string }>;
  /** What has moved, for the watch (`./follow-attempt.ts`). */
  progress?: () => Promise<{ marker: string; refused?: string }>;
  standIns: readonly AttemptStandIn[];
  /** The person the Lab plays at a person-only check; absent, an attempt waiting for a person is where the proof stops. */
  person?: LiveAttemptPerson;
  stallMs?: number;
  log?: (line: string) => void;
  /** Called once the attempt has stopped and the turn is read, with the page still as it left it. */
  onEnded?: (ended: LiveAttemptEnded) => Promise<void>;
  /**
   * How a later attempt starts: `typed`, the same words typed into the same thread, or `run_again`, a
   * press of Run again on the attempt before it's answer, which is a person asking for it again.
   */
  later?: "typed" | "run_again";
};

/** An attempt's ending to the hard rule: a budget or a person's Stop excuses, and anything else short of a result is `other`. */
function endingOf(attempt: AttemptOutcomeRecord): AttemptEndingFact {
  if (attempt.status === "achieved" || attempt.status === "finished_unchecked") return "finished";
  if (attempt.status === "budget_out") return attemptEndingOfBuild("budget_exhausted");
  if (attempt.status === "stopped_by_person") return attemptEndingOfBuild("cancelled");
  return "other";
}

/** What the attempt's record says it left, as the series reads it. */
function savedOf(outcome: AttemptOutcomeRead): AttemptSavedState | null {
  const { saved } = outcome;
  return saved ? { state: saved.state, ...(saved.flowId ? { flowId: saved.flowId } : {}), draftDigest: saved.stepsDigest ?? null } : null;
}

/** What Core says the attempt began from, or nothing where it says none. */
function startedFromOf(attempt: AttemptOutcomeRecord): AttemptStart | null {
  return attempt.startedFrom ? { draftDigest: attempt.startedFrom.stepsDigest, route: attempt.startedFrom.route } : null;
}

const listOf = (activity: unknown): readonly unknown[] => (Array.isArray(activity) ? activity : []);

/**
 * What landed during an attempt, in the site's own words where it keeps a record of its
 * lasting acts, and by the Lab's lasting names where it does not. A press a site ignored
 * moved nothing, and a site's record of one is not a change.
 */
function changedWords(activity: readonly unknown[] | null, change: SiteChange): string[] {
  const moved = Object.entries(change).map(([name, by]) => `${name} ${by > 0 ? "+" : ""}${by}`);
  if (moved.length === 0) return [];
  const told = (activity ?? []).filter((line): line is string => typeof line === "string" && line.length > 0);
  return told.length > 0 ? told : moved;
}

/**
 * Runs a real attempt: the instruction typed into the real chat, followed through the
 * real service by the read the extension uses, until it ends. It is then scored with
 * the task's own oracle: the attempt's stored rows, the site's change since its
 * recorded baseline, the declared final state on the page it left, and the answer
 * turn out of the panel's DOM.
 *
 * The series may run it again with no reseed: the same words in the same thread, as a
 * person sends them, on the site as the last attempt left it. That attempt's baseline is read
 * when it starts, and its change is judged against what the first attempt left
 * (`judgeLaterChange`). A reseed starts the account again.
 */
export function liveAttemptDriver(input: LiveAttemptDriverInput): AttemptDriver {
  const log = input.log ?? (() => undefined);
  /** The first attempt's baseline since the site was last seeded, and every attempt this thread already holds. */
  let first: LastingView | undefined;
  const known = new Set<string>();
  /** The attempt before this one and its thread: what a press of Run again is made on. */
  let previous: { attemptId: string; conversationId: string } | undefined;
  return {
    seedSite: async () => {
      first = undefined;
      await input.resetSite();
    },
    run: async (task: AttemptTask, ordinal: number): Promise<AttemptOutcome> => {
      const { request, scenario, workflow } = task;
      const baseline = await readSiteBaseline(input.origin, input.runToken, scenario.id);
      const stateBefore = await readSiteState(input.origin, input.runToken, scenario.id);
      const earlierLeft = first === undefined ? undefined : siteChange(first, baseline.view);
      first ??= baseline.view;
      const askedAgain = ordinal > 1 && input.later === "run_again" && previous !== undefined;
      // Started before the message and finished after the attempt stops: it may be asked the moment the attempt starts.
      const person = await input.person?.start(ordinal);
      let conversationId: string;
      let followed: AttemptOutcomeRead;
      try {
        if (askedAgain) {
          log(`[attempt] pressing Run again on the answer of ${previous!.attemptId}`);
          await pressPanelRunAgain(input.session, previous!.attemptId);
          conversationId = previous!.conversationId;
        } else {
          log(`[attempt] typing the instruction into the chat: ${request.task.id}`);
          ({ conversationId } = await input.send(request.task.instruction));
        }
        followed = await followAttempt({
          control: input.control, projectId: input.projectId, conversationId, known,
          ...(input.progress ? { progress: input.progress } : {}),
          ...(input.person?.playable ? { personPlaying: true } : {}),
          describeChat: () => input.session.panel?.text() ?? Promise.resolve(""),
          onChange: (line) => log(`[attempt] ${line}`),
          ...(input.stallMs === undefined ? {} : { stallMs: input.stallMs }),
        });
      } finally {
        await person?.finish();
      }
      const outcome = await readTaskAttempt(input.control, input.projectId, followed.attempt.attemptId);
      const { attempt } = outcome;
      known.add(attempt.attemptId);
      previous = { attemptId: attempt.attemptId, conversationId };
      log(`[attempt] it ended: ${attempt.status}${attempt.waitingFor ? ` for ${attempt.waitingFor}` : ""}`);
      let shown: AnswerTurnDom | null = null;
      const columnIds = new Map((outcome.result?.rows?.columns ?? []).map(({ id, label }) => [label, id]));
      const stage = liveAttemptStage({
        control: input.control, projectId: input.projectId, scenarioId: scenario.id, scenarioOrigin: input.origin, runToken: input.runToken, baseline, result: outcome.result, standIns: input.standIns,
        chat: panelAnswerPort({ session: input.session, attemptId: attempt.attemptId, columnIds, onRead: (dom) => { shown = dom; } }),
      });
      const page = input.session.scenario;
      const siteAfter = async (): Promise<Exclude<LiveAttemptEnded["site"], { unread: string }> & { activity: readonly unknown[] | null }> => {
        const state = await readSiteState(input.origin, input.runToken, scenario.id);
        const after = lastingViewOf(scenario.id)(state);
        // The site's own record of what landed, for the evidence: `activity` lists each act the fixture took, and a repeat it ignored is not in it.
        const activityBefore = listOf(stateBefore.activity);
        const activity = state.activity === undefined ? null : listOf(state.activity).slice(activityBefore.length);
        return { before: baseline.view, after, change: siteChange(baseline.view, after), activity, activityBefore };
      };
      // The attempt has ended and been paid for: its ending is kept whatever the scoring throws, and the throw still fails the run.
      const judged = await keptWhateverScored(
        () => judgeAttemptAnswer({
          request, workflow, scenarioOrigin: input.origin, ending: endingOf(attempt), stage, baseline, earlierLeft, askedAgain,
          judgeFinalState: async () => {
            const facts = await judgeEveryFact(finalStateFacts(scenario, workflow), playwrightScenarioFactProbe(page));
            return { held: facts.every((fact) => fact.held), unheldFacts: facts.filter((fact) => !fact.held), facts };
          },
        }),
        async () => input.onEnded?.({ ordinal, outcome, shown, conversationId, site: await siteOrWhyUnread(siteAfter) }),
        log,
      );
      const site = await siteAfter();
      const { activity, change } = site;
      await input.onEnded?.({ ordinal, outcome, shown, conversationId, site });
      const asked = askedChangeOf(request.task.id);
      const remaining = asked && earlierLeft ? new Set(stillAsked(asked, earlierLeft).acts.map((act) => act.name)) : undefined;
      // A person asked for this again: what they asked for, again, scored with its rows, final state and shown answer like any attempt (`judgeAskedAgain`). Its lists are for the line.
      const again = askedAgain && asked ? judgeAskedAgain(asked, earlierLeft ?? {}, change) : undefined;
      const answer = judged.score;
      return Object.freeze({
        record: {
          taskId: request.task.id, attemptId: attempt.attemptId, ordinal: attempt.ordinal, projectId: attempt.projectId,
          ...(attempt.flowId ? { flowId: attempt.flowId } : {}),
          path: attempt.path,
          // `finished_unchecked` is a Flow's run with nothing to check it by, which an explore never is; the Lab's words have it as achieved's near neighbour, and its row carries the answer's own verdict either way.
          status: attempt.status === "finished_unchecked" ? "achieved" as const : attempt.status,
          spend: attempt.spend,
          liveSteps: attempt.liveSteps,
          ...(attempt.simulation ? { simulation: attempt.simulation } : {}),
          loopsCaught: attempt.loopsCaught,
          ...(attempt.actsWithNoRow !== undefined ? { actsWithNoRow: attempt.actsWithNoRow } : {}),
        },
        saved: savedOf(outcome),
        startedFrom: startedFromOf(attempt),
        answer,
        oracleVerdict: null,
        standIns: input.standIns,
        ...(earlierLeft ? { against: { reseeded: false as const, foundDone: (asked?.acts ?? []).map((act) => act.name).filter((name) => !remaining?.has(name)), changed: changedWords(activity, change) } } : {}),
        ...(again ? { askedAgain: { pressedAgain: again.pressedAgain, foundAsAsked: again.foundAsAsked, undone: again.undone, notPressed: again.notPressed } } : {}),
      });
    },
  };
}
