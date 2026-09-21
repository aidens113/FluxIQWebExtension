import type { FeedPost } from "./units.js";

/**
 * The Riverside Allotment Society's discussion, newest first, as its group
 * page lists it. Posts need an admin's approval before they appear here, so a
 * post Maya submits shows only in her own "pending" box above this list.
 */
export const RIVERSIDE_DISCUSSION: readonly FeedPost[] = [
  { kind: "post", id: "p_7c1e44", author: "elena-sokolova", group: "riverside-allotments", minutesAgo: 185, audience: "Members", text: "Notes from Saturday's committee meeting, for anyone who couldn't make it. The water troughs will be switched off from 1 November, so please drain your hoses and store them in your shed rather than leaving them on the paths. The skip for green waste is booked for the weekend of 10 October; woody prunings only, no soil, no plastic pots. Plot inspections move to the first Sunday of each month, and the waiting list is now down to eleven names. Thank you to everyone who helped repaint the gate!", reactions: "41", comments: "18 comments" },
  { kind: "post", id: "p_52f0b8", author: "walter-grieve", group: "riverside-allotments", minutesAgo: 1_320, audience: "Members", text: "Plot 22 has more squash than any one household can eat. Help yourselves from the crate by the gate, and bring the crate back.", reactions: "27", comments: "4 comments" },
  { kind: "post", id: "p_6d2e5a", author: "tom-becker", group: "riverside-allotments", minutesAgo: 4_330, audience: "Members", text: "Has anyone seen the green wheelbarrow from the shared shed? It was there on Wednesday. No questions asked, just please bring it back before the manure delivery.", reactions: "9", comments: "7 comments" },
  { kind: "post", id: "p_91ce07", author: "june-park", group: "riverside-allotments", minutesAgo: 6_020, audience: "Members", text: "Reminder that the manure delivery is Saturday morning. Barrows at the ready, and please don't park in front of the main gate.", reactions: "18", comments: "2 comments" },
  { kind: "post", id: "p_a2b3c4", author: "aisha-khan", group: "riverside-allotments", minutesAgo: 9_900, audience: "Members", text: "Who's doing jam for the open day? I've got damson and hedgerow covered, but someone please make something that isn't purple.", reactions: "33", comments: "21 comments" },
];

/** The group Maya is asked to post in, and the one whose page is redesigned in `regrouped`. */
export const TASK_GROUP = "riverside-allotments";
