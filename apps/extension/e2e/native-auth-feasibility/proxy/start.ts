import { createServer, request as forward, type OutgoingHttpHeaders } from "node:http";
import type { ProbeConfiguration } from "../model.js";
import { NativeAuthProbeError } from "../failure.js";
import type { NativeProxy } from "./model.js";
import { createProxyTransport } from "./transport.js";

/** Starts before Chrome: exact loopback origins only, no CONNECT/direct fallback. */
export async function startNativeProxy(configuration: ProbeConfiguration): Promise<NativeProxy> {
  const allowed = new Set([configuration.ordinaryUrl, configuration.alternateUrl].map(value => new URL(value).origin));
  if ([...allowed].some(origin => !/^http:\/\/127\.0\.0\.1:\d+$/u.test(origin))) throw new NativeAuthProbeError("containment");
  let forwarded = 0;
  let denied = 0;
  let nativeCallbackRequests = 0;
  const transport = createProxyTransport();
  const refuse = (address: string): void => {
    denied += 1;
    if (/(?:^|[./])[a-p]{32}\.chromiumapp\.org(?::443)?(?:[/:]|$)/u.test(address)) nativeCallbackRequests += 1;
  };
  const server = createServer((incoming, outgoing) => {
    incoming.on("error", transport.observe);
    outgoing.on("error", transport.observe);
    let target: URL;
    try { target = new URL(incoming.url ?? ""); }
    catch {
      refuse("");
      outgoing.writeHead(403).end();
      return;
    }
    if (!allowed.has(target.origin) || target.username || target.password || target.protocol !== "http:") {
      refuse(target.href);
      outgoing.writeHead(403).end();
      return;
    }
    forwarded += 1;
    const headers: OutgoingHttpHeaders = { ...incoming.headers, host: target.host };
    delete headers["proxy-authorization"];
    delete headers["proxy-connection"];
    const upstream = forward(target, { method: incoming.method, headers }, response => {
      response.on("error", error => {
        transport.observe(error);
        outgoing.destroy();
      });
      outgoing.writeHead(response.statusCode ?? 502, response.headers);
      response.pipe(outgoing);
    });
    upstream.on("error", error => {
      transport.observe(error);
      if (outgoing.destroyed) return;
      if (!outgoing.headersSent) outgoing.writeHead(502);
      outgoing.end();
    });
    incoming.on("aborted", () => upstream.destroy());
    incoming.pipe(upstream);
  });
  server.on("connection", socket => socket.on("error", transport.observe));
  server.on("clientError", (error, socket) => {
    transport.observe(error);
    socket.destroy();
  });
  server.on("error", transport.observe);
  server.on("connect", (request, socket) => {
    refuse(request.url ?? "");
    socket.end("HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\n\r\n");
  });
  server.on("upgrade", (request, socket) => {
    refuse(request.url ?? "");
    socket.destroy();
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new NativeAuthProbeError("containment");
  return {
    origin: `http://127.0.0.1:${address.port}`,
    counts: () => ({ forwarded, denied, nativeCallbackRequests, ...transport.counts() }),
    close: () => new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
      server.closeAllConnections();
    })
  };
}
