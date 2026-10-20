import { classifyStep } from "./classify-step.js";
import { IntervalSet } from "./interval-set.js";
import type { BuildCategory, Interval, RunBuildTime, StepClass, StepTiming } from "./types.js";

const PRECEDENCE: readonly Exclude<BuildCategory, "other">[] = ["trial", "reset", "model", "exploration"];

type Classified = { step: StepTiming; category: StepClass; rule: string };

const span = (step: StepTiming): Interval => ({ start: step.start, end: step.end });

/**
 * Playback windows: each maximal run of consecutive steps (by index) that are
 * playback runs or part-less judges, holding at least one playback run, spans
 * its first start to its last end. A part-less judge outside one is model time.
 */
function playbackWindows(classified: readonly Classified[]): { windows: Interval[]; members: Set<StepTiming> } {
  const windows: Interval[] = [];
  const members = new Set<StepTiming>();
  let group: Classified[] = [];
  const close = () => {
    if (group.some(item => item.category === "playback")) {
      windows.push({ start: Math.min(...group.map(item => item.step.start)), end: Math.max(...group.map(item => item.step.end)) });
      for (const item of group) members.add(item.step);
    }
    group = [];
  };
  for (const item of classified) {
    if (item.category === "playback" || item.category === "playback-judge") group.push(item);
    else close();
  }
  close();
  return { windows, members };
}

/** Trial windows: each trial tool call, and each run of consecutive dry-run nodes of one round. */
function trialWindows(classified: readonly Classified[]): Interval[] {
  const windows: Interval[] = [];
  let nodes: StepTiming[] = [];
  const close = () => {
    if (nodes.length > 0) windows.push({ start: nodes[0]!.start, end: Math.max(...nodes.map(node => node.end)) });
    nodes = [];
  };
  for (const { step, rule } of classified) {
    if (rule === "trial-node") {
      if (nodes.length > 0 && nodes[nodes.length - 1]!.round !== step.round) close();
      nodes.push(step);
      continue;
    }
    close();
    if (rule === "trial-tool") windows.push(span(step));
  }
  close();
  return windows;
}

const zero = (): Record<BuildCategory, number> => ({ trial: 0, reset: 0, model: 0, exploration: 0, other: 0 });

/**
 * Divides one run's build wall time. Build wall time runs from the first
 * non-playback step's start to the last one's end, less the playback windows
 * inside that span (the Lab's replay of the applied Flow; a repair build after
 * it still counts). Each category is an interval union clipped to that time;
 * the exclusive shares apply trial > reset > model > exploration, and `other`
 * is what is left: bookkeeping steps, unknown steps and idle gaps.
 */
export function measureBuildTime(steps: readonly StepTiming[]): RunBuildTime {
  const ordered = [...steps].sort((a, b) => a.index - b.index);
  const classified: Classified[] = ordered.map(step => ({ step, ...classifyStep(step) }));
  const { windows, members } = playbackWindows(classified);
  const playback = IntervalSet.of(windows);
  const build = classified.filter(item => !members.has(item.step));
  const ruleCounts: Record<string, number> = {};
  const unknown: Record<string, number> = {};
  for (const { step, rule } of classified) {
    ruleCounts[rule] = (ruleCounts[rule] ?? 0) + 1;
    if (rule === "unknown") unknown[`${step.kind}:${step.toolId ?? "-"}`] = (unknown[`${step.kind}:${step.toolId ?? "-"}`] ?? 0) + 1;
  }
  const result: RunBuildTime = {
    wallMs: 0, buildStart: null, buildEnd: null, playbackMs: 0, exclusive: zero(), union: zero(), idleMs: 0,
    modelInTrialMs: 0, resetInTrialMs: 0, trialCount: 0, longestTrialMs: 0, stepCount: ordered.length, unknown, ruleCounts
  };
  if (build.length === 0) return result;
  const buildStart = Math.min(...build.map(item => item.step.start));
  const buildEnd = Math.max(...build.map(item => item.step.end));
  const whole = IntervalSet.of([{ start: buildStart, end: buildEnd }]);
  const wall = whole.subtract(playback);
  const ofCategory = (category: StepClass) => IntervalSet.of(build.filter(item => item.category === category || (category === "model" && item.category === "playback-judge")).map(item => span(item.step))).intersect(wall);
  const trials = trialWindows(build);
  const unions: Record<BuildCategory, IntervalSet> = {
    trial: IntervalSet.of(trials).intersect(wall),
    reset: ofCategory("reset"),
    model: ofCategory("model"),
    exploration: ofCategory("exploration"),
    other: ofCategory("other")
  };
  let remaining = wall;
  for (const category of PRECEDENCE) {
    const owned = unions[category].intersect(remaining);
    result.exclusive[category] = owned.totalMs;
    remaining = remaining.subtract(owned);
  }
  result.exclusive.other = remaining.totalMs;
  for (const category of Object.keys(unions) as BuildCategory[]) result.union[category] = unions[category].totalMs;
  result.idleMs = remaining.subtract(unions.other).totalMs;
  result.modelInTrialMs = unions.model.intersect(unions.trial).totalMs;
  result.resetInTrialMs = unions.reset.intersect(unions.trial).totalMs;
  result.trialCount = trials.length;
  result.longestTrialMs = trials.reduce((longest, trial) => Math.max(longest, trial.end - trial.start), 0);
  result.buildStart = buildStart;
  result.buildEnd = buildEnd;
  result.wallMs = wall.totalMs;
  result.playbackMs = playback.totalMs;
  return result;
}
