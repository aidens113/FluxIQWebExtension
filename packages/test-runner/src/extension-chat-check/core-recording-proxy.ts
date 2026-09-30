import { createServer, request as httpRequest, type IncomingHttpHeaders, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

/** One program call the extension made through the proxy, as it was sent and as Core answered it. */
export type ObservedCoreCall = {
  /** Milliseconds since the epoch at which the request finished arriving. */
  at: number;
  method: string;
  /** The route only; a query string is dropped. */
  path: string;
  /** The program endpoint (`append-turn`), or null for any other route. */
  endpoint: string | null;
  /** Whether the call carried a bearer credential. The credential itself is never read into a record. */
  bearer: boolean;
  /** The request body, parsed. */
  request: unknown;
  status: number;
  /** The response body, parsed. */
  response: unknown;
};

export type CoreRecordingProxy = {
  /** The proxy's own `http://127.0.0.1:<port>`: the address the extension is told Core is at. */
  origin: string;
  /** Every program call so far, oldest first. */
  calls(): readonly ObservedCoreCall[];
  close(): Promise<void>;
};

const PROGRAM_ROUTE = /^\/api\/programs\/automation-studio\/([a-z0-9-]+)$/u;
const HOP_BY_HOP = new Set(["connection", "keep-alive", "transfer-encoding", "upgrade", "proxy-connection", "te", "trailer", "host"]);

/**
 * A loopback HTTP proxy in front of Core that records what the extension sends
 * to Automation Studio's program routes, and what Core answers.
 *
 * The extension is paired with the proxy's address as its `coreApiUrl`, so the
 * requests recorded are the extension's own, sent by its background worker
 * (Chrome) or event page (Firefox), byte for byte: nothing here builds a
 * request. Every request, recorded or not, is forwarded unchanged but for
 * `host`, and the answer is passed back unchanged.
 *
 * Headers are never recorded. The `authorization` header carries the pairing
 * token, so a record says only whether one was present.
 */
export async function startCoreRecordingProxy(coreOrigin: string): Promise<CoreRecordingProxy> {
  const target = new URL(coreOrigin);
  const recorded: ObservedCoreCall[] = [];
  const server = createServer((incoming, outgoing) => { void forward(incoming, outgoing); });

  async function forward(incoming: IncomingMessage, outgoing: ServerResponse): Promise<void> {
    const body = await readAll(incoming);
    const path = (incoming.url ?? "/").split("?")[0]!;
    const endpoint = PROGRAM_ROUTE.exec(path)?.[1] ?? null;
    const upstream = httpRequest({ hostname: target.hostname, port: target.port, method: incoming.method, path: incoming.url, headers: forwardedHeaders(incoming.headers, target.host) }, response => {
      void (async () => {
        const answer = await readAll(response);
        outgoing.writeHead(response.statusCode ?? 502, passedHeaders(response.headers));
        outgoing.end(answer);
        if (endpoint !== null) {
          recorded.push({
            at: Date.now(),
            method: incoming.method ?? "GET",
            path,
            endpoint,
            bearer: /^Bearer\s+\S/u.test(String(incoming.headers.authorization ?? "")),
            request: parsed(body),
            status: response.statusCode ?? 0,
            response: parsed(answer),
          });
        }
      })();
    });
    upstream.on("error", () => { if (!outgoing.headersSent) outgoing.writeHead(502); outgoing.end(); });
    upstream.end(body);
  }

  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", () => resolve()); });
  const port = (server.address() as AddressInfo).port;
  return {
    origin: `http://127.0.0.1:${port}`,
    calls: () => [...recorded],
    close: () => new Promise<void>(resolve => { server.closeAllConnections?.(); server.close(() => resolve()); }),
  };
}

function forwardedHeaders(headers: IncomingHttpHeaders, host: string): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const [name, value] of Object.entries(headers)) if (value !== undefined && !HOP_BY_HOP.has(name)) out[name] = value;
  out.host = host;
  return out;
}

function passedHeaders(headers: IncomingHttpHeaders): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const [name, value] of Object.entries(headers)) if (value !== undefined && !HOP_BY_HOP.has(name) && name !== "content-length") out[name] = value;
  return out;
}

function readAll(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

function parsed(bytes: Buffer): unknown {
  if (bytes.byteLength === 0) return null;
  try { return JSON.parse(bytes.toString("utf8")); } catch { return { unparsed: true, bytes: bytes.byteLength }; }
}
