// A stale target found again by its identity (t786): the web host's half of
// Core's re-acquire (`fluxiq/automation-studio` `target-reacquire/`). Core owns
// the lineage, the trigger, the read-only re-run of the source step and the
// rebinding; this module owns how one web item is the same item again -- a
// read's row (`row-match.ts`, `row-key-columns.ts`, `volatile-text.ts`) or a
// control (`element-match.ts`) -- and how the page goes back to where the
// source ran (`return-to-source-place.ts`, `source-places.ts`). The host
// runtime binds both methods (`../host-runtime.ts`); a build's own exploration
// and draft tests use the matchers through `llm-evidence/node-run/retries/`.

export { webReacquireElement } from "./element-match";
export { webAutomationReacquireTarget } from "./reacquire-target";
export { webAutomationReturnToSourcePlace, type WebSourcePlaceDispatch } from "./return-to-source-place";
export { webReacquireRowKeyColumns } from "./row-key-columns";
export { webReacquireRow } from "./row-match";
export { createWebSourcePlaces, type WebSourcePlaces } from "./source-places";
export { webReacquireText } from "./text";
export { webReacquireVolatileText } from "./volatile-text";
