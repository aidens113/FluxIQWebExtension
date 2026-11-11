import type { FluxIQSettings } from "../../../shared/protocol";

/** The settings with `humanness` (optional integer 0-100, absent is 0), until protocol.ts carries it (interface I1). */
export type HumannessSettings = FluxIQSettings & { humanness?: number };
