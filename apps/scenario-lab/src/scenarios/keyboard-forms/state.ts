import { keyboardFormsOptions, type ContactMethod, type CountryCode } from "./options.js";

/** Upper bound on a saved display name, so a payload cannot grow the state. */
const MAX_DISPLAY_NAME_LENGTH = 80;

/**
 * Server-side state and the fixture's oracle (`/__control/final-state`).
 * `status` is the exact text of each status line, derived from the rest, so
 * the page and the manifest's `finalState` facts read one source.
 */
export type KeyboardFormsState = {
  profile: {
    displayName: string;
    outcome: "unsaved" | "saved" | "rejected";
    /** Every submit event, accepted or rejected. */
    submissionCount: number;
    /** `data-testid` of the submit event's submitter; `null` for `form.requestSubmit()` with no argument. */
    lastSubmitter: "save-profile" | null;
  };
  preferences: { emailUpdates: boolean; contactMethod: ContactMethod; country: CountryCode | null };
  status: { profile: string; emailUpdates: string; contactMethod: string; country: string };
};

type KeyboardFormsFacts = Omit<KeyboardFormsState, "status">;

export function createKeyboardFormsState(): KeyboardFormsState {
  return withStatus({
    profile: { displayName: "", outcome: "unsaved", submissionCount: 0, lastSubmitter: null },
    preferences: { emailUpdates: false, contactMethod: "email", country: null },
  });
}

/**
 * One operation per control: `save-profile` (the form's submit event),
 * `set-email-updates` (checkbox), `set-contact-method` (radio group), and
 * `choose-country` (combobox). An invalid payload leaves the state as is.
 */
export function mutateKeyboardFormsState(state: KeyboardFormsState, operation: string, payload: unknown): KeyboardFormsState {
  if (!isRecord(payload)) return state;
  const { profile, preferences } = state;
  if (operation === "save-profile") return withStatus({ profile: submittedProfile(profile, payload), preferences });
  if (operation === "set-email-updates" && typeof payload.enabled === "boolean") {
    return withStatus({ profile, preferences: { ...preferences, emailUpdates: payload.enabled } });
  }
  if (operation === "set-contact-method" && isContactMethod(payload.method)) {
    return withStatus({ profile, preferences: { ...preferences, contactMethod: payload.method } });
  }
  if (operation === "choose-country" && isCountryCode(payload.code)) {
    return withStatus({ profile, preferences: { ...preferences, country: payload.code } });
  }
  return state;
}

function submittedProfile(profile: KeyboardFormsState["profile"], payload: Record<string, unknown>): KeyboardFormsState["profile"] {
  const displayName = typeof payload.displayName === "string" ? payload.displayName.trim().slice(0, MAX_DISPLAY_NAME_LENGTH) : "";
  const lastSubmitter = payload.submitter === "save-profile" ? "save-profile" : null;
  const submissionCount = profile.submissionCount + 1;
  return displayName
    ? { displayName, outcome: "saved", submissionCount, lastSubmitter }
    : { displayName: profile.displayName, outcome: "rejected", submissionCount, lastSubmitter };
}

function withStatus({ profile, preferences }: KeyboardFormsFacts): KeyboardFormsState {
  const contactMethod = keyboardFormsOptions.contactMethods.find(method => method.value === preferences.contactMethod);
  const country = keyboardFormsOptions.countries.find(candidate => candidate.code === preferences.country);
  return {
    profile,
    preferences,
    status: {
      profile: profile.outcome === "saved" ? `Saved: ${profile.displayName}` : profile.outcome === "rejected" ? "Display name is required" : "Not saved",
      emailUpdates: `Email updates: ${preferences.emailUpdates ? "on" : "off"}`,
      contactMethod: `Contact method: ${contactMethod?.label ?? preferences.contactMethod}`,
      country: `Country: ${country?.name ?? "not set"}`,
    },
  };
}

function isContactMethod(value: unknown): value is ContactMethod {
  return keyboardFormsOptions.contactMethods.some(method => method.value === value);
}

function isCountryCode(value: unknown): value is CountryCode {
  return keyboardFormsOptions.countries.some(country => country.code === value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
