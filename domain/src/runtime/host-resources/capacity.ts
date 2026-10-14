// How many host leases the web domain grants at once (automation-project-agents
// plan, `Host Actions`; user, 2026-10-13: "make it possible in core, but have
// extension set it to only 1 at a time").
//
// Core's scheduler can run several builders at once; the browser cannot yet.
// Two tabs of one profile share cookies, the session and the cart, so one
// builder's lasting act would change the other's page. Raising this is only
// correct once each lease gets its own browser context and the extension stops
// assuming one actor (per-lease tab ids, handle scopes, overlay, pacing and
// reset). A test pins it at 1 until then.

export const WEB_AUTOMATION_HOST_RESOURCE_CAPACITY = 1;
