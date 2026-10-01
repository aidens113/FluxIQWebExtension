// What the automations tab and the open automation's strip know and ask for
// (plan 3.1, "run controls"; 3.5; 3.9). No DOM: `automations-tab.ts` and
// `automation-strip.ts` render `state()`, and the one browser side effect,
// saving an export, arrives as the injected `download`.
//
// Faces, by `AutomationsState.mode`:
//   offline   not connected: nothing is read
//   loading   connected, no list read yet (a read error may show)
//   fallback  the background does not relay the list: "Your saved automations
//             are in FluxIQ." -- for as long as the panel lives, so a panel
//             reopen is the only retry
//   empty     FluxIQ has no automations
//   list      the rows, newest first
//
// A run's detail (what it learned, its datasets) is read only for the
// automation the person opened (`focus`), so a long list costs one read.
//
// A read failure keeps what was on screen and shows its sentence until the
// next successful read. A run, a run's detail and an export each fail into
// their own row, never into the list.

import { AUTOMATION_PANEL_MESSAGES as MESSAGES, type ExtensionStatus } from "../../shared/protocol";
import type { PanelStore } from "../state";
import { automationRows } from "./rows";
import type { AutomationRow, RunDataset, RunDetail, RunReply, RunSummary } from "./types";
import { readCore } from "./read-core";
import { runFacts } from "./facts";
import { readRunReplies } from "./replies";
import { runSummaryLines } from "./summary-copy";

export type AutomationsMode = "offline" | "loading" | "fallback" | "empty" | "list";

/** A row's own message; `openFluxIQ` adds the Open FluxIQ way out beside it. */
export type AutomationRowNotice = { sentence: string; detail?: string | undefined; openFluxIQ: boolean };

/** One automation as the panel draws it: plain words only, plus the ids its buttons send. */
export type AutomationRowView = {
  flowId: string;
  name: string;
  lines: readonly string[];
  /** The last run's datasets, when its detail listed any. */
  datasets: readonly RunDataset[];
  runId?: string | undefined;
  running: boolean;
  exporting: boolean;
  notice?: AutomationRowNotice | undefined;
};

export type AutomationsState = {
  mode: AutomationsMode;
  rows: readonly AutomationRowView[];
  readError?: { sentence: string; detail?: string | undefined } | undefined;
  /** A run is in flight from this panel, so every Run waits. */
  runInFlight: boolean;
  /** FluxIQ is working already (the shell's held signal, not `status.runtime`), so Run waits. */
  working: boolean;
};

export type ExportFormat = "csv" | "json";

export type AutomationsController = {
  state(): AutomationsState;
  /** Reads the connection from the status. Answers true when it just became connected. */
  observe(status: ExtensionStatus): boolean;
  /** Whether FluxIQ is working, held steady by the shell; `status.runtime` flips for every page read, so it is not read here. */
  setWorking(working: boolean): void;
  /** Reads the list, then the opened automation's run detail when it still needs it. Does nothing offline or after `fallback`. */
  refresh(): Promise<void>;
  /** The automation the person opened, whose last run's detail is read; undefined for none. */
  focus(flowId: string | undefined): Promise<void>;
  run(flowId: string): Promise<void>;
  exportDataset(flowId: string, runId: string, datasetId: string, format: ExportFormat): Promise<void>;
};

/** Saves a file for the person; the panel passes the Blob-and-link download. */
export type SaveFile = (fileName: string, contentType: string, body: string) => void;

const TOO_LARGE = "Too large to export here — open it in FluxIQ.";

/** Creates the controller; `onChange` is called after every change to `state()`. */
export function createAutomationsController(
  request: PanelStore["request"],
  hooks: { onChange(): void; download: SaveFile }
): AutomationsController {
  let connected = false;
  let working = false;
  let listUnsupported = false;
  let runUnsupported = false;
  let detailUnsupported = false;
  let reading = false;
  let rows: AutomationRow[] | undefined;
  let readError: AutomationsState["readError"];
  let runningFlowId: string | undefined;
  let focused: string | undefined;
  const exporting = new Set<string>();
  const notices = new Map<string, AutomationRowNotice>();
  const replies = new Map<string, RunReply>();
  const details = new Map<string, RunDetail>();
  const detailsAsked = new Set<string>();

  function lastRun(row: AutomationRow): RunSummary | undefined {
    const replied = replies.get(row.flowId)?.run;
    if (replied === undefined) return row.lastRun;
    if (row.lastRun === undefined) return replied;
    if (row.lastRun.runId === replied.runId) return row.lastRun;
    return (replied.updatedAt ?? -Infinity) > (row.lastRun.updatedAt ?? -Infinity) ? replied : row.lastRun;
  }

  function factsOf(run: RunSummary) {
    const reply = [...replies.values()].find((held) => held.run.runId === run.runId);
    const detail = details.get(run.runId);
    return runFacts({
      run,
      createdAdaptationIds: reply?.createdAdaptationIds,
      durableBehaviorChanged: reply?.durableBehaviorChanged,
      adaptationIds: detail?.adaptationIds,
      adaptationStatuses: detail?.adaptationStatuses
    });
  }

  function rowView(row: AutomationRow): AutomationRowView {
    const run = lastRun(row);
    const running = runningFlowId === row.flowId;
    const lines = running ? ["Running..."] : run === undefined ? ["Not run yet"] : runSummaryLines(factsOf(run));
    return {
      flowId: row.flowId,
      name: row.name,
      lines: lines.length === 0 ? ["Ran"] : lines,
      datasets: running || run === undefined ? [] : details.get(run.runId)?.datasets ?? [],
      runId: run?.runId,
      running,
      exporting: exporting.has(row.flowId),
      notice: notices.get(row.flowId)
    };
  }

  function mode(): AutomationsMode {
    if (listUnsupported) return "fallback";
    if (!connected) return "offline";
    if (rows === undefined) return "loading";
    return rows.length === 0 ? "empty" : "list";
  }

  // A detail is worth asking for once, and again only while what the run
  // learned is still being checked.
  function needsDetail(run: RunSummary): boolean {
    if (detailUnsupported) return false;
    if (!detailsAsked.has(run.runId)) return true;
    if (!details.has(run.runId)) return false;
    const facts = factsOf(run);
    return (facts.learned ?? 0) > 0 && facts.validated === undefined && facts.futureRunsUpdated !== true;
  }

  async function loadDetail(runId: string): Promise<void> {
    detailsAsked.add(runId);
    const result = await request<unknown>({ type: MESSAGES.runDetail, runId });
    if (!result.ok) {
      if (result.unsupported) detailUnsupported = true;
      else detailsAsked.delete(runId);
      return;
    }
    const detail = readRunReplies.detail(result.value);
    if (detail !== undefined) {
      details.set(runId, detail);
      hooks.onChange();
    }
  }

  async function refresh(): Promise<void> {
    if (reading || listUnsupported || !connected) return;
    reading = true;
    const result = await request<unknown>({ type: MESSAGES.listAutomations });
    reading = false;
    if (!result.ok) {
      if (result.unsupported) listUnsupported = true;
      else readError = { sentence: result.sentence, detail: result.detail };
      hooks.onChange();
      return;
    }
    const payload = readCore.record(readCore.record(result.value)?.payload);
    if (payload === undefined || !Array.isArray(payload.flows)) {
      readError = { sentence: "Couldn't read your automations from FluxIQ.", detail: "The list answer had no flows." };
      hooks.onChange();
      return;
    }
    rows = automationRows(payload);
    readError = undefined;
    hooks.onChange();
    await loadFocusedDetail();
  }

  async function loadFocusedDetail(): Promise<void> {
    const row = rows?.find((candidate) => candidate.flowId === focused);
    const run = row === undefined ? undefined : lastRun(row);
    if (run !== undefined && needsDetail(run)) await loadDetail(run.runId);
  }

  return {
    state: () => ({
      mode: mode(),
      rows: (rows ?? []).map(rowView),
      readError: listUnsupported ? undefined : readError,
      runInFlight: runningFlowId !== undefined,
      working
    }),
    observe(status) {
      const was = connected;
      connected = status.connectionState === "connected";
      if (was !== connected) hooks.onChange();
      return connected && !was;
    },
    setWorking(next) {
      if (next === working) return;
      working = next;
      hooks.onChange();
    },
    refresh,
    async focus(flowId) {
      focused = flowId;
      if (connected && !listUnsupported) await loadFocusedDetail();
    },
    async run(flowId) {
      if (runningFlowId !== undefined || working || !connected) return;
      if (runUnsupported) {
        notices.set(flowId, { sentence: "Run it in FluxIQ.", openFluxIQ: true });
        hooks.onChange();
        return;
      }
      runningFlowId = flowId;
      notices.delete(flowId);
      hooks.onChange();
      const result = await request<unknown>({ type: MESSAGES.runAutomation, flowId });
      runningFlowId = undefined;
      const reply = result.ok ? readRunReplies.run(result.value) : undefined;
      if (!result.ok) {
        if (result.unsupported) runUnsupported = true;
        notices.set(flowId, result.unsupported
          ? { sentence: "Run it in FluxIQ.", openFluxIQ: true }
          : { sentence: result.sentence, detail: result.detail, openFluxIQ: false });
      } else if (reply === undefined) {
        notices.set(flowId, { sentence: "It ran, but FluxIQ didn't say how it went.", openFluxIQ: true });
      } else {
        replies.set(flowId, reply);
        detailsAsked.delete(reply.run.runId);
      }
      hooks.onChange();
      await refresh();
      if (reply !== undefined && !detailsAsked.has(reply.run.runId) && !detailUnsupported) await loadDetail(reply.run.runId);
    },
    async exportDataset(flowId, runId, datasetId, format) {
      if (exporting.has(flowId)) return;
      exporting.add(flowId);
      notices.delete(flowId);
      hooks.onChange();
      const result = await request<unknown>({ type: MESSAGES.exportDataset, runId, datasetId, format });
      exporting.delete(flowId);
      const exported = result.ok ? readRunReplies.export(result.value) : undefined;
      if (!result.ok) {
        notices.set(flowId, result.unsupported
          ? { sentence: "Export it in FluxIQ.", openFluxIQ: true }
          : { sentence: result.sentence, detail: result.detail, openFluxIQ: false });
      } else if (exported === undefined) {
        notices.set(flowId, { sentence: "Couldn't read the export from FluxIQ.", openFluxIQ: true });
      } else if (exported.tooLarge) {
        notices.set(flowId, { sentence: TOO_LARGE, openFluxIQ: true });
      } else {
        hooks.download(exported.fileName, exported.contentType, exported.body);
      }
      hooks.onChange();
    }
  };
}
