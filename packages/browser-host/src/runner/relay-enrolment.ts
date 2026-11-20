import net from "node:net";
import type { Readable, Writable } from "node:stream";
import { setTimeout as delay } from "node:timers/promises";
import { lineChannel } from "./line-channel.js";

/** How often the relay looks again for a runner that has not opened its socket yet (it is starting). */
const RECHECK_MS = 250;

/**
 * `fluxiq-runner enrol`: what the environment driver runs with `docker exec`
 * once it started the container. It relays between the driver, on its
 * standard input and output, and the runner, on the runner's socket: each
 * time the runner asks for a ticket it prints `ticket`, reads the ticket the
 * driver writes on its standard input and passes it to the runner; it prints
 * `connected` once the runner's client is connected. The ticket is never
 * printed, logged or kept. Answers its exit code: 0 connected, 3 refused or
 * failed (the reason on standard error), 4 the runner went away. It waits
 * for a runner that is still starting; a runner that died ends the
 * container, and this command with it.
 */
export async function relayEnrolment(socketPath: string, io: { stdin: Readable; stdout: Writable; stderr: Writable }, connect: (path: string) => net.Socket = (path) => net.connect(path)): Promise<number> {
  const socket = await connected(socketPath, connect);
  const runner = lineChannel(socket, socket);
  const driver = lineChannel(io.stdin, io.stdout);
  try {
    for (;;) {
      const line = await runner.next();
      if (line === null) {
        io.stderr.write("fluxiq-runner: the runner closed the enrolment relay before its client connected.\n");
        return 4;
      }
      if (line === "ticket") {
        driver.send("ticket");
        const ticket = await driver.next();
        if (ticket === null) {
          io.stderr.write("fluxiq-runner: the driver sent no ticket.\n");
          return 3;
        }
        runner.send(ticket.trim());
      } else if (line === "connected") {
        driver.send("connected");
        return 0;
      } else if (line.startsWith("failed")) {
        io.stderr.write(`fluxiq-runner: the runner did not enrol: ${line.slice("failed".length).trim()}\n`);
        return 3;
      }
    }
  } finally {
    socket.destroy();
  }
}

async function connected(socketPath: string, connect: (path: string) => net.Socket): Promise<net.Socket> {
  for (;;) {
    const socket = connect(socketPath);
    const outcome = await new Promise<NodeJS.ErrnoException | null>((resolve) => {
      socket.once("connect", () => resolve(null));
      socket.once("error", (error: NodeJS.ErrnoException) => resolve(error));
    });
    if (outcome === null) return socket;
    socket.destroy();
    if (outcome.code !== "ENOENT" && outcome.code !== "ECONNREFUSED") throw outcome;
    await delay(RECHECK_MS);
  }
}
