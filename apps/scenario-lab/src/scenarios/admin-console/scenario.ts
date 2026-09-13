import { defineScenario } from "../../types.js";
import { adminConsoleManifest } from "./manifest.js";
import { renderConsoleDocument } from "./markup.js";
import { routeAdminConsole } from "./route.js";
import { createAdminConsoleState, mutateAdminConsoleState } from "./state.js";
import type { AdminConsoleState } from "./types.js";

/**
 * A CRM console with the four properties this corpus had no fixture for: a
 * virtualised customer list whose rows exist only while they are near the
 * viewport, a settings switch inside a web component's open shadow root, route
 * changes that rewrite `document.location` with no request, and detail-pane
 * cells that turn into inputs and back while an edit is being made.
 *
 * The book is the same for every lab seed. The manifest's expected extraction
 * records are literal text, so a reseed must not move a single row.
 */
export const adminConsoleScenario = defineScenario<AdminConsoleState>({
  id: "admin-console",
  title: "Admin console",
  startPath: "/scenarios/admin-console/",
  seed: 112,
  manifest: adminConsoleManifest,
  createState: () => createAdminConsoleState(),
  mutate: mutateAdminConsoleState,
  render: (state, context) => renderConsoleDocument(state, context.runToken),
  route: (state, request, context) => routeAdminConsole(state, request, context),
});
