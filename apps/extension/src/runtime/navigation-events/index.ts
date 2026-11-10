// Barrel for the browser's navigation events, counted per tab: what tells a
// look still standing from a page that has begun to move (task speed S3), and
// a page that has finished moving and finished drawing itself from one still at
// work (S10).
export { refreshDeclaredSoon } from "./declared-refresh";
export { tabNavigationEpochs } from "./epochs";
export { pageWorkSettled } from "./page-work";
export { declaredRefreshDelayMs } from "./refresh-delay";
