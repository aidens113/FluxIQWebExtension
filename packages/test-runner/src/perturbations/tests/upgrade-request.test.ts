import assert from "node:assert/strict";
import test from "node:test";
import { rewriteUpgradeRequest } from "../upgrade-request.js";

test("Host names the gateway, no extension is offered, and everything else passes as it came", () => {
  const head = [
    "GET /client HTTP/1.1",
    "Host: 127.0.0.1:5555",
    "Upgrade: websocket",
    "Connection: Upgrade",
    "Origin: chrome-extension://abc",
    "Sec-WebSocket-Key: a2V5",
    "Sec-WebSocket-Version: 13",
    "sec-websocket-extensions: permessage-deflate; client_max_window_bits",
  ].join("\r\n");
  assert.equal(rewriteUpgradeRequest(head, "127.0.0.1:4877"), [
    "GET /client HTTP/1.1",
    "Host: 127.0.0.1:4877",
    "Upgrade: websocket",
    "Connection: Upgrade",
    "Origin: chrome-extension://abc",
    "Sec-WebSocket-Key: a2V5",
    "Sec-WebSocket-Version: 13",
  ].join("\r\n") + "\r\n\r\n");
});
