// Page-world script entry point. This bundle is the one part of the extension
// that runs in the page's own JavaScript world (`world: "MAIN"` in each
// manifest), at `document_start`, in every frame.
//
// It owns no behaviour of its own -- only the order things happen in. Nothing
// here should grow beyond wiring, and nothing in this directory may import
// extension, domain, or Core modules: the page can read and rewrite everything
// this bundle defines, so it holds no tokens, no recorded data, and no
// messaging to the background worker. Its only channel is the DOM contract in
// `shared/dialog-channel.ts`.

import { installDialogOverride } from "./dialog-override";

installDialogOverride();
