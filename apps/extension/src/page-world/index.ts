// Page-world script entry point. This bundle is the one part of the extension
// that runs in the page's own JavaScript world (`world: "MAIN"` in each
// manifest), at `document_start`, in every frame.
//
// It owns no behaviour of its own -- only the order things happen in. Nothing
// here should grow beyond wiring, and nothing in this directory may import
// extension, domain, or Core modules: the page can read and rewrite everything
// this bundle defines, so it holds no tokens, no recorded data, and no
// messaging to the background worker. Its only channels are the DOM contracts
// in `shared/dialog-channel.ts`, `shared/press-probe-event.ts`,
// `shared/request-start-event.ts` and `shared/scheduled-work-event.ts`.

import { installDialogOverride } from "./dialog-override";
import { installPressListenerWatch } from "./press-listeners";
import { installPageWorkWatch } from "./page-work";
import { installRequestStartWatch } from "./request-starts";
import { installPressWorkWatch } from "./press-work";
import { installWindowOpenWatch } from "./window-opens";

installDialogOverride();
installPressListenerWatch();
// First, so the request probe's and the press-work watch's wrappers sit over its own and their health checks hold.
installPageWorkWatch();
installRequestStartWatch();
installPressWorkWatch();
installWindowOpenWatch();
