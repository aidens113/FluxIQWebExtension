import { applicationReference, normaliseApplication } from "./ats/index.js";
import { COMPANIES, postingById, postingByKey } from "./catalog/index.js";
import { jobBoardModes, type JobBoardMode, type JobBoardState } from "./types.js";

/** Enough history to see what a run did, and a hard stop so a stuck page cannot grow the snapshot without bound. */
const ACTIVITY_LIMIT = 60;

/**
 * The two jobs already on the saved list when the person arrives: a Halvard
 * Systems role saved last week, whose heart is therefore already filled (a
 * second press unsaves it), and a Pinecrest role that has since closed.
 */
const ALREADY_SAVED = ["hv2", "px"] as const;

/** The board as the person finds it: nothing answered, nothing dismissed, two jobs saved. The lab seed reaches none of it. */
export function createJobBoardState(mode: JobBoardMode = "baseline"): JobBoardState {
  return {
    mode,
    consent: "pending",
    careersConsent: false,
    alertOfferDismissed: false,
    alertSubscriptions: [],
    chatMinimised: false,
    wallDismissed: false,
    resultsViews: 0,
    freshLive: false,
    paneViews: 0,
    saved: ALREADY_SAVED.map((id) => postingById(id).key),
    follows: [],
    applications: [],
    activity: [],
  };
}

/**
 * Every change the pages report. `set-mode` arms a rendering and, like every
 * armed fixture here, starts the board over, so an armed run's oracle is its
 * own. `results-view` and `pane-view` are what the routes record on GET.
 * `submit-application` stores what Talentloom's form sent, normalised; a
 * submission missing anything the form requires, or for a posting that takes
 * no applications, changes nothing. Anything else, or a payload the page could
 * not have sent, leaves the state alone.
 */
export function mutateJobBoardState(state: JobBoardState, operation: string, payload: unknown): JobBoardState {
  const body = isRecord(payload) ? payload : {};
  const log = (next: JobBoardState, entry: string): JobBoardState => ({ ...next, activity: [...next.activity, entry].slice(-ACTIVITY_LIMIT) });
  switch (operation) {
    case "set-mode": {
      const mode = jobBoardModes.find((candidate) => candidate === body.mode);
      return mode === undefined ? state : createJobBoardState(mode);
    }
    case "consent":
      return body.choice === "accepted" || body.choice === "rejected" ? log({ ...state, consent: body.choice }, `consent ${body.choice}`) : state;
    case "careers-consent":
      return log({ ...state, careersConsent: true }, "careers consent");
    case "dismiss-alert-offer":
      return log({ ...state, alertOfferDismissed: true }, "alert offer dismissed");
    case "subscribe-alert":
      return typeof body.email === "string" && /^[^@\s]+@[^@\s]+$/u.test(body.email.trim())
        ? log({ ...state, alertOfferDismissed: true, alertSubscriptions: [...state.alertSubscriptions, body.email.trim()] }, "alert subscribed")
        : state;
    case "minimise-chat":
      return log({ ...state, chatMinimised: true }, "chat minimised");
    case "dismiss-wall":
      return log({ ...state, wallDismissed: true }, "sign-in wall dismissed");
    case "results-view": {
      const page = typeof body.page === "number" ? body.page : 1;
      return { ...state, resultsViews: state.resultsViews + 1, freshLive: state.freshLive || page >= 2 };
    }
    case "pane-view":
      return { ...state, paneViews: state.paneViews + 1 };
    case "save": {
      const posting = typeof body.key === "string" ? postingByKey(body.key) : undefined;
      if (!posting || posting.closed || state.saved.includes(posting.key)) return state;
      return log({ ...state, saved: [...state.saved, posting.key] }, `saved ${posting.id}`);
    }
    case "unsave": {
      const key = typeof body.key === "string" ? body.key : "";
      if (!state.saved.includes(key)) return state;
      return log({ ...state, saved: state.saved.filter((saved) => saved !== key) }, `unsaved ${postingByKey(key)?.id ?? "unknown"}`);
    }
    case "follow":
    case "unfollow": {
      const company = typeof body.company === "string" ? body.company : "";
      if (!isCompany(company)) return state;
      const follows = operation === "follow" ? [...new Set([...state.follows, company])] : state.follows.filter((name) => name !== company);
      return log({ ...state, follows }, `${operation} ${company}`);
    }
    case "submit-application":
      return submitApplication(state, body, log);
    default:
      return state;
  }
}

function submitApplication(state: JobBoardState, body: Record<string, unknown>, log: (next: JobBoardState, entry: string) => JobBoardState): JobBoardState {
  const normalised = normaliseApplication(body);
  if (!normalised) return log(state, "application refused: incomplete");
  const posting = postingByKey(normalised.answers.jobKey);
  if (!posting || posting.closed || posting.apply.kind !== "company") return log(state, "application refused: not open");
  if (state.mode === "posting-closed" && posting.id === "m1") return log(state, "application refused: position filled");
  const flagged = normalised.honeypot !== "";
  const application = {
    id: `app-${state.applications.length + 1}`,
    answers: normalised.answers,
    flagged,
    reference: flagged ? null : applicationReference(normalised.answers),
  };
  return log({ ...state, applications: [...state.applications, application] }, `application ${application.id}${flagged ? " flagged" : ""} for ${posting.id}`);
}

function isCompany(name: string): boolean {
  return COMPANIES.some((company) => company.name === name);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
