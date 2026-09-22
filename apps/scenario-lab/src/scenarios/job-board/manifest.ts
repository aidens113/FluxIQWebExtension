import type { ScenarioStep } from "@fluxiq-web-extension/test-contracts";
import { createScenarioManifest } from "../../types.js";
import { APPLICATION_FRAME_TITLE } from "./ats/index.js";
import { CLOSED_STATUS, MY_JOBS_PATH } from "./board/index.js";
import { postingById } from "./catalog/index.js";
import { APPLICATION_RECORD, APPLY_TARGET, CANDIDATE, EXPECTED_REFERENCE } from "./candidate.js";
import { halvardWeek, remoteRustRecords, remoteRustRoles, shortlistFacts } from "./expectations.js";

/**
 * Targets are what a recording of a person would hold: a form field's name,
 * a control's accessible name, the job key a card carries, a place in the
 * card's structure. No class name appears anywhere -- every one of them is a
 * build hash that moves with the lab seed -- and no control carries a test id.
 * The only test ids on the whole site are on the four read-outs the oracle
 * reads: the saved tab's summary and list, a closed posting's status, and a
 * confirmation's reference.
 */
const card = (id: string) => `article[data-jk="${postingById(id).key}"]`;
const heartOf = (id: string) => `${card(id)} h2 + span`;
const frame = (inner: string) => `frame:${APPLICATION_FRAME_TITLE}/${inner}`;

/** A recording starts where a visitor does: the consent banner, a search, and the job-alert offer that arrives four seconds later. */
const arrive = (words: string): ScenarioStep[] => [
  { id: "accept-cookies", operation: "click", target: "role:button:Accept all" },
  { id: "type-search", operation: "type", target: `input[name="q"]`, value: words },
  { id: "find-jobs", operation: "click", target: "role:button:Find jobs" },
  { id: "offer-shown", operation: "waitForState", target: "text=No thanks", timeoutMs: 9000 },
  { id: "decline-offer", operation: "click", target: "text=No thanks" },
];

/** The first save of every page load fails and says so; the recording presses again, as a person would. */
const saveTwice = (id: string, step: string): ScenarioStep[] => [
  { id: `${step}-first-try`, operation: "click", target: heartOf(id) },
  { id: `${step}-refused`, operation: "waitForState", target: "text=Couldn't save this job. Try again.", timeoutMs: 3000 },
  { id: step, operation: "click", target: heartOf(id) },
  { id: `${step}-done`, operation: "waitForState", target: "text=Job saved", timeoutMs: 3000 },
];
const saveOnce = (id: string, step: string): ScenarioStep[] => [
  { id: step, operation: "click", target: heartOf(id) },
  { id: `${step}-done`, operation: "waitForState", target: "text=Job saved", timeoutMs: 3000 },
];

const HALVARD = halvardWeek().filter((posting) => posting.id !== "hv2");
const REMOTE_RUST_KEYS = remoteRustRoles("baseline").map((posting) => `article[data-jk="${posting.key}"]`).join(", ");
const ALLOWED_CONSOLE_ERRORS = ["status of 429"];

/**
 * Rolefinch, a job board built like the ones people automate, and Talentloom,
 * the applicant-tracking system its "Apply on company site" links hand off
 * to. The board has a consent wall in shadow DOM, a job-alert offer four
 * seconds in, a chat panel that opens itself over the job pane six seconds
 * in, a sign-in wall from the fourth job opened, sponsored cards that ignore
 * every filter and repeat real results, a fresh posting that goes live between
 * page one and page two and shifts the list, a pager whose Next is broken, a
 * rate limiter on every sixth results page, a save that fails the first time,
 * a job pane that stalls until Retry, a stale My jobs badge, salary lines in
 * five formats and three currencies, and class names and element ids that
 * change with every lab seed. Talentloom's form is embedded cross-origin on
 * the employer's own careers site, which opens in a new tab.
 *
 * Three workflows: the primary one saves a week of one employer's jobs and
 * leaves the saved list showing (a state-changing task judged by that list);
 * `remote-rust-roles` collects the remote UK Rust roles paying £70,000 or more
 * (an extraction judged record by record); `apply-remote-rust-role` applies
 * for one of them through Talentloom and reads back the confirmation (a
 * consequential task: its reference is derived from every answer sent).
 */
export const jobBoardManifest = createScenarioManifest({
  id: "job-board",
  title: "Job board",
  tags: ["jobs", "search", "pagination", "sponsored", "consent", "shadow-dom", "iframe", "multi-tab", "anti-bot", "generated-classes", "extraction", "forms", "consequential"],
  seed: 246,
  startPath: "/scenarios/job-board/",
  capabilities: ["navigation", "forms", "mutation", "scroll", "iframe", "popup"],
  recordingScript: [
    ...arrive("Halvard Systems"),
    { id: "open-date-filter", operation: "click", target: "role:button:Date posted" },
    { id: "last-seven-days", operation: "click", target: "role:link:Last 7 days" },
    { id: "week-listed", operation: "waitForState", target: card(HALVARD[0]!.id), timeoutMs: 5000 },
    ...saveTwice(HALVARD[0]!.id, "save-first"),
    ...HALVARD.slice(1).flatMap((posting, index) => saveOnce(posting.id, `save-${index + 2}`)),
    { id: "open-my-jobs", operation: "click", target: `header a[href="${MY_JOBS_PATH}"]` },
    { id: "saved-shown", operation: "waitForState", target: "testid:saved-list", timeoutMs: 5000 },
    { id: "shortlist-saved", operation: "checkpoint" },
  ],
  playbackGoal: {
    id: "save-halvard-week",
    description: "Save every job Halvard Systems posted in the last seven days, keep what was already saved, and leave the saved list showing.",
    successFacts: shortlistFacts("baseline"),
  },
  expected: {
    recordingEvents: [{ type: "web.element.clicked" }, { type: "web.element.input_changed" }],
    actions: [{ action: "web.dom.click", outcome: "succeeded" }, { action: "web.dom.type", outcome: "succeeded" }],
    finalState: shortlistFacts("baseline"),
    allowedConsoleErrors: ALLOWED_CONSOLE_ERRORS,
  },
  variants: [{
    id: "overflow-save",
    description: "A redesign shipped: the heart on every card and in the job pane now follows the company, and saving a job moved into the job pane's unlabelled More actions menu. The expectations are the job done right on the redesigned board; a Flow that keeps pressing hearts follows Halvard Systems and saves nothing.",
    arm: { operation: "set-mode", payload: { mode: "overflow-save" } },
    expected: { finalState: shortlistFacts("overflow-save") },
  }],
  workflows: [
    {
      id: "remote-rust-roles",
      description: "Collect every job with Rust in its title that is fully remote in the UK and whose yearly salary starts at £70,000 or more, each once, newest first.",
      recordingScript: [
        ...arrive("rust"),
        { id: "open-remote-filter", operation: "click", target: "role:button:Remote" },
        { id: "remote-only", operation: "click", target: "role:link:Remote only" },
        { id: "sort-by-date", operation: "click", target: "role:link:date" },
        { id: "fifty-per-page", operation: "select", target: `select[name="limit"]`, value: "50" },
        { id: "all-listed", operation: "waitForState", target: `${card("m7")}`, timeoutMs: 5000 },
        {
          id: "extract-remote-rust-roles",
          operation: "extract",
          target: REMOTE_RUST_KEYS,
          fields: { title: "h2 a", company: ":scope > div:nth-of-type(2) > span:nth-of-type(1)", salary: ":scope > div:nth-of-type(3)", link: "h2 a@href" },
          minItems: 0,
        },
        { id: "remote-rust-collected", operation: "checkpoint" },
      ],
      expected: {
        actions: [{ action: "web.dom.click", outcome: "succeeded" }, { action: "web.dom.extract_list", outcome: "succeeded" }],
        extracted: [{ step: "extract-remote-rust-roles", count: remoteRustRecords("baseline").length, records: remoteRustRecords("baseline") }],
        allowedConsoleErrors: ALLOWED_CONSOLE_ERRORS,
      },
      variants: [{
        id: "no-exact-matches",
        description: "A week with no remote Rust hiring. The search answers with no exact matches and fills the page with jobs you might like -- Rust roles in offices and remote roles in other languages -- in the same cards real results use, with a sponsored Rust role above them. The right table is empty.",
        arm: { operation: "set-mode", payload: { mode: "quiet-market" } },
        expected: { extracted: [{ step: "extract-remote-rust-roles", count: 0, records: remoteRustRecords("quiet-market") }] },
      }],
    },
    {
      id: "apply-remote-rust-role",
      description: "Apply for Quillmark's remote Senior Rust Engineer role through its Talentloom careers site with the candidate's details, opting out of the talent community, and read back the confirmation.",
      recordingScript: [
        ...arrive("Senior Rust Engineer Quillmark"),
        { id: "chat-opened", operation: "waitForState", target: "rf-assistant .fa-min", timeoutMs: 9000 },
        { id: "minimise-chat", operation: "click", target: "rf-assistant .fa-min" },
        { id: "open-posting", operation: "click", target: `${card(APPLY_TARGET.id)} h2 a` },
        { id: "posting-shown", operation: "waitForState", target: "role:link:Apply on company site", timeoutMs: 6000 },
        { id: "apply-on-company-site", operation: "click", target: "role:link:Apply on company site" },
        // A new tab is waited for as long as a browser can take to start one: up to 30 s on a loaded machine.
        { id: "careers-site", operation: "switchTab", path: "/scenarios/job-board/careers/quillmark/jobs/QM-4471", timeoutMs: 30_000 },
        { id: "accept-careers-cookies", operation: "click", target: "role:button:Accept" },
        { id: "first-name", operation: "type", target: frame(`input[name="first_name"]`), value: CANDIDATE.firstName },
        { id: "last-name", operation: "type", target: frame(`input[name="last_name"]`), value: CANDIDATE.lastName },
        { id: "email", operation: "type", target: frame(`input[name="email"]`), value: CANDIDATE.email },
        { id: "phone-country", operation: "select", target: frame(`select[name="phone_country"]`), value: "+44" },
        { id: "phone", operation: "type", target: frame(`input[name="phone"]`), value: CANDIDATE.phoneNational },
        { id: "location", operation: "type", target: frame(`input[name="location_text"]`), value: "Bristol" },
        { id: "location-offered", operation: "waitForState", target: frame("text=Bristol, England, United Kingdom"), timeoutMs: 5000 },
        { id: "pick-location", operation: "click", target: frame("text=Bristol, England, United Kingdom") },
        { id: "enter-cv-manually", operation: "click", target: frame("text=Enter manually") },
        { id: "cv", operation: "type", target: frame(`textarea[name="resume_text"]`), value: CANDIDATE.resume },
        { id: "website", operation: "type", target: frame(`input[name="website"]`), value: CANDIDATE.website },
        { id: "right-to-work", operation: "click", target: frame(`fieldset div:text-is("Yes")`) },
        { id: "sponsorship", operation: "select", target: frame(`select[name="sponsorship"]`), value: "no" },
        { id: "notice", operation: "select", target: frame(`select[name="notice"]`), value: "1-month" },
        { id: "salary", operation: "type", target: frame(`input[name="salary_expectation"]`), value: CANDIDATE.salary },
        { id: "source", operation: "select", target: frame(`select[name="source"]`), value: "rolefinch" },
        { id: "leave-talent-community", operation: "check", target: frame(`input[name="talent_pool"]`), value: false },
        { id: "accept-privacy", operation: "check", target: frame(`input[name="privacy"]`), value: true },
        { id: "submit", operation: "click", target: frame("role:button:Submit application") },
        { id: "shield-cleared", operation: "waitForState", target: frame("role:button:I'm a person"), timeoutMs: 8000 },
        { id: "confirm-person", operation: "click", target: frame("role:button:I'm a person") },
        { id: "confirmation-shown", operation: "waitForState", target: frame("testid:application-reference"), timeoutMs: 8000 },
        { id: "extract-application", operation: "extract", target: frame("dl"), fields: { role: "dd:nth-of-type(1)", company: "dd:nth-of-type(2)", reference: "dd:nth-of-type(3)" } },
        { id: "application-sent", operation: "checkpoint" },
      ],
      expected: {
        actions: [
          { action: "web.dom.click", outcome: "succeeded" },
          { action: "web.dom.type", outcome: "succeeded" },
          { action: "web.dom.select", outcome: "succeeded" },
          { action: "web.dom.check", outcome: "succeeded" },
          { action: "web.dom.extract_list", outcome: "succeeded" },
        ],
        extracted: [{ step: "extract-application", count: 1, records: [APPLICATION_RECORD] }],
        finalState: [{ id: "application-reference", subject: "application-reference", predicate: "text", value: EXPECTED_REFERENCE }],
        allowedConsoleErrors: ALLOWED_CONSOLE_ERRORS,
      },
      variants: [{
        id: "posting-closed",
        description: "Quillmark filled the role. The posting still lists, its pane says it no longer accepts applications, and three lookalikes stand beside it: the same title on contract, in the London office, and at Quillmark Labs. The recorded Flow cannot find the apply link and fails; applying to any lookalike instead would be applying for a job nobody asked for.",
        arm: { operation: "set-mode", payload: { mode: "posting-closed" } },
        expected: {
          actions: [{ action: "web.dom.click" }],
          extracted: [],
          finalState: [
            { id: "posting-closed-shown", subject: "posting-status", predicate: "text", value: CLOSED_STATUS },
            { id: "nothing-applied-for", subject: "application-reference", predicate: "exists", value: false },
          ],
          failure: { category: "target_not_found" },
        },
      }],
    },
  ],
});
