// The one seam the setup screens read the model key through. The panel's default is
// `extensionSetupPort`; a spec passes a fake in `PanelPorts.setup`.

import type { ModelKeyReading } from "./model";

/** What setup reads. A failed read answers `unknown`, never throws. */
export type SetupPort = { readModelKey(): Promise<ModelKeyReading> };
