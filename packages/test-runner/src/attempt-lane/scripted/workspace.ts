import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ScenarioStep } from "@fluxiq-web-extension/test-contracts";

/** What an attempt left saved for a task: a stand-in for Core's draft, with the steps it would hold. */
export type ScriptedDraft = Readonly<{ flowId: string; digest: string; steps: readonly ScenarioStep[] }>;

/**
 * STAND-IN for a FluxIQ workspace's saved drafts, until Core's Flow draft and attempt
 * read land. It is a file, so a second attempt can only find what an earlier one
 * really wrote; one workspace is one directory.
 */
export type ScriptedWorkspace = Readonly<{
  projectId: string;
  read(taskId: string): Promise<ScriptedDraft | null>;
  save(taskId: string, steps: readonly ScenarioStep[]): Promise<ScriptedDraft>;
}>;

export function scriptedWorkspace(directory: string, projectId: string): ScriptedWorkspace {
  const at = (taskId: string) => path.join(directory, `${taskId}.draft.json`);
  return Object.freeze({
    projectId,
    read: async (taskId: string) => {
      const text = await readFile(at(taskId), "utf8").catch((error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return null;
        throw error;
      });
      return text === null ? null : JSON.parse(text) as ScriptedDraft;
    },
    save: async (taskId: string, steps: readonly ScenarioStep[]) => {
      const digest = createHash("sha256").update(JSON.stringify(steps)).digest("hex");
      const draft: ScriptedDraft = { flowId: `flow-${digest.slice(0, 12)}`, digest, steps };
      await mkdir(directory, { recursive: true });
      await writeFile(at(taskId), JSON.stringify(draft));
      return draft;
    },
  });
}
