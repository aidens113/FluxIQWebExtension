import type { ScenarioExpected } from "@fluxiq-web-extension/test-contracts";

/**
 * Of Maya's eight friend requests, one comes from someone she has no mutual
 * friends with at all: Diego Alvarez, whose card shows no mutual-friends line,
 * fifth in the list and so not among the four the Friends home previews. The
 * second Tom Becker has one mutual friend, which is not none. Written out from
 * the authored requests (`content/requests.ts`), never from the renderer.
 *
 * The table is the requests the list shows as removed, so a run that deleted
 * the second Tom Becker too reads him back; the final state is the server's
 * answer to every request, so a run that confirmed anyone, or deleted anyone
 * else, fails even where its table looks right.
 */
export const deleteStrangerRequestsExpected: ScenarioExpected = {
  pageFacts: [
    { id: "delete-strangers-start", subject: "document", predicate: "path", value: "/scenarios/social-network-feed/" },
    { id: "delete-strangers-initial-account", subject: "social-account-changes", predicate: "text", value: "{\"requests\":{},\"friendRequestsSent\":[],\"chatMessagesSent\":0,\"pending\":[],\"created\":[],\"trashed\":[],\"hidden\":[],\"liked\":[],\"shared\":[],\"spam\":0}" },
  ],
  actions: [{ action: "web.dom.click", outcome: "succeeded" }, { action: "web.dom.extract_list", outcome: "succeeded" }],
  extracted: [{
    step: "extract-removed-requests",
    count: 1,
    records: [{ name: "Diego Alvarez", url: "/scenarios/social-network-feed/people/diego-alvarez/" }],
  }],
  finalState: [{ id: "delete-strangers-account", subject: "social-account-changes", predicate: "text", value: "{\"requests\":{\"rq_3d6b28\":\"deleted\"},\"friendRequestsSent\":[],\"chatMessagesSent\":0,\"pending\":[],\"created\":[],\"trashed\":[],\"hidden\":[],\"liked\":[],\"shared\":[],\"spam\":0}" }],
  allowedConsoleErrors: [],
};
