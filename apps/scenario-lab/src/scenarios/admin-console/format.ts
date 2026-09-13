import type { ConsoleRoute, SettingsTab } from "./types.js";

/** The console's start page. Every in-app path is written root-relative from here, so it reads the same on any run's port. */
export const ADMIN_CONSOLE_ROOT = "/scenarios/admin-console/";

/** `$1,180.00`. The inline editor's own formatter in `inline-edit.ts` must agree with this; the e2e spec checks that it does. */
export function formatMoney(cents: number): string {
  const dollars = String(Math.floor(Math.abs(cents) / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${cents < 0 ? "-" : ""}$${dollars}.${String(Math.abs(cents) % 100).padStart(2, "0")}`;
}

/** The deep link a record's row pushes onto the history stack. */
export function recordPath(id: string): string {
  return `${ADMIN_CONSOLE_ROOT}records/${id}`;
}

/** The settings deep link. The tab rides in the query, because the client changes it with `replaceState`. */
export function settingsPath(tab: SettingsTab): string {
  return tab === "profile" ? `${ADMIN_CONSOLE_ROOT}settings` : `${ADMIN_CONSOLE_ROOT}settings?tab=${tab}`;
}

/** The path a route is showing: what `document.location` reads after the client has routed to it. */
export function routePathFor(route: ConsoleRoute): string {
  if (route.view === "settings") return settingsPath(route.tab);
  return route.recordId ? recordPath(route.recordId) : ADMIN_CONSOLE_ROOT;
}
