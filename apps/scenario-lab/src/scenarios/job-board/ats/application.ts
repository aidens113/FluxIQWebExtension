import type { ApplicationAnswers } from "../types.js";
import { isKnownPlace } from "./places.js";

/** The notice periods Talentloom's select offers, by option value. */
export const NOTICE_OPTIONS = [
  { value: "immediately", label: "Available immediately" },
  { value: "2-weeks", label: "2 weeks" },
  { value: "1-month", label: "1 month" },
  { value: "2-months", label: "2 months" },
  { value: "3-months-plus", label: "3 months or more" },
] as const;

/** Where the applicant heard about the job, by option value. */
export const SOURCE_OPTIONS = [
  { value: "company-website", label: "Company website" },
  { value: "rolefinch", label: "Rolefinch" },
  { value: "other-job-board", label: "Another job board" },
  { value: "referral", label: "Referral from a current employee" },
  { value: "recruiter", label: "A recruiter contacted me" },
] as const;

/** The dialling codes the phone field's country select offers; it opens on the United States. */
export const DIALLING_CODES = [
  { value: "+1", label: "United States (+1)" },
  { value: "+44", label: "United Kingdom (+44)" },
  { value: "+353", label: "Ireland (+353)" },
  { value: "+49", label: "Germany (+49)" },
] as const;

/**
 * What the Talentloom form sends, normalised the way the ATS stores it, and
 * the honeypot's contents. Formatting a person would not notice is folded
 * away -- surrounding spaces, the case of an email, a phone number typed with
 * or without its leading zero or its own +44, a website with a trailing
 * slash -- so the stored application, and the reference derived from it, is
 * the same for every honest way of typing the same answers. Returns
 * `undefined` for a submission missing anything the form requires, which the
 * ATS refuses without storing.
 */
export function normaliseApplication(payload: Record<string, unknown>): { answers: ApplicationAnswers; honeypot: string } | undefined {
  const text = (key: string) => (typeof payload[key] === "string" ? (payload[key] as string) : "");
  const squash = (value: string) => value.replace(/\s+/gu, " ").trim();
  const choose = (value: string, allowed: readonly string[]) => (allowed.includes(value) ? value : "");
  const resumeText = squash(text("resumeText"));
  const resumeFile = squash(text("resumeFile"));
  const answers: ApplicationAnswers = {
    jobKey: text("jobKey"),
    firstName: squash(text("firstName")),
    lastName: squash(text("lastName")),
    email: text("email").trim().toLowerCase(),
    phone: phoneNumber(text("phoneCountry"), text("phoneNumber")),
    placeId: text("placeId"),
    resume: resumeText || (resumeFile ? `file:${resumeFile}` : ""),
    website: text("website").trim().replace(/\/+$/u, ""),
    rightToWork: choose(text("rightToWork"), ["yes", "no"]),
    sponsorship: choose(text("sponsorship"), ["yes", "no"]),
    notice: choose(text("notice"), NOTICE_OPTIONS.map((option) => option.value)),
    salary: /^\d{1,7}$/u.test(text("salary").trim()) ? String(Number(text("salary").trim())) : "",
    source: choose(text("source"), SOURCE_OPTIONS.map((option) => option.value)),
    talentPool: payload.talentPool === true,
    privacy: payload.privacy === true,
  };
  const complete = answers.jobKey && answers.firstName && answers.lastName && /^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(answers.email)
    && isKnownPlace(answers.placeId) && answers.resume && answers.rightToWork && answers.sponsorship && answers.notice && answers.salary && answers.privacy;
  return complete ? { answers, honeypot: text("confirmEmail").trim() } : undefined;
}

/**
 * The reference Talentloom prints on a confirmation: derived from everything
 * the application says, so a confirmation's reference is evidence of exactly
 * what was sent, and one wrong answer anywhere gives a different reference.
 */
export function applicationReference(answers: ApplicationAnswers): string {
  const canonical = JSON.stringify([
    answers.jobKey, answers.firstName, answers.lastName, answers.email, answers.phone, answers.placeId, answers.resume, answers.website,
    answers.rightToWork, answers.sponsorship, answers.notice, answers.salary, answers.source, answers.talentPool, answers.privacy,
  ]);
  const code = `${fnv(canonical, 0x811c9dc5)}${fnv(canonical, 0x2f6b1d93)}`.toUpperCase();
  return `TL-${code.slice(0, 4)}-${code.slice(4, 8)}`;
}

/** A phone number as dialled internationally: its own leading + wins, otherwise the chosen code plus the digits without a trunk zero. */
function phoneNumber(country: string, number: string): string {
  const digits = number.replace(/\D/gu, "");
  if (!digits) return "";
  if (number.trim().startsWith("+")) return `+${digits}`;
  const code = DIALLING_CODES.some((option) => option.value === country) ? country : "+1";
  return `${code}${digits.replace(/^0+/u, "")}`;
}

function fnv(text: string, seed: number): string {
  let value = seed >>> 0;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 0x01000193) >>> 0;
  }
  return value.toString(36).padStart(7, "0").slice(-7);
}
