import type { ScenarioStep } from "@fluxiq-web-extension/test-contracts";
import { createScenarioManifest } from "../../types.js";
import { SENT_INVITATIONS } from "./data/index.js";
import { peopleRecords, ROTTERDAM_ENGINEERS, staleConnectionRequests, STORE_AFTER_WITHDRAWAL, STORE_AT_START } from "./records.js";
import { ROOT } from "./shell/index.js";

const STALE = staleConnectionRequests();
const PEOPLE_SENT = SENT_INVITATIONS.filter((invitation) => invitation.kind === "person");
const ROTTERDAM = peopleRecords(ROTTERDAM_ENGINEERS);

const storeIs = (value: string) => ({ id: "invitation-store", subject: "invitation-store", predicate: "text", value });
const confirmHook = (present: boolean) => ({ id: present ? "withdraw-confirm-hooked" : "withdraw-confirm-unhooked", subject: "withdraw-confirm", predicate: "exists", value: present });
const onFeed = { id: "on-feed", subject: "document", predicate: "path", value: ROOT };

/** The conversation's close control, which is the only thing on it that says which conversation it closes. */
const CLOSE_CONVERSATION = "role:button:Close your conversation with Priya Nair";
const sentRow = (urn: string) => `li[data-entity-urn="${urn}"]`;

/**
 * The recorded withdrawal: open the Sent invitations, narrow them to people,
 * load all of them -- the first "Show more" needs its Retry -- and withdraw
 * each request sent a month or more ago through the dialog's confirm control,
 * then wait until the list no longer holds the last of them.
 */
const WITHDRAW_SCRIPT: ScenarioStep[] = [
  { id: "accept-cookies", operation: "click", target: "role:button:Accept" },
  { id: "open-sent-invitations", operation: "navigate", path: `${ROOT}mynetwork/invitation-manager/sent/` },
  { id: "conversation-opened", operation: "waitForState", target: CLOSE_CONVERSATION, timeoutMs: 8000 },
  { id: "close-conversation", operation: "click", target: CLOSE_CONVERSATION },
  { id: "only-people", operation: "click", target: `role:button:People (${PEOPLE_SENT.length})` },
  { id: "people-listed", operation: "waitForState", target: "role:button:Show more", timeoutMs: 5000 },
  { id: "show-more", operation: "click", target: "role:button:Show more" },
  { id: "retry-offered", operation: "waitForState", target: "role:button:Retry", timeoutMs: 5000 },
  { id: "retry-show-more", operation: "click", target: "role:button:Retry" },
  { id: "second-page-listed", operation: "waitForState", target: sentRow(PEOPLE_SENT[10]!.urn), timeoutMs: 5000 },
  { id: "show-more-again", operation: "click", target: "role:button:Show more" },
  { id: "every-request-listed", operation: "waitForState", target: sentRow(PEOPLE_SENT[PEOPLE_SENT.length - 1]!.urn), timeoutMs: 5000 },
  ...STALE.flatMap((invitation, index): ScenarioStep[] => [
    { id: `withdraw-request-${index + 1}`, operation: "click", target: `${sentRow(invitation.urn)} button` },
    { id: `confirm-withdrawal-${index + 1}`, operation: "click", target: "testid:withdraw-confirm" },
  ]),
  { id: "withdrawals-settled", operation: "waitForState", target: `ul:has(li[data-entity-urn]):not(:has(${sentRow(STALE[STALE.length - 1]!.urn)}))`, timeoutMs: 5000 },
  { id: "stale-requests-withdrawn", operation: "checkpoint" },
];

/** Each field is read inside one organic result: the name without its hidden "View …'s profile", then the headline and location lines. */
const personFields = {
  name: `a[href*="/in/"] span[aria-hidden="true"]`,
  headline: ":scope > div:nth-child(2) > div:nth-child(2)",
  location: ":scope > div:nth-child(2) > div:nth-child(3)",
};
const ORGANIC_RESULTS = `li[data-urn^="urn:gl:member:"]:not([data-ad-slot])`;
const VISIBLE_SHOW_RESULTS = `div:text-is("Show results") >> visible=true`;

/**
 * The recorded people search, as a person does it: search from the global
 * bar, open all people results, put off the app prompt and close the
 * conversation that opens over the pager, filter to second-degree connections,
 * then add Rotterdam in the Netherlands through the location typeahead --
 * which closes the dropdown when a suggestion is chosen, so it is opened again
 * to apply -- and read every page by its number, because Next never leaves
 * page 2.
 */
const SEARCH_SCRIPT: ScenarioStep[] = [
  { id: "search-accept-cookies", operation: "click", target: "role:button:Accept" },
  { id: "type-keywords", operation: "type", target: "role:combobox:Search", value: ROTTERDAM_ENGINEERS.keywords },
  { id: "submit-search", operation: "press", target: "role:combobox:Search", value: "Enter" },
  { id: "all-results-shown", operation: "waitForState", target: "role:link:See all people results", timeoutMs: 5000 },
  { id: "open-people-results", operation: "click", target: "role:link:See all people results" },
  { id: "app-prompt-shown", operation: "waitForState", target: `div:text-is("Not now")`, timeoutMs: 6000 },
  { id: "put-off-app", operation: "click", target: `div:text-is("Not now")` },
  { id: "search-conversation-opened", operation: "waitForState", target: CLOSE_CONVERSATION, timeoutMs: 6000 },
  { id: "search-close-conversation", operation: "click", target: CLOSE_CONVERSATION },
  { id: "open-connections", operation: "click", target: `div[tabindex="0"]:text-is("Connections ▾")` },
  { id: "choose-second-degree", operation: "check", target: "role:checkbox:2nd", value: true },
  { id: "apply-connections", operation: "click", target: VISIBLE_SHOW_RESULTS },
  { id: "second-degree-shown", operation: "waitForState", target: ORGANIC_RESULTS, timeoutMs: 6000 },
  { id: "open-locations", operation: "click", target: `div[tabindex="0"]:text-is("Locations ▾")` },
  { id: "type-location", operation: "type", target: `input[placeholder="Add a location"]`, value: "Rotterdam" },
  { id: "choose-rotterdam-nl", operation: "click", target: `input[placeholder="Add a location"] ~ div > div:text-is("Rotterdam, South Holland, Netherlands")` },
  { id: "reopen-locations", operation: "click", target: `div[tabindex="0"]:text-is("Locations ▾")` },
  { id: "apply-locations", operation: "click", target: VISIBLE_SHOW_RESULTS },
  { id: "rotterdam-shown", operation: "waitForState", target: ORGANIC_RESULTS, timeoutMs: 6000 },
  {
    id: "extract-rotterdam-engineers", operation: "extract", target: ORGANIC_RESULTS, fields: personFields,
    pagination: { mode: "numbered", pages: `section[aria-label="Search results"] li > button`, maxPages: 5 },
  },
  { id: "rotterdam-engineers-extracted", operation: "checkpoint" },
];

const rotterdamDataset = { step: "extract-rotterdam-engineers", count: ROTTERDAM.length, records: ROTTERDAM, pages: 3 };

/**
 * Guildline, a professional network at the size and with the manners of a
 * real one: a signed-in member with 69 people in the search index, 36
 * outstanding invitations and 8 waiting for an answer; a feed that loads as it
 * scrolls; a people search whose results arrive behind skeletons, carry
 * promoted profiles that look like results, repeat a result across pages, and
 * whose Next is broken; a cookie banner, an app prompt, and a conversation
 * that opens over the bottom right of every page; class names that change
 * with the seed and ids that change with every rendering; relative dates
 * rendered inside shadow roots; a hidden honeypot on the connection-note form;
 * and a results endpoint that answers anyone asking too fast with a security
 * check.
 *
 * The primary workflow withdraws the connection requests sent a month or more
 * ago and nothing else; its playback goal is judged on the page-embedded
 * invitation store, an exact set. `people-search` reads every second-degree
 * data engineer in Rotterdam, Netherlands, once each, with no promoted entry.
 */
export const professionalNetworkManifest = createScenarioManifest({
  id: "professional-network",
  title: "Professional network",
  tags: ["social", "professional-network", "search", "pagination", "extraction", "invitations", "overlays", "anti-bot", "shadow-dom", "generated-classes"],
  seed: 4303,
  startPath: ROOT,
  capabilities: ["navigation", "forms", "mutation", "scroll", "iframe"],
  playbackGoal: {
    id: "withdraw-month-old-requests",
    description: "Withdraw every connection request sent a month or more ago that is still pending, and leave newer requests, page and newsletter invitations, and received invitations as they are.",
    successFacts: [storeIs(STORE_AFTER_WITHDRAWAL)],
  },
  recordingScript: WITHDRAW_SCRIPT,
  expected: {
    pageFacts: [storeIs(STORE_AT_START), confirmHook(true), onFeed],
    recordingEvents: [{ type: "web.element.clicked" }],
    actions: [{ action: "web.dom.click", outcome: "succeeded" }],
    finalState: [storeIs(STORE_AFTER_WITHDRAWAL)],
    allowedConsoleErrors: ["status of 429"],
  },
  variants: [{
    id: "redesigned-withdraw-dialog",
    description: "Only a repair can pass this row. The withdraw confirmation was redesigned: its confirm control lost the test hook the recording names, reads Withdraw invitation and sits first, and Keep invitation beside it withdraws nothing. A provider-free run fails at the first confirmation; the expectations are the repaired run's, so a repair that re-points the click at Withdraw invitation reaches the goal, and one that presses Keep invitation leaves every request pending.",
    arm: { operation: "set-mode", payload: { mode: "redesigned-withdraw-dialog" } },
    expected: {
      pageFacts: [storeIs(STORE_AT_START), confirmHook(false), onFeed],
      finalState: [storeIs(STORE_AFTER_WITHDRAWAL)],
    },
  }],
  workflows: [{
    id: "people-search",
    description: "Search people for data engineer, narrow to second-degree connections in Rotterdam, Netherlands, and read every result across every page, each person once and no promoted entry.",
    recordingScript: SEARCH_SCRIPT,
    expected: {
      pageFacts: [storeIs(STORE_AT_START), onFeed],
      recordingEvents: [{ type: "web.element.clicked" }, { type: "web.element.input_changed" }],
      actions: [
        { action: "web.dom.click", outcome: "succeeded" },
        { action: "web.dom.type", outcome: "succeeded" },
        { action: "web.dom.extract_list" },
      ],
      extracted: [rotterdamDataset],
      finalState: [storeIs(STORE_AT_START)],
      allowedConsoleErrors: ["status of 429"],
    },
    variants: [{
      id: "premium-upsell",
      description: "A Premium trial offer now opens over the people results once they load, and the page behind it is inert until it is closed by its unlabelled close icon or a No thanks that is not a button; Start free trial leads to a checkout. Closed, the page is the baseline, so the same people must be read; a Flow that never saw the offer has to get past it, and one that presses Start free trial has left the search.",
      arm: { operation: "set-mode", payload: { mode: "premium-upsell" } },
      expected: {
        pageFacts: [storeIs(STORE_AT_START), onFeed],
        extracted: [rotterdamDataset],
        finalState: [storeIs(STORE_AT_START)],
      },
    }],
  }],
});
