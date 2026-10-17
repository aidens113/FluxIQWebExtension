import type { ScenarioExpected } from "@fluxiq-web-extension/test-contracts";

/**
 * The found-items post in Harbourside Runners -- Dev Patel's, from Tuesday 15
 * September -- read from the group, and the account afterwards: one post, word
 * for word, waiting for that group's admins, and nothing else changed. Written
 * out from the authored feed (`content/units.ts`), never from the renderer.
 *
 * The final state is what catches the ways this goes wrong that the table
 * cannot show: a post in the Riverside Allotment Society (the group the Groups
 * link opens first) names the wrong group; a single press of Post is swallowed
 * and leaves nothing pending; a filled trap field is counted as spam; a poll
 * is the wrong kind; and a second submission is a second pending post.
 */
export const claimFoundKeyExpected: ScenarioExpected = {
  pageFacts: [
    { id: "claim-key-start", subject: "document", predicate: "path", value: "/scenarios/social-network-feed/" },
    { id: "claim-key-initial-account", subject: "social-account-changes", predicate: "text", value: "{\"requests\":{},\"friendRequestsSent\":[],\"chatMessagesSent\":0,\"pending\":[],\"created\":[],\"trashed\":[],\"hidden\":[],\"liked\":[],\"shared\":[],\"spam\":0}" },
  ],
  actions: [{ action: "web.dom.click", outcome: "succeeded" }, { action: "web.dom.type", outcome: "succeeded" }, { action: "web.dom.extract_list", outcome: "succeeded" }],
  extracted: [{
    step: "extract-found-items-post",
    count: 1,
    records: [{
      author: "Dev Patel",
      posted: "Tuesday 15 September 2026 at 12:50",
      text: "Found at the park after Thursday's session: one blue glove, left hand, and a car key with a red fob. Both are with me until someone claims them.",
    }],
  }],
  finalState: [{ id: "claim-key-account", subject: "social-account-changes", predicate: "text", value: "{\"requests\":{},\"friendRequestsSent\":[],\"chatMessagesSent\":0,\"pending\":[{\"group\":\"harbourside-runners\",\"kind\":\"post\",\"text\":\"The car key with the red fob is mine. I'll collect it at Tuesday's session, thank you!\"}],\"created\":[],\"trashed\":[],\"hidden\":[],\"liked\":[],\"shared\":[],\"spam\":0}" }],
  allowedConsoleErrors: [],
};
