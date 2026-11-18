// The one seam the screens read the AI key through: the key card in Settings reads its state here, and the chat's
// card reads the same reply (`panel/chat/transport/ports/model-keys`). The panel's default is `extensionSetupPort`;
// a spec passes a fake in `PanelPorts.setup`.

import type { ModelAccessState } from "@fluxiq/ui-components";
import type { ModelKeyReading } from "./model-key-reading";

/** What setup reads. A failed read answers `unknown`, never throws. */
export type SetupPort = {
  readModelKey(): Promise<ModelKeyReading>;
  /** Hears the key's state as the background pushes it (`null`: changed, read again). Absent: the card only reads when asked. */
  subscribeModelKey?(listener: (state: ModelAccessState | null) => void): () => void;
};
