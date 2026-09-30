// The one page-load pace of this worker's life, which every command the
// connection runs consults (`runtime/command-router.ts`). A worker the browser
// stops and restarts starts a new one; while FluxIQ is driving a site its
// connection keeps the worker alive.

import { OriginPace } from "./origin-pace";

export const SESSION_PAGE_LOAD_PACE = new OriginPace();
