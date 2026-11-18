import type { ModelAccessState } from "@fluxiq/contracts/platform";
import type { ModelKeyAvailability } from "fluxiq/ui";

/** Safe model metadata. Null availability means malformed status; absence permits legacy compatibility. */
export type PanelModelKeySummary = {
  readonly kind?: string;
  readonly provider?: string;
  readonly enabled: boolean;
  readonly heldByYou?: boolean;
  readonly availability?: ModelKeyAvailability | null;
  /** Only an old explicit refusal is retained, so an incompatible server never looks ready. */
  readonly unlocked?: false;
};

/** The providers a person's own model key may be saved for. */
export const MODEL_KEY_PROVIDERS = ["anthropic", "deepseek"] as const;
export type ModelKeyProvider = (typeof MODEL_KEY_PROVIDERS)[number];

/** Core's pushed model-access state (`server.model_access_changed`), passed on to the side panel. Carries no key id and no key value. */
export const PANEL_MODEL_ACCESS_CHANGED = "fluxiq.panel.modelAccessChanged";
export type PanelModelAccessChangedMessage = {
  readonly type: typeof PANEL_MODEL_ACCESS_CHANGED;
  readonly modelAccess: ModelAccessState;
  readonly at: number;
};

