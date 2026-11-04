// THE ONE NAMED SEAM. The parts messages (`listParts`, `getPart`, `runPart`) are built on t866's branch, which has
// not landed, so the extension has no library to show yet and the Automations tab shows no Library segment.
// When t866 lands: set `LIBRARY_LANDED` to `true`, and replace the three literals in `library-port.ts` with
// `AUTOMATION_PANEL_MESSAGES.listParts`, `getPart` and `runPart`. Nothing else changes.

import type { SubflowLibraryPort } from "@fluxiq/ui-components";
import type { PanelStore } from "../state";
import { createPartsLibraryPort } from "./library-port";

const LIBRARY_LANDED = false;

/** The library port for this build, or `undefined` while the background cannot answer for it. */
export function extensionLibraryPort(request: PanelStore["request"]): SubflowLibraryPort | undefined {
  return LIBRARY_LANDED ? createPartsLibraryPort(request) : undefined;
}
