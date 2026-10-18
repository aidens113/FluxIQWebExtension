import assert from "node:assert/strict";
import { test } from "node:test";
import type { ScenarioExpected, ScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { BRANCHES, branchById, newsletterCode, slotsFor, TEAM, weekday } from "../../data/index.js";
import { COMPANY_WEBSITE_LIVE_TASKS } from "../../live-tasks.js";
import { companyWebsiteManifest } from "../../manifest.js";
import { routeCompanyWebsite } from "../../route.js";
import { createCompanyWebsiteState, mutateCompanyWebsiteState, normaliseQuote } from "../../state.js";
import type { CompanyWebsiteState } from "../../types.js";
import {
  apprenticesExpected, apprenticesWorkflow, companyReviewAccountFacts, heatPumpQuoteExpected, heatPumpQuoteWorkflow,
  newsletterSignupExpected, newsletterSignupWorkflow, saturdayCertificateExpected, saturdayCertificateWorkflow,
} from "../index.js";

/**
 * The breadth rows' literal oracles (t704), checked against the fixture data
 * they were read from: each literal is what the site's own data yields, the
 * honest act leaves exactly the declared account, and a plausible wrong act
 * leaves another one.
 */
const ADA = { fullName: "Ada Synthetic", email: "ada.synthetic@example.test", phone: "07700 900123", postcode: "KL6 2RN" } as const;
const BREADTH: ReadonlyArray<{ taskId: string; workflow: ScenarioWorkflow; expected: ScenarioExpected }> = [
  { taskId: "company-website-apprentices", workflow: apprenticesWorkflow, expected: apprenticesExpected },
  { taskId: "company-website-newsletter-signup", workflow: newsletterSignupWorkflow, expected: newsletterSignupExpected },
  { taskId: "company-website-saturday-certificate", workflow: saturdayCertificateWorkflow, expected: saturdayCertificateExpected },
  { taskId: "company-website-heat-pump-quote", workflow: heatPumpQuoteWorkflow, expected: heatPumpQuoteExpected },
];
const accountOf = (expected: ScenarioExpected, kind: "pageFacts" | "finalState") => expected[kind]!.find(({ subject }) => subject === "company-review-account")!.value;
const page = (state: CompanyWebsiteState, subpath: string) => {
  const [path, query] = subpath.split("?");
  return routeCompanyWebsite(state, { subpath: path!, query: new URLSearchParams(query ?? ""), method: "GET" }, { runToken: "t", seed: 4519 })?.body ?? "";
};

test("breadth: each row is registered, in the manifest, and judged by the records of its own workflow's read", () => {
  for (const { taskId, workflow, expected } of BREADTH) {
    const task = COMPANY_WEBSITE_LIVE_TASKS.find(({ id }) => id === taskId);
    assert.ok(task, taskId);
    assert.equal(task.variantId, undefined, `${taskId}: no drift variant`);
    assert.ok(companyWebsiteManifest.workflows?.includes(workflow), `${taskId}: workflow in the manifest`);
    const entry = expected.extracted![0]!;
    assert.equal(task.expectedDatasetId, entry.step);
    assert.ok(Array.isArray(entry.records));
    assert.equal(entry.count, entry.records.length);
    assert.ok(workflow.recordingScript.some(({ id, operation }) => id === entry.step && operation === "extract"), `${taskId}: the recording reads ${entry.step}`);
    for (const key of new Set(entry.records.flatMap((record) => Object.keys(record)))) assert.match(task.instruction, new RegExp(`\\b${key}\\b`, "u"), `${taskId}: ${key}`);
    assert.equal(accountOf(expected, "pageFacts"), companyReviewAccountFacts(createCompanyWebsiteState()), `${taskId}: the initial account is a first visit's`);
  }
  const ids = BREADTH.flatMap(({ workflow }) => workflow.recordingScript.map(({ id }) => id));
  assert.equal(new Set(ids).size, ids.length, "step ids are unique across the breadth workflows");
});

test("breadth: the apprentices are the four cards whose role is an apprenticeship, at the grid places the read names", () => {
  const apprentices = TEAM.flatMap((card, index) => card.kind === "person" && /^Apprentice\b/u.test(card.role) ? [{ place: index + 1, record: { name: card.name, role: card.role, branch: branchById(card.branchId).name } }] : []);
  assert.deepEqual(apprenticesExpected.extracted![0]!.records, apprentices.map(({ record }) => record));
  const target = apprenticesWorkflow.recordingScript.find(({ id }) => id === "extract-apprentices")!.target!;
  assert.deepEqual([...target.matchAll(/nth-of-type\((\d+)\)/gu)].map((match) => Number(match[1])), apprentices.map(({ place }) => place));
  assert.equal(apprentices.at(-1)!.place > 24, true, "the last apprentice is only in the batch behind Show more people");
  assert.equal(accountOf(apprenticesExpected, "finalState"), companyReviewAccountFacts(createCompanyWebsiteState()));
});

test("breadth: one sign-up leaves one subscription with its code; a second address or a repeat is told apart", () => {
  const record = newsletterSignupExpected.extracted![0]!.records![0]!;
  assert.deepEqual(record, { email: ADA.email, code: newsletterCode(ADA.email) });
  const once = mutateCompanyWebsiteState(createCompanyWebsiteState(), "subscribe-newsletter", { email: ADA.email });
  assert.equal(companyReviewAccountFacts(once), accountOf(newsletterSignupExpected, "finalState"));
  assert.deepEqual(mutateCompanyWebsiteState(once, "subscribe-newsletter", { email: " Ada.Synthetic@Example.test " }).newsletter.subscribers, [ADA.email], "the list keeps an address once");
  const second = mutateCompanyWebsiteState(once, "subscribe-newsletter", { email: "ada@example.test" });
  assert.notEqual(companyReviewAccountFacts(second), accountOf(newsletterSignupExpected, "finalState"));
  assert.deepEqual(mutateCompanyWebsiteState(once, "unsubscribe-newsletter", { email: ADA.email }).newsletter.subscribers, [], "the site's own control undoes it");
  const listed = page(once, "newsletter");
  assert.match(listed, new RegExp(`<td>${ADA.email}</td><td>${record.code}</td>`, "u"));
  assert.match(page(createCompanyWebsiteState(), "team"), />Offers &amp; reminders</u, "every page's footer links the page");
  assert.doesNotMatch(page(createCompanyWebsiteState(), "newsletter"), /Your subscriptions/u);
});

test("breadth: Wrenfield has exactly two free Saturday slots across three weeks; Corve Bridge is closed", () => {
  const saturdays = (branchId: string) => slotsFor(branchId).filter(({ date }) => weekday(date) === 6);
  assert.deepEqual(saturdays("corve-bridge"), []);
  assert.equal(BRANCHES.find(({ id }) => id === "corve-bridge")!.hours.find(([days]) => days === "Saturday")![1], "Closed");
  const free = saturdays("wrenfield").filter(({ free }) => free).map(({ date, time }) => ({ date, time }));
  assert.deepEqual(free, [{ date: "2026-10-03", time: "11:30" }, { date: "2026-10-17", time: "09:00" }]);
  assert.deepEqual(saturdayCertificateExpected.extracted![0], { step: "extract-saturday-certificate-slots", count: 2, records: free });
  assert.equal(accountOf(saturdayCertificateExpected, "finalState"), companyReviewAccountFacts(createCompanyWebsiteState()));
});

test("breadth: the heat pump request names the renewables branch and the confirmation shows the declared record", () => {
  const centre = BRANCHES.find(({ note }) => /heat pump centre/iu.test(note))!;
  assert.equal(centre.name, "Sallowmere");
  assert.ok(heatPumpQuoteExpected.finalState!.some(({ subject, predicate, value }) => subject === "quote-details" && predicate === "contains" && value === centre.name));
  const details = heatPumpQuoteWorkflow.recordingScript.find(({ id }) => id === "heat-pump-details")!.value as string;
  const quote = { ...ADA, service: "Heat pump installation", contactBy: "Text message", marketing: false, privacy: true, verified: true, details };
  const sent = mutateCompanyWebsiteState(createCompanyWebsiteState(), "submit-quote", quote);
  const reference = normaliseQuote(quote)!.reference;
  assert.deepEqual(heatPumpQuoteExpected.extracted![0]!.records, [{ reference, service: "Heat pump installation", contactBy: "Text message", offers: "No" }]);
  assert.equal(companyReviewAccountFacts(sent), accountOf(heatPumpQuoteExpected, "finalState"));
  const received = page(sent, `quote/received?ref=${reference}`);
  for (const [testId, value] of [["quote-reference", reference], ["quote-service", "Heat pump installation"], ["quote-contact", "Text message"], ["quote-marketing", "No"]]) {
    assert.match(received, new RegExp(`data-testid="${testId}">${value}<`, "u"), testId);
  }
  assert.notEqual(normaliseQuote({ ...quote, contactBy: "Phone" })!.reference, reference, "the drawer's default contact gives another reference");
  assert.notEqual(normaliseQuote({ ...quote, marketing: true })!.reference, reference, "the pre-ticked box gives another reference");
});
