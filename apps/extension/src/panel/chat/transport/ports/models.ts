import type { ChatModelsPort } from "@fluxiq/ui-components";
import { RUNTIME_MESSAGES } from "../../../../shared/constants";
import type { PanelStore } from "../../../state";
import { payloadOf } from "../reply";

/** Whether FluxIQ has a model key, from the background's readiness relay. */
export function modelsPort(request: PanelStore["request"]): ChatModelsPort {
  return {
    readKeys: async () => {
      const payload = payloadOf(await request({ type: RUNTIME_MESSAGES.panelModelReadiness }));
      return payload.ok ? { ok: true, value: { keys: payload.value.keys } } : payload;
    }
  };
}
