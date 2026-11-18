import type { ScriptedModelScript } from "../../attempt-lane/scripted-model/index.js";

/** A transport fixture: it never replaces Core's model binding or secret resolver. */
export function approvedClientModelScript(): { script: ScriptedModelScript; receipts(): readonly string[] } {
  const receipts: string[] = [];
  const names = ["configured-later", "after-panel-logout", "after-reconnect", "after-core-restart", "approved-without-password"];
  return {
    receipts: () => [...receipts],
    script: {
      taskId: "approved-client-access",
      replies: {
        panel_command: names.map((name) => (request) => {
          if (request.message !== `Check approved client access: ${name}`) throw new Error("The approved-client fixture received an unexpected probe.");
          receipts.push(name);
          return { reply: `Approved client access confirmed: ${name}` };
        })
      }
    }
  };
}
