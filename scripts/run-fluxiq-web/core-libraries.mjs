/** Core's library builds the panel and the host's setup compile against, in dependency order. */
export const CORE_LIBRARY_STEPS = ["contracts:build", "sdk:build", "fluxiq:build", "client-gateway-websocket:build", "ui-components:build"];

/**
 * One line for a build-cache run, from its per-step JSON records (other output
 * lines are ignored): "current" when every step was reused, else the steps it
 * rebuilt.
 */
export function summarizeBuildCache(label, lines) {
  const rebuilt = lines
    .filter((line) => line.startsWith("{\"build-cache\""))
    .map((line) => JSON.parse(line))
    .filter((record) => record["build-cache"] !== "reuse")
    .map((record) => record.step.replace(/:build$/u, ""));
  return rebuilt.length === 0 ? `${label}: current.` : `${label}: rebuilt ${rebuilt.join(", ")} (they were out of date).`;
}
