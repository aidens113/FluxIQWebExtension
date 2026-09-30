import type { ExistingFluxIQControlClient } from "../existing-fluxiq-control.js";

/** A turn as `get-conversation` returns it, with only what the claims read. */
export type ThreadTurn = {
  turnId: string;
  ordinal: number;
  author: string;
  text: string;
  ask: { askId: string; kind: string; status: string; answer: { kind: string; value?: unknown } | null } | null;
  attachment: { kind: string; ref: string } | null;
};

export type ThreadReader = {
  /** Every turn of the thread, oldest first, read through Core's `get-conversation` as the signed-in person. */
  turns(conversationId: string): Promise<ThreadTurn[]>;
  /** Polls the thread until `found` picks something out of it, or fails after `timeoutMs` naming what it was waiting for. */
  waitFor<T>(conversationId: string, what: string, found: (turns: ThreadTurn[]) => T | undefined, timeoutMs?: number): Promise<T>;
};

/**
 * Reads a chat thread the way FluxIQ's own web panel does, with the person's
 * session rather than the extension's token, so what the extension did is
 * checked against Core's record and not against the extension's own account.
 */
export function threadReader(control: Pick<ExistingFluxIQControlClient, "automationStudioCall">, projectId: string): ThreadReader {
  async function turns(conversationId: string): Promise<ThreadTurn[]> {
    const payload = await control.automationStudioCall("get-conversation", { projectId, conversationId, limit: 200 }) as { conversation?: { turns?: unknown } };
    const list = payload?.conversation?.turns;
    return Array.isArray(list) ? list as ThreadTurn[] : [];
  }
  return {
    turns,
    async waitFor(conversationId, what, found, timeoutMs = 60_000) {
      const deadline = Date.now() + timeoutMs;
      let last: ThreadTurn[] = [];
      for (;;) {
        last = await turns(conversationId);
        const value = found(last);
        if (value !== undefined) return value;
        if (Date.now() >= deadline) throw new Error(`Timed out after ${timeoutMs} ms waiting for ${what}; the thread had ${last.length} turn(s), the last by ${last.at(-1)?.author ?? "nobody"}: ${JSON.stringify(last.at(-1)?.text?.slice(0, 200) ?? "")}`);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    },
  };
}
