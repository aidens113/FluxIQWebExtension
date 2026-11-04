// Which project this browser works in, in words. The panel is told only that a project is
// chosen, never its name (no port reads one yet), so the sentence says so rather than
// showing an id.

import type { ExtensionStatus } from "../../shared/protocol";

/** What to say about the project. */
export function projectLine(status: ExtensionStatus | undefined): string {
  if (status === undefined || status.connectionState !== "connected") return "Connect to FluxIQ to see which project this browser works in.";
  return typeof status.projectId === "string" && status.projectId !== ""
    ? "This browser works in the project you chose in FluxIQ. Change it there."
    : "No project is chosen yet. Choose one in FluxIQ.";
}
