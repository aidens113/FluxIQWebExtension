import type { BrowserActionCommand, BrowserActionResult } from "../shared/protocol";

const PORT_NAME = "fluxiq.test.action-evidence";
const ACK_TIMEOUT_MS = 15_000;

type ActionBoundary = {
  boundaryId: string;
  phase: "before" | "after";
  commandId: string;
  actionType: string;
  status?: BrowserActionResult["status"];
};

let evidencePort: chrome.runtime.Port | undefined;
let nextBoundaryId = 0;

export function acceptActionEvidencePort(port: chrome.runtime.Port): boolean {
  if (port.name !== PORT_NAME) return false;
  evidencePort = port;
  port.onDisconnect.addListener(() => {
    if (evidencePort === port) evidencePort = undefined;
  });
  return true;
}

export async function captureActionBoundary(
  phase: ActionBoundary["phase"],
  value: BrowserActionCommand | BrowserActionResult,
): Promise<void> {
  const port = evidencePort;
  if (!port) return;
  const activePort = port;
  const boundaryId = `${value.commandId}:${phase}:${++nextBoundaryId}`;
  const message: ActionBoundary = {
    boundaryId,
    phase,
    commandId: value.commandId,
    actionType: value.actionType,
    ...(phase === "after" && "status" in value ? { status: value.status } : {}),
  };
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => finish(new Error(`Timed out capturing ${phase} evidence for ${value.actionType}.`)), ACK_TIMEOUT_MS);
    const onMessage = (response: unknown) => {
      const ack = response as { boundaryId?: unknown; ok?: unknown; error?: unknown };
      if (ack?.boundaryId !== boundaryId) return;
      finish(ack.ok === true ? undefined : new Error(typeof ack.error === "string" ? ack.error : "Action evidence capture failed."));
    };
    const onDisconnect = () => finish(new Error("Action evidence observer disconnected."));
    function finish(error?: Error): void {
      clearTimeout(timeout);
      activePort.onMessage.removeListener(onMessage);
      activePort.onDisconnect.removeListener(onDisconnect);
      if (error) reject(error);
      else resolve();
    }
    activePort.onMessage.addListener(onMessage);
    activePort.onDisconnect.addListener(onDisconnect);
    try {
      activePort.postMessage(message);
    } catch (error) {
      finish(error instanceof Error ? error : new Error("Action evidence observer is unavailable."));
    }
  });
}
