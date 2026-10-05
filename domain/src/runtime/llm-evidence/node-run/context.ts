// What one node run is handed: the gateway it acts through, the call it
// answers, and the build's memories that outlive the call.
//
// Its own file because both the run (`./run.ts`) and the replay
// (`./replay.ts`) take it, and because each memory a build keeps across calls
// (`./arrival.ts`, `./shown-addresses.ts`, `./own-layers/memory.ts`) arrives
// here rather than as another parameter of the run.

import type { WebLlmEvidenceGateway, WebLlmEvidenceToolRequest } from "../capture";
import type { WebPlanHandleStores } from "../plan-resolution";
import type { WebLlmSnapshotBinding } from "../sanitize";
import type { WebNodeArrivals } from "./arrival";
import type { WebNodeOwnLayers } from "./own-layers";
import type { WebNodeShownAddresses } from "./shown-addresses";

export type WebNodeRun = {
  gateway: WebLlmEvidenceGateway;
  sessionId: string;
  request: WebLlmEvidenceToolRequest;
  stores: WebPlanHandleStores;
  /** Renumber a capture's handles so they keep naming what they named. */
  restamp: (binding: WebLlmSnapshotBinding) => WebLlmSnapshotBinding;
  /** Remember a packet the model has now been shown. */
  shown: (binding: WebLlmSnapshotBinding) => void;
  /**
   * Remember the look a call takes before it acts, which the model is not
   * shown: its controls become pressable, and a look cut short at its forty
   * controls forgets none the model was shown (`../plan-resolution/target-packets.ts`).
   */
  looked: (binding: WebLlmSnapshotBinding) => void;
  /**
   * Whether this build has reached its start location, held by the runtime for
   * the life of the process (`./arrival.ts`). Read only for a build told a
   * start location.
   */
  arrivals: WebNodeArrivals;
  /** Where this build has been shown it can go, which is where it may navigate (`./shown-addresses.ts`). */
  addresses: WebNodeShownAddresses;
  /** The layers a press of this build opened, which closing is a step of the Flow and not an interruption (`./own-layers/memory.ts`). */
  layers: WebNodeOwnLayers;
};
