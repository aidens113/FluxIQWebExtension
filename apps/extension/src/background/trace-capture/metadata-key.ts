// The key a traced command's request and its result's reference ride under in
// `metadata`. Core's constant is imported as a type only, so the background
// bundle never loads Core's client-gateway service; the declared type makes
// this copy a compile error the moment the two differ.

import type { CLIENT_GATEWAY_TRACE_METADATA_KEY } from "fluxiq/client-gateway";

export const TRACE_METADATA_KEY: typeof CLIENT_GATEWAY_TRACE_METADATA_KEY = "trace";
