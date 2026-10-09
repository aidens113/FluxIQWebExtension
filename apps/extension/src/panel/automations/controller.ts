// What the automations tab and the open automation's strip know and ask for
// (plan 3.1, "run controls"; 3.5; 3.9). No DOM: `automations-tab.ts` and
// `automation-strip.ts` render `state()`, and the one browser side effect,
// saving an export, arrives as the injected `download`.
//
// Faces, by `AutomationsState.mode`:
//   offline   not connected: nothing is read
//   loading   connected, no list read yet (a read error may show)
//   fallback  the background does not relay the list: "Your saved automations
//             are in FluxIQ." -- for this confirmed owner; a replacement
//             owner gets its own capability check
//   empty     FluxIQ has no automations
//   list      the rows, newest first
//
// A run's detail (what it learned, its datasets) is read only for the
// automation the person opened (`focus`), so a long list costs one read.
//
// A read failure keeps what was on screen and shows its sentence until the
// next successful read. A run, a run's detail and an export each fail into
// their own row, never into the list.

import { RUNTIME_MESSAGES } from "../../shared/constants";
import { AUTOMATION_PANEL_MESSAGES as MESSAGES, type ExtensionStatus, type PanelRelayResponse } from "../../shared/protocol";
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
  /** A run of this automation is in progress, from this panel's Run or as FluxIQ last listed it, so Stop is offered. */
  stoppable: boolean;
  /** Stop's state while `stoppable`: sending, sent and waiting for the run to end, or failed. */
  stop?: AutomationStopState | undefined;
  exporting: boolean;
  notice?: AutomationRowNotice | undefined;
};

export type AutomationStopState = "stopping" | "requested" | "failed";

export type AutomationsState = {
  /** Local rendered-control lease; never sent to FluxIQ. */
  ownerRevision: number;
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
  /** Reads the connection from the status. Answers true when a connected owner needs a fresh read. */
  observe(status: ExtensionStatus): boolean;
  /** Whether FluxIQ is working, held steady by the shell; `status.runtime` flips for every page read, so it is not read here. */
  setWorking(working: boolean): void;
  /** Reads the list, then the opened automation's run detail when it still needs it. Does nothing offline or after `fallback`. */
  refresh(owner?: number): Promise<void>;
  /** The automation the person opened, whose last run's detail is read; undefined for none. */
  focus(flowId: string | undefined, owner?: number): Promise<void>;
  run(flowId: string, owner?: number): Promise<void>;
  /**
   * Stops this automation's run in progress: by its run id when known, else
   * (a Run from this panel, whose id arrives only with its reply) every active
   * run of the project, which is one run at a time.
   */
  stop(flowId: string, owner?: number): Promise<void>;
  exportDataset(flowId: string, runId: string, datasetId: string, format: ExportFormat, owner?: number): Promise<void>;
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
  // Owner changes retire foreign evidence; connection changes retire pending work.
  // Object identity prevents an obsolete finally from unlocking a new same-ID operation.
  type Operation = { owner: number; connection: number; focus: number };
  let ownerRevision = 0;
  let connectionRevision = 0;
  let focusRevision = 0;
  let ownerKey: string | undefined;
  let coreAddress: string | undefined;
  let reading: Operation | undefined;
  let running: Operation | undefined;
  const detailReads = new Map<string, Operation>();
  let rows: AutomationRow[] | undefined;
  let readError: AutomationsState["readError"];
  let runningFlowId: string | undefined;
  let focused: string | undefined;
  const exporting = new Map<string, Operation>();
  const stops = new Map<string, { op: Operation; state: AutomationStopState }>();
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
      // A run started here answers in its reply; any other run (the chat's
      // "run it", a playback through the API) says it in the run list.
      durableBehaviorChanged: reply?.durableBehaviorChanged ?? run.durableBehaviorChanged,
      adaptationIds: detail?.adaptationIds,
      adaptationStatuses: detail?.adaptationStatuses
    });
  }

  function rowView(row: AutomationRow): AutomationRowView {
    const run = lastRun(row);
    const running = runningFlowId === row.flowId;
    const stoppable = running || (run !== undefined && factsOf(run).outcome === "running");
    const lines = running ? ["Running..."] : run === undefined ? ["Not run yet"] : runSummaryLines(factsOf(run));
    return {
      flowId: row.flowId,
      name: row.name,
      lines: lines.length === 0 ? ["Ran"] : lines,
      datasets: running || run === undefined ? [] : details.get(run.runId)?.datasets ?? [],
      runId: run?.runId,
      running,
      stoppable,
      stop: stoppable ? stops.get(row.flowId)?.state : undefined,
      exporting: exporting.has(row.flowId),
      notice: notices.get(row.flowId)
    };
  }

  function mode(): AutomationsMode {
    if (!connected) return "offline";
    if (listUnsupported) return "fallback";
    if (rows === undefined) return "loading";
    return rows.length === 0 ? "empty" : "list";
  }

  // A detail is worth asking for once, and again only while the run's
  // adaptations are still being checked.
  function needsDetail(run: RunSummary): boolean {
    if (detailUnsupported) return false;
    if (!detailsAsked.has(run.runId)) return true;
    if (!details.has(run.runId)) return false;
    const facts = factsOf(run);
    return (facts.changesTried ?? 0) > 0 && facts.validated === undefined && facts.futureRunsUpdated !== true;
  }


  const operation = (): Operation => ({ owner: ownerRevision, connection: connectionRevision, focus: focusRevision });
  const current = (op: Operation): boolean => connected && op.owner === ownerRevision && op.connection === connectionRevision;
  const leased = (owner: number | undefined): boolean => owner === undefined || owner === ownerRevision;
  const rowFor = (flowId: string) => rows?.find((row) => row.flowId === flowId);
  function invalidateOperations(): void {
    reading = undefined;
    running = undefined;
    runningFlowId = undefined;
    exporting.clear();
    stops.clear();
    for (const id of detailReads.keys()) if (!details.has(id)) detailsAsked.delete(id);
    detailReads.clear();
  }

  async function loadDetail(flowId: string, runId: string): Promise<void> {
    if (!connected || detailReads.has(runId) || detailUnsupported) return;
    const op = operation();
    detailReads.set(runId, op);
    detailsAsked.add(runId);
    try {
      const result = await request<unknown>({ type: MESSAGES.runDetail, runId });
      if (!current(op) || detailReads.get(runId) !== op || op.focus !== focusRevision || (rowFor(flowId) === undefined || lastRun(rowFor(flowId)!)?.runId !== runId)) return;
      if (!result.ok) {
        if (result.unsupported) detailUnsupported = true;
        else detailsAsked.delete(runId);
        return;
      }
      const detail = readRunReplies.detail(result.value);
      if (detail !== undefined && (detail.run === undefined || detail.run.runId === runId && detail.run.flowId === flowId)) { details.set(runId, detail); hooks.onChange(); }
      else detailsAsked.delete(runId);
    } catch {
      if (current(op) && detailReads.get(runId) === op && op.focus === focusRevision && rowFor(flowId) !== undefined) {
        detailsAsked.delete(runId);
        notices.set(flowId, { sentence: "Couldn't read this run's details. Try again.", openFluxIQ: false });
        hooks.onChange();
      }
    } finally {
      if (detailReads.get(runId) === op) {
        detailReads.delete(runId);
        if (!details.has(runId)) detailsAsked.delete(runId);
      }
    }
  }

  async function refresh(owner?: number): Promise<void> {
    if (!leased(owner) || reading || listUnsupported || !connected) return;
    const op = operation();
    reading = op;
    try {
      const result = await request<unknown>({ type: MESSAGES.listAutomations });
      if (!current(op) || reading !== op) return;
      if (!result.ok) {
        if (result.unsupported) listUnsupported = true;
        else readError = { sentence: result.sentence, detail: result.detail };
        hooks.onChange(); return;
      }
      const payload = readCore.record(readCore.record(result.value)?.payload);
      if (payload === undefined || !Array.isArray(payload.flows)) {
        readError = { sentence: "Couldn't read your automations from FluxIQ.", detail: "The list answer had no flows." };
        hooks.onChange(); return;
      }
      rows = automationRows(payload);
      readError = undefined;
      reading = undefined;
      hooks.onChange();
      if (current(op)) await loadFocusedDetail();
    } catch {
      if (current(op) && reading === op) {
        readError = { sentence: "Couldn't read your automations from FluxIQ. Try again." };
        hooks.onChange();
      }
    } finally { if (reading === op) reading = undefined; }
  }

  async function loadFocusedDetail(): Promise<void> {
    const row = rows?.find((candidate) => candidate.flowId === focused);
    const run = row === undefined ? undefined : lastRun(row);
    if (row !== undefined && run !== undefined && needsDetail(run)) await loadDetail(row.flowId, run.runId);
  }

  // The id of this automation's run in progress: from what is on screen, else
  // from a fresh read of the runs. A Run from this panel names its run only in
  // its reply, once the run ends, and a run started elsewhere (the chat's "run
  // it", a playback through the API) never answers here at all, so the run list
  // is where both are found. Undefined when neither names one.
  async function runningRunId(flowId: string): Promise<string | undefined> {
    const row = rowFor(flowId);
    const shown = row === undefined ? undefined : lastRun(row);
    if (shown !== undefined && factsOf(shown).outcome === "running") return shown.runId;
    const result = await request<unknown>({ type: MESSAGES.listAutomations });
    const listed = result.ok ? automationRows(readCore.record(readCore.record(result.value)?.payload)).find((candidate) => candidate.flowId === flowId)?.lastRun : undefined;
    return listed !== undefined && runFacts({ run: listed }).outcome === "running" ? listed.runId : undefined;
  }

  function exportable(flowId: string, runId: string, datasetId: string): boolean {
    const row = rowFor(flowId);
    return row !== undefined && lastRun(row)?.runId === runId && details.get(runId)?.datasets?.some((data) => data.datasetId === datasetId) === true;
  }

  return {
    state: () => ({ ownerRevision, mode: mode(), rows: (rows ?? []).map(rowView), readError: listUnsupported ? undefined : readError, runInFlight: running !== undefined, working }),
    observe(status) {
      if (status.settings !== undefined) coreAddress = status.settings.coreApiUrl.trim();
      // Omitted settings preserve the last confirmed HTTP address. Project absence
      // represents the unscoped session; ordinary session/runtime churn is irrelevant.
      const key = JSON.stringify([status.gatewayUrl.trim(), coreAddress, status.clientId, status.projectId ?? null, status.paired]);
      const replaced = ownerKey !== key;
      const nextConnected = status.connectionState === "connected" && status.paired;
      const changedConnection = nextConnected !== connected;
      if (replaced) {
        ownerKey = key; ownerRevision++; focusRevision++;
        rows = undefined; readError = undefined; focused = undefined;
        listUnsupported = false; runUnsupported = false; detailUnsupported = false;
        notices.clear(); replies.clear(); details.clear(); detailsAsked.clear();
      }
      if (replaced || changedConnection) { connectionRevision++; invalidateOperations(); }
      connected = nextConnected;
      if (replaced || changedConnection) hooks.onChange();
      return connected && (replaced || changedConnection);
    },
    // FluxIQ starting or finishing work is when a run started elsewhere begins
    // or ends, so the list is read again: the open automation's row then shows
    // the run in progress, with Stop, and afterwards how it went.
    setWorking(next) {
      if (next === working) return;
      working = next; hooks.onChange();
      if (connected && !listUnsupported) void refresh();
    },
    refresh,
    async focus(flowId, owner) {
      if (!leased(owner)) return;
      if (focused !== flowId) {
        focused = flowId; focusRevision++;
        for (const id of detailReads.keys()) if (!details.has(id)) detailsAsked.delete(id);
        detailReads.clear();
      }
      if (connected && !listUnsupported) await loadFocusedDetail();
    },
    async run(flowId, owner) {
      if (!leased(owner) || running || working || !connected || !rowFor(flowId)) return;
      if (runUnsupported) { notices.set(flowId, { sentence: "Run it in FluxIQ.", openFluxIQ: true }); hooks.onChange(); return; }
      const op = operation(); running = op; runningFlowId = flowId; notices.delete(flowId); stops.delete(flowId); hooks.onChange();
      if (!current(op) || running !== op) return;
      let reply: RunReply | undefined;
      try {
        const result = await request<unknown>({ type: MESSAGES.runAutomation, flowId });
        if (!current(op) || running !== op || !rowFor(flowId)) return;
        reply = result.ok ? readRunReplies.run(result.value) : undefined;
        if (reply?.run.flowId !== flowId) reply = undefined;
        if (!result.ok) {
          if (result.unsupported) runUnsupported = true;
          notices.set(flowId, result.unsupported ? { sentence: "Run it in FluxIQ.", openFluxIQ: true } : { sentence: result.sentence, detail: result.detail, openFluxIQ: false });
        } else if (!reply) notices.set(flowId, { sentence: "It ran, but FluxIQ didn't say how it went.", openFluxIQ: true });
        else { replies.set(flowId, reply); detailsAsked.delete(reply.run.runId); }
      } catch {
        if (current(op) && running === op) notices.set(flowId, { sentence: "Couldn't run this automation. Try again.", openFluxIQ: false });
      } finally {
        if (running === op) { running = undefined; runningFlowId = undefined; stops.delete(flowId); hooks.onChange(); }
      }
      if (!current(op)) return;
      await refresh(op.owner);
      if (current(op) && op.focus === focusRevision && reply && !detailsAsked.has(reply.run.runId) && !detailUnsupported) await loadDetail(flowId, reply.run.runId);
    },
    async stop(flowId, owner) {
      const row = rowFor(flowId);
      const held = stops.get(flowId)?.state;
      if (!leased(owner) || !connected || row === undefined || !rowView(row).stoppable || held === "stopping" || held === "requested") return;
      const op = operation(); const entry = { op, state: "stopping" as AutomationStopState }; stops.set(flowId, entry); hooks.onChange();
      const live = () => current(op) && stops.get(flowId) === entry;
      try {
        const runId = await runningRunId(flowId);
        if (!live()) return;
        const result = await request<PanelRelayResponse>({ type: RUNTIME_MESSAGES.panelStopRun, ...(runId === undefined ? {} : { runId }) });
        if (!live()) return;
        entry.state = result.ok && result.value?.ok === true ? "requested" : "failed";
      } catch {
        if (live()) entry.state = "failed";
      }
      if (live()) hooks.onChange();
    },
    async exportDataset(flowId, runId, datasetId, format, owner) {
      if (!leased(owner) || !connected || exporting.has(flowId) || !exportable(flowId, runId, datasetId)) return;
      const op = operation(); exporting.set(flowId, op); notices.delete(flowId); hooks.onChange();
      try {
        if (!current(op) || exporting.get(flowId) !== op) return;
        const result = await request<unknown>({ type: MESSAGES.exportDataset, runId, datasetId, format });
        if (!current(op) || exporting.get(flowId) !== op || !exportable(flowId, runId, datasetId)) return;
        const exported = result.ok ? readRunReplies.export(result.value) : undefined;
        if (!result.ok) notices.set(flowId, result.unsupported ? { sentence: "Export it in FluxIQ.", openFluxIQ: true } : { sentence: result.sentence, detail: result.detail, openFluxIQ: false });
        else if (!exported) notices.set(flowId, { sentence: "Couldn't read the export from FluxIQ.", openFluxIQ: true });
        else if (exported.tooLarge) notices.set(flowId, { sentence: TOO_LARGE, openFluxIQ: true });
        else hooks.download(exported.fileName, exported.contentType, exported.body);
      } catch {
        if (current(op) && exporting.get(flowId) === op) notices.set(flowId, { sentence: "Couldn't save the export here. Try again or open it in FluxIQ.", openFluxIQ: true });
      } finally {
        if (exporting.get(flowId) === op) { exporting.delete(flowId); hooks.onChange(); }
      }
    }
  };
}
