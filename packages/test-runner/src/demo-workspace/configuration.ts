// The demo workspace's configuration: the shape every lane is handed, how it
// is resolved from the environment, and the validators that reject anything
// unsafe before a run starts.
import path from "node:path";
import { requireSecureGatewayUrl } from "../target-config.js";

export type DemoWorkspaceConfiguration = {
  repositoryRoot: string;
  runsDirectory: string;
  workspaceDirectory: string;
  fluxiqRepositoryRoot: string;
  /** The built unpacked extension a run copies and loads; `FLUXIQ_DEMO_EXTENSION_DIR` pins one that other builds cannot rewrite. */
  extensionSourceDirectory: string;
  fluxiqRoot: string;
  storageDirectory: string;
  origin: string;
  gatewayUrl: string;
  username: string;
  password: string;
  pin: string;
  totp?: string;
  projectId?: string;
  projectName: string;
  flowId: string;
  flowName: string;
  headless: boolean;
};

/**
 * What a caller that allocated its own topology supplies in place of the
 * environment's fixed demo endpoints (`3300`/`4877`, which every isolated live
 * run had to override by hand, and one of which fell inside a Windows excluded
 * port range). Each value passes the same checks as its environment variable,
 * and the two ports must be explicit and distinct, because a Core started on
 * this configuration binds exactly these ports.
 */
export type DemoWorkspaceTopologyOverrides = {
  /** The panel origin on its allocated loopback port. */
  origin: string;
  /** The client gateway WebSocket URL on its allocated loopback port. */
  gatewayUrl: string;
  /** The run-scoped workspace; it must still resolve below the runs directory. */
  workspaceDirectory?: string;
  /** An absolute pinned copy of the unpacked extension build. */
  extensionSourceDirectory?: string;
};

export function resolveDemoWorkspaceConfiguration(repositoryRoot: string, env: NodeJS.ProcessEnv, overrides?: DemoWorkspaceTopologyOverrides): DemoWorkspaceConfiguration {
  const root = path.resolve(repositoryRoot);
  const runsDirectory = path.resolve(env.FLUXIQ_TEST_RUNS_DIR ?? path.join(root, "test-runs"));
  const workspaceDirectory = path.resolve(overrides?.workspaceDirectory ?? (env.FLUXIQ_DEMO_RUN_DIR?.trim() || path.join(runsDirectory, "web-extension-demo")));
  const relative = path.relative(runsDirectory, workspaceDirectory);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(overrides?.workspaceDirectory ? "The allocated workspace must resolve below FLUXIQ_TEST_RUNS_DIR" : "FLUXIQ_DEMO_RUN_DIR must resolve below FLUXIQ_TEST_RUNS_DIR");
  }
  const fluxiqRepositoryRoot = path.resolve(env.FLUXIQ_CORE_ROOT?.trim() || path.join(root, "..", "!FluxIQ"));
  const fluxiqRoot = path.join(workspaceDirectory, "fluxiq-root");
  const extensionLabel = overrides?.extensionSourceDirectory ? "The pinned extension build" : "FLUXIQ_DEMO_EXTENSION_DIR";
  const extensionOverride = overrides?.extensionSourceDirectory ?? env.FLUXIQ_DEMO_EXTENSION_DIR?.trim();
  if (extensionOverride && !path.isAbsolute(extensionOverride)) throw new Error(`${extensionLabel} must be an absolute path`);
  const extensionSourceDirectory = extensionOverride ? path.resolve(extensionOverride) : path.join(root, "apps", "extension", "dist", "chrome");
  const originLabel = overrides ? "The allocated panel origin" : "FLUXIQ_DEMO_BASE_URL";
  const gatewayLabel = overrides ? "The allocated gateway URL" : "FLUXIQ_DEMO_GATEWAY_URL";
  const origin = exactHttpOrigin(overrides?.origin ?? (env.FLUXIQ_DEMO_BASE_URL?.trim() || "http://127.0.0.1:3300"), originLabel);
  const gatewayUrl = requireSecureGatewayUrl(overrides?.gatewayUrl ?? (env.FLUXIQ_DEMO_GATEWAY_URL?.trim() || "ws://127.0.0.1:4877/client"), gatewayLabel);
  requireLoopbackEndpoint(origin, originLabel);
  requireLoopbackEndpoint(gatewayUrl, gatewayLabel);
  if (overrides && explicitPort(origin, originLabel) === explicitPort(gatewayUrl, gatewayLabel)) {
    throw new Error("The allocated panel origin and gateway URL must use different ports");
  }
  return {
    repositoryRoot: root,
    runsDirectory,
    workspaceDirectory,
    fluxiqRepositoryRoot,
    extensionSourceDirectory,
    fluxiqRoot,
    storageDirectory: path.join(fluxiqRoot, ".fluxiq"),
    origin,
    gatewayUrl,
    username: required(env.FLUXIQ_TEST_USERNAME, "FLUXIQ_TEST_USERNAME"),
    password: required(env.FLUXIQ_TEST_PASSWORD, "FLUXIQ_TEST_PASSWORD"),
    pin: required(env.FLUXIQ_TEST_PIN, "FLUXIQ_TEST_PIN"),
    ...(env.FLUXIQ_TEST_TOTP?.trim() ? { totp: env.FLUXIQ_TEST_TOTP.trim() } : {}),
    ...(env.FLUXIQ_DEMO_PROJECT_ID?.trim()
      ? { projectId: safeId(env.FLUXIQ_DEMO_PROJECT_ID, "FLUXIQ_DEMO_PROJECT_ID") }
      : {}),
    projectName: env.FLUXIQ_DEMO_PROJECT_NAME?.trim() || "FluxIQ Web Extension Test",
    flowId: safeId(env.FLUXIQ_DEMO_FLOW_ID?.trim() || "flow.web-extension-demo", "FLUXIQ_DEMO_FLOW_ID"),
    flowName: env.FLUXIQ_DEMO_FLOW_NAME?.trim() || "Web Extension Demo Flow",
    headless: optionalBoolean(env.FLUXIQ_DEMO_HEADLESS, "FLUXIQ_DEMO_HEADLESS", true),
  };
}

export function credentialLiterals(config: DemoWorkspaceConfiguration): string[] {
  return [config.password, config.pin, ...(config.totp ? [config.totp] : [])];
}

export function required(value: string | undefined, name: string): string {
  const result = value?.trim();
  if (!result || /[\r\n]/u.test(result)) throw new Error(name + " is required and must be a single line");
  return result;
}

export function safeId(value: string | undefined, name: string): string {
  const result = required(value, name);
  if (!/^[A-Za-z0-9._:-]{1,160}$/u.test(result)) throw new Error(name + " contains unsupported characters");
  return result;
}

export function exactHttpOrigin(value: string, name: string): string {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error(`${name} must be an exact HTTP(S) origin`);
  }
  return url.origin;
}

export function requireLoopbackEndpoint(value: string, name: string): void {
  const hostname = new URL(value).hostname.toLowerCase();
  if (hostname !== "127.0.0.1" && hostname !== "localhost" && hostname !== "[::1]") {
    throw new Error(`${name} must use a loopback host for the self-managed demo Core`);
  }
}

export function explicitPort(value: string, name: string): number {
  const url = new URL(value);
  if (!url.port) throw new Error(`${name} must include an explicit port`);
  const port = Number(url.port);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error(`${name} has an invalid port`);
  return port;
}

export function optionalBoolean(value: string | undefined, name: string, fallback: boolean): boolean {
  if (value === undefined || value.trim() === "") return fallback;
  if (value.trim().toLowerCase() === "true") return true;
  if (value.trim().toLowerCase() === "false") return false;
  throw new Error(`${name} must be true or false`);
}
