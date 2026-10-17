import type { ScenarioExpected } from "@fluxiq-web-extension/test-contracts";

const UNCHANGED_ACCOUNT = "{\"requests\":{},\"friendRequestsSent\":[],\"chatMessagesSent\":0,\"pending\":[],\"created\":[],\"trashed\":[],\"hidden\":[],\"liked\":[],\"shared\":[],\"spam\":0}";

/**
 * The posts the home feed shows, down to "You're all caught up", that were
 * written in one of Maya's three groups on or after Saturday 19 September
 * 2026, in feed order, each once and whole. Written out from the authored
 * feed (`content/units.ts`), never from the renderer.
 *
 * Left out on purpose: Kim Tran's Urban Growers post, a group Maya does not
 * belong to that the feed suggests; the second showing of Elena's committee
 * notes, a recap further down; and Tom Becker's wheelbarrow and Dev Patel's
 * found glove, group posts from Friday 18 and Tuesday 15 September. A read is
 * no lasting act, so the account must end exactly as it began.
 */
export const recentGroupPostsExpected: ScenarioExpected = {
  pageFacts: [
    { id: "recent-group-posts-start", subject: "document", predicate: "path", value: "/scenarios/social-network-feed/" },
    { id: "recent-group-posts-initial-account", subject: "social-account-changes", predicate: "text", value: UNCHANGED_ACCOUNT },
  ],
  actions: [{ action: "web.dom.click", outcome: "succeeded" }, { action: "web.dom.extract_list", outcome: "succeeded" }],
  extracted: [{
    step: "extract-recent-group-posts",
    count: 3,
    records: [
      {
        group: "Riverside Allotment Society",
        author: "Elena Sokolova",
        posted: "Monday 21 September 2026 at 05:55",
        text: "Notes from Saturday's committee meeting, for anyone who couldn't make it. The water troughs will be switched off from 1 November, so please drain your hoses and store them in your shed rather than leaving them on the paths. The skip for green waste is booked for the weekend of 10 October; woody prunings only, no soil, no plastic pots. Plot inspections move to the first Sunday of each month, and the waiting list is now down to eleven names. Thank you to everyone who helped repaint the gate!",
        comments: "18 comments",
      },
      {
        group: "Harbourside Runners",
        author: "Sofía Marín",
        posted: "Sunday 20 September 2026 at 20:46",
        text: "Tuesday's session is moving to the leisure centre track while the park lights are being replaced. Same time, 18:30. Bring a head torch for the warm-down lap.",
        comments: "24 comments",
      },
      {
        group: "Old Town Bakers' Circle",
        author: "Oliver Hughes",
        posted: "Sunday 20 September 2026 at 03:35",
        text: "Finally cracked the tangzhong method for the milk bread everyone kept asking about. The trick for me was cooking the roux to 65°C rather than going by look, then letting it cool completely before it goes into the dough. I've written up the full recipe with weights, timings and a few photos of the shaping, and I'll bring a couple of loaves to the stall on Saturday so you can see the crumb for yourselves. Oven temperatures are for a fan oven; add 20 degrees for conventional.",
        comments: "15 comments",
      },
    ],
  }],
  finalState: [{ id: "recent-group-posts-account-unchanged", subject: "social-account-changes", predicate: "text", value: UNCHANGED_ACCOUNT }],
  allowedConsoleErrors: [],
};
