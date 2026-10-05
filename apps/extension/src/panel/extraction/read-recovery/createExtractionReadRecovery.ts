import type { ExtractionPreviewColumn, ExtractionSessionIdentity, ExtractionSessionView } from "../messages";

type Stage = "session" | "preview" | "prepare" | "start";
type Operation = { epoch: number; stage: Stage; identity: ExtractionSessionIdentity | undefined; selection?: string };
export type ExtractionRecoveryTicket = { readonly epoch: number; readonly identity: ExtractionSessionIdentity | undefined; readonly stage: Stage; readonly label: string; readonly sentence: string; readonly selection?: string | undefined };
type Hooks = {
  epoch(): number;
  identity(): ExtractionSessionIdentity | undefined;
  acceptIdentity(identity: ExtractionSessionIdentity): void;
  busy(): boolean;
  selection(): readonly ExtractionPreviewColumn[] | undefined;
  runBusy(work: () => Promise<void>): Promise<void>;
  acceptSession(session: ExtractionSessionView | undefined, restore: boolean): void;
  acceptPreview(session: ExtractionSessionView | undefined): void;
  showError(ticket: ExtractionRecoveryTicket, sentence: string): void;
  clearError(ticket: ExtractionRecoveryTicket): void;
  onChange(): void;
};
const labels: Record<Stage, string> = { session: "Retry reading item", preview: "Retry preview", prepare: "Try starting again", start: "Retry picking item" };
const sentences: Record<Stage, string> = {
  session: "Couldn't read the extraction session. Try again.", preview: "Couldn't refresh the preview. Try again.",
  prepare: "Couldn't prepare the recording. Try again.", start: "Couldn't start picking an item. Try again."
};
const keyOf = (selection: readonly ExtractionPreviewColumn[] | undefined) => JSON.stringify(selection);

/** Local pick/read recovery; issued background operations are never treated as cancelled. */
export function createExtractionReadRecovery(
  client: { read(columns?: readonly ExtractionPreviewColumn[], identity?: ExtractionSessionIdentity): Promise<ExtractionSessionView | undefined>; start(): Promise<ExtractionSessionIdentity | undefined>; prepare?: (() => Promise<void>) | undefined },
  hooks: Hooks
) {
  let sessionRead: Operation | undefined, previewRead: Operation | undefined, pick: Operation | undefined;
  let polling: ReturnType<typeof setInterval> | undefined;
  let prepared = false;
  let pollOwner: object | undefined;
  const failures = new Map<Stage, ExtractionRecoveryTicket>();
  const current = (op: Operation) => op.epoch === hooks.epoch() && op.identity === hooks.identity();
  const activePreview = (op: Operation) => current(op) && previewRead === op && op.selection === keyOf(hooks.selection());
  const owns = (op: Operation) => op.stage === "preview" ? activePreview(op) : current(op) && (op.stage === "session" ? sessionRead === op : pick === op);
  function clear(stage: Stage): void {
    const ticket = failures.get(stage);
    if (!ticket) return;
    failures.delete(stage); hooks.clearError(ticket);
  }
  function fail(op: Operation, error: unknown): void {
    const refusal = error instanceof Error && (error as Error & { extractionRefusal?: unknown }).extractionRefusal === true;
    const sentence = error instanceof Error && (refusal || op.stage === "prepare") ? error.message : sentences[op.stage];
    const ticket = { epoch: op.epoch, identity: op.identity, stage: op.stage, label: labels[op.stage], sentence, selection: op.selection };
    clear(op.stage);
    if (!owns(op)) return;
    failures.set(op.stage, ticket); hooks.showError(ticket, sentence); hooks.onChange();
  }
  function stopPolling(): void { if (polling !== undefined) clearInterval(polling); polling = undefined; pollOwner = undefined; }
  function startPolling(): void {
    if (polling !== undefined) return;
    const owner = {}, epoch = hooks.epoch(), identity = hooks.identity(); pollOwner = owner;
    polling = setInterval(() => { if (pollOwner === owner && epoch === hooks.epoch() && identity === hooks.identity()) void refresh(); }, 600);
  }
  function reset(): void {
    stopPolling(); sessionRead = undefined; previewRead = undefined; pick = undefined; prepared = false;
    for (const stage of [...failures.keys()]) clear(stage);
    hooks.onChange();
  }
  function bind(op: Operation, identity: ExtractionSessionIdentity): void {
    if (!op.identity) { stopPolling(); hooks.acceptIdentity(Object.freeze({ sessionId: identity.sessionId, tabId: identity.tabId, form: identity.form })); op.identity = hooks.identity(); }
  }
  async function refresh(restore = false): Promise<void> {
    if (hooks.busy() || (sessionRead && current(sessionRead))) return;
    const op: Operation = { epoch: hooks.epoch(), identity: hooks.identity(), stage: "session" }; sessionRead = op; hooks.onChange();
    try {
      if (!current(op) || sessionRead !== op || hooks.busy()) return;
      const session = await client.read(undefined, op.identity);
      if (!current(op) || sessionRead !== op) return;
      clear("session");
      if (current(op) && sessionRead === op) { if (session) bind(op, session); if (current(op)) hooks.acceptSession(session, restore); }
    } catch (error) {
      if (current(op) && sessionRead === op) { stopPolling(); fail(op, error); }
    } finally { if (sessionRead === op) { sessionRead = undefined; hooks.onChange(); } }
  }
  async function refreshPreview(selection: readonly ExtractionPreviewColumn[]): Promise<void> {
    if (hooks.busy()) return;
    const epoch = hooks.epoch();
    const selected = selection.map(column => ({ ...column }));
    const key = keyOf(selected);
    if (key !== keyOf(hooks.selection())) return;
    const previous = previewRead;
    if (previous && activePreview(previous) && previous.selection === key) return;
    if (failures.has("preview") && failures.get("preview")?.selection !== key) clear("preview");
    const op: Operation = { epoch, identity: hooks.identity(), stage: "preview", selection: key }; previewRead = op; hooks.onChange();
    try {
      if (!activePreview(op) || hooks.busy()) return;
      const session = await client.read(selected, op.identity);
      if (!activePreview(op)) return;
      clear("preview");
      if (activePreview(op)) { if (!session && op.identity) hooks.acceptSession(undefined, false); else hooks.acceptPreview(session); }
    } catch (error) { if (activePreview(op)) fail(op, error); }
    finally { if (previewRead === op) { previewRead = undefined; hooks.onChange(); } }
  }
  async function beginPick(verify = false): Promise<void> {
    if (hooks.busy() || (pick && current(pick))) return;
    const op: Operation = { epoch: hooks.epoch(), identity: hooks.identity(), stage: prepared ? "start" : "prepare" }; pick = op; hooks.onChange();
    try {
      if (!current(op) || pick !== op || hooks.busy()) return;
      await hooks.runBusy(async () => {
        try {
          if (!current(op) || pick !== op) return;
          if (verify) {
            op.stage = "start";
            const session = await client.read(undefined, op.identity);
            if (!current(op) || pick !== op) return;
            if (session) { clear("start"); if (owns(op)) { bind(op, session); if (owns(op)) hooks.acceptSession(session, true); } return; }
          }
          if (!prepared) {
            op.stage = "prepare"; await client.prepare?.();
            if (!current(op) || pick !== op) return;
            prepared = true;
          }
          op.stage = "start";
          if (!current(op) || pick !== op) return;
          const identity = await client.start();
          if (!current(op) || pick !== op) return;
          if (identity) bind(op, identity);
          clear("prepare");
          if (!owns(op)) return;
          clear("start");
          if (owns(op)) startPolling();
        } catch (error) {
          if (current(op) && pick === op) { stopPolling(); if (op.stage === "start") clear("prepare"); fail(op, error); }
        }
      });
    } finally { if (pick === op) { pick = undefined; hooks.onChange(); } }
  }
  return {
    refresh, refreshPreview, beginPick: () => beginPick(), startPolling, stopPolling, reset,
    state() {
      const ticket = [...failures.values()].filter(ticket => ticket.epoch === hooks.epoch() && ticket.identity === hooks.identity()).at(-1);
      const pending = ticket?.stage === "session" ? sessionRead !== undefined : ticket?.stage === "preview" ? previewRead !== undefined : pick !== undefined;
      // The preview's own observation, for the note beside the sample: a read for
      // the columns shown now is in flight, or the last one for them failed. Both
      // are fenced to the current selection, so an older selection's read can
      // neither mark the new sample pending nor call it stale.
      const previewPending = previewRead !== undefined && activePreview(previewRead);
      const failedPreview = failures.get("preview");
      const previewFailed = failedPreview !== undefined && failedPreview.epoch === hooks.epoch() && failedPreview.identity === hooks.identity()
        && failedPreview.selection === keyOf(hooks.selection());
      return { ticket, pending: pending || hooks.busy(), previewPending, previewFailed };
    },
    async retry(ticket: ExtractionRecoveryTicket): Promise<void> {
      if (ticket.epoch !== hooks.epoch() || ticket.identity !== hooks.identity() || failures.get(ticket.stage) !== ticket || hooks.busy()) return;
      if (ticket.stage === "session") await refresh(true);
      else if (ticket.stage === "preview") { const selection = hooks.selection(); if (selection) await refreshPreview(selection); }
      else await beginPick(ticket.stage === "start");
    }
  };
}
