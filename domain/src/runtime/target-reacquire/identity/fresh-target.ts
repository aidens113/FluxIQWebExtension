import type { WebAutomationElementFingerprint } from "../../../actions/types";

/** A candidate rebuilt from the fresh observation, never from a saved handle. */
export type WebFreshTarget = {
  selector: string;
  element: WebAutomationElementFingerprint;
  hidden: boolean;
};
