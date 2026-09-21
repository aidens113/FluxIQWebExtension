import { applicationReference } from "./ats/index.js";
import { postingById } from "./catalog/index.js";
import type { ApplicationAnswers } from "./types.js";

/**
 * The applicant, as the apply task's instruction describes them. The phone
 * number is a reserved drama number and the addresses are on `example.net`.
 */
export const CANDIDATE = {
  firstName: "Morgan",
  lastName: "Ellery",
  email: "morgan.ellery@example.net",
  phoneNational: "07700 900418",
  town: "Bristol, England",
  website: "https://morganellery.example.net",
  resume: "Senior Rust engineer with eight years of building payment and settlement systems in Rust and Go, most recently leading the move of a card authorisation service to Rust at a UK fintech.",
  salary: "88000",
} as const;

/** The posting the apply task is for: Quillmark's remote Senior Rust Engineer, not its London, contract or Quillmark Labs namesakes. */
export const APPLY_TARGET = postingById("m1");

/** What Talentloom stores when the application is made exactly as the instruction says, after its own normalisation. */
export const EXPECTED_ANSWERS: ApplicationAnswers = {
  jobKey: APPLY_TARGET.key,
  firstName: CANDIDATE.firstName,
  lastName: CANDIDATE.lastName,
  email: CANDIDATE.email,
  phone: "+447700900418",
  placeId: "bristol-england-gb",
  resume: CANDIDATE.resume,
  website: CANDIDATE.website,
  rightToWork: "yes",
  sponsorship: "no",
  notice: "1-month",
  salary: CANDIDATE.salary,
  source: "rolefinch",
  talentPool: false,
  privacy: true,
};

/** The reference the confirmation prints for that application, and only for that application. */
export const EXPECTED_REFERENCE = applicationReference(EXPECTED_ANSWERS);

/** The apply task's table: the one confirmation, as its receipt reads. */
export const APPLICATION_RECORD = { role: APPLY_TARGET.title, company: APPLY_TARGET.company, reference: EXPECTED_REFERENCE };
