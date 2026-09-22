import type { ExpectedFact, ScenarioStep } from "@fluxiq-web-extension/test-contracts";

/** The search box, by the name the form submits it under: the one text field before it is a honeypot. */
const SEARCH_BOX = `form[role="search"] input[name="k"]`;

/**
 * The steps every recording shares, and the facts every unarmed rendering of
 * the home page holds.
 *
 * `openStore` answers what a visit's first seconds throw at it, in the one
 * order that holds however long the visit took to get going: first the
 * notifications prompt, which arrives four seconds after the page loads and
 * whose backdrop covers the whole page, the cookie banner included, until it
 * is answered; then the cookie banner, which stays until it is answered. A
 * cookie click made first races the prompt, and loses whenever the page had
 * been open four seconds before the click came. The prompt is certain to
 * come, so it is waited for generously: on a loaded machine its timer fires
 * late. `search` types the words, presses the header's search button -- the
 * recording's one test id -- and passes the browser check the session's first
 * search meets, whose button unlocks after a moment.
 */
export const SHARED_STEPS = {
  openStore: [
    { id: "notifications-asked", operation: "waitForState", target: "role:dialog:Never miss a deal", timeoutMs: 15_000 },
    { id: "decline-notifications", operation: "click", target: "role:button:Not now" },
    { id: "accept-cookies", operation: "click", target: "role:button:Accept" },
  ] satisfies ScenarioStep[],
  search: (prefix: string, keywords: string): ScenarioStep[] => [
    { id: `${prefix}-type-search`, operation: "type", target: SEARCH_BOX, value: keywords },
    { id: `${prefix}-submit-search`, operation: "click", target: "testid:nav-search-submit" },
    { id: `${prefix}-browser-check`, operation: "waitForState", target: "testid:soft-check", timeoutMs: 8000 },
    { id: `${prefix}-continue-shopping`, operation: "click", target: "role:button:Continue shopping", timeoutMs: 6000 },
  ],
  homeFacts: [
    { id: "cart-starts-with-two", subject: "cart-count", predicate: "text", value: "2" },
    { id: "search-button-present", subject: "nav-search-submit", predicate: "exists", value: true },
  ] satisfies ExpectedFact[],
  /** Nothing the run did looked automated to the store. */
  notChallenged: { id: "never-challenged", subject: "robot-check", predicate: "exists", value: false } satisfies ExpectedFact,
} as const;
