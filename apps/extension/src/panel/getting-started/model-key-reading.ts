import type { ModelAccessState } from "@fluxiq/ui-components";

/** What setup knows of the person's AI key: the card's state, or `unknown` when it could not be read. */
export type ModelKeyReading = ModelAccessState | "unknown";
