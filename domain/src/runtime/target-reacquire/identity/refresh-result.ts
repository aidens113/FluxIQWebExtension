import type { AutomationStudioUnboundTargetReacquireAnswer } from "fluxiq/automation-studio";
import type { WebFreshTarget } from "./fresh-target";

/** Shared web matching result; adapters alone turn a fresh target into dispatch patches. */
export type WebTargetIdentityRefreshResult =
  | { outcome: "found"; target: WebFreshTarget }
  | Exclude<AutomationStudioUnboundTargetReacquireAnswer, { outcome: "found" }>;
