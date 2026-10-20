// A stand-in FluxIQ client gateway on loopback for the gateway-session specs:
// a hand-rolled WebSocket server (the e2e tree carries no `ws` dependency) that
// records every client message with the socket it arrived on, and can be put
// in one of three moods between sockets:
//
//   ready    a hello is answered with `server.session_ready` and a new token,
//            which is a resume by token when the hello carried one;
//   pair     a hello is answered with `server.pairing_required`, and
//            `approve()` later answers it with `server.session_ready`: the
//            client had to pair, so it is a new trust;
//   offline  every upgrade is refused before it opens, so the extension sees
//            FluxIQ unreachable and queues what it sends.
//
// Tokens are synthetic fixtures; nothing here reads or prints a real one.

import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo, Socket } from "node:net";

export type ClientMessage = { type: string; payload: Record<string, unknown> & { commandId?: string } };
/** One client message and the ordinal of the socket it came over (1 for the first socket accepted). */
export type ReceivedMessage = { socket: number; message: ClientMessage };
export type Lease = { resourceKey: string; epoch: number; holder: { role: string; briefId: string } };
export type GatewayMood = "ready" | "pair" | "offline";

export type StandInGateway = {
  readonly url: string;
  readonly received: () => ReceivedMessage[];
  /** How many sockets were accepted (upgraded) so far; refused upgrades are not counted. */
  readonly socketsAccepted: () => number;
  /** How many upgrades were refused while offline. */
  readonly refusedUpgrades: () => number;
  readonly setMood: (mood: GatewayMood) => void;
  /** Answers the pending `server.pairing_required` sockets with `server.session_ready`. */
  readonly approve: () => void;
  /** Destroys every open socket, as a FluxIQ restart or a network blip does. */
  readonly drop: () => void;
  readonly send: (type: string, payload: unknown) => void;
  readonly command: (commandId: string, actionType: string, parameters: Record<string, unknown>, lease: Lease) => void;
  readonly close: () => Promise<void>;
};

export async function startStandInGateway(): Promise<StandInGateway> {
  const sockets = new Map<Socket, number>();
  const awaitingApproval = new Set<Socket>();
  const received: ReceivedMessage[] = [];
  let mood: GatewayMood = "ready";
  let accepted = 0;
  let refused = 0;
  let ordinal = 0;
  let tokens = 0;

  const sendOn = (socket: Socket, type: string, payload: unknown): void => {
    const bytes = Buffer.from(JSON.stringify({ id: `stand-in-${++ordinal}`, protocolVersion: "0.1", timestamp: Date.now(), type, payload }));
    const header = bytes.length < 126
      ? Buffer.from([0x81, bytes.length])
      : Buffer.from([0x81, 126, bytes.length >> 8, bytes.length & 255]);
    if (bytes.length > 0xffff) throw new Error("The stand-in gateway sends server messages under 64 KiB only.");
    socket.write(Buffer.concat([header, bytes]));
  };
  const ready = (socket: Socket, number: number): void =>
    sendOn(socket, "server.session_ready", { sessionId: `stand-in-session-${number}`, token: `e2e-token-${++tokens}` });

  const server: Server = createServer((_request, response) => response.writeHead(404).end());
  server.on("upgrade", (request, socket: Socket) => {
    const key = request.headers["sec-websocket-key"];
    if (typeof key !== "string" || mood === "offline") {
      if (mood === "offline") refused += 1;
      return socket.destroy();
    }
    const accept = createHash("sha1").update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest("base64");
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
    const number = ++accepted;
    sockets.set(socket, number);
    const forget = () => {
      sockets.delete(socket);
      awaitingApproval.delete(socket);
    };
    socket.on("close", forget);
    socket.on("error", forget);
    let buffered = Buffer.alloc(0);
    // A large message arrives as a text frame and continuation frames; it is read once the last has.
    let fragments: Buffer[] | undefined;
    socket.on("data", (chunk: Buffer) => {
      buffered = Buffer.concat([buffered, chunk]);
      for (;;) {
        const frame = readClientFrame(buffered);
        if (!frame) break;
        buffered = buffered.subarray(frame.length);
        if (frame.opcode === 8) return socket.destroy();
        if (frame.opcode === 1) fragments = [frame.data];
        else if (frame.opcode === 0 && fragments) fragments.push(frame.data);
        else continue;
        if (!frame.final) continue;
        const message = JSON.parse(Buffer.concat(fragments).toString("utf8")) as ClientMessage;
        fragments = undefined;
        received.push({ socket: number, message });
        if (message.type !== "client.hello") continue;
        if (mood === "pair") {
          awaitingApproval.add(socket);
          sendOn(socket, "server.pairing_required", { referenceCode: "E2E-REF", reason: "Approve this client in FluxIQ." });
        } else {
          ready(socket, number);
        }
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;
  const openSockets = (): Socket[] => {
    if (sockets.size === 0) throw new Error("No extension socket is open on the stand-in gateway.");
    return [...sockets.keys()];
  };
  return {
    url: `ws://127.0.0.1:${port}/client`,
    received: () => [...received],
    socketsAccepted: () => accepted,
    refusedUpgrades: () => refused,
    setMood: (next) => { mood = next; },
    approve: () => {
      for (const socket of awaitingApproval) ready(socket, sockets.get(socket) ?? 0);
      awaitingApproval.clear();
    },
    drop: () => { for (const socket of sockets.keys()) socket.destroy(); },
    send: (type, payload) => { for (const socket of openSockets()) sendOn(socket, type, payload); },
    command: (commandId, actionType, parameters, granted) => {
      for (const socket of openSockets()) sendOn(socket, "server.execute_action", { commandId, actionType, parameters, lease: granted });
    },
    close: async () => {
      for (const socket of sockets.keys()) socket.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  };
}

/** One masked client frame, or undefined until the whole frame has arrived. */
function readClientFrame(buffer: Buffer): { opcode: number; final: boolean; data: Buffer; length: number } | undefined {
  if (buffer.length < 2) return undefined;
  const final = (buffer[0]! & 0x80) !== 0;
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
  const mask = masked ? buffer.subarray(offset, offset + 4) : undefined;
  if (masked) offset += 4;
  if (buffer.length < offset + length) return undefined;
  const data = Buffer.from(buffer.subarray(offset, offset + length));
  if (mask) for (let index = 0; index < data.length; index += 1) data[index] = data[index]! ^ mask[index % 4]!;
  return { opcode, final, data, length: offset + length };
}
