import type { WebAutomationElementFingerprint } from "../../../actions/types";

/** Existing structured record identity, retained privately beside transient handles. */
export type WebTargetRecordIdentity = NonNullable<NonNullable<WebAutomationElementFingerprint["context"]>["record"]>;
