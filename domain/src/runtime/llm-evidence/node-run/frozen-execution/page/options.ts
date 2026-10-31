import type { WebTargetScope } from "../../../../target-reacquire/identity";

/** A scoped passive read shared by ordinary preparation and selected execution. */
export type WebNodePageOptions = { includeHidden?: true; scope: WebTargetScope };
