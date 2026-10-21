// The list reads the offline-reads spec runs, live through the content
// harness and offline through the snapshot page: one request shape, so live
// and offline are given the same command. Planned as the snapshot spike plans
// (lane T U3, decision 5): the extension's own structure detection proposes
// the item and fields, and a field the read refuses as still-collapsed text is
// dropped, as the refusal itself says to; the reads then never drop a field.

import type { WebAutomationExtractField, WebAutomationStructureDetection } from "@fluxiq-web-extension/domain/client";
import type { BrowserActionCommand, BrowserActionResult } from "../../../../../src/shared/protocol.js";
import type { ContentHarness } from "../../../index.js";

export type ListReadPlan = { item: string; fields: Record<string, WebAutomationExtractField>; dropped: number };

const MAX_DROPPED_FIELDS = 8;
/** How long a read may take to answer at all; its own `timeoutMs` is 30 s. */
const READ_ANSWER_MS = 90_000;

export const listRead = {
  command(commandId: string, item: string, fields: Record<string, WebAutomationExtractField>): BrowserActionCommand {
    return { commandId, actionType: "web.dom.extract_list", timeoutMs: 30_000, extractList: { item, fields, minItems: 0 } };
  },

  /** The read run live, bounded so a stall names itself. */
  async live(harness: ContentHarness, command: BrowserActionCommand): Promise<BrowserActionResult> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stalled = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error(`the live read ${command.commandId} did not answer within ${READ_ANSWER_MS} ms`)), READ_ANSWER_MS);
    });
    try {
      return await Promise.race([harness.runAction(command), stalled]);
    } finally {
      clearTimeout(timer);
    }
  },

  /** The detected list's item and fields; with `warm`, read once whole (dropping collapsed fields), which loads what the read loads. */
  async plan(harness: ContentHarness, warm: boolean): Promise<ListReadPlan> {
    const detected = await harness.runAction({ commandId: "offline-reads-detect", actionType: "web.dom.capture_snapshot", detectStructure: {} });
    const structure = detected.structure as WebAutomationStructureDetection | undefined;
    if (!structure?.ok) throw new Error(`no list was detected: ${structure && !structure.ok ? structure.refused : "no structure answered"}`);
    const plan: ListReadPlan = {
      item: structure.proposal.item,
      fields: Object.fromEntries(structure.proposal.fields.map((field) => [field.key, field.spec as WebAutomationExtractField])),
      dropped: 0
    };
    for (let attempt = 0; warm && attempt <= MAX_DROPPED_FIELDS; attempt += 1) {
      const reply = await listRead.live(harness, listRead.command(`offline-reads-plan-${attempt}`, plan.item, plan.fields));
      const collapsed = /^incomplete_text: field (\S+) /u.exec(reply.failure?.actual ?? "")?.[1];
      if (!collapsed || !(collapsed in plan.fields)) break;
      delete plan.fields[collapsed];
      plan.dropped += 1;
    }
    return plan;
  },

  rows(result: Pick<BrowserActionResult, "extracted"> | undefined): Array<Record<string, unknown>> {
    return Array.isArray(result?.extracted) ? result.extracted as Array<Record<string, unknown>> : [];
  }
};
