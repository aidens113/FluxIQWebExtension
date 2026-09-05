import { createServer } from "node:net";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";

export type RunAllocation = {
  runId: string;
  runRoot: string;
  fluxiqRoot: string;
  storageDir: string;
  browserProfileDir: string;
  coreWorkspaceDir: string;
  webWorkspaceDir: string;
  logsDir: string;
  scenarioPort: number;
  webPort: number;
  gatewayPort: number;
  controllerToken: string;
};

export async function allocateLoopbackPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Failed to allocate a loopback port");
  const port = address.port;
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return port;
}

export async function allocateRun(baseDir: string, requestedRunId?: string): Promise<RunAllocation> {
  const runId = requestedRunId ?? `run-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomBytes(4).toString("hex")}`;
  if (!/^[A-Za-z0-9._-]{1,128}$/.test(runId)) throw new Error("Run ID must contain only letters, numbers, dot, underscore, and dash");
  const runRoot = path.resolve(baseDir, runId);
  const resolvedBase = path.resolve(baseDir);
  if (path.dirname(runRoot) !== resolvedBase) throw new Error("Run directory escaped its configured base");
  const fluxiqRoot = path.join(runRoot, "fluxiq-root");
  const storageDir = path.join(fluxiqRoot, ".fluxiq");
  const browserProfileDir = path.join(runRoot, "browser-profile");
  const coreWorkspaceDir = path.join(runRoot, "core-workspace");
  const webWorkspaceDir = path.join(coreWorkspaceDir, "apps", "web");
  const logsDir = path.join(runRoot, "logs");
  await mkdir(baseDir, { recursive: true });
  await mkdir(runRoot, { recursive: false });
  await mkdir(fluxiqRoot, { recursive: false });
  await Promise.all([storageDir, browserProfileDir, logsDir].map(directory => mkdir(directory, { recursive: false })));
  await mkdir(webWorkspaceDir, { recursive: true });
  const [scenarioPort, webPort, gatewayPort] = await allocateDistinctPorts(3);
  return {
    runId, runRoot, fluxiqRoot, storageDir, browserProfileDir, coreWorkspaceDir, webWorkspaceDir, logsDir,
    scenarioPort: scenarioPort!, webPort: webPort!, gatewayPort: gatewayPort!,
    controllerToken: randomBytes(32).toString("base64url"),
  };
}

async function allocateDistinctPorts(count: number): Promise<number[]> {
  const ports = new Set<number>();
  while (ports.size < count) ports.add(await allocateLoopbackPort());
  return [...ports];
}
