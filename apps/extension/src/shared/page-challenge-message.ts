// The `fluxiq.pageChallenge` content message: what the background worker asks
// the top frame of a page a navigation has just landed on, and what that frame
// answers.
//
// The worker builds a navigation's result and has no document to read, so
// until this message existed a navigation onto a robot check reported success
// and the model was sent on into a page only a person may answer. The frame
// answers with `challenge-evidence.ts`'s page reading, one closed word or none,
// and never quotes the page.

/** The message name, which the background worker and the content script must spell identically. */
export const PAGE_CHALLENGE_MESSAGE = "fluxiq.pageChallenge";

/**
 * The top frame's answer: what the page, as a whole, asks for that only a
 * person can give, or `null` when it asks for none of it. A page is read only
 * for a robot check (`captcha`) or a code prompt (`credential`); a payment or
 * password field is part of an ordinary page, and only a dialog is read for one.
 */
export type PageChallengeResponse = { challenge: "captcha" | "credential" | null };
