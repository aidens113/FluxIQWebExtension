/**
 * The job board's vocabulary: a posting, what its salary line says, what the
 * run left behind, and the renderings the fixture can be armed into.
 *
 * - `baseline` is Rolefinch as it ships.
 * - `overflow-save` -- a redesign shipped after the Flow was made: the heart
 *   on every card and in the job pane now follows the *company*, and saving a
 *   job moved into the pane's "More actions" menu. A Flow that keeps pressing
 *   the heart follows companies and saves nothing.
 * - `posting-closed` -- Quillmark filled its remote Senior Rust Engineer role.
 *   The posting still lists, but its pane says it no longer accepts
 *   applications, and three lookalike roles stand beside it.
 * - `quiet-market` -- a week with no remote Rust hiring at all: the search
 *   answers with no exact matches and fills the page with "jobs you might
 *   like", in the same cards the real results use.
 * - `in-place-filters` -- the board's newer results page: choosing an option
 *   in a filter pill's menu no longer loads a new page. The page fetches the
 *   filtered results itself and swaps them in, marking the results column
 *   `aria-busy` while it does, and the address bar keeps the address the
 *   visitor arrived on. The postings, the cards and the filters themselves are
 *   the baseline's.
 * - `extended-application` -- hiring teams that ask Talentloom for the longer
 *   form: every application form adds "A few more questions", prefilled from
 *   the candidate's Talentloom profile. Native number, date, time, month,
 *   week and date-time fields; answers the form holds to (a whole-number
 *   count that refuses other keys, hours and an assessment day the hiring
 *   team fixed, a read-only requisition number, referral and agency codes put
 *   back after an edit); a profile widget that re-renders its field from the
 *   saved profile; an offer to hide the application from the current
 *   employer the moment that answer changes; and a password for tracking the
 *   application. What the form sends, and so the state, is the baseline's.
 */
export const jobBoardModes = ["baseline", "overflow-save", "posting-closed", "quiet-market", "in-place-filters", "extended-application"] as const;

export type JobBoardMode = (typeof jobBoardModes)[number];

export type Workplace = "remote" | "hybrid" | "onsite";

export type JobType = "Full-time" | "Contract" | "Part-time";

/**
 * A salary line as the employer wrote it, with the figures a reader takes
 * from it. `min` and `max` are in the line's own currency and period; a line
 * that states only a ceiling has no `min`, and one that states only a floor
 * has no `max`.
 */
export type Salary = {
  text: string;
  period: "year" | "day" | "none";
  currency: "GBP" | "EUR" | "USD" | null;
  min: number | null;
  max: number | null;
};

/** How a posting takes applications: on the employer's own careers site, or Rolefinch's quick apply. */
export type ApplyRoute = { kind: "company"; careersSlug: string; requisition: string } | { kind: "easy" };

export type Posting = {
  id: string;
  /** Rolefinch's job key: sixteen hex characters, stable across seeds, the way a job board keys its postings. */
  key: string;
  title: string;
  company: string;
  location: string;
  workplace: Workplace;
  jobType: JobType;
  salary: Salary;
  /** Hours between the posting going up and the board's fixed reference time. */
  postedHours: number;
  /** The one-line snippet the card shows under the salary. */
  snippet: string;
  description: readonly string[];
  apply: ApplyRoute;
  /** A posting that closed before the reference time: it never lists, though a saved copy still shows. */
  closed?: true;
  /** A posting that goes live while the person browses: listed from the second results page served onward. */
  fresh?: true;
};

/** What the Talentloom form sends, after the server has normalised it. */
export type ApplicationAnswers = {
  jobKey: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  placeId: string;
  resume: string;
  website: string;
  rightToWork: string;
  sponsorship: string;
  notice: string;
  salary: string;
  source: string;
  talentPool: boolean;
  privacy: boolean;
};

/**
 * One submitted application. `reference` is what the confirmation shows; an
 * application whose honeypot was filled is kept, flagged, with no reference,
 * and its applicant is shown the same thank-you page as everyone else.
 */
export type SubmittedApplication = {
  id: string;
  answers: ApplicationAnswers;
  flagged: boolean;
  reference: string | null;
};

/**
 * What the run left behind. Counters are what the routes report on GET: the
 * results pages served (which decides when the fresh posting appears and when
 * the rate limiter answers), and the job panes served (which decides when the
 * sign-in wall shows).
 */
export type JobBoardState = {
  mode: JobBoardMode;
  consent: "pending" | "accepted" | "rejected";
  careersConsent: boolean;
  alertOfferDismissed: boolean;
  alertSubscriptions: string[];
  chatMinimised: boolean;
  wallDismissed: boolean;
  resultsViews: number;
  /** Set once a second or later results page is served: the fresh posting has gone live and every list after it shifts by one. */
  freshLive: boolean;
  paneViews: number;
  /** Job keys on the saved list, oldest save first. */
  saved: string[];
  /** Company names the person follows, oldest first. */
  follows: string[];
  applications: SubmittedApplication[];
  /** Operations the page reported, oldest first, capped. */
  activity: string[];
};
