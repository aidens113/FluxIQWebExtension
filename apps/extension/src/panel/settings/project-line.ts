// Which project this browser works in, in words: by its name once the background has it, and
// otherwise by saying a project is chosen. Never an id. Projects are managed in the FluxIQ panel
// (the link beside it in `settings-view.ts`); the header's switcher is the one place to switch.

import type { ExtensionStatus } from "../../shared/protocol";

/** What to say about the project. */
export function projectLine(status: ExtensionStatus | undefined): string {
  if (status === undefined || status.connectionState !== "connected") return "Connect to FluxIQ to see which project this browser works in.";
  if (typeof status.projectId !== "string" || status.projectId === "") return "No project yet. FluxIQ makes one when you send your first message.";
  const name = status.projectName?.trim();
  return name ? `Project: “${name}”` : "Project: the one you chose in FluxIQ";
}
