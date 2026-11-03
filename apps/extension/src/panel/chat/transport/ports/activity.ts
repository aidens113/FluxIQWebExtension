import type { ChatActivityPort } from "@fluxiq/ui-components";
import { ACTIVITY_MESSAGES } from "../../../../shared/activity/index";
import type { PanelStore } from "../../../state";
import { asRecord, stateOf } from "../reply";

/** What the runtime's broadcast is heard through: every message, answering an unsubscribe. */
export type RuntimeListen = (listener: (message: unknown) => void) => () => void;

/** FluxIQ's live activity: read and set through the background, pushed by its broadcast. */
export function activityPort(request: PanelStore["request"], listen: RuntimeListen): ChatActivityPort {
  return {
    read: async () => stateOf(await request({ type: ACTIVITY_MESSAGES.read })),
    subscribe: (listener) => listen((message) => {
      const pushed = asRecord(message);
      if (pushed?.type === ACTIVITY_MESSAGES.changed) {
        listener(pushed.state);
      }
    }),
    setOverlay: async (overlay) => stateOf(await request({ type: ACTIVITY_MESSAGES.setOverlay, overlay }))
  };
}
