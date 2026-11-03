import type { ChatRunPort } from "@fluxiq/ui-components";
import { RUNTIME_MESSAGES } from "../../../../shared/constants";
import type { PanelStore } from "../../../state";
import { failureOf, payloadOf, refusalOf } from "../reply";

/** Stop, Take over, Hand back and the instructions recovery, through the background. */
export function runsPort(request: PanelStore["request"]): ChatRunPort {
  return {
    stop: async (target) => {
      const result = await request({ type: RUNTIME_MESSAGES.panelStopRun, ...target });
      const refused = refusalOf(result);
      if (refused !== undefined) {
        return refused;
      }
      const payload = payloadOf(result);
      if (!payload.ok) {
        return payload;
      }
      if (payload.value.cancellationRequested === false) {
        return { ok: true, value: { cancellationRequested: false } };
      }
      return { ok: true, value: {} };
    },
    takeOver: async (target) => refusalOf(await request({ type: RUNTIME_MESSAGES.panelTakeOverRun, ...target })) ?? { ok: true, value: undefined },
    handBack: async (target) => refusalOf(await request({ type: RUNTIME_MESSAGES.panelHandBackRun, ...target })) ?? { ok: true, value: undefined },
    openInstructions: async (runId) => {
      const result = await request({ type: RUNTIME_MESSAGES.panelOpenFluxIQ, runId });
      return result.ok ? { ok: true, value: undefined } : failureOf(result);
    }
  };
}
