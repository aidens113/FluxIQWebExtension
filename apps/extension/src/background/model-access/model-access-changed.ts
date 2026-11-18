// `server.model_access_changed` carries Core's model-access state: whether the
// person's key works and, when not, why. It becomes one panel message so the
// panel shows it at once. Read through the contract, so a malformed state is
// dropped, and sent without the key id, as Core sends it to paired clients.

import { pairedClientModelAccessState, readModelAccessState } from "@fluxiq/contracts/platform";
import { PANEL_MODEL_ACCESS_CHANGED, type PanelModelAccessChangedMessage } from "../../shared/protocol";

/** The panel message for one `server.model_access_changed` payload, or undefined when it holds no valid state. */
export function modelAccessChangedFor(payload: unknown, at: number): PanelModelAccessChangedMessage | undefined {
  const raw = payload && typeof payload === "object" ? (payload as { modelAccess?: unknown }).modelAccess : undefined;
  const modelAccess = readModelAccessState(raw);
  if (!modelAccess) return undefined;
  return { type: PANEL_MODEL_ACCESS_CHANGED, modelAccess: pairedClientModelAccessState(modelAccess), at };
}
