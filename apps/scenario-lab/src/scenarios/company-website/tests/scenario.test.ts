import assert from "node:assert/strict";
import test from "node:test";
import { resolveScenarioWorkflow, validateWebScenario } from "@fluxiq-web-extension/test-contracts";
import { LIVE_INSTRUCTION_TASKS, LIVE_REPAIR_TASKS } from "../../index.js";
import { BOOKING_RECORD, EXPECTED_QUOTE, GAS_ENGINEER_RECORDS, PRICE_LIST_RECORDS } from "../expectations.js";
import { COMPANY_WEBSITE_LIVE_TASKS } from "../live-tasks.js";
import { COMPANY_WEBSITE_REPAIR_TASKS } from "../repair-tasks.js";
import { routeCompanyWebsite } from "../route.js";
import { companyWebsiteScenario } from "../scenario.js";
import { createCompanyWebsiteState, mutateCompanyWebsiteState, normalisePhone, normalisePostcode } from "../state.js";
import type { CompanyWebsiteState } from "../types.js";

const { manifest, render } = companyWebsiteScenario;
const context = (seed: number) => ({ runToken: "company-website-token", seed });
const get = (state: CompanyWebsiteState, subpath: string, seed = 4519, now = 1_000_000) => {
  const [path, query] = subpath.split("?");
  return routeCompanyWebsite(state, { subpath: path!, query: new URLSearchParams(query ?? ""), method: "GET" }, context(seed), now);
};
const QUOTE = { fullName: " Ada   Synthetic ", email: "Ada.Synthetic@Example.test", phone: "+44 7700 900123", postcode: "kl62rn", service: "Combi boiler replacement", contactBy: "Email", marketing: false, privacy: true, verified: true, details: "2009 floor standing" };

/** Page text with every class and id removed: what a person reads, and what must not depend on the seed. */
const readable = (html: string) => html.replace(/\s(?:class|id|for|aria-labelledby)="[^"]*"/gu, "").replace(/css-[a-z0-9]{7}/gu, "css").replace(/:r[a-z0-9]+:/gu, ":r:");

test("the manifest is valid, loopback-only, and its workflows and variants are the ones the tasks name", () => {
  assert.deepEqual(validateWebScenario(manifest), { valid: true, value: manifest });
  assert.deepEqual([manifest.id, manifest.seed, manifest.startPath, manifest.networkPolicy], ["company-website", 4519, "/scenarios/company-website/", "loopback-only"]);
  assert.deepEqual(manifest.workflows?.map(({ id }) => id), ["gas-engineers", "business-prices", "book-service"]);
  assert.deepEqual(manifest.variants?.map(({ id }) => id), ["redesigned-quote-submit"]);
  assert.equal(resolveScenarioWorkflow(manifest, { workflowId: "gas-engineers", variantId: "winter-notice" }).expected.extracted?.[0]?.records?.length, 8);
});

test("the answers are the ones a careful reader of the site arrives at", () => {
  assert.deepEqual(GAS_ENGINEER_RECORDS.map(({ name, branch }) => `${name} (${branch})`), [
    "Tomasz Wierzbicki (Eastmoor)", "Priya Anand (Eastmoor)", "James Whitlock (Eastmoor)", "Grace Lindqvist (Eastmoor)",
    "Owen Castellane (Hollins Cross)", "Farah Qureshi (Hollins Cross)", "Ruth Abernethy (Hollins Cross)", "Stefan Novak (Hollins Cross)",
  ]);
  assert.equal(GAS_ENGINEER_RECORDS.find(({ name }) => name === "Stefan Novak")?.gasSafeId, "7012384", "his Gas Safe ID is his second credential");
  assert.equal(PRICE_LIST_RECORDS.length, 12);
  assert.deepEqual(PRICE_LIST_RECORDS.slice(0, 2), [{ service: "Annual boiler service (combi)", price: "£79.17" }, { service: "Annual boiler service (system or regular)", price: "£91.67" }]);
  assert.ok(PRICE_LIST_RECORDS.some(({ price }) => price === "from £100.00"));
  assert.ok(!PRICE_LIST_RECORDS.some(({ service }) => /cover|protection/iu.test(service ?? "")), "no partner advert");
  assert.deepEqual({ ...BOOKING_RECORD, reference: BOOKING_RECORD.reference?.slice(0, 3) }, { reference: "SW-", branch: "Hollins Cross", date: "Monday 5 October 2026", time: "10:30", engineer: "Owen Castellane" });
});

test("a quote request is stored normalised, and its reference depends on the structured fields and never the free text", () => {
  const state = mutateCompanyWebsiteState(createCompanyWebsiteState(), "submit-quote", QUOTE);
  assert.equal(state.quotes.length, 1);
  assert.deepEqual({ ...state.quotes[0], details: undefined }, { ...EXPECTED_QUOTE, details: undefined });
  assert.equal(state.lastSubmission?.reference, EXPECTED_QUOTE.reference);
  const reworded = mutateCompanyWebsiteState(createCompanyWebsiteState(), "submit-quote", { ...QUOTE, details: "It is a floor-standing boiler from 2009." });
  assert.equal(reworded.quotes[0]?.reference, EXPECTED_QUOTE.reference);
  const marketing = mutateCompanyWebsiteState(createCompanyWebsiteState(), "submit-quote", { ...QUOTE, marketing: true });
  assert.notEqual(marketing.quotes[0]?.reference, EXPECTED_QUOTE.reference);
  assert.equal(normalisePhone("07700900123"), "07700 900123");
  assert.equal(normalisePhone("0770090012"), "");
  assert.equal(normalisePostcode(" kl6 2rn "), "KL6 2RN");
});

test("the spam filter drops a honeypot, a missing human check and a missing consent, and still says thanks", () => {
  const initial = createCompanyWebsiteState();
  const honeypot = mutateCompanyWebsiteState(initial, "submit-quote", { ...QUOTE, companyWebsite: "https://example.test" });
  const unverified = mutateCompanyWebsiteState(initial, "submit-quote", { ...QUOTE, verified: false });
  const noConsent = mutateCompanyWebsiteState(initial, "submit-quote", { ...QUOTE, privacy: false });
  for (const state of [honeypot, unverified, noConsent]) {
    assert.equal(state.quotes.length, 0);
    assert.deepEqual(state.lastSubmission, { reference: null });
  }
  assert.deepEqual([honeypot.discarded, unverified.discarded, noConsent.discarded], [{ honeypot: 1, unverified: 0, invalid: 0 }, { honeypot: 0, unverified: 1, invalid: 0 }, { honeypot: 0, unverified: 0, invalid: 1 }]);
  const thanks = get(honeypot, "quote/received");
  assert.match(thanks?.body ?? "", /We will be in touch soon/u);
  assert.doesNotMatch(thanks?.body ?? "", /data-testid="quote-reference"/u);
});

test("a booking takes a free slot and the deposit together, and refuses a full slot, a taken slot and missing details", () => {
  const request = { branchId: "hollins-cross", serviceId: "service-combi", date: "2026-10-05", time: "10:30", fullName: "Ada Synthetic", email: "ada.synthetic@example.test", phone: "07700 900123", postcode: "KL6 2RN", payDeposit: true };
  const booked = mutateCompanyWebsiteState(createCompanyWebsiteState(), "book-slot", request);
  assert.deepEqual({ reference: booked.bookings[0]?.reference, engineer: booked.bookings[0]?.engineer, deposits: booked.deposits }, { reference: BOOKING_RECORD.reference, engineer: "Owen Castellane", deposits: { count: 1, totalPence: 3_000 } });
  assert.equal(mutateCompanyWebsiteState(booked, "book-slot", request).refusedBookings, 1, "the slot is now taken");
  const full = mutateCompanyWebsiteState(createCompanyWebsiteState(), "book-slot", { ...request, time: "08:00" });
  const noDeposit = mutateCompanyWebsiteState(createCompanyWebsiteState(), "book-slot", { ...request, payDeposit: false });
  const noPhone = mutateCompanyWebsiteState(createCompanyWebsiteState(), "book-slot", { ...request, phone: "" });
  for (const state of [full, noDeposit, noPhone]) assert.deepEqual({ bookings: state.bookings.length, refused: state.refusedBookings, deposits: state.deposits.count }, { bookings: 0, refused: 1, deposits: 0 });
  assert.match(get(booked, `booking/confirmed?ref=${BOOKING_RECORD.reference}`)?.body ?? "", /data-testid="booking-date">Monday 5 October 2026</u);
});

test("the team endpoint serves batches of eight and rate-limits a second request inside the window", () => {
  const first = get(createCompanyWebsiteState(), "team/people?branch=all&offset=0", 4519, 10_000);
  assert.equal(first?.status, 200);
  assert.equal(first?.headers?.["x-has-more"], "true");
  assert.equal((first?.body?.match(/<article/gu) ?? []).length, 8);
  const after = mutateCompanyWebsiteState(createCompanyWebsiteState(), first!.mutation!.operation, first!.mutation!.payload);
  const hurried = get(after, "team/people?branch=all&offset=8", 4519, 10_400);
  assert.deepEqual([hurried?.status, hurried?.headers?.["retry-after"], hurried?.mutation?.operation], [429, "2", "throttle-team-batch"]);
  const patient = get(after, "team/people?branch=all&offset=24", 4519, 11_000);
  assert.deepEqual([patient?.status, patient?.headers?.["x-has-more"], (patient?.body?.match(/<article/gu) ?? []).length], [200, "false", 4]);
  assert.equal((get(after, "team/people?branch=hollins-cross&offset=0", 4519, 20_000)?.body?.match(/<article/gu) ?? []).length, 8, "seven people and the advert");
});

test("the seed renames every class and generated id and changes nothing a person reads", () => {
  const state = createCompanyWebsiteState();
  for (const subpath of ["", "team", "services", "book"]) {
    const [a, b] = [4519, 90210].map((seed) => (subpath === "" ? render(state, context(seed)) : get(state, subpath, seed)?.body ?? ""));
    assert.notEqual(a, b, `${subpath || "home"} differs between seeds`);
    assert.equal(readable(a!), readable(b!), `${subpath || "home"} reads the same under both seeds`);
  }
  const home = render(state, context(4519));
  const markup = home.replace(/<script[\s\S]*?<\/script>/gu, "");
  const classes = new Set([...markup.matchAll(/class="([^"]+)"/gu)].flatMap((match) => (match[1] ?? "").split(" ")).filter(Boolean));
  assert.ok(classes.size > 30);
  for (const name of classes) assert.match(name, /^css-[a-z0-9]{7}$/u, `class ${name} reads as authored`);
  assert.equal((home.match(/\sdata-testid="/gu) ?? []).length, 2, "only the consent host and the analytics-tagged submit carry test ids");
});

test("the renderings the variants arm are the ones they describe", () => {
  const redesigned = render(mutateCompanyWebsiteState(createCompanyWebsiteState(), "set-mode", { mode: "redesigned-quote-submit" }), context(4519));
  assert.doesNotMatch(redesigned, /\sdata-testid="quote-submit"/u);
  assert.match(redesigned, />Get my free quote</u);
  assert.match(redesigned, />Save and finish later</u);
  const drafted = mutateCompanyWebsiteState(createCompanyWebsiteState("redesigned-quote-submit"), "save-quote-draft", {});
  assert.deepEqual({ drafts: drafted.drafts, quotes: drafted.quotes.length }, { drafts: 1, quotes: 0 });
  const winter = createCompanyWebsiteState("winter-notice");
  assert.match(render(winter, context(4519)), /\sdata-testid="winter-notice"/u);
  assert.match(get(winter, "team")?.body ?? "", /\sdata-testid="winter-notice"/u, "on every page until dismissed");
  assert.doesNotMatch(render(mutateCompanyWebsiteState(winter, "dismiss-notice", {}), context(4519)), /\sdata-testid="winter-notice"/u);
  const armedAfterUse = mutateCompanyWebsiteState(mutateCompanyWebsiteState(createCompanyWebsiteState(), "submit-quote", QUOTE), "set-mode", { mode: "winter-notice" });
  assert.deepEqual({ quotes: armedAfterUse.quotes.length, consent: armedAfterUse.consent }, { quotes: 0, consent: "pending" }, "arming starts a new visitor");
});

test("the scenario's tasks are in the shared catalogs, and each names a dataset or goal the manifest declares", () => {
  for (const task of COMPANY_WEBSITE_LIVE_TASKS) assert.ok(LIVE_INSTRUCTION_TASKS.some(({ id }) => id === task.id), task.id);
  for (const task of COMPANY_WEBSITE_REPAIR_TASKS) assert.ok(LIVE_REPAIR_TASKS.some(({ id }) => id === task.id), task.id);
  const kinds = COMPANY_WEBSITE_LIVE_TASKS.map(({ judgeBy, variantId, variantArmedAfterBuild }) => `${judgeBy}:${variantId ?? "-"}:${variantArmedAfterBuild ? "after" : "before"}`);
  assert.deepEqual(kinds, ["playback-goal:-:before", "playback-goal:redesigned-quote-submit:after", "expected-dataset:-:before", "expected-dataset:winter-notice:before", "expected-dataset:-:before", "expected-dataset:-:before"]);
  assert.match(COMPANY_WEBSITE_LIVE_TASKS.find(({ id }) => id === "company-website-book-service")?.instruction ?? "", /^Book /u);
  assert.doesNotMatch(COMPANY_WEBSITE_LIVE_TASKS.find(({ id }) => id === "company-website-book-service")?.instruction ?? "", /deposit|pay/iu, "nothing the person says allows money to move");
});
