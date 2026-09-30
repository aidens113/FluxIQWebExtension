// Coverage of rdp-framing.ts: Firefox's `<length>:<JSON>` packets, split
// across reads and measured in UTF-8 bytes.

import assert from "node:assert/strict";
import test from "node:test";
import { readRdpFrames } from "../rdp-framing.js";

function packet(value: unknown): Buffer {
  const json = Buffer.from(JSON.stringify(value), "utf8");
  return Buffer.concat([Buffer.from(`${json.byteLength}:`, "ascii"), json]);
}

test("several whole packets in one read come out in order with nothing left", () => {
  const { packets, rest } = readRdpFrames(Buffer.concat([packet({ from: "root", applicationType: "browser" }), packet({ from: "root", addonsActor: "server1.conn0.addonsActor2" })]));
  assert.deepEqual(packets, [{ from: "root", applicationType: "browser" }, { from: "root", addonsActor: "server1.conn0.addonsActor2" }]);
  assert.equal(rest.byteLength, 0);
});

test("a packet cut part-way through, even inside a multi-byte character, is held until the rest arrives", () => {
  const whole = packet({ from: "addons", addon: { id: "fluxiq-web-automation@example.local", name: "FluxIQ — Web" } });
  const cut = whole.indexOf(Buffer.from("—", "utf8")) + 1;
  const first = readRdpFrames(whole.subarray(0, cut));
  assert.deepEqual(first.packets, []);
  const second = readRdpFrames(Buffer.concat([first.rest, whole.subarray(cut)]));
  assert.deepEqual(second.packets, [{ from: "addons", addon: { id: "fluxiq-web-automation@example.local", name: "FluxIQ — Web" } }]);
  assert.equal(second.rest.byteLength, 0);
});

test("a header that is not a length is refused rather than guessed at", () => {
  assert.throws(() => readRdpFrames(Buffer.from("bulk actor type 5:hello", "ascii")), /not a length/u);
});
