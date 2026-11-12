import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { Duplex } from "node:stream";

export type FakeGateway = {
  url: string;
  /** The JSON messages clients sent, in order. */
  received: Array<{ type?: string; payload?: Record<string, unknown> }>;
  close(): Promise<void>;
};

const GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

/**
 * A local WebSocket server standing in for the client gateway, with no
 * dependency: the opening handshake and text frames are all a hello needs.
 * `onMessage` may answer each message with a JSON reply.
 */
export async function startFakeGateway(onMessage: (message: { type?: string; payload?: Record<string, unknown> }) => unknown): Promise<FakeGateway> {
  const received: FakeGateway["received"] = [];
  const sockets = new Set<Duplex>();
  const server: Server = createServer((_request, response) => response.writeHead(426).end());
  server.on("upgrade", (request, socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    socket.on("error", () => undefined);
    const accept = createHash("sha1").update(`${request.headers["sec-websocket-key"]}${GUID}`).digest("base64");
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
    let buffered = Buffer.alloc(0);
    socket.on("data", chunk => {
      buffered = Buffer.concat([buffered, chunk]);
      for (let frame = readFrame(buffered); frame; frame = readFrame(buffered)) {
        buffered = buffered.subarray(frame.consumed);
        if (frame.opcode !== 1) continue;
        const message = JSON.parse(frame.text) as FakeGateway["received"][number];
        received.push(message);
        const reply = onMessage(message);
        if (reply !== undefined) socket.write(textFrame(JSON.stringify(reply)));
      }
    });
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as { port: number };
  return {
    url: `ws://127.0.0.1:${port}/client`,
    received,
    close: () => new Promise<void>(resolve => {
      for (const socket of sockets) socket.destroy();
      server.close(() => resolve());
    })
  };
}

/** One complete masked client frame at the start of `buffer`, or undefined while it is still arriving. */
function readFrame(buffer: Buffer): { opcode: number; text: string; consumed: number } | undefined {
  if (buffer.length < 2) return undefined;
  const opcode = buffer[0]! & 0x0f;
  let length = buffer[1]! & 0x7f;
  let offset = 2;
  if (length === 126) {
    if (buffer.length < 4) return undefined;
    length = buffer.readUInt16BE(2);
    offset = 4;
  } else if (length === 127) {
    if (buffer.length < 10) return undefined;
    length = Number(buffer.readBigUInt64BE(2));
    offset = 10;
  }
  const masked = (buffer[1]! & 0x80) !== 0;
  const total = offset + (masked ? 4 : 0) + length;
  if (buffer.length < total) return undefined;
  const payload = Buffer.from(buffer.subarray(offset + (masked ? 4 : 0), total));
  if (masked) for (let index = 0; index < payload.length; index++) payload[index] = payload[index]! ^ buffer[offset + (index % 4)]!;
  return { opcode, text: payload.toString("utf8"), consumed: total };
}

function textFrame(text: string): Buffer {
  const body = Buffer.from(text, "utf8");
  const header = body.length < 126 ? Buffer.from([0x81, body.length]) : body.length < 65_536 ? Buffer.from([0x81, 126, body.length >> 8, body.length & 0xff]) : undefined;
  if (!header) throw new Error("fake gateway replies stay small");
  return Buffer.concat([header, body]);
}
