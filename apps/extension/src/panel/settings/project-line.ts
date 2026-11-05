// Which project this browser works in, in words: by Core's name for it once the background has it, and
// otherwise by saying a project is chosen. Never an id.

import type { ExtensionStatus } from "../../shared/protocol";

/** What to say about the project. */
export function projectLine(status: ExtensionStatus | undefined): string {
  if (status === undefined || status.connectionState !== "connected") return "Connect to FluxIQ to see which project this browser works in.";
  if (typeof status.projectId !== "string" || status.projectId === "") return "No project is chosen yet. Choose one in FluxIQ.";
  const name = status.projectName?.trim();
  return name ? `This browser works in the project “${name}”. Change it in FluxIQ.` : "This browser works in the project you chose in FluxIQ. Change it there.";
}
