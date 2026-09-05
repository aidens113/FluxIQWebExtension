import path from "node:path";
import type { RunAllocation } from "./allocation.js";

export type TopologyPaths = {
  repositoryRoot: string;
  fluxiqRepositoryRoot: string;
  hostModulePath?: string;
};

export function buildScenarioEnvironment(allocation: RunAllocation, seed: number, base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  return {
    ...base,
    SCENARIO_LAB_RUN_TOKEN: allocation.controllerToken,
    SCENARIO_LAB_PORT: String(allocation.scenarioPort),
    SCENARIO_LAB_SEED: String(seed),
  };
}

export function buildFluxIQEnvironment(allocation: RunAllocation, paths: TopologyPaths, base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const hostModulePath = paths.hostModulePath ?? path.join(paths.repositoryRoot, "domain", "dist", "host", "web-panel-host.cjs");
  return {
    ...base,
    PORT: String(allocation.webPort),
    FLUXIQ_ROOT: allocation.fluxiqRoot,
    FLUXIQ_IMPORTER_ROOT: allocation.fluxiqRoot,
    FLUXIQ_HOST_ROOT: allocation.fluxiqRoot,
    FLUXIQ_DATA_DIR: allocation.storageDir,
    FLUXIQ_DATABASES_DIR: allocation.storageDir,
    FLUXIQ_HOST_MODULE: hostModulePath,
    FLUXIQ_CLIENT_GATEWAY_ENABLED: "true",
    FLUXIQ_CLIENT_GATEWAY_HOST: "127.0.0.1",
    FLUXIQ_CLIENT_GATEWAY_PORT: String(allocation.gatewayPort),
    FLUXIQ_CLIENT_GATEWAY_PATH: "/client",
    FLUXIQ_PUBLIC_CLIENT_WS_URL: `ws://127.0.0.1:${allocation.gatewayPort}/client`,
  };
}
