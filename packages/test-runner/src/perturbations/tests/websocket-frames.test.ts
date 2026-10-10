import assert from "node:assert/strict";
import test from "node:test";
import { WebSocketUnitReader } from "../websocket-frames.js";

/** One frame as a client (masked) or a server (unmasked) would send it. */
function frame(payload: Buffer, options: { opcode?: number; fin?: boolean; mask?: boolean; rsv1?: boolean } = {}): Buffer {
  const { opcode = 0x1, fin = true, mask = false, rsv1 = false } = options;
  const length = payload.length;
  const header = length < 126 ? Buffer.from([0, length]) : length < 65536 ? Buffer.alloc(4) : Buffer.alloc(10);
  if (length >= 126 && length < 65536) {
    header[1] = 126;
    header.writeUInt16BE(length, 2);
  }
  if (length >= 65536) {
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(length), 2);
  }
  header[0] = (fin ? 0x80 : 0) | (rsv1 ? 0x40 : 0) | opcode;
  if (!mask) return Buffer.concat([header, payload]);
  header[1] = header[1]! | 0x80;
  const key = Buffer.from([1, 2, 3, 4]);
  const masked = Buffer.from(payload.map((byte, index) => byte ^ key[index % 4]!));
  return Buffer.concat([header, key, masked]);
}

test("a masked text frame is read whole, unmasked, with its exact bytes kept for forwarding", () => {
  const bytes = frame(Buffer.from("{\"type\":\"client.action_result\"}"), { mask: true });
  const [unit] = new WebSocketUnitReader().push(bytes);
  assert.equal(unit?.kind, "message");
  assert.equal(unit?.kind === "message" ? unit.text : undefined, "{\"type\":\"client.action_result\"}");
  assert.deepEqual(unit?.frames[0]?.bytes, bytes);
});

test("a frame split across chunks waits for its last byte, and two frames in one chunk come out in order", () => {
  const reader = new WebSocketUnitReader();
  const first = frame(Buffer.from("one"));
  const second = frame(Buffer.from("two"), { mask: true });
  const joined = Buffer.concat([first, second]);
  assert.deepEqual(reader.push(joined.subarray(0, 3)), []);
  const units = reader.push(joined.subarray(3));
  assert.deepEqual(units.map(unit => (unit.kind === "message" ? unit.text : unit.kind)), ["one", "two"]);
});

test("16- and 64-bit lengths are read", () => {
  const medium = "m".repeat(300);
  const large = "l".repeat(70_000);
  const units = new WebSocketUnitReader().push(Buffer.concat([frame(Buffer.from(medium), { mask: true }), frame(Buffer.from(large))]));
  assert.deepEqual(units.map(unit => (unit.kind === "message" ? unit.text?.length : 0)), [300, 70_000]);
});

test("a fragmented message is one unit with every fragment, and a ping between fragments passes on its own", () => {
  const reader = new WebSocketUnitReader();
  const units = reader.push(Buffer.concat([
    frame(Buffer.from("{\"a\":"), { fin: false, mask: true }),
    frame(Buffer.from("ping"), { opcode: 0x9, mask: true }),
    frame(Buffer.from("1}"), { opcode: 0x0, mask: true }),
  ]));
  assert.deepEqual(units.map(unit => unit.kind), ["control", "message"]);
  const message = units[1];
  assert.equal(message?.kind === "message" ? message.text : undefined, "{\"a\":1}");
  assert.equal(message?.frames.length, 2);
});

test("a compressed message is passed on unread", () => {
  const [unit] = new WebSocketUnitReader().push(frame(Buffer.from([1, 2, 3]), { rsv1: true }));
  assert.equal(unit?.kind === "message" ? unit.compressed : undefined, true);
  assert.equal(unit?.kind === "message" ? unit.text : "read", undefined);
});
