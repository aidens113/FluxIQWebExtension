// The side panel entry (Chrome and Edge): the same panel UI as the popup, from
// panel/, mounted into the stub page's #app for the side-panel surface.
import { mountPanel } from "../panel";

const root = document.getElementById("app");
if (!root) throw new Error("Missing panel root: #app");
mountPanel(root, "sidepanel");
