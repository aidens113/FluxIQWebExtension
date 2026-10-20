/**
 * The renderings the site can be armed into. `baseline` is the site as a run
 * first meets it; each other mode is one variant's arm.
 *
 * - `redesigned-quote-submit`: the quote drawer's last step was redesigned.
 *   The control the recording pressed is gone, "Get my free quote" does its
 *   job from the step's header, and "Save and finish later" now stands where
 *   the old button stood.
 * - `winter-notice`: a winter emergency-service notice opens over every page
 *   until it is dismissed, the way a site announces a seasonal change.
 * - `confirm-unsubscribe`: "Unsubscribe" on the newsletter page asks the
 *   browser's own `window.confirm` first. Accepting removes the address in
 *   place; declining keeps it. Both answers are counted in
 *   `newsletter.unsubscribePrompts`.
 * - `reworded-quote-submit`: a restyle of the quote drawer's footer. The
 *   submit now reads "Send", with a new generated id, a new class and no
 *   analytics test id; only its accessible name, `aria-label="Send request"`,
 *   is what it was. It still submits, beside Back as before.
 *
 * - `quotes-paused`: new quote requests are paused while the firm moves to a
 *   new booking system. The quote drawer's last step says so, and the
 *   footer's right-hand button is "Save and finish later", in the primary
 *   style Send request wore. Nothing on the step sends.
 * - `phone-quotes`: quotes are taken by phone. The header's and the hero's
 *   "Get a free quote" are gone, and the top strip has a call button drawn by
 *   the header's button component: an icon with no words, label or id. The
 *   footer's old "Request a quote" link still opens the drawer, as a link a
 *   redesign forgot does.
 * - `quote-footer-redesign`: the quote drawer's footer was redesigned.
 *   Continue now comes before Back, and the submit has moved to the new UI
 *   kit the site is adopting component by component: classes
 *   `ui-button ui-button--accent`, no analytics test id, the text "Send".
 *   Its generated id is unchanged, because the component keeps its name.
 *   It still submits.
 * - `security-check`, `captcha-check`, `sign-in-again`, `sign-in-code`,
 *   `card-on-file`, `deposit-authorisation`, `account-move`: one account or
 *   security dialog (`data/interstitials.ts`) opens over every page until
 *   one of its buttons is pressed, which `interstitial.pressed` records.
 *
 * Every mode after `winter-notice` is a hook for the content-harness specs,
 * which need a realistic page with a native confirm, a control whose
 * accessible name alone survives a redesign, a redeploy that puts another
 * control in a recorded one's place or style, or a dialog only a person may
 * answer. They are not manifest variants: no Lab row, live task or person
 * check names them.
 */
export const siteModes = [
  "baseline", "redesigned-quote-submit", "winter-notice", "confirm-unsubscribe", "reworded-quote-submit", "quotes-paused", "phone-quotes",
  "quote-footer-redesign",
  "security-check", "captcha-check", "sign-in-again", "sign-in-code", "card-on-file", "deposit-authorisation", "account-move",
] as const;
export type SiteMode = (typeof siteModes)[number];

/** The fields a quote request carries once the server has normalised them. */
export type QuoteRequest = {
  reference: string;
  fullName: string;
  email: string;
  phone: string;
  postcode: string;
  service: string;
  contactBy: string;
  marketing: boolean;
  details: string;
};

/** A booked visit. `date` is ISO; the pages spell it out. */
export type Booking = {
  reference: string;
  branchId: string;
  serviceId: string;
  date: string;
  time: string;
  engineer: string;
  fullName: string;
  email: string;
  phone: string;
  postcode: string;
  depositPence: number;
};

/**
 * Server-side state and the fixture's oracle (`/__control/final-state`).
 *
 * The visitor's session lives here as cookies would: the consent answer, the
 * newsletter and chat greeting dismissals, the winter notice. Everything a
 * run changes is recorded, including what a careful person would never do:
 * `discarded` counts quote submissions a spam filter dropped while telling
 * the visitor "thanks", `drafts` counts presses of "Save and finish later",
 * `deposits` counts money taken, `newsletter.unsubscribePrompts` counts
 * how the visitor answered the unsubscribe confirmation, when it is armed,
 * and `interstitial.pressed` is the button the visitor pressed on an armed
 * account or security dialog.
 */
export type CompanyWebsiteState = {
  mode: SiteMode;
  consent: "pending" | "all" | "essential";
  newsletter: { dismissed: boolean; subscribers: string[]; unsubscribePrompts: { accepted: number; dismissed: number } };
  chat: { greetingDismissed: boolean; opened: number };
  notice: { dismissed: boolean };
  interstitial: { pressed: string | null };
  team: { batchRequests: number; lastBatchAtMs: number; throttled: number };
  quotes: QuoteRequest[];
  discarded: { honeypot: number; unverified: number; invalid: number };
  drafts: number;
  lastSubmission: { reference: string | null } | null;
  bookings: Booking[];
  deposits: { count: number; totalPence: number };
  refusedBookings: number;
  directions: string[];
};
