// In-flight command reconciliation (plan B3, Core C8): a committing act in
// flight when the service worker restarts or the socket drops must never read
// as "did not happen", and must never be made twice blindly.
//
// Three duties, each on one moment of a command's life:
//
//  - **Before it goes to a page**, a record is written to session storage
//    (`begin`), refined with the tab and document it was sent to
//    (`dispatched`), and cleared when its result is sent or queued (`settled`).
//  - **After the next `session_ready`**, a record no running command of this
//    worker owns is a command an earlier worker lost. It is reported as the
//    domain's interrupted result -- `unknown` for a committing act, an `unacted`
//    failure for any other (`domain/src/client/interrupted-action/`) -- and
//    cleared (`reportLeftovers`).
//  - **A command id that comes again** is answered with what this worker
//    already has for it instead of acting again (`answerRepeat`): nothing while
//    it is still running, since its own result will answer; the result just
//    sent; the result still waiting in the offline queue; or, for a record an
//    earlier worker left, the interrupted result. The window is the life of the
//    record plus the queued result, and a short memory of results just sent.
//  - **Core asking what became of a command** whose answer never reached it
//    (`server.reconcile_command`, Core C8) is answered from the same knowledge,
//    and never by acting (`reconcile`): `running`, `landed` with the result
//    kept, `unknown` when a record or the memory of receiving it is all that is
//    left, or `not_seen` when this browser never had it. An id answered
//    `not_seen` is refused from then on, so a copy still on its way can never
//    act after Core has made the act again.

import {
  webAutomationActionCommits,
  webAutomationInterruptedActionResult,
  webAutomationNotSeenOutcome,
  webAutomationReconcileAnswer,
  type WebAutomationReconcileAnswer
} from "@fluxiq-web-extension/domain/client";
import type { BrowserActionCommand, ClientGatewayActionResult, JsonObject } from "../../../shared/protocol";
import type { InFlightCommandRecord, InFlightRecordStore } from "./record-store";
import type { SeenCommandStore } from "./seen-store";

export type CommandReconciliationDeps = {
  readonly store: InFlightRecordStore;
  /** The result the offline queue holds for this command id, when it holds one (`GatewaySession.queuedActionResult`). */
  readonly queuedResult: (commandId: string) => Promise<ClientGatewayActionResult | undefined>;
  /** Sends a result as `client.action_result`, or queues it while the socket is down. */
  readonly send: (result: ClientGatewayActionResult) => Promise<void>;
  /** The document a frame holds now (`./frame-document.ts`); absent, records name no document. */
  readonly documentOf?: (tabId: number, frameId: number) => Promise<string | undefined>;
  /**
   * The ids this browser has received, kept past their records (`./seen-store.ts`).
   * Absent, a command whose result this worker no longer holds and whose record
   * is gone reads as never received.
   */
  readonly seen?: SeenCommandStore;
  readonly now?: () => number;
};

/** How a repeated command id was answered: still running here, its result sent again, or refused as one answered `not_seen`. */
export type RepeatAnswer = "running" | "resent" | "refused";

/** How many results just sent are remembered, newest kept. */
const RECENT_RESULTS = 16;

/** How many ids answered `not_seen` are refused, newest kept. */
const DISOWNED_LIMIT = 64;

export class CommandReconciliation {
  private readonly running = new Set<string>();
  private readonly recent = new Map<string, ClientGatewayActionResult>();
  private readonly disowned = new Set<string>();

  constructor(private readonly deps: CommandReconciliationDeps) {}

  /** Records a command about to be run, before anything is sent toward a page. */
  async begin(action: Pick<BrowserActionCommand, "commandId" | "actionType" | "options">, tabId: number | undefined): Promise<void> {
    this.running.add(action.commandId);
    const record: InFlightCommandRecord = {
      commandId: action.commandId,
      actionType: action.actionType,
      committing: webAutomationActionCommits(action.actionType, action.options as JsonObject | undefined),
      startedAt: this.now()
    };
    if (tabId !== undefined) record.tabId = tabId;
    await this.deps.store.write(record);
    await this.deps.seen?.mark(action.commandId, record.startedAt);
  }

  /** Names the tab and document the command is being sent to, just before it is. */
  async dispatched(commandId: string, tabId: number, frameId: number): Promise<void> {
    const record = await this.deps.store.read(commandId);
    if (record === undefined) return;
    const next: InFlightCommandRecord = { ...record, tabId };
    const documentId = await this.deps.documentOf?.(tabId, frameId);
    if (documentId !== undefined) next.documentId = documentId;
    else delete next.documentId;
    await this.deps.store.write(next);
  }

  /** The command's result was sent or queued: its record is cleared, and the result remembered for a repeat. */
  async settled(result: ClientGatewayActionResult): Promise<void> {
    this.remember(result);
    this.running.delete(result.commandId);
    await this.deps.store.remove(result.commandId);
  }

  /**
   * The command stopped running here without a result (its handler threw). Its
   * record stays: nothing answered it, so a repeat, or the next worker, reports
   * it as interrupted rather than acting again.
   */
  release(commandId: string): void {
    this.running.delete(commandId);
  }

  /**
   * Answers a command id this worker already has an answer for; `undefined`
   * means it is new and may run. A new id is claimed as running before the
   * first wait, so Core asking about it meanwhile hears `running`, never
   * `not_seen`.
   */
  async answerRepeat(commandId: string): Promise<RepeatAnswer | undefined> {
    if (this.disowned.has(commandId)) {
      await this.deps.send(this.notSeenResult(commandId));
      return "refused";
    }
    if (this.running.has(commandId)) return "running";
    this.running.add(commandId);
    const answered = await this.answerFromKept(commandId);
    if (answered) this.running.delete(commandId);
    return answered ? "resent" : undefined;
  }

  /**
   * What became of a command, for Core (`server.reconcile_command`), from what
   * this browser kept and never by running anything. A `not_seen` id is
   * refused from then on.
   */
  async reconcile(commandId: string): Promise<WebAutomationReconcileAnswer> {
    if (this.disowned.has(commandId)) return webAutomationReconcileAnswer(commandId, { running: false, recordLeft: false, seen: false });
    const running = this.running.has(commandId);
    const kept = running ? undefined : this.recent.get(commandId) ?? await this.deps.queuedResult(commandId);
    const recordLeft = running || kept !== undefined ? false : await this.deps.store.read(commandId) !== undefined;
    const seen = running || kept !== undefined || recordLeft ? true : await this.deps.seen?.has(commandId) ?? false;
    // A command that arrived during the reads above is running now, and is answered so.
    const answer = webAutomationReconcileAnswer(commandId, { running: running || this.running.has(commandId), result: kept, recordLeft, seen });
    if (answer.state === "not_seen") this.disown(commandId);
    return answer;
  }

  /** Reports every record no running command owns -- a command an earlier worker lost -- and clears it. */
  async reportLeftovers(): Promise<number> {
    const leftovers = (await this.deps.store.all()).filter((record) => !this.running.has(record.commandId));
    for (const record of leftovers) await this.reportInterrupted(record);
    return leftovers.length;
  }

  private async answerFromKept(commandId: string): Promise<boolean> {
    const recent = this.recent.get(commandId);
    if (recent !== undefined) {
      await this.deps.send(recent);
      return true;
    }
    const left = await this.deps.store.read(commandId);
    if (left !== undefined) {
      await this.reportInterrupted(left);
      return true;
    }
    const queued = await this.deps.queuedResult(commandId);
    if (queued === undefined) return false;
    this.remember(queued);
    await this.deps.send(queued);
    return true;
  }

  /** The answer to a late copy of a command answered `not_seen`: it did not run, and never will. */
  private notSeenResult(commandId: string): ClientGatewayActionResult {
    const outcome = webAutomationNotSeenOutcome();
    const at = this.now();
    return { commandId, status: outcome.status, startedAt: at, completedAt: at, message: outcome.message, error: outcome.message, failure: outcome.failure, payload: { commandId, status: "not_seen" } };
  }

  private disown(commandId: string): void {
    this.disowned.add(commandId);
    while (this.disowned.size > DISOWNED_LIMIT) {
      const oldest = this.disowned.values().next().value;
      if (oldest === undefined) break;
      this.disowned.delete(oldest);
    }
  }

  private async reportInterrupted(record: InFlightCommandRecord): Promise<void> {
    const result = webAutomationInterruptedActionResult(record, this.now());
    this.remember(result);
    await this.deps.send(result);
    await this.deps.store.remove(record.commandId);
  }

  private remember(result: ClientGatewayActionResult): void {
    this.recent.delete(result.commandId);
    this.recent.set(result.commandId, result);
    while (this.recent.size > RECENT_RESULTS) {
      const oldest = this.recent.keys().next().value;
      if (oldest === undefined) break;
      this.recent.delete(oldest);
    }
  }

  private now(): number {
    return (this.deps.now ?? Date.now)();
  }
}
