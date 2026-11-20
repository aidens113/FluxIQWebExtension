import { rm } from "node:fs/promises";
import net from "node:net";
import type { FluxIQHostLaunchRequest, FluxIQLaunchedHost } from "fluxiq/server";
import type { BrowserHostOptions } from "../browser-host-options.js";
import { BrowserHostError } from "../errors/index.js";
import { lineChannel } from "./line-channel.js";
import { runnerBrowserArgs } from "./runner-browser-args.js";
import type { RunnerSettings } from "./runner-settings.js";

type Launch = (request: FluxIQHostLaunchRequest, options: BrowserHostOptions) => Promise<FluxIQLaunchedHost>;

const ATTEMPTS = 4; // the first attempt plus 3 retries

/** A running runner: how to stop it (as SIGTERM does) and when it ended. */
export type RunnerHandle = { stop(): Promise<void>; ended: Promise<number> };

/**
 * `fluxiq-runner serve`: the container's main process. It listens on its
 * socket for the enrolment relay the environment driver runs at every start,
 * then launches the browser with the extension on the environment's profile
 * and enrols it at the tenant's gateway with the tickets the relay hands it,
 * asking for a fresh ticket for each attempt (the first plus 3 retries). A
 * gateway refusal (`enrolment.*`) is final and reported as such. A relay that
 * arrives while a browser runs (the environment was started again, which
 * revoked its client) closes that browser and enrols afresh. When the
 * browser ends without being stopped the runner ends with code 1, so the
 * container is seen stopped and its controller starts it again.
 */
export async function serveRunner(settings: RunnerSettings, launch: Launch, options: { listen?: (server: net.Server, path: string) => Promise<void> } = {}): Promise<RunnerHandle> {
  const browser: BrowserHostOptions = { extensionPath: settings.extensionPath, executablePath: settings.executablePath, headless: true, browserArgs: runnerBrowserArgs(settings),
    // Every start revokes the environment's client trust, so its stored token never resumes: present the ticket at once.
    resumeStoredToken: false };
  let current: FluxIQLaunchedHost | null = null;
  let stopping = false;
  let finish: (code: number) => void = () => undefined;
  const ended = new Promise<number>((resolve) => { finish = resolve; });
  const abort = new AbortController();
  let queue = Promise.resolve();

  const enrol = async (socket: net.Socket): Promise<void> => {
    const relay = lineChannel(socket, socket);
    if (current !== null) {
      const previous = current;
      current = null;
      await previous.close().catch((error: Error) => process.stderr.write(`fluxiq-runner: closing the previous browser failed: ${error.message}\n`));
    }
    const causes: string[] = [];
    for (let attempt = 1; attempt <= ATTEMPTS && !stopping; attempt++) {
      relay.send("ticket");
      const ticket = await relay.next();
      if (ticket === null) return;
      let taken = false;
      try {
        const host = await launch({
          hostId: settings.environmentId,
          gatewayUrl: settings.gatewayUrl,
          coreApiUrl: settings.coreApiUrl,
          dataDir: settings.profileDir,
          profile: { kind: "named", name: "environment" },
          headless: true,
          takeEnrolmentTicket: () => {
            if (taken) throw new BrowserHostError("browser_host.ticket_used", "This attempt's ticket was already presented.");
            taken = true;
            return ticket;
          },
          signal: abort.signal
        }, browser);
        current = host;
        void host.closed.then(() => {
          if (current === host && !stopping) finish(1);
        }, () => {
          if (current === host && !stopping) finish(1);
        });
        relay.send("connected");
        return;
      } catch (error) {
        const code = error instanceof BrowserHostError ? error.code : "browser_host.launch_failed";
        if (code.startsWith("enrolment.")) {
          relay.send(`failed ${code}`);
          return;
        }
        causes.push(`attempt ${attempt}: ${code}`);
      }
    }
    relay.send(`failed browser_host.connect_failed (${causes.join("; ") || "stopping"})`);
  };

  const server = net.createServer((socket) => {
    socket.on("error", (error: Error) => process.stderr.write(`fluxiq-runner: the enrolment relay's connection failed: ${error.message}\n`));
    const step = queue.then(() => enrol(socket)).finally(() => socket.end());
    // A relay that sees its connection end without `connected` reports the failure to its driver; the reason is logged here.
    void step.catch((error: Error) => process.stderr.write(`fluxiq-runner: enrolment failed: ${error.message}\n`));
    queue = step.then(() => undefined, /* each relay is answered by its own enrolment; the queue only orders the next */ () => undefined);
  });
  await rm(settings.socketPath, { force: true }).catch(/* best-effort: a pipe name on Windows is not a file */ () => undefined);
  await (options.listen ?? listen)(server, settings.socketPath);

  const stop = async (): Promise<void> => {
    if (stopping) return;
    stopping = true;
    abort.abort(new Error("The runner is stopping."));
    server.close();
    try {
      await queue;
      await current?.close();
      finish(0);
    } catch (error) {
      process.stderr.write(`fluxiq-runner: the browser did not close cleanly: ${(error as Error).message}\n`);
      finish(1);
    }
  };
  return { stop, ended };
}

function listen(server: net.Server, path: string): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(path, () => {
      server.off("error", reject);
      resolve();
    });
  });
}
