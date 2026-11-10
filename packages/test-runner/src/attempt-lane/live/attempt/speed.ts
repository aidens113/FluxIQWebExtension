import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

/** One node type's steps: how many, and the mean of each part, in milliseconds. */
export type AttemptNodeSpeed = {
  node: string;
  steps: number;
  stepMs: number;
  /** The page's own work on the node's act, by the extension's clock (`page.<action>` inside `act`). */
  actionMs: number;
  /** The rest of the step: `stepMs` less `actionMs`. */
  overheadMs: number;
  /** The mean of each span the steps recorded, by name, summed within a step first. */
  spans: Record<string, number>;
};

/**
 * Where an attempt's wall time went (task speed S0), summed from what each
 * step's `meta.json` recorded: model decisions split into hidden thinking and
 * visible output by their tokens, the browser's action and its overhead from
 * the spans a node run writes (`domain/src/runtime/llm-evidence/node-run/timing/`),
 * the judge, the chat's interpretation, other tools and Core's gaps.
 */
export type AttemptSpeed = {
  wallMs: number;
  decisions: { calls: number; ms: number; thinkingMs: number; outputMs: number; uncachedInputTokens: number };
  browser: { steps: number; ms: number; actionMs: number; overheadMs: number; unsplitMs: number };
  judgeMs: number;
  /** Model calls the step log attributes to this attempt by their kind: the chat's reading of the typed instruction, and the judge. The decisions are `decisions.calls`. */
  interpretationCalls: number;
  judgeCalls: number;
  interpretationMs: number;
  otherToolMs: number;
  otherMs: number;
  /** Wall time no step covered: Core between steps. */
  gapsMs: number;
  nodes: AttemptNodeSpeed[];
};

type Span = { name: string; at: number; ms: number };
type StepRead = { folder: string; meta: Record<string, unknown>; node: string | undefined; visibleChars: number };

/** Characters per token of visible text, which is how a reply's visible share of its billed output is estimated. */
const CHARS_PER_TOKEN = 3.3;

const number = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) ? value : 0);
const isMissing = (error: unknown): boolean => (error as NodeJS.ErrnoException).code === "ENOENT";

async function readText(file: string): Promise<string | undefined> {
  try {
    return await readFile(file, "utf8");
  } catch (error) {
    if (isMissing(error)) return undefined;
    throw error;
  }
}

function parsed(raw: string | undefined): Record<string, unknown> | undefined {
  if (raw === undefined) return undefined;
  try {
    const value = JSON.parse(raw) as unknown;
    return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
  } catch (error) {
    if (error instanceof SyntaxError) return undefined;
    throw error;
  }
}

/** The steps since `skip`, in the order they were logged; a folder without a whole `meta.json` is not a step yet. */
async function readSteps(stepsDirectory: string, skip: number): Promise<StepRead[]> {
  let folders: string[];
  try {
    folders = (await readdir(stepsDirectory, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort().slice(skip);
  } catch (error) {
    if (isMissing(error)) return [];
    throw error;
  }
  const steps: StepRead[] = [];
  for (const folder of folders) {
    const meta = parsed(await readText(path.join(stepsDirectory, folder, "meta.json")));
    if (!meta) continue;
    const call = typeof meta.toolId === "string" ? parsed(await readText(path.join(stepsDirectory, folder, "call.json"))) : undefined;
    const input = call?.input as Record<string, unknown> | undefined;
    const node = typeof input?.node === "string" ? input.node : typeof meta.toolId === "string" ? meta.toolId : undefined;
    const visibleChars = typeof meta.provider === "string" ? (await readText(path.join(stepsDirectory, folder, "response.txt")))?.length ?? 0 : 0;
    steps.push({ folder, meta, node, visibleChars });
  }
  return steps;
}

function spansOf(meta: Record<string, unknown>): Span[] {
  return Array.isArray(meta.spans) ? (meta.spans as unknown[]).filter((span): span is Span => typeof span === "object" && span !== null && typeof (span as Span).name === "string" && Number.isFinite((span as Span).at) && Number.isFinite((span as Span).ms)) : [];
}

/** The page's own work on a step's act: `page.*` spans inside its `act` span, or, for a look with no act, every `page.*` span. */
function actionMs(spans: readonly Span[]): number {
  const pages = spans.filter((span) => span.name.startsWith("page."));
  // A node run's act is `act`; a Flow run's step dispatches its act as `dispatch` (Core `engine/automation/node-execution/attempt.ts`).
  const act = spans.find((span) => span.name === "act") ?? spans.find((span) => span.name === "dispatch");
  const inAct = act ? pages.filter((span) => span.at >= act.at && span.at <= act.at + act.ms) : pages;
  return inAct.reduce((sum, span) => sum + span.ms, 0);
}

const round = (value: number): number => Math.round(value);

/** Where the time of the attempt whose steps follow the first `skip` folders went. */
export async function attemptSpeed(stepsDirectory: string, skip = 0): Promise<AttemptSpeed> {
  const steps = await readSteps(stepsDirectory, skip);
  const speed: AttemptSpeed = {
    wallMs: 0,
    decisions: { calls: 0, ms: 0, thinkingMs: 0, outputMs: 0, uncachedInputTokens: 0 },
    browser: { steps: 0, ms: 0, actionMs: 0, overheadMs: 0, unsplitMs: 0 },
    judgeMs: 0, interpretationCalls: 0, judgeCalls: 0, interpretationMs: 0, otherToolMs: 0, otherMs: 0, gapsMs: 0, nodes: []
  };
  const nodes = new Map<string, { steps: number; stepMs: number; actionMs: number; spans: Map<string, number> }>();
  let first: number | undefined;
  let last: number | undefined;
  let covered = 0;
  for (const { meta, node, visibleChars } of steps) {
    const ms = number(meta.ms);
    const startedAt = Date.parse(String(meta.startedAt));
    const finishedAt = Date.parse(String(meta.finishedAt));
    if (Number.isFinite(startedAt)) first = first === undefined ? startedAt : Math.min(first, startedAt);
    if (Number.isFinite(finishedAt)) last = last === undefined ? finishedAt : Math.max(last, finishedAt);
    covered += ms;
    const kind = String(meta.kind);
    if (kind === "judge") {
      speed.judgeMs += ms;
      if (typeof meta.provider === "string") speed.judgeCalls += 1;
    } else if (kind === "chat") {
      speed.interpretationMs += ms;
      if (typeof meta.provider === "string") speed.interpretationCalls += 1;
    }
    else if (typeof meta.provider === "string") {
      const usage = (meta.usage ?? {}) as Record<string, unknown>;
      const output = number(usage.outputTokens);
      const visible = Math.min(output, visibleChars / CHARS_PER_TOKEN);
      const thinking = output > 0 ? ms * (output - visible) / output : 0;
      speed.decisions.calls += 1;
      speed.decisions.ms += ms;
      speed.decisions.thinkingMs += thinking;
      speed.decisions.outputMs += ms - thinking;
      speed.decisions.uncachedInputTokens += number(usage.cacheMissInputTokens);
    } else if (kind === "tool" || kind === "test" || kind === "flow") {
      // A `flow` step is one node of a saved Flow's run, which no tool call wraps (Core `step-log/flow-step.ts`, task speed S10).
      const spans = spansOf(meta);
      const browser = spans.some((span) => span.name.startsWith("send."));
      if (!browser && spans.length > 0) {
        speed.otherToolMs += ms;
        continue;
      }
      if (spans.length === 0) {
        // A step from before spans were written, or a tool that sent nothing: counted whole, not split.
        if (node?.startsWith("web.output.") || node === "core.run_node") {
          speed.browser.steps += 1;
          speed.browser.ms += ms;
          speed.browser.unsplitMs += ms;
        } else speed.otherToolMs += ms;
        continue;
      }
      const action = actionMs(spans);
      speed.browser.steps += 1;
      speed.browser.ms += ms;
      speed.browser.actionMs += action;
      speed.browser.overheadMs += Math.max(0, ms - action);
      const named = (node ?? "unknown").replace(/^web\.output\./u, "");
      const key = kind === "flow" ? `${named} (Flow run)` : named;
      const entry = nodes.get(key) ?? { steps: 0, stepMs: 0, actionMs: 0, spans: new Map<string, number>() };
      entry.steps += 1;
      entry.stepMs += ms;
      entry.actionMs += action;
      for (const span of spans) entry.spans.set(span.name, (entry.spans.get(span.name) ?? 0) + span.ms);
      nodes.set(key, entry);
    } else speed.otherMs += ms;
  }
  speed.wallMs = first !== undefined && last !== undefined ? last - first : 0;
  speed.gapsMs = Math.max(0, speed.wallMs - covered);
  speed.nodes = [...nodes.entries()].sort((left, right) => right[1].steps - left[1].steps).map(([node, entry]) => ({
    node,
    steps: entry.steps,
    stepMs: round(entry.stepMs / entry.steps),
    actionMs: round(entry.actionMs / entry.steps),
    overheadMs: round((entry.stepMs - entry.actionMs) / entry.steps),
    spans: Object.fromEntries([...entry.spans.entries()].sort().map(([name, total]) => [name, round(total / entry.steps)]))
  }));
  speed.decisions = { ...speed.decisions, thinkingMs: round(speed.decisions.thinkingMs), outputMs: round(speed.decisions.outputMs) };
  return speed;
}

const seconds = (ms: number): string => (ms / 1000).toFixed(1);

/** The attempt report's speed section: one line for the attempt, one per node type. */
export function attemptSpeedLines(attempt: number, speed: AttemptSpeed): string[] {
  const { decisions, browser } = speed;
  const unsplit = browser.unsplitMs > 0 ? `, ${seconds(browser.unsplitMs)} s with no spans` : "";
  const lines = [
    `Speed of attempt ${attempt}: ${seconds(speed.wallMs)} s wall. Model decisions ${seconds(decisions.ms)} s over ${decisions.calls} calls (thinking about ${seconds(decisions.thinkingMs)} s, output and input ${seconds(decisions.outputMs)} s, ${decisions.uncachedInputTokens} uncached input tokens; time to first token is not logged). ` +
    `Browser ${seconds(browser.ms)} s over ${browser.steps} steps (action ${seconds(browser.actionMs)} s, overhead ${seconds(browser.overheadMs)} s${unsplit}). ` +
    `Judge ${seconds(speed.judgeMs)} s, interpretation ${seconds(speed.interpretationMs)} s, other tools ${seconds(speed.otherToolMs)} s, other steps ${seconds(speed.otherMs)} s, gaps ${seconds(speed.gapsMs)} s.`
  ];
  for (const node of speed.nodes) {
    const parts = Object.entries(node.spans).map(([name, ms]) => `${name} ${ms}`).join(", ");
    lines.push(`  ${node.node} x${node.steps}: ${node.stepMs} ms a step, action ${node.actionMs}, overhead ${node.overheadMs} (mean ms: ${parts}).`);
  }
  return lines;
}
