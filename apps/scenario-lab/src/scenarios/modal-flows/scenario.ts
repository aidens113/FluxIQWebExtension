import { page } from "../../html.js";
import { defineScenario } from "../../types.js";
import { modalFlowsClientScript } from "./client-script.js";
import { modalFlowsManifest } from "./manifest.js";
import { renderModalFlowsBody } from "./markup.js";
import { mutateModalFlows } from "./mutate.js";
import { createModalFlowsState, type ModalFlowsState } from "./state.js";

/**
 * Corpus rows W12-W14 on one draft editor: an accessible invite modal, a
 * cookie-consent banner over the primary action, an armable upsell
 * interstitial, and a Delete draft button guarded by a native confirm() for
 * the Phase 1.2 dialog action.
 */
export const modalFlowsScenario = defineScenario<ModalFlowsState>({
  id: "modal-flows",
  title: "Modal flows",
  startPath: "/scenarios/modal-flows/",
  seed: 117,
  manifest: modalFlowsManifest,
  createState: createModalFlowsState,
  mutate: mutateModalFlows,
  render: (state, context) => page("Modal flows", renderModalFlowsBody(state), modalFlowsClientScript(context.runToken, state)),
});
