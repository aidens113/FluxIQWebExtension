/**
 * The extension's WebSocket upgrade request as the relay passes it to Core's
 * gateway: `Host` names the gateway rather than the relay, and
 * `Sec-WebSocket-Extensions` is removed so no compression is negotiated and
 * every frame stays readable. Everything else -- the request line, the path,
 * the key, the extension's `Origin` -- passes as it came. `head` is the
 * request up to, not including, the blank line that ends it.
 */
export function rewriteUpgradeRequest(head: string, gatewayHost: string): string {
  const [requestLine, ...headers] = head.split("\r\n");
  const kept = headers.filter(line => line.length > 0 && !/^sec-websocket-extensions\s*:/iu.test(line)).map(line => (/^host\s*:/iu.test(line) ? `Host: ${gatewayHost}` : line));
  return `${[requestLine ?? "", ...kept].join("\r\n")}\r\n\r\n`;
}
