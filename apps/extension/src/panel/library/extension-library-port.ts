// The library's port for this build: the panel messages for saved parts, as the background relays them.

import type { SubflowLibraryPort } from "@fluxiq/ui-components";
import type { PanelStore } from "../state";
import { createPartsLibraryPort } from "./library-port";

/** The library port for this build. */
export function extensionLibraryPort(request: PanelStore["request"]): SubflowLibraryPort {
  return createPartsLibraryPort(request);
}
