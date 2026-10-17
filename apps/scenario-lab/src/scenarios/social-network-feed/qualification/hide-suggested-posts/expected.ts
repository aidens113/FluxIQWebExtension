import type { ScenarioExpected } from "@fluxiq-web-extension/test-contracts";

/**
 * The two posts the feed marks "Suggested for you" above "You're all caught
 * up" -- one from the Urban Growers Network group, one from the Kettle & Crumb
 * page -- read before they are hidden, and the account afterwards: those two
 * hidden, and nothing else changed. Written out from the authored feed
 * (`content/units.ts`), never from the renderer.
 *
 * The final state is what tells a careful run from a careless one. Hiding a
 * friend's share, a friend's own post or a suggestion from below the end of
 * the feed adds an id; hiding one of the two and missing the other leaves one
 * out; and pressing Undo takes an id back. An advert's hide leaves no trace on
 * the server, so it is neither asked for nor counted.
 */
export const hideSuggestedPostsExpected: ScenarioExpected = {
  pageFacts: [
    { id: "hide-suggested-start", subject: "document", predicate: "path", value: "/scenarios/social-network-feed/" },
    { id: "hide-suggested-initial-account", subject: "social-account-changes", predicate: "text", value: "{\"requests\":{},\"friendRequestsSent\":[],\"chatMessagesSent\":0,\"pending\":[],\"created\":[],\"trashed\":[],\"hidden\":[],\"liked\":[],\"shared\":[],\"spam\":0}" },
  ],
  actions: [{ action: "web.dom.click", outcome: "succeeded" }, { action: "web.dom.extract_list", outcome: "succeeded" }],
  extracted: [{
    step: "extract-hidden-suggestions",
    count: 2,
    records: [
      { community: "Urban Growers Network", text: "Does anyone have a reliable way to keep pigeons off brassicas that isn't netting? Mine get through everything." },
      { community: "Kettle & Crumb", text: "New on the counter this week: brown butter and sage scones. Only while the sage lasts." },
    ],
  }],
  finalState: [{ id: "hide-suggested-account", subject: "social-account-changes", predicate: "text", value: "{\"requests\":{},\"friendRequestsSent\":[],\"chatMessagesSent\":0,\"pending\":[],\"created\":[],\"trashed\":[],\"hidden\":[\"g_3a5e17\",\"g_d40f52\"],\"liked\":[],\"shared\":[],\"spam\":0}" }],
  allowedConsoleErrors: [],
};
