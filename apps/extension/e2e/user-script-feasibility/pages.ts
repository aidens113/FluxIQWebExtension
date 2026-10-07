import { createServer } from "node:http";
/** Only synthetic local pages; counters identify API versus DOM network effects. */
export async function startProbePages() {
  const requests: Record<string, number> = {};
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (url.pathname === "/network") { const kind = url.searchParams.get("kind") ?? "unknown"; requests[kind] = (requests[kind] ?? 0) + 1; response.setHeader("access-control-allow-origin", "*"); response.end("synthetic-network-response"); return; }
    if (url.pathname === "/strict") response.setHeader("content-security-policy", "default-src 'none'; script-src 'none'; connect-src 'none'; img-src 'self'");
    response.setHeader("content-type", "text/html"); response.end('<!doctype html><title>Synthetic user script page</title><div id="fact">local fixture</div><script>window.pageOnlyValue=123;document.documentElement.dataset.pageInline="ran"</script>');
  });
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const address = server.address(); if (!address || typeof address !== "object") throw new Error("Synthetic HTTP listener has no port.");
  return { origin: `http://127.0.0.1:${address.port}`, deniedOrigin: `http://localhost:${address.port}`, requests, close: () => new Promise<void>((resolve, reject) => { server.closeAllConnections(); server.close(error => error ? reject(error) : resolve()); }) };
}
