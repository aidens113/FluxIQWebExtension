import type { ChatResult } from "@fluxiq/ui-components";
import { RUNTIME_MESSAGES } from "../../../shared/constants";
import type { PanelFlowHumannessReadRequest, PanelFlowHumannessSetRequest } from "../../../shared/protocol";
import { humannessOf } from "../../chat/transport/reply";
import type { PanelStore } from "../../state";

/** One Flow's own humanness: read it, and set it or clear it with `null`. Each answers the own level Core holds, absent when it holds none. */
export type FlowHumannessPort = {
  read(flowId: string): Promise<ChatResult<{ humanness?: number }>>;
  set(flowId: string, humanness: number | null): Promise<ChatResult<{ humanness?: number }>>;
};

/**
 * The port over the background's humanness relay (`background/panel/humanness-relay.ts`).
 * No project is named, so it is the session's, as the strip's own Flow list is.
 */
export function flowHumannessPort(request: PanelStore["request"]): FlowHumannessPort {
  return {
    read: async (flowId) => humannessOf(await request({
      type: RUNTIME_MESSAGES.panelFlowHumannessRead,
      flowId
    } satisfies PanelFlowHumannessReadRequest & { type: string })),
    set: async (flowId, humanness) => humannessOf(await request({
      type: RUNTIME_MESSAGES.panelFlowHumannessSet,
      flowId,
      humanness
    } satisfies PanelFlowHumannessSetRequest & { type: string }))
  };
}
