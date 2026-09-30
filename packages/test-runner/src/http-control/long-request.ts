import http from "node:http";
import https from "node:https";

/** The most a long request reads back. Core's largest answer, a refused build's diagnostic, is a few hundred kilobytes. */
const LONG_REQUEST_MAX_BODY_BYTES = 32 * 1024 * 1024;
/** Statuses a `Response` must be built without a body for. */
const NULL_BODY_STATUSES = new Set([204, 205, 304]);

/**
 * One request that may be held open longer than Node's global `fetch` allows.
 *
 * `fetch` is undici, whose dispatcher gives up on a response whose headers have
 * not arrived within 300 s (`UND_ERR_HEADERS_TIMEOUT`), whatever timer the
 * caller set. Core answers a Flow build only when the build is over, which can
 * be eight minutes, so the build's own answer -- a proposal or the diagnostic
 * naming why it failed -- never reached the Lab. `node:http` has no such
 * default: this request waits exactly as long as `signal` lets it, and the
 * caller's bound is the only one.
 *
 * The whole body is read before the answer resolves, so the caller's timer
 * covers the reply as well as its headers. An error carries the transport's
 * code (`ECONNRESET`) and nothing of the request: the caller keeps the code and
 * drops the rest, as it does for `fetch`.
 */
export function longRequestFetch(url: string, init: { method: string; headers: Record<string, string>; body?: string; signal: AbortSignal }): Promise<Response> {
  return new Promise<Response>((resolve, reject) => {
    const target = new URL(url);
    const transport = target.protocol === "https:" ? https : target.protocol === "http:" ? http : undefined;
    if (!transport) { reject(new Error("unsupported protocol")); return; }
    if (init.signal.aborted) { reject(init.signal.reason); return; }
    const headers: Record<string, string | number> = { ...init.headers };
    if (init.body !== undefined) headers["content-length"] = Buffer.byteLength(init.body, "utf8");
    const request = transport.request(target, { method: init.method, headers, agent: false });
    const abort = () => request.destroy(Object.assign(new Error("aborted"), { name: "AbortError" }));
    init.signal.addEventListener("abort", abort, { once: true });
    const settle = () => init.signal.removeEventListener("abort", abort);
    request.on("error", (error) => { settle(); reject(error); });
    request.on("response", (response) => {
      const chunks: Buffer[] = [];
      let bytes = 0;
      let ended = false;
      response.on("data", (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > LONG_REQUEST_MAX_BODY_BYTES) { request.destroy(Object.assign(new Error("reply too large"), { code: "ERR_REPLY_TOO_LARGE" })); return; }
        chunks.push(chunk);
      });
      response.on("error", (error) => { settle(); reject(error); });
      // A reply cut short -- by the caller's signal, or by the body bound -- closes without ending.
      response.on("close", () => { if (!ended) { settle(); reject(init.signal.aborted ? init.signal.reason : new Error("reply closed early")); } });
      response.on("end", () => {
        ended = true;
        settle();
        const status = response.statusCode ?? 0;
        if (status < 200 || status > 599) { reject(new Error("unexpected status")); return; }
        const replyHeaders = new Headers();
        for (const [name, value] of Object.entries(response.headers)) {
          if (value === undefined) continue;
          for (const entry of Array.isArray(value) ? value : [value]) replyHeaders.append(name, entry);
        }
        resolve(new Response(NULL_BODY_STATUSES.has(status) ? null : Buffer.concat(chunks), { status, headers: replyHeaders }));
      });
    });
    request.end(init.body);
  });
}
