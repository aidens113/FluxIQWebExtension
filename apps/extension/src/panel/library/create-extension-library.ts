// The subflow library as the extension mounts it: the package's screen over a port. `port` is the one the caller
// has, or the build's own (`extensionLibraryPort`); with neither there is no library, and the caller shows none.

import { createLibraryScreen, type LibraryHost, type LibraryScreen, type SubflowLibraryPort } from "@fluxiq/ui-components";
import "@fluxiq/ui-components/styles/library.css";
import type { PanelStore } from "../state";
import { extensionLibraryPort } from "./extension-library-port";

/** The library screen, or `undefined` when this build has no library to read. */
export function createExtensionLibrary(request: PanelStore["request"], port: SubflowLibraryPort | undefined, host: LibraryHost): LibraryScreen | undefined {
  const chosen = port ?? extensionLibraryPort(request);
  return chosen === undefined ? undefined : createLibraryScreen({ port: chosen, host });
}
