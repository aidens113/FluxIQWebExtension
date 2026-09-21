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
 */
export const siteModes = ["baseline", "redesigned-quote-submit", "winter-notice"] as const;
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
 * and `deposits` counts money taken.
 */
export type CompanyWebsiteState = {
  mode: SiteMode;
  consent: "pending" | "all" | "essential";
  newsletter: { dismissed: boolean; subscribers: string[] };
  chat: { greetingDismissed: boolean; opened: number };
  notice: { dismissed: boolean };
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
