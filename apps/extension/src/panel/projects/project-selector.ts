// The header's project switcher: `@fluxiq/ui-components`' sheet over the
// extension's projects port. Choosing a project tells the background
// (`panelSelectProject`), whose status push then moves the chat and the
// automations to it; the shell tells the switcher which project is current
// from each status.

import { createProjectSwitcher, type ProjectsPort } from "@fluxiq/ui-components";
import { RUNTIME_MESSAGES } from "../../shared/constants";
import type { ExtensionStatus } from "../../shared/protocol";
import type { PanelStore } from "../state";

/** The mounted switcher. */
export type ProjectSelector = {
  readonly element: HTMLElement;
  /** Names the current project from `status`, only when it changed. */
  render(status: ExtensionStatus): void;
};

/** What the selector reaches beside the port. */
export type ProjectSelectorOptions = {
  /** "Add or manage projects in the FluxIQ panel": opens the web panel at its projects page. */
  readonly openAll: () => void;
};

/** Builds the selector over `port`; a choice goes through `request`. */
export function createProjectSelector(request: PanelStore["request"], port: ProjectsPort, options: ProjectSelectorOptions): ProjectSelector {
  let current: string | undefined;
  /** Names already seen per project id, so a status that names the id before its name never drops the label back to "Project". */
  const known = new Map<string, string>();
  const switcher = createProjectSwitcher({
    port,
    onSelect: (project) => {
      void request({ type: RUNTIME_MESSAGES.panelSelectProject, projectId: project.id }).then((result) => {
        if (!result.ok) switcher.refresh();
      });
    },
    onOpenAll: options.openAll
  });
  async function nameFromList(id: string, key: string): Promise<void> {
    try {
      const found = (await port.list()).find((project) => project.id === id)?.name.trim();
      // Only while this status is still the current one: a newer status names itself.
      if (found) known.set(id, found);
      if (found && current === key) switcher.setCurrent({ id, name: found });
    } catch {
      /* best-effort: the label stays generic; opening the switcher shows the real error */
    }
  }
  return {
    element: switcher.element,
    render(status) {
      const id = typeof status.projectId === "string" && status.projectId !== "" ? status.projectId : undefined;
      const statusName = status.projectName?.trim() ?? "";
      if (id !== undefined && statusName !== "") known.set(id, statusName);
      const name = statusName !== "" ? statusName : id === undefined ? "" : known.get(id) ?? "";
      const key = id === undefined ? "" : `${id}\n${name}`;
      if (key === current) return;
      current = key;
      switcher.setCurrent(id === undefined ? null : { id, name: name || "Project" });
      // The status can name the project's id before its name (the background learns names from the list);
      // read the name from the same list the switcher shows, so the header never waits for the sheet to open.
      if (id !== undefined && name === "") void nameFromList(id, key);
    }
  };
}
