// Whether anything still listens on a loopback port. The restart journey uses
// it to prove that stopping Core stopped both its panel and its gateway: a port
// that still accepts a connection after the stop means something survived.
import { connect } from "node:net";
import { RunnerFailure } from "../../failure.js";

export type ProbedPort = Readonly<{ label: "web" | "gateway"; port: number }>;

/** Whether a TCP connection to `127.0.0.1:port` is accepted within `timeoutMs`. */
export async function loopbackPortAccepting(port: number, timeoutMs = 1_000): Promise<boolean> {
  return new Promise<boolean>(resolve => {
    const socket = connect({ host: "127.0.0.1", port });
    const timer = setTimeout(() => { socket.destroy(); resolve(false); }, timeoutMs);
    socket.once("connect", () => { clearTimeout(timer); socket.destroy(); resolve(true); });
    socket.once("error", () => { clearTimeout(timer); socket.destroy(); resolve(false); });
  });
}

/**
 * Waits until no port in `ports` accepts a connection, probing every 200 ms.
 * Fails `restart.port_still_open`, naming the ports by label, when one still
 * accepts after `timeoutMs`: a stopped process tree releases its sockets in
 * well under that, so a port still open then has a listener that survived.
 */
export async function waitForPortsClosed(ports: readonly ProbedPort[], timeoutMs: number, probe: (port: number) => Promise<boolean> = loopbackPortAccepting): Promise<{ waitedMs: number; probes: number }> {
  const startedAt = Date.now();
  let probes = 0;
  for (;;) {
    probes += 1;
    const open: string[] = [];
    for (const { label, port } of ports) if (await probe(port)) open.push(label);
    if (open.length === 0) return { waitedMs: Date.now() - startedAt, probes };
    if (Date.now() - startedAt >= timeoutMs) {
      throw new RunnerFailure("process.startup", "A stopped Core still accepts connections", { details: { reasonCode: "restart.port_still_open", openPorts: open, waitedMs: Date.now() - startedAt } });
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
}
