/**
 * Guildline's vocabulary: the members the search indexes, the invitations the
 * signed-in member has sent and received, and what a run can leave behind.
 *
 * `baseline` is the site as it ships. The armed renderings are each one thing
 * a real deployment does between the day a Flow was made and the day it runs:
 *
 * - `premium-upsell` -- a Premium trial offer now opens over the people search
 *   results and leaves the page behind it inert until it is closed. Closed, the
 *   page is the baseline. This is the existing-Flow edge case: a new popup.
 * - `redesigned-withdraw-dialog` -- the withdraw confirmation was redesigned.
 *   Its confirm control lost the test hook the recording named, now reads
 *   "Withdraw invitation", and stands beside "Keep invitation", which withdraws
 *   nothing. Only a repair that re-points the click at the right one passes.
 */
export const networkModes = ["baseline", "premium-upsell", "redesigned-withdraw-dialog"] as const;

export type NetworkMode = (typeof networkModes)[number];

/** Connection degree as the search filter spells it: F first, S second, O third and beyond. */
export type Degree = "F" | "S" | "O";

/** One indexed member. `city` is the key a location filter matches; `location` is what the member typed. */
export type Member = {
  urn: string;
  slug: string;
  name: string;
  pronouns: string;
  headline: string;
  location: string;
  city: string;
  degree: Degree;
  /** The line under the card, exactly as the page prints it, or empty for none. */
  mutual: string;
  /** A "Current:" line some cards carry and most do not. */
  current: string;
  company: string;
  /** The primary action the card offers: most members take a connection request, some only a follow. */
  action: "Connect" | "Follow" | "Message";
  /** Out of network: the page shows "Guildline Member" and no profile link. */
  hidden: boolean;
};

/** What a sent or received invitation is for. Only `person` is a connection request. */
export type InvitationKind = "person" | "page" | "newsletter";

/** One invitation the signed-in member sent. `days` is its age against the site's fixed reference time. */
export type SentInvitation = {
  urn: string;
  kind: InvitationKind;
  /** The member it went to. */
  memberUrn: string;
  /** For a page or newsletter invitation, what the member was invited to follow. */
  subject: string;
  days: number;
};

/** One invitation someone sent the signed-in member. */
export type ReceivedInvitation = {
  urn: string;
  kind: InvitationKind;
  memberUrn: string;
  subject: string;
  message: string;
  days: number;
};

/** A connection request the run itself sent. `flagged` is a submission that filled the honeypot and was silently discarded. */
export type RunInvitation = { memberUrn: string; note: string; flagged: boolean };

/**
 * The page-embedded invitation store, as the site hydrates it: every pending
 * invitation in each direction, by urn and sorted. It is what the final-state
 * oracle reads, so an exact set -- not a count -- is what a run is judged by.
 */
export type InvitationStore = { received: string[]; sent: string[] };

export type ConsentChoice = "unset" | "accepted" | "rejected";

/**
 * What the run left behind. Everything except `store` is a change the page
 * reported through `mutate`; `store` is what those changes produce.
 * `searchHits` holds the times, in milliseconds, of the last result requests
 * the search served, which is what its rate limit reads.
 */
export type ProfessionalNetworkState = {
  mode: NetworkMode;
  consent: ConsentChoice;
  appPromptDismissed: boolean;
  chatBubbleSeen: boolean;
  upsellDismissed: boolean;
  withdrawn: string[];
  accepted: string[];
  ignored: string[];
  sentByRun: RunInvitation[];
  messages: Array<{ thread: string; text: string }>;
  searchHits: number[];
  challenges: number;
  activity: string[];
  store: InvitationStore;
};
