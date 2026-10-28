import { createHash } from "node:crypto";
import { createServer } from "node:http";
import type { Socket } from "node:net";
import type { FluxIQ } from "fluxiq";
import type { ClientGatewayClientMessage } from "fluxiq/client-gateway";

/**
 * A websocket transport for the real Core gateway; every envelope is delegated unchanged. `observe` is told each client
 * message as it arrives; `commanded` (optional) the action type of each `server.execute_action` Core sends a client.
 */
export async function startResetDiagnosticGateway(fluxiq: FluxIQ, observe?: (message: ClientGatewayClientMessage) => void, commanded?: (actionType: string) => void) {
  const gateway = fluxiq.programs.clientGateway;
  const sockets = new Set<Socket>();
  const errors: string[] = [];
  const server = createServer((_request, response) => response.writeHead(404).end());
  server.on("upgrade", (request, socket: Socket) => {
    const key = request.headers["sec-websocket-key"];
    if (typeof key !== "string") return socket.destroy();
    const accept = createHash("sha1").update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest("base64");
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
    sockets.add(socket);
    const session = gateway.connect({ socket: { send: raw => {
      if (commanded) {
        try {
          const sent = JSON.parse(String(raw)) as { type?: unknown; payload?: { actionType?: unknown } };
          if (sent.type === "server.execute_action") commanded(String(sent.payload?.actionType ?? ""));
        } catch {
          // best-effort: a frame that is not JSON is no command.
        }
      }
      const body = Buffer.from(raw);
      const head = body.length < 126 ? Buffer.from([0x81, body.length]) : body.length < 65536
        ? Buffer.from([0x81, 126, body.length >> 8, body.length & 255]) : Buffer.alloc(10);
      if (head.length === 10) {
        head[0] = 0x81;
        head[1] = 127;
        head.writeBigUInt64BE(BigInt(body.length), 2);
      }
      socket.write(Buffer.concat([head, body]));
    } } });
    socket.on("close", () => {
      sockets.delete(socket);
      gateway.disconnect(session.sessionId);
    });
    socket.on("error", () => { errors.push("socket_error"); });
    let buffered = Buffer.alloc(0), fragments: Buffer[] | undefined;
    let receiving = Promise.resolve();
    socket.on("data", (chunk: Buffer) => {
      buffered = Buffer.concat([buffered, chunk]);
      for (;;) {
        const frame = readFrame(buffered);
        if (!frame) break;
        buffered = buffered.subarray(frame.length);
        if (frame.opcode === 8) {
          socket.end();
          break;
        }
        if (frame.opcode === 1) fragments = [frame.body];
        else if (frame.opcode === 0 && fragments) fragments.push(frame.body);
        else continue;
        if (!frame.final) continue;
        const raw = Buffer.concat(fragments).toString("utf8");
        fragments = undefined;
        receiving = receiving.then(async () => {
          const message = JSON.parse(raw) as ClientGatewayClientMessage;
          observe?.(message);
          await gateway.receive(session.sessionId, message);
        }).catch(() => { errors.push("gateway_receive_failed"); });
      }
    });
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as { port: number }).port;
  return {
    url: `ws://127.0.0.1:${port}/client`,
    errors,
    close: async () => {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  };
}

/** Chromium may fragment a large snapshot; retain all bytes before parsing its envelope. */
function readFrame(buffer: Buffer): { opcode: number; final: boolean; body: Buffer; length: number } | undefined {
  if (buffer.length < 2) return undefined;
  let length = buffer[1]! & 127, offset = 2;
  if (length === 126) {
    if (buffer.length < 4) return undefined;
    length = buffer.readUInt16BE(2);
    offset = 4;
  } else if (length === 127) {
    if (buffer.length < 10) return undefined;
    length = Number(buffer.readBigUInt64BE(2));
    offset = 10;
  }
  const masked = (buffer[1]! & 128) !== 0;
  if (buffer.length < offset + (masked ? 4 : 0) + length) return undefined;
  const mask = masked ? buffer.subarray(offset, offset + 4) : undefined;
  if (masked) offset += 4;
  const body = Buffer.from(buffer.subarray(offset, offset + length));
  if (mask) for (let i = 0; i < body.length; i++) body[i] = body[i]! ^ mask[i % 4]!;
  return { opcode: buffer[0]! & 15, final: (buffer[0]! & 128) !== 0, body, length: offset + length };
}
