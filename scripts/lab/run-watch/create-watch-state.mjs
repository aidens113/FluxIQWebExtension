// The watcher's rolling counts for ONE attempt (one run's step log), and the
// patterns that turn them into alerts. No model, no I/O: it is fed the facts
// `readStep` returns, in step order, and answers with the alerts those steps
// raise. It only observes; nothing it returns stops or changes a run.
//
// Patterns, each alerted again only at a further multiple of its threshold:
//   no_act_after_loop    decisions with no act after a loop decision (or steer) fired
//   no_act               decisions in a row with no act at all
//   repeated_call        the same tool and input sent again and again with no act between
//   finish_not_ending    a `finish_with_best` decision and the build still going
//   approach_unchanged   calls after `change_approach` that stayed the kind the loop named
//   page_reset           the page sent back to the start URL after the first time
//   no_new_evidence      steps since a new page location, fingerprint or row count

import { WATCH_THRESHOLDS } from "./config.mjs";

const BOUNDARY_KINDS = new Set(["flow", "run", "judge", "test", "reset", "escalate", "repair", "offline_trial", "diagnose"]);
const PROGRESS_KINDS = new Set(["flow", "run", "judge", "test", "repair", "offline_trial"]);

/** @param {typeof WATCH_THRESHOLDS} [thresholds] */
export function createWatchState(thresholds = WATCH_THRESHOLDS) {
  const state = {
    steps: 0, firstStep: null, lastStep: 0, costUsd: 0,
    noAct: 0, acts: 0, loops: 0, loopDecisions: 0,
    afterLoop: /** @type {null | { step: number, decisions: number }} */ (null),
    calls: new Map(), finish: /** @type {null | { step: number, steps: number }} */ (null),
    change: /** @type {null | { step: number, toolIds: string[], calls: number }} */ (null),
    startUrl: /** @type {string | null} */ (null), resets: 0, explainedResets: 0, boundary: false,
    locations: new Set(), pages: new Set(), rows: 0, lastEvidence: 0,
    alerts: 0, lastAlerted: new Map(),
  };

  /** One alert per multiple of `every`, never the same multiple twice. */
  function crossed(pattern, count, every) {
    if (every <= 0 || count < every) return false;
    const multiple = Math.floor(count / every);
    if ((state.lastAlerted.get(pattern) ?? 0) >= multiple) return false;
    state.lastAlerted.set(pattern, multiple);
    return true;
  }

  /** @param {Awaited<ReturnType<typeof import("./read-step.mjs").readStep>> & {}} event */
  function observe(event) {
    const alerts = [];
    const raise = (pattern, fromStep, counts, message) => {
      state.alerts += 1;
      alerts.push({ pattern, fromStep, toStep: event.step, counts, costUsd: round(state.costUsd), message });
    };
    state.steps += 1;
    state.firstStep ??= event.step;
    state.lastStep = event.step;
    state.costUsd += event.costUsd;

    if (event.kind === "loop") {
      state.loops += 1;
      state.afterLoop = { step: event.step, decisions: 0 };
    } else if (event.kind === "loop_decision") {
      state.loopDecisions += 1;
      state.afterLoop = { step: event.step, decisions: 0 };
      if (event.decision === "finish_with_best") state.finish = { step: event.step, steps: 0 };
      else if (event.decision === "change_approach") state.change = { step: event.step, toolIds: event.toolIds, calls: 0 };
    } else if (event.kind === "decide") {
      state.noAct += 1;
      if (state.afterLoop !== null) state.afterLoop.decisions += 1;
      if (state.afterLoop !== null && crossed("no_act_after_loop", state.afterLoop.decisions, thresholds.noActAfterLoopDecisions)) {
        raise("no_act_after_loop", state.afterLoop.step, { decisionsWithoutAct: state.afterLoop.decisions, loops: state.loops, loopDecisions: state.loopDecisions }, `${state.afterLoop.decisions} decisions with no act since the loop handling fired at step ${state.afterLoop.step}`);
      } else if (crossed("no_act", state.noAct, thresholds.noActDecisions)) {
        raise("no_act", state.firstStep, { decisionsWithoutAct: state.noAct, acts: state.acts }, `${state.noAct} decisions in a row with no act`);
      }
    }

    if (state.finish !== null && BOUNDARY_KINDS.has(event.kind)) state.finish = null;
    else if (state.finish !== null && event.kind === "decide") {
      state.finish.steps += 1;
      if (crossed("finish_not_ending", state.finish.steps, thresholds.unfinishedAfterFinish)) {
        raise("finish_not_ending", state.finish.step, { decisionsAfterFinish: state.finish.steps }, `${state.finish.steps} decisions after a finish_with_best decision and no Flow run or judged run followed`);
      }
    }

    if (event.kind === "tool" && !event.initial) {
      if (event.act) {
        state.acts += 1;
        state.noAct = 0;
        state.afterLoop = null;
        state.calls.clear();
        state.lastAlerted.delete("repeated_call");
        state.lastAlerted.delete("no_act_after_loop");
        state.lastAlerted.delete("no_act");
        state.change = null;
      } else if (event.callKey !== null) {
        const seen = (state.calls.get(event.callKey) ?? 0) + 1;
        state.calls.set(event.callKey, seen);
        if (seen >= thresholds.repeatedCalls && seen % thresholds.repeatedCalls === 0) {
          raise("repeated_call", event.step, { repeats: seen, tool: event.toolId ?? "" }, `the same ${event.toolId} call sent ${seen} times with no act between`);
        }
      }
      if (state.change !== null && !event.act) {
        if (state.change.toolIds.includes(event.toolId ?? "")) {
          state.change.calls += 1;
          if (crossed("approach_unchanged", state.change.calls, thresholds.unchangedAfterChange)) {
            raise("approach_unchanged", state.change.step, { callsAfterChange: state.change.calls, tool: event.toolId ?? "" }, `${state.change.calls} calls after change_approach stayed the kind the loop named (${event.toolId}) with no act`);
          }
        } else state.change = null;
      }
    }

    if (event.startUrl !== null && (event.initial || event.act)) {
      if (state.startUrl === null) state.startUrl = event.startUrl;
      else if (event.startUrl === state.startUrl && state.boundary) state.explainedResets += 1;
      else if (event.startUrl === state.startUrl) {
        state.resets += 1;
        if (state.resets >= thresholds.pageResets) raise("page_reset", event.step, { resets: state.resets, bySystem: event.initial ? 1 : 0 }, `the page was sent back to the start URL (${state.resets} time${state.resets === 1 ? "" : "s"} this attempt)`);
      }
    }

    // A Flow run, a judged run or a test is the page legitimately leaving where the build was, so
    // the start navigation that follows one is expected; it is a reset only when nothing explains it.
    if (event.startUrl !== null && (event.initial || event.act)) state.boundary = false;
    if (BOUNDARY_KINDS.has(event.kind)) state.boundary = true;

    // Progress that is not a page change: an act, a Flow run, a judged run, an applied draft amendment.
    let fresh = event.act || PROGRESS_KINDS.has(event.kind) || (event.kind === "answer" && event.decision === "amend_draft" && event.verdict === "applied");
    if (event.location !== null && !state.locations.has(event.location)) {
      state.locations.add(event.location);
      fresh = true;
    }
    if (event.pageHash !== null && !state.pages.has(event.pageHash)) {
      state.pages.add(event.pageHash);
      fresh = true;
    }
    if (event.rows !== null && event.rows > state.rows) {
      state.rows = event.rows;
      fresh = true;
    }
    if (fresh) {
      state.lastEvidence = event.step;
      state.lastAlerted.delete("no_new_evidence");
    } else if (crossed("no_new_evidence", event.step - state.lastEvidence, thresholds.stepsWithoutEvidence)) {
      raise("no_new_evidence", state.lastEvidence, { stepsWithoutEvidence: event.step - state.lastEvidence, locations: state.locations.size }, `${event.step - state.lastEvidence} steps with no new page location, fingerprint or rows`);
    }
    return alerts;
  }

  function snapshot() {
    return {
      steps: state.steps, lastStep: state.lastStep, costUsd: round(state.costUsd), acts: state.acts, decisionsWithoutAct: state.noAct,
      loops: state.loops, loopDecisions: state.loopDecisions, pageResets: state.resets,
      stepsSinceEvidence: state.lastStep - state.lastEvidence, alerts: state.alerts,
    };
  }

  return { observe, snapshot };
}

function round(value) { return Math.round(value * 1e6) / 1e6; }
