// The `state.*` paths a web Flow's Router can test, and what each holds.
//
// Core's Router decides before any step runs, from the run's inputs and the
// state its host observes where the run starts. These are the words this
// host fills that state with. They are handed to Core as
// `routeStatePaths`, which is what a model building a Flow is shown, so it
// can write a condition on a path that happens to be absent right now -- no
// dialog open, nothing covering the page -- as well as on one it can see.
//
// Every value is read out of the sanitized evidence packet
// (`./project.ts`), so a route can test nothing a model could not already be
// shown, and nothing a packet drops -- an input's value, a query string, a
// credential-shaped control -- ever reaches a condition.

export type WebAutomationRouteStatePath = { readonly path: string; readonly description: string };

export const WEB_AUTOMATION_ROUTE_STATE_PATHS: readonly WebAutomationRouteStatePath[] = Object.freeze([
  { path: "state.page.path", description: "The path of the address the tab is on, such as /orders/open; never its query." },
  { path: "state.page.location", description: "The address the tab is on: origin and path, never its query." },
  { path: "state.page.title", description: "The document's title." },
  { path: "state.page.dialog", description: "The name of the dialog standing open in front of the page, such as an announcement or a confirmation. Absent when no dialog is open." },
  { path: "state.page.blockedBy", description: "The name of whatever covers the page's controls and takes their clicks. Absent when nothing does." },
  { path: "state.page.controls", description: "The names of the controls the page offers, joined with \" | \": buttons, links, fields and choices." }
]);
