import assert from "node:assert/strict";
import test from "node:test";
import { resolveScenarioWorkflow, type ExpectedFact } from "@fluxiq-web-extension/test-contracts";
import { slotsFor, weekday } from "../data/index.js";
import { BOOKING_INPUT, QUOTE_INPUT } from "../expectations.js";
import { companyWebsiteManifest as manifest } from "../manifest.js";
import { companyBookingRecord, companyQuoteDetails, companyQuoteRecord, companyReviewAccountFacts } from "../qualification/index.js";
import { routeCompanyWebsite } from "../route.js";
import { createCompanyWebsiteState, mutateCompanyWebsiteState } from "../state.js";

/**
 * Final facts that were readable on one page only (the quote confirmation, the booking confirmation, the document
 * path) now read hidden elements every page carries. The honest ending satisfies them; a wrong one does not.
 */
const fresh = () => createCompanyWebsiteState();
const finalOf = (workflowId?: string) => resolveScenarioWorkflow(manifest, workflowId === undefined ? {} : { workflowId }).expected.finalState ?? [];
const valueOf = (facts: readonly ExpectedFact[], subject: string) => facts.find((fact) => fact.subject === subject)?.value;
const quote = (changes: Record<string, unknown> = {}) => mutateCompanyWebsiteState(fresh(), "submit-quote", { ...QUOTE_INPUT, privacy: true, verified: true, ...changes });
const weekdayMornings = (after: string) => slotsFor(BOOKING_INPUT.branchId).filter(({ date, time, free }) => free && date >= after && weekday(date) >= 1 && weekday(date) <= 5 && time < "12:00");
const SLOT = weekdayMornings(BOOKING_INPUT.onOrAfter)[0]!;
const book = (changes: Record<string, unknown> = {}) => mutateCompanyWebsiteState(fresh(), "book-slot", {
  branchId: BOOKING_INPUT.branchId, serviceId: BOOKING_INPUT.serviceId, date: SLOT.date, time: SLOT.time,
  fullName: "Ada Synthetic", email: QUOTE_INPUT.email, phone: QUOTE_INPUT.phone, postcode: QUOTE_INPUT.postcode, payDeposit: true, ...changes,
});

test("quote-request: the quote record and details hold the right request, and wrong requests read differently", () => {
  const record = valueOf(manifest.playbackGoal!.successFacts, "company-quote-record");
  assert.equal(companyQuoteRecord(quote()), record);
  assert.ok(companyQuoteDetails(quote()).includes("2009"));
  assert.ok(finalOf().some(({ id }) => id === "one-quote-kept"));
  assert.notEqual(companyQuoteRecord(fresh()), record, "no request");
  for (const [name, changes] of Object.entries({
    "another service": { service: "Boiler service" }, "phone contact": { contactBy: "Phone" }, "marketing ticked": { marketing: true }, "another postcode": { postcode: "KL1 1AA" },
  })) assert.notEqual(companyQuoteRecord(quote(changes)), record, name);
  assert.ok(!companyQuoteDetails(quote({ details: "A new boiler please." })).includes("2009"), "no mention of the 2009 boiler");
});

test("read-only tasks: the final state is the untouched account, which any quote or booking changes", () => {
  const untouched = companyReviewAccountFacts(fresh());
  for (const [workflowId, id] of [["gas-engineers", "team-read-changes-nothing"], ["business-prices", "prices-read-changes-nothing"]] as const) {
    const fact = finalOf(workflowId).find((entry) => entry.id === id);
    assert.equal(fact?.subject, "company-review-account");
    assert.equal(fact?.value, untouched);
  }
  assert.notEqual(companyReviewAccountFacts(quote()), untouched);
  assert.notEqual(companyReviewAccountFacts(book()), untouched);
});

test("book-service: the booking record holds the right visit and deposit, and wrong bookings read differently", () => {
  const facts = finalOf("book-service");
  const record = valueOf(facts, "company-booking-record");
  const booked = book();
  assert.equal(booked.bookings.length, 1, "the fixture takes the booking");
  assert.equal(companyBookingRecord(booked), record);
  assert.equal(valueOf(facts, "company-review-account"), companyReviewAccountFacts(booked));
  assert.notEqual(companyBookingRecord(fresh()), record, "nothing booked");
  const later = weekdayMornings(SLOT.date).find((slot) => slot.date > SLOT.date)!;
  assert.notEqual(companyBookingRecord(book({ date: later.date, time: later.time })), record, "another slot");
  assert.notEqual(companyBookingRecord(book({ serviceId: "cp12" })), record, "another service");
  assert.notEqual(companyBookingRecord(book({ branchId: "eastmoor" })), record, "another branch");
});

test("every page carries the records in hidden elements, outside the visible markup", () => {
  const response = routeCompanyWebsite(quote(), { subpath: "team", query: new URLSearchParams(), method: "GET" }, { runToken: "t", seed: manifest.seed, alternateOrigin: "http://127.0.0.1:9" });
  const html = String(response?.body ?? "");
  for (const testId of ["company-quote-record", "company-quote-details", "company-booking-record"]) assert.match(html, new RegExp(`<script type="application/json" data-testid="${testId}">`, "u"), testId);
  assert.ok(!html.slice(0, html.indexOf("<script")).includes("company-quote"), "no element in the visible markup");
});
