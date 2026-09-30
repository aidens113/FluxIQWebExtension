// The popup entry (Firefox, and the toolbar popup): the shared panel UI from
// panel/, mounted into the stub page's #app for the popup surface.
import { mountPanel } from "../panel";

const root = document.getElementById("app");
if (!root) throw new Error("Missing panel root: #app");
mountPanel(root, "popup");
