import { createServer, request, type ServerResponse } from "node:http";
import { connect } from "node:net";
import { once } from "node:events";
import { expect, test } from "@playwright/test";
import { startNativeProxy } from "../index.js";
import { createProxyTransport } from "../transport.js";

test.setTimeout(10_000);

test("unknown transport failures remain caller-visible and repeated events are deduplicated", () => {
  const transport = createProxyTransport();
  const failure = Object.assign(new Error("synthetic private details"), { code: "EINVAL" });
  transport.observe(failure);
  transport.observe(failure);
  expect(transport.counts()).toEqual({ connectionResets: 0, transportFailures: 1 });
});

test("client reset after a refused CONNECT stays owned by that connection", async () => {
  const proxy = await startNativeProxy({ ordinaryUrl: "http://127.0.0.1:41001/scenarios/company-website/", alternateUrl: "http://127.0.0.1:41002/scenarios/company-website/booking-widget" });
  const address = new URL(proxy.origin);
  const client = connect(Number(address.port), "127.0.0.1");
  const closed = once(client, "close");
  try {
    await once(client, "connect");
    client.write("CONNECT aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.chromiumapp.org:443 HTTP/1.1\r\nHost: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.chromiumapp.org:443\r\n\r\n");
    await once(client, "data");
    client.resetAndDestroy();
    await closed;
    await expect.poll(() => proxy.counts().connectionResets).toBe(1);
    expect(proxy.counts().denied).toBe(1);
    expect(proxy.counts().transportFailures).toBe(0);
    const healthy = await new Promise<number>((resolve, reject) => {
      const next = request(proxy.origin, { path: "http://127.0.0.1:1/" }, response => {
        response.resume();
        response.on("end", () => resolve(response.statusCode ?? 0));
      });
      next.on("error", reject);
      next.end();
    });
    expect(healthy).toBe(403);
  } finally {
    client.destroy();
    await proxy.close();
  }
});

test("client cancellation during a streamed fixture response stays inside the proxy connection", async () => {
  const responses = new Set<ServerResponse>();
  const fixture = createServer((_request, response) => {
    responses.add(response);
    response.writeHead(200, { "content-type": "text/plain" });
    response.write("fixture-frame");
  });
  await new Promise<void>(resolve => fixture.listen(0, "127.0.0.1", resolve));
  const address = fixture.address();
  if (!address || typeof address === "string") throw new Error("fixture.listen");
  const origin = `http://127.0.0.1:${address.port}`;
  const proxy = await startNativeProxy({ ordinaryUrl: `${origin}/scenarios/company-website/`, alternateUrl: `${origin}/scenarios/company-website/booking-widget` });
  const proxyAddress = new URL(proxy.origin);
  const client = connect(Number(proxyAddress.port), "127.0.0.1");
  const closed = once(client, "close");
  try {
    await once(client, "connect");
    client.write(`GET ${origin}/scenarios/company-website/ HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n`);
    await once(client, "data");
    client.resetAndDestroy();
    await closed;
    await new Promise<void>(resolve => setImmediate(resolve));
    expect(proxy.counts().forwarded).toBe(1);
  } finally {
    client.destroy();
    for (const response of responses) response.end();
    await proxy.close();
    await new Promise<void>((resolve, reject) => fixture.close(error => error ? reject(error) : resolve()));
  }
});

test("truncated upstream response terminates its downstream without an unowned stream error", async () => {
  let upstream: ServerResponse | undefined;
  const fixture = createServer((_request, response) => {
    upstream = response;
    response.writeHead(200, { "content-type": "text/plain", "content-length": "100" });
    response.write("short");
  });
  await new Promise<void>(resolve => fixture.listen(0, "127.0.0.1", resolve));
  const address = fixture.address();
  if (!address || typeof address === "string") throw new Error("fixture.listen");
  const origin = `http://127.0.0.1:${address.port}`;
  const proxy = await startNativeProxy({ ordinaryUrl: `${origin}/scenarios/company-website/`, alternateUrl: `${origin}/scenarios/company-website/booking-widget` });
  try {
    const outcome = await new Promise<string>((resolve, reject) => {
      const outgoing = request(proxy.origin, { path: `${origin}/scenarios/company-website/` }, response => {
        response.on("data", () => upstream?.destroy());
        response.on("error", error => (error as NodeJS.ErrnoException).code === "ECONNRESET" ? resolve("truncated") : reject(error));
        response.on("end", () => resolve("complete"));
      });
      outgoing.on("error", reject);
      outgoing.end();
    });
    expect(outcome).toBe("truncated");
    expect(proxy.counts().connectionResets).toBeGreaterThan(0);
    expect(proxy.counts().transportFailures).toBe(0);
  } finally {
    upstream?.destroy();
    await proxy.close();
    await new Promise<void>((resolve, reject) => fixture.close(error => error ? reject(error) : resolve()));
  }
});
