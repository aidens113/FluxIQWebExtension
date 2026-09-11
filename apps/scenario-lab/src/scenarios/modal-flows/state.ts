/**
 * The fixture's state; `/__control/final-state` returns it as the oracle.
 * Whether the invite dialog is open is view state and is not recorded: like
 * a real page, a reload closes it.
 */
export type ModalFlowsState = {
  draftTitle: string;
  /** `absent` is the banner-absent variant: the banner never renders. */
  consent: "pending" | "accepted" | "essential-only" | "absent";
  invites: Array<{ email: string; role: "viewer" | "editor" }>;
  inviteCancellations: number;
  publishCount: number;
  sectionCount: number;
  /** `armed` shows the offer on the next Add section; `open` blocks the page until `closed`. */
  interstitial: "unarmed" | "armed" | "open" | "closed";
  draft: "active" | "deleted";
  /** Answers given to the native confirm() that guards Delete draft. */
  deletePrompts: { accepted: number; dismissed: number };
};

const DRAFT_TITLES = ["Spring product update", "Quarterly roadmap", "Community digest", "Release notes"] as const;

export function createModalFlowsState(seed: number): ModalFlowsState {
  return {
    draftTitle: DRAFT_TITLES[Math.abs(seed) % DRAFT_TITLES.length] ?? DRAFT_TITLES[0],
    consent: "pending",
    invites: [],
    inviteCancellations: 0,
    publishCount: 0,
    sectionCount: 0,
    interstitial: "unarmed",
    draft: "active",
    deletePrompts: { accepted: 0, dismissed: 0 },
  };
}
