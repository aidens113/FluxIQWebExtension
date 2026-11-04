import type { ChatAnswerPort, ShownAnswerTurn } from "../../flow-lane/index.js";

/**
 * STAND-IN for the Answer lane's turn, read through the port the real one will use.
 * `shows` is a turn with what the attempt holds, previewed as Core's limit says.
 * `silent` is a chat that never told the person anything, which is what this port
 * exists to catch.
 */
export function scriptedChatPort(mode: "shows" | "silent", holds: () => { rows: readonly Readonly<Record<string, unknown>>[]; landedActs: number }): ChatAnswerPort {
  return {
    readShownAnswer: async () => {
      if (mode === "silent") return null;
      const { rows, landedActs } = holds();
      const turn: ShownAnswerTurn = {
        kind: rows.length > 0 ? "rows" : landedActs > 0 ? "done_on_site" : "partial",
        ...(rows.length > 0 ? { rows: { totalRows: rows.length, truncated: false, previewRows: rows.slice(0, 50) } } : {}),
        acts: Array.from({ length: landedActs }, () => ({ state: "landed" as const })),
      };
      return { form: "turn", turn };
    },
  };
}
