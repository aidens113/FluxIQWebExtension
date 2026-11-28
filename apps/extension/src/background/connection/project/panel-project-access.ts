// The panel's hold on the worker's project: which project a panel call uses, and
// the choice the panel's project messages make. Split from `FluxIQConnection`,
// which only owns the instances this reads through.

import type { PanelRelayResponse } from "../../../shared/protocol";
import type { ProjectChoice } from "../../projects/index";
import type { ProjectContext } from "../project-context";

export interface PanelProjectAccessDeps {
  readonly projects: ProjectContext;
  /** Tells Core of each choice, and each clear (`ProjectFocus.chosen`). */
  readonly announceChosen: (projectId: string | null) => Promise<unknown>;
}

export interface PanelProjectChoice {
  chosenProject: () => string | undefined;
  choose: (choice: ProjectChoice | null) => Promise<void>;
  noteName: ProjectContext["noteName"];
  /** Writes the chosen project to Core (I5); a refusal comes back as Core's sentence. */
  shareChoice: (projectId: string) => Promise<PanelRelayResponse>;
}

export class PanelProjectAccess {
  constructor(private readonly deps: PanelProjectAccessDeps) {}

  /**
   * The project a panel call uses: the person's choice, else the held one,
   * which Core is asked about once per lease and then in the background
   * (`ProjectContext.forPanel`), so no call waits on a snapshot fetch.
   */
  projectId(): Promise<string | undefined> {
    return this.deps.projects.forPanel("panel");
  }

  /** The panel's project messages' hold on the worker's project choice. */
  choice(): PanelProjectChoice {
    const { projects } = this.deps;
    return {
      chosenProject: () => projects.chosenProject(),
      // Core is told each choice, and each clear, so the chat hears the chosen project's work as it happens.
      choose: async (choice) => {
        await projects.choose(choice);
        await this.deps.announceChosen(choice?.projectId ?? null);
      },
      noteName: (projectId, name) => projects.noteName(projectId, name),
      shareChoice: (projectId) => projects.shareChoice(projectId)
    };
  }
}
