import { connect, type Socket } from "node:net";
import { readRdpFrames } from "./rdp-framing.js";

type Packet = Record<string, unknown> & { from?: string };

export type FirefoxRdpClient = {
  /** Sends one request to an actor and resolves with its reply, or rejects with the actor's error. */
  request(to: string, type: string, fields?: Record<string, unknown>): Promise<Packet>;
  close(): void;
};

/**
 * A minimal client for Firefox's remote debugging protocol over TCP, enough to
 * install a temporary add-on.
 *
 * Replies are matched to requests per actor, in order, which is how the
 * protocol answers them. A packet that carries a `type` is an event, not a
 * reply, and is ignored, as is the root actor's greeting.
 */
export async function connectFirefoxRdp(port: number, timeoutMs: number): Promise<FirefoxRdpClient> {
  const socket = await openSocket(port, timeoutMs);
  const waiting = new Map<string, Array<{ resolve: (packet: Packet) => void; reject: (error: Error) => void }>>();
  let buffered: Buffer = Buffer.alloc(0);
  socket.on("data", (chunk: Buffer) => {
    const { packets, rest } = readRdpFrames(Buffer.concat([buffered, chunk]));
    buffered = rest;
    for (const packet of packets as Packet[]) {
      if (typeof packet.from !== "string" || typeof packet.type === "string" || "applicationType" in packet) continue;
      const next = waiting.get(packet.from)?.shift();
      if (!next) continue;
      if (typeof packet.error === "string") next.reject(new Error(`Firefox actor ${packet.from} refused: ${packet.error}${typeof packet.message === "string" ? `: ${packet.message}` : ""}`));
      else next.resolve(packet);
    }
  });
  socket.on("close", () => {
    for (const queue of waiting.values()) for (const entry of queue.splice(0)) entry.reject(new Error("Firefox closed the debugging connection"));
  });
  return {
    request(to, type, fields = {}) {
      return new Promise<Packet>((resolve, reject) => {
        const queue = waiting.get(to) ?? [];
        queue.push({ resolve, reject });
        waiting.set(to, queue);
        const json = Buffer.from(JSON.stringify({ to, type, ...fields }), "utf8");
        socket.write(`${json.byteLength}:`);
        socket.write(json);
      });
    },
    close: () => socket.destroy(),
  };
}

/** Connects, retrying while Firefox is still starting its debugger server. */
async function openSocket(port: number, timeoutMs: number): Promise<Socket> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      return await new Promise<Socket>((resolve, reject) => {
        const socket = connect({ host: "127.0.0.1", port });
        socket.once("connect", () => { socket.removeAllListeners("error"); resolve(socket); });
        socket.once("error", reject);
      });
    } catch (error) {
      lastError = error;
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }
  throw new Error(`Firefox's debugger server on port ${port} did not accept a connection within ${timeoutMs} ms: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}
