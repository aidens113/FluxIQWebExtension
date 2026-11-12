import type { ChatTaskSettingsPort } from "@fluxiq/ui-components";
import { RUNTIME_MESSAGES } from "../../../../../shared/constants";
import type { ExtensionStatus, PanelTaskHumannessSetRequest } from "../../../../../shared/protocol";
import type { PanelStore } from "../../../../state";
import { humannessOf } from "../../reply";
import { readTaskHumanness } from "./read-task-humanness";
import { startingHumanness } from "./starting-humanness";

/**
 * A task's own settings on its answer card, through the background: its
 * humanness from its `list-project-tasks` row, the person's starting value from
 * the latest status (read each time, so a change in Settings shows on the next
 * read), and a set or clear through `update-task-settings`.
 */
export function taskSettingsPort(request: PanelStore["request"], status: () => ExtensionStatus | undefined): ChatTaskSettingsPort {
  return {
    read: async (task) => {
      const own = await readTaskHumanness(request, task);
      if (!own.ok) return own;
      const starting = startingHumanness(status());
      return { ok: true, value: own.value.humanness === undefined ? { starting } : { humanness: own.value.humanness, starting } };
    },
    setHumanness: async ({ projectId, taskId, humanness }) => humannessOf(await request({
      type: RUNTIME_MESSAGES.panelTaskHumannessSet,
      projectId,
      taskId,
      humanness
    } satisfies PanelTaskHumannessSetRequest & { type: string }))
  };
}
