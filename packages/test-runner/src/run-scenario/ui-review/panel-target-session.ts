import type { CDPSession } from "@playwright/test";
import { withTimeout } from "./with-timeout.js";

type Pending = { resolve: (value: any) => void; reject: (error: Error) => void };

/**
 * A DevTools session on a target Playwright does not hand out as a page -- the
 * extension's real side panel -- opened through a page's own session, not
 * flattened, the way the extension-start trace listens to the service worker.
 * Commands go out with `Target.sendMessageToTarget` and their answers come
 * back as `Target.receivedMessageFromTarget`, matched here by id.
 */
export class PanelTargetSession {
  private nextId = 1;
  private readonly pending = new Map<number, Pending>();
  private readonly listener = (event: { sessionId: string; message: string }) => this.receive(event);

  private constructor(private readonly cdp: CDPSession, private readonly sessionId: string) {
    cdp.on("Target.receivedMessageFromTarget", this.listener);
  }

  static async open(cdp: CDPSession, targetId: string, timeoutMs: number): Promise<PanelTargetSession> {
    const { sessionId } = await withTimeout(cdp.send("Target.attachToTarget", { targetId, flatten: false }), timeoutMs, "attaching to the side panel") as { sessionId: string };
    return new PanelTargetSession(cdp, sessionId);
  }

  async send(method: string, params: Record<string, unknown>, timeoutMs: number): Promise<any> {
    const id = this.nextId++;
    const answer = new Promise<any>((resolve, reject) => this.pending.set(id, { resolve, reject }));
    await this.cdp.send("Target.sendMessageToTarget", { sessionId: this.sessionId, message: JSON.stringify({ id, method, params }) });
    try { return await withTimeout(answer, timeoutMs, `the side panel's ${method}`); }
    finally { this.pending.delete(id); }
  }

  async close(): Promise<void> {
    this.cdp.off("Target.receivedMessageFromTarget", this.listener);
    for (const waiting of this.pending.values()) waiting.reject(new Error("the side panel session closed"));
    this.pending.clear();
    await this.cdp.send("Target.detachFromTarget", { sessionId: this.sessionId });
  }

  private receive(event: { sessionId: string; message: string }): void {
    if (event.sessionId !== this.sessionId) return;
    let message: { id?: number; result?: unknown; error?: { message?: string } };
    try { message = JSON.parse(event.message) as typeof message; }
    catch (error) { for (const waiting of this.pending.values()) waiting.reject(new Error(`the side panel sent an unreadable answer: ${error instanceof Error ? error.message : String(error)}`)); return; }
    if (typeof message.id !== "number") return;
    const waiting = this.pending.get(message.id);
    if (!waiting) return;
    if (message.error) waiting.reject(new Error(message.error.message ?? "the side panel refused the command"));
    else waiting.resolve(message.result);
  }
}
