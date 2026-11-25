// The run's target packets, also feeding what the run sees a page change by itself
// (`./memory.ts`, t1043). Every capture a build records reaches the packets
// (`remember`, `rememberLook`), and the node run tells them before anything is done to
// the page (`acting`): exactly the two things the memory needs, so it is fed where t496's
// memory of control names is (`../../../plan-resolution/target-packets.ts`) and nothing
// else has to remember to feed it.

import type { WebLlmTargetPackets } from "../../../plan-resolution";
import { createWebPressSelfChanges } from "./memory";

/** `packets`, with every capture and every act also kept by a memory of what the page changes by itself. */
export function webPressSelfChangeWatch(packets: WebLlmTargetPackets): WebLlmTargetPackets {
  const changes = createWebPressSelfChanges();
  return {
    ...packets,
    remember(scope, binding) {
      changes.captured(scope, binding);
      packets.remember(scope, binding);
    },
    rememberLook(scope, binding) {
      changes.captured(scope, binding);
      packets.rememberLook(scope, binding);
    },
    acting(scope) {
      changes.acting(scope);
      packets.acting(scope);
    }
  };
}
