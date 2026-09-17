// How long the demo lanes wait for an adapting run. The run iterates for as
// long as Core's grant allows: a claim window, then the run lease once
// claimed, and the answer still has to come back. A run that finishes sooner
// is returned as soon as it is terminal.

import { EVIDENCE_GUIDED_CREATION_LIMITS } from "../../demo-llm-create-ui/index.js";

export const ADAPTING_RUN_TIMEOUT_MS = (EVIDENCE_GUIDED_CREATION_LIMITS.grantClaimWindowSeconds + EVIDENCE_GUIDED_CREATION_LIMITS.runLeaseSeconds) * 1_000 + 15_000;
