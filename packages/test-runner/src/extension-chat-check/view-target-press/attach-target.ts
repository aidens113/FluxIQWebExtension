import type { CDPSession } from "@playwright/test";

/** A command's answer as the attached target sent it back. */
type TargetReply = { id?: number; result?: Record<string, unknown>; error?: { message?: string } };

/**
 * One browser target reached through another page's CDP session, attached
 * without flattening (as `perturbations/stop-service-worker.ts` reads a
 * worker): each command goes in as `Target.sendMessageToTarget`, and its answer
 * comes back on the same session as `Target.receivedMessageFromTarget`.
 */
export type TargetChannel = {
  /** Sends one command to the target and resolves with its `result`; rejects on the target's error or after `timeoutMs`. */
  call(method: string, params: object, timeoutMs: number): Promise<Record<string, unknown>>;
  /** Stops listening and detaches from the target. */
  detach(): Promise<void>;
};

export async function attachTarget(session: CDPSession, targetId: string): Promise<TargetChannel> {
  const { sessionId } = await session.send("Target.attachToTarget", { targetId, flatten: false });
  const waiting = new Map<number, (reply: TargetReply) => void>();
  let lastId = 0;
  const listener = (event: { sessionId: string; message: string }): void => {
    if (event.sessionId !== sessionId) return;
    const reply = JSON.parse(event.message) as TargetReply;
    const answer = reply.id === undefined ? undefined : waiting.get(reply.id);
    if (!answer || reply.id === undefined) return;
    waiting.delete(reply.id);
    answer(reply);
  };
  session.on("Target.receivedMessageFromTarget", listener);
  return {
    async call(method, params, timeoutMs) {
      lastId += 1;
      const id = lastId;
      const reply = await new Promise<TargetReply>((resolve, reject) => {
        const timer = setTimeout(() => {
          waiting.delete(id);
          reject(new Error(`${method} got no answer from the target within ${timeoutMs} ms`));
        }, timeoutMs);
        waiting.set(id, answered => {
          clearTimeout(timer);
          resolve(answered);
        });
        session.send("Target.sendMessageToTarget", { sessionId, message: JSON.stringify({ id, method, params }) }).catch((error: unknown) => {
          clearTimeout(timer);
          waiting.delete(id);
          reject(error);
        });
      });
      if (reply.error) throw new Error(`${method} failed in the target: ${reply.error.message ?? "no message"}`);
      return reply.result ?? {};
    },
    async detach() {
      session.off("Target.receivedMessageFromTarget", listener);
      await session.send("Target.detachFromTarget", { sessionId });
    },
  };
}
