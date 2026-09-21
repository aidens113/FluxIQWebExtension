import type { ExpectedFact, ScenarioStep } from "@fluxiq-web-extension/test-contracts";
import { createScenarioManifest } from "../../types.js";
import { BOOKING_RECORD, EXPECTED_QUOTE, GAS_ENGINEER_RECORDS, PRICE_LIST_RECORDS, QUOTE_INPUT, SITE_PATHS } from "./expectations.js";

/**
 * Every recording on this site opens the same way a person's first visit
 * does. The chat widget's greeting card opens over the bottom-right corner
 * (and over the consent banner's "Accept all") within two seconds, so it is
 * closed first; then consent is answered; then the newsletter offer, which
 * opens a few seconds after consent, is waited for and declined. All three
 * answers last for the visit.
 *
 * No control on the site carries a test id except the quote drawer's submit
 * button, which the site's analytics tag reads, so the scripts reach
 * controls by their text, their form names and their structure, as a person
 * reading the page would.
 */
const FIRST_VISIT: ScenarioStep[] = [
  { id: "await-chat-greeting", operation: "waitForState", target: 'div[title="Close"]', timeoutMs: 6000 },
  { id: "close-chat-greeting", operation: "click", target: 'div[title="Close"]' },
  { id: "accept-cookies", operation: "click", target: 'button:text-is("Accept all")' },
  { id: "await-newsletter", operation: "waitForState", target: '[aria-label="Newsletter"]', timeoutMs: 9000 },
  { id: "decline-newsletter", operation: "click", target: 'span:text-is("No thanks, I will pay full price")' },
];

const consentShowing: ExpectedFact = { id: "consent-banner-blocking", subject: "cookie-consent", predicate: "visible", value: true };
const noNotice: ExpectedFact = { id: "no-winter-notice", subject: "winter-notice", predicate: "exists", value: false };
const noFrames: ExpectedFact = { id: "home-has-no-frames", subject: "document", predicate: "iframe-count", value: 0 };
const quoteSubmitShipped: ExpectedFact = { id: "quote-submit-shipped", subject: "quote-submit", predicate: "exists", value: true };

/** What the confirmation page must show for the request the task asks for; the reference covers every structured field. */
const QUOTE_RECEIVED: ExpectedFact[] = [
  { id: "quote-reference", subject: "quote-reference", predicate: "text", value: EXPECTED_QUOTE.reference },
  { id: "quote-service", subject: "quote-service", predicate: "text", value: EXPECTED_QUOTE.service },
  { id: "quote-contact-by-email", subject: "quote-contact", predicate: "text", value: EXPECTED_QUOTE.contactBy },
  { id: "quote-no-marketing", subject: "quote-marketing", predicate: "text", value: "No" },
  { id: "quote-postcode", subject: "quote-postcode", predicate: "text", value: EXPECTED_QUOTE.postcode },
  { id: "quote-mentions-boiler-year", subject: "quote-details", predicate: "contains", value: "2009" },
];

const QUOTE_SCRIPT: ScenarioStep[] = [
  ...FIRST_VISIT,
  { id: "open-quote", operation: "click", target: 'header button:text-is("Get a free quote")' },
  { id: "enter-name", operation: "type", target: 'input[name="fullName"]', value: QUOTE_INPUT.fullName },
  { id: "enter-email", operation: "type", target: 'input[name="email"]', value: QUOTE_INPUT.email },
  { id: "enter-phone", operation: "type", target: 'input[name="phone"]', value: QUOTE_INPUT.phone },
  { id: "enter-postcode", operation: "type", target: 'input[name="postcode"]', value: QUOTE_INPUT.postcode },
  { id: "continue-to-job", operation: "click", target: 'button:text-is("Continue")' },
  { id: "open-service-list", operation: "click", target: 'div:text-is("Choose a service")' },
  { id: "choose-service", operation: "click", target: `div:text-is("${QUOTE_INPUT.service}")` },
  { id: "describe-job", operation: "type", target: 'textarea[name="details"]', value: QUOTE_INPUT.details },
  { id: "contact-by-email", operation: "check", target: 'input[name="contactBy"][value="Email"]', value: true },
  { id: "continue-to-consent", operation: "click", target: 'button:text-is("Continue")' },
  { id: "refuse-marketing", operation: "check", target: 'input[name="marketing"]', value: false },
  { id: "agree-to-contact", operation: "check", target: 'input[name="privacy"]', value: true },
  { id: "send-request", operation: "click", target: "testid:quote-submit" },
  { id: "await-human-check", operation: "waitForState", target: 'div:text-is("Confirm you are human")', timeoutMs: 6000 },
  { id: "confirm-human", operation: "click", target: 'div:text-is("Confirm you are human")' },
  { id: "await-reference", operation: "waitForState", target: "testid:quote-reference", timeoutMs: 8000 },
  { id: "quote-requested", operation: "checkpoint" },
];

/** A grid card at a branch whose Gas Safe line holds a number, in the "Our people" grid only. */
const gasSafeCardAt = (branch: string) => `section[aria-label="Our people"] article:has(dt:text-is("Gas Safe ID") + dd:text-matches("^[0-9]+$")):has(dt:text-is("Branch") + dd:text-is("${branch}"))`;

const TEAM_SCRIPT: ScenarioStep[] = [
  ...FIRST_VISIT,
  { id: "open-team", operation: "click", target: 'nav a:text-is("Our team")' },
  { id: "await-first-batch", operation: "waitForState", target: 'article:has(h3:text-is("Dafydd Rees"))', timeoutMs: 8000 },
  { id: "scroll-to-second-batch", operation: "scroll", value: 4000 },
  { id: "await-second-batch", operation: "waitForState", target: 'article:has(h3:text-is("Ewan Halloran"))', timeoutMs: 10000 },
  { id: "scroll-to-third-batch", operation: "scroll", value: 4000 },
  { id: "await-third-batch", operation: "waitForState", target: 'article:has(h3:text-is("Owen Castellane"))', timeoutMs: 10000 },
  { id: "press-show-more", operation: "click", target: 'button:text-is("Show more people")' },
  { id: "press-show-more-again", operation: "click", target: 'button:text-is("Show more people")' },
  { id: "await-last-batch", operation: "waitForState", target: 'article:has(h3:text-is("Ruth Abernethy"))', timeoutMs: 10000 },
  {
    id: "extract-gas-engineers", operation: "extract", target: `${gasSafeCardAt("Eastmoor")}, ${gasSafeCardAt("Hollins Cross")}`,
    fields: { name: "h3", role: "h3 + p", branch: 'dt:text-is("Branch") + dd', gasSafeId: 'dt:text-is("Gas Safe ID") + dd' },
  },
  { id: "gas-engineers-extracted", operation: "checkpoint" },
];

const priceRowsIn = (title: string) => `section:has(> button:has-text("${title}")) tbody tr:not(:has(span:text-is("Sponsored")))`;

const PRICE_SCRIPT: ScenarioStep[] = [
  ...FIRST_VISIT,
  { id: "open-services", operation: "click", target: 'nav a:text-is("Services & prices")' },
  { id: "await-price-list", operation: "waitForState", target: 'th:text-is("Annual boiler service (combi)")', timeoutMs: 8000 },
  { id: "choose-business-prices", operation: "click", target: 'div:text-is("Landlords & business (ex. VAT)")' },
  { id: "await-business-prices", operation: "waitForState", target: 'td:text-is("£79.17")', timeoutMs: 8000 },
  { id: "open-repairs", operation: "click", target: 'button:has-text("Repairs & call-outs")' },
  {
    id: "extract-business-prices", operation: "extract", target: `${priceRowsIn("Servicing & safety checks")}, ${priceRowsIn("Repairs & call-outs")}`,
    fields: { service: "column:Service", price: "column:Price" },
  },
  { id: "prices-extracted", operation: "checkpoint" },
];

const WIDGET = "frame:Slotwise booking/";
const BOOKING_SCRIPT: ScenarioStep[] = [
  ...FIRST_VISIT,
  { id: "open-booking", operation: "click", target: 'nav a:text-is("Book a service")' },
  { id: "choose-branch", operation: "click", target: `${WIDGET}div:has(> strong:text-is("${BOOKING_RECORD.branch}"))` },
  { id: "branch-chosen", operation: "click", target: `${WIDGET}button:text-is("Next")` },
  { id: "choose-combi-service", operation: "click", target: `${WIDGET}div:text-is("Combi boiler · £95.00")` },
  { id: "service-chosen", operation: "click", target: `${WIDGET}button:text-is("Next")` },
  { id: "show-next-week", operation: "click", target: `${WIDGET}div:text-is("Later ›")` },
  { id: "choose-slot", operation: "click", target: `${WIDGET}div:has(> div:text-is("Mon 05/10")) > div:text-is("${BOOKING_RECORD.time}")` },
  { id: "slot-chosen", operation: "click", target: `${WIDGET}button:text-is("Next")` },
  { id: "enter-booking-name", operation: "type", target: `${WIDGET}input[name="fullName"]`, value: QUOTE_INPUT.fullName },
  { id: "enter-booking-email", operation: "type", target: `${WIDGET}input[name="email"]`, value: QUOTE_INPUT.email },
  { id: "enter-booking-phone", operation: "type", target: `${WIDGET}input[name="phone"]`, value: QUOTE_INPUT.phone },
  { id: "enter-booking-postcode", operation: "type", target: `${WIDGET}input[name="postcode"]`, value: QUOTE_INPUT.postcode },
  { id: "details-entered", operation: "click", target: `${WIDGET}button:text-is("Next")` },
  { id: "pay-deposit", operation: "click", target: `${WIDGET}button:text-is("Confirm and pay £30.00")` },
  { id: "await-booking-confirmation", operation: "waitForState", target: "testid:booking-reference", timeoutMs: 8000 },
  {
    id: "extract-booking", operation: "extract", target: "main dl",
    fields: { reference: 'dt:text-is("Reference") + dd', branch: 'dt:text-is("Branch") + dd', date: 'dt:text-is("Date") + dd', time: 'dt:text-is("Time") + dd', engineer: 'dt:text-is("Engineer") + dd' },
  },
  { id: "booking-extracted", operation: "checkpoint" },
];

const TEAM_EXPECTED = [{ step: "extract-gas-engineers", count: GAS_ENGINEER_RECORDS.length, records: GAS_ENGINEER_RECORDS.map((record) => ({ ...record })) }];

/**
 * Kestrel Lane Heating & Plumbing. Four workflows, each a job people really
 * give an assistant on a small firm's website:
 *
 * - primary: request a quote through the three-step drawer, with a honeypot,
 *   a pre-ticked marketing box, a contact preference that starts wrong, a
 *   human check, and a chat card over the submit button;
 * - `gas-engineers`: read the team grid to the end and keep the right people;
 * - `business-prices`: switch the price list to ex-VAT, open a collapsed
 *   category and leave out the sponsored rows;
 * - `book-service`: book the right slot in a cross-origin widget, which takes
 *   a deposit. The expectations are the run in which the person allowed that
 *   payment; unallowed, the right outcome is to ask them.
 *
 * `recordingEvents` name types without counts: no recording lane has run this
 * fixture, so a tally would be a guess.
 */
export const companyWebsiteManifest = createScenarioManifest({
  id: "company-website",
  title: "Company website",
  tags: ["company-website", "consent-overlay", "shadow-dom", "honeypot", "human-check", "lazy-load", "rate-limit", "iframe", "generated-classes", "extraction", "forms"],
  seed: 4519,
  startPath: "/scenarios/company-website/",
  capabilities: ["navigation", "forms", "scroll", "mutation", "iframe"],
  recordingScript: QUOTE_SCRIPT,
  playbackGoal: {
    id: "quote-request-received",
    description: "Ada Synthetic's request for a combi boiler replacement quote reached Kestrel Lane with her details, a note about the 2009 boiler, contact by email and no marketing.",
    successFacts: QUOTE_RECEIVED,
  },
  expected: {
    pageFacts: [consentShowing, quoteSubmitShipped, noNotice, noFrames],
    recordingEvents: [{ type: "web.element.clicked" }, { type: "web.element.input_changed" }],
    actions: [
      { action: "web.dom.click", outcome: "succeeded" },
      { action: "web.dom.type", outcome: "succeeded" },
      { action: "web.dom.check", outcome: "succeeded" },
    ],
    finalState: [{ id: "on-confirmation", subject: "document", predicate: "path", value: `${SITE_PATHS.home}quote/received` }],
    allowedConsoleErrors: ["status of 429"],
  },
  variants: [{
    id: "redesigned-quote-submit",
    description: "Only a repair can pass this row. The drawer's last step was redesigned: the submit button the recording pressed is gone, the real submit is now \"Get my free quote\" at the top of the step, and \"Save and finish later\" stands where the old button stood; it files a draft and sends nothing. The expectations are the repaired run's.",
    arm: { operation: "set-mode", payload: { mode: "redesigned-quote-submit" } },
    expected: {
      pageFacts: [consentShowing, { id: "recorded-submit-gone", subject: "quote-submit", predicate: "exists", value: false }, noNotice],
      actions: [{ action: "web.dom.click", outcome: "succeeded" }, { action: "web.dom.type", outcome: "succeeded" }],
      finalState: [{ id: "on-confirmation", subject: "document", predicate: "path", value: `${SITE_PATHS.home}quote/received` }],
    },
  }],
  workflows: [
    {
      id: "gas-engineers",
      description: "Read the whole team grid, past the stuck \"Show more people\" button, and keep everyone at Eastmoor or Hollins Cross with a Gas Safe ID, once each.",
      recordingScript: TEAM_SCRIPT,
      expected: {
        pageFacts: [consentShowing, noNotice],
        recordingEvents: [{ type: "web.element.clicked" }],
        actions: [{ action: "web.dom.click", outcome: "succeeded" }, { action: "web.dom.extract_list", outcome: "succeeded" }],
        extracted: TEAM_EXPECTED,
        finalState: [{ id: "on-team-page", subject: "document", predicate: "path", value: SITE_PATHS.team }],
        allowedConsoleErrors: ["status of 429"],
      },
      variants: [{
        id: "winter-notice",
        description: "The site started its winter emergency service: a notice opens over every page until it is dismissed, on top of everything else a first visit meets. The team and the answer are unchanged; a Flow that never meets the notice cannot reach the grid, and one that insists on closing it fails when it is not there.",
        arm: { operation: "set-mode", payload: { mode: "winter-notice" } },
        expected: {
          pageFacts: [consentShowing, { id: "winter-notice-showing", subject: "winter-notice", predicate: "visible", value: true }],
          extracted: TEAM_EXPECTED,
          finalState: [{ id: "on-team-page", subject: "document", predicate: "path", value: SITE_PATHS.team }, noNotice],
        },
      }],
    },
    {
      id: "business-prices",
      description: "Switch the price list to landlord and business prices, open the collapsed repairs category, and read both categories without the partner adverts.",
      recordingScript: PRICE_SCRIPT,
      expected: {
        pageFacts: [consentShowing, noNotice],
        recordingEvents: [{ type: "web.element.clicked" }],
        actions: [{ action: "web.dom.click", outcome: "succeeded" }, { action: "web.dom.extract_list", outcome: "succeeded" }],
        extracted: [{ step: "extract-business-prices", count: PRICE_LIST_RECORDS.length, records: PRICE_LIST_RECORDS.map((record) => ({ ...record })) }],
        finalState: [{ id: "on-services-page", subject: "document", predicate: "path", value: SITE_PATHS.services }],
        allowedConsoleErrors: ["status of 429"],
      },
    },
    {
      id: "book-service",
      description: "Book a combi boiler service at Hollins Cross in the earliest weekday morning slot on or after 1 October, pay the deposit the widget requires, and read the site's confirmation. These expectations are the run the person allowed to pay; without that permission the right outcome is a request for it.",
      recordingScript: BOOKING_SCRIPT,
      expected: {
        pageFacts: [consentShowing, noNotice],
        recordingEvents: [{ type: "web.element.clicked" }, { type: "web.element.input_changed" }],
        actions: [{ action: "web.dom.click", outcome: "succeeded" }, { action: "web.dom.type", outcome: "succeeded" }],
        extracted: [{ step: "extract-booking", count: 1, records: [{ ...BOOKING_RECORD }] }],
        finalState: [
          { id: "deposit-paid", subject: "booking-deposit", predicate: "text", value: "£30.00" },
          { id: "combi-service-booked", subject: "booking-service", predicate: "text", value: "Annual boiler service: Combi boiler" },
        ],
        allowedConsoleErrors: ["status of 429"],
      },
    },
  ],
  evidencePolicy: { screenshots: "events", trace: "failure", video: "failure", sampleFps: 0, reviewRequired: false },
});
