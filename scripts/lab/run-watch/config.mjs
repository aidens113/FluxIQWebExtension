// The run watcher's detection thresholds, in one place. They decide only when
// an ALERT is written; nothing here ever stops, resets or limits a run (user,
// 2026-11-24: no arbitrary limit ends a run, and a run is stopped early only by
// the agent that reads an alert and judges the run plainly stuck).
//
// A number is a count of what the run itself did, never a time limit:
//   noActAfterLoopDecisions  model decisions with no act after a loop decision fired, alerted again at each multiple
//   noActDecisions           model decisions in a row with no act at all, alerted again at each multiple
//   repeatedCalls            the same tool with the same input, sent this many times with no act between them
//   unfinishedAfterFinish    model decisions after a `finish_with_best` decision before the build is said not to have ended
//   unchangedAfterChange     calls after a `change_approach` decision that are all the kind the loop named, with no act
//   pageResets               navigations to the start URL after the first, in one attempt
//   roundsWithoutDecision    Core opening calls (`initial.*`) in a row with no model decision since the previous one, alerted again at each multiple
//   stepsWithoutEvidence     steps since a new page location, a new page fingerprint or new rows, alerted again at each multiple
// `heartbeatMs` is how seldom `watch-status.json` is rewritten; `pollMs` is how often the step folder is read.

export const WATCH_THRESHOLDS = Object.freeze({
  noActAfterLoopDecisions: 8,
  noActDecisions: 40,
  repeatedCalls: 4,
  unfinishedAfterFinish: 4,
  unchangedAfterChange: 6,
  pageResets: 1,
  roundsWithoutDecision: 2,
  stepsWithoutEvidence: 60,
  pollMs: 5_000,
  heartbeatMs: 30_000,
});
