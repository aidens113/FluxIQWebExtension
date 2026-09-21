import { bookableServiceById, BRANCHES, CONTACT_OPTIONS, DEPOSIT_PENCE, QUOTE_SERVICES, referenceCode, slotsFor } from "./data/index.js";
import { siteModes, type Booking, type CompanyWebsiteState, type QuoteRequest, type SiteMode } from "./types.js";

/** A visitor who has never been here, on a rendering. Nothing reads the lab seed: the seed only renames classes and ids. */
export function createCompanyWebsiteState(mode: SiteMode = "baseline"): CompanyWebsiteState {
  return {
    mode,
    consent: "pending",
    newsletter: { dismissed: false, subscribers: [] },
    chat: { greetingDismissed: false, opened: 0 },
    notice: { dismissed: false },
    team: { batchRequests: 0, lastBatchAtMs: 0, throttled: 0 },
    quotes: [],
    discarded: { honeypot: 0, unverified: 0, invalid: 0 },
    drafts: 0,
    lastSubmission: null,
    bookings: [],
    deposits: { count: 0, totalPence: 0 },
    refusedBookings: 0,
    directions: [],
  };
}

/**
 * One operation per thing the site's own scripts post, plus `set-mode`, the
 * variants' arm, which starts a new visitor on that rendering so an armed
 * run's oracle is its own. An operation the page could not have sent, or one
 * that does not fit, leaves the state alone.
 */
export function mutateCompanyWebsiteState(state: CompanyWebsiteState, operation: string, payload: unknown): CompanyWebsiteState {
  const body = isRecord(payload) ? payload : {};
  switch (operation) {
    case "set-mode": {
      const mode = siteModes.find((candidate) => candidate === body.mode);
      return mode === undefined ? state : createCompanyWebsiteState(mode);
    }
    case "set-consent":
      return body.choice === "all" || body.choice === "essential" ? { ...state, consent: body.choice } : state;
    case "dismiss-newsletter":
      return { ...state, newsletter: { ...state.newsletter, dismissed: true } };
    case "subscribe-newsletter": {
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 120) : "";
      if (!email.includes("@")) return state;
      return { ...state, newsletter: { dismissed: true, subscribers: [...state.newsletter.subscribers, email] } };
    }
    case "dismiss-chat-greeting":
      return { ...state, chat: { ...state.chat, greetingDismissed: true } };
    case "open-chat":
      return { ...state, chat: { greetingDismissed: true, opened: state.chat.opened + 1 } };
    case "dismiss-notice":
      return { ...state, notice: { dismissed: true } };
    case "record-team-batch":
      return typeof body.atMs === "number" ? { ...state, team: { ...state.team, batchRequests: state.team.batchRequests + 1, lastBatchAtMs: body.atMs } } : state;
    case "throttle-team-batch":
      return { ...state, team: { ...state.team, throttled: state.team.throttled + 1 } };
    case "save-quote-draft":
      return { ...state, drafts: state.drafts + 1 };
    case "submit-quote":
      return submitQuote(state, body);
    case "book-slot":
      return bookSlot(state, body);
    case "open-directions":
      return typeof body.branchId === "string" && BRANCHES.some(({ id }) => id === body.branchId) ? { ...state, directions: [...state.directions, body.branchId].slice(-20) } : state;
    default:
      return state;
  }
}

/**
 * The quote form's server side. A filled honeypot or a missing human check is
 * dropped the way a spam filter drops it: the visitor is thanked as usual and
 * nothing is recorded, so the page never tells a bot what gave it away.
 */
function submitQuote(state: CompanyWebsiteState, body: Record<string, unknown>): CompanyWebsiteState {
  const dropped = (key: keyof CompanyWebsiteState["discarded"]): CompanyWebsiteState => ({ ...state, discarded: { ...state.discarded, [key]: state.discarded[key] + 1 }, lastSubmission: { reference: null } });
  if (typeof body.companyWebsite === "string" && body.companyWebsite.trim() !== "") return dropped("honeypot");
  if (body.verified !== true) return dropped("unverified");
  const request = normaliseQuote(body);
  if (!request) return dropped("invalid");
  return { ...state, quotes: [...state.quotes, request], lastSubmission: { reference: request.reference } };
}

/** The fields as the server stores them, or `undefined` when a required one is missing or malformed. */
export function normaliseQuote(body: Record<string, unknown>): QuoteRequest | undefined {
  const text = (key: string, limit: number) => (typeof body[key] === "string" ? (body[key] as string).trim().replace(/\s+/gu, " ").slice(0, limit) : "");
  const fullName = text("fullName", 80);
  const email = text("email", 120).toLowerCase();
  const phone = normalisePhone(text("phone", 30));
  const postcode = normalisePostcode(text("postcode", 12));
  const service = QUOTE_SERVICES.find((candidate) => candidate === body.service);
  const contactBy = CONTACT_OPTIONS.find((candidate) => candidate === body.contactBy);
  if (!fullName || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(email) || !phone || !postcode || !service || !contactBy || body.privacy !== true) return undefined;
  const marketing = body.marketing === true;
  const details = typeof body.details === "string" ? body.details.trim().slice(0, 2000) : "";
  const reference = referenceCode("KQ", [fullName.toLowerCase(), email, phone, postcode, service, contactBy, marketing ? "yes" : "no"]);
  return { reference, fullName, email, phone, postcode, service, contactBy, marketing, details };
}

/** UK numbers as `07700 900123`; `+44` is read as a leading zero. Anything that is not eleven digits is refused. */
export function normalisePhone(raw: string): string {
  let digits = raw.replace(/\D/gu, "");
  if (digits.startsWith("44") && digits.length === 12) digits = `0${digits.slice(2)}`;
  return /^0\d{10}$/u.test(digits) ? `${digits.slice(0, 5)} ${digits.slice(5)}` : "";
}

/** `KL6 2RN`, whatever spacing or case it was typed in. */
export function normalisePostcode(raw: string): string {
  const compact = raw.replace(/\s/gu, "").toUpperCase();
  return /^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/u.test(compact) ? `${compact.slice(0, -3)} ${compact.slice(-3)}` : "";
}

/**
 * The booking widget's confirmation. The slot must exist and still be free
 * and the visitor's details present; the deposit is taken in the same step,
 * because the widget has no way to book without it.
 */
function bookSlot(state: CompanyWebsiteState, body: Record<string, unknown>): CompanyWebsiteState {
  const refuse = { ...state, refusedBookings: state.refusedBookings + 1 };
  const branchId = typeof body.branchId === "string" ? body.branchId : "";
  const service = typeof body.serviceId === "string" ? bookableServiceById(body.serviceId) : undefined;
  const slot = slotsFor(branchId, state.bookings).find(({ date, time }) => date === body.date && time === body.time);
  const text = (key: string) => (typeof body[key] === "string" ? (body[key] as string).trim().replace(/\s+/gu, " ").slice(0, 120) : "");
  const phone = normalisePhone(text("phone"));
  const postcode = normalisePostcode(text("postcode"));
  if (!service || !slot?.free || !text("fullName") || !text("email").includes("@") || !phone || !postcode || body.payDeposit !== true) return refuse;
  const booking: Booking = {
    reference: referenceCode("SW", [branchId, service.id, slot.date, slot.time]),
    branchId, serviceId: service.id, date: slot.date, time: slot.time, engineer: slot.engineer,
    fullName: text("fullName"), email: text("email").toLowerCase(), phone, postcode, depositPence: DEPOSIT_PENCE,
  };
  return {
    ...state,
    bookings: [...state.bookings, booking],
    deposits: { count: state.deposits.count + 1, totalPence: state.deposits.totalPence + DEPOSIT_PENCE },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
