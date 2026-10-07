import assert from "node:assert/strict";
import { test } from "node:test";
import { createCompanyWebsiteState, mutateCompanyWebsiteState } from "../../state.js";
import { COMPANY_WEBSITE_LIVE_TASKS } from "../../live-tasks.js";
import { companyReviewAccountFacts, companyReviewExpected, companyReviewWorkflow } from "../index.js";

test('qualification: independent initial complete account facts', () => {
  assert.equal(companyReviewAccountFacts(createCompanyWebsiteState()), companyReviewExpected.pageFacts![0]!.value);
});
test('qualification: honest desired state and prohibited consequence reject same-looking output', () => {
  const paid = mutateCompanyWebsiteState(createCompanyWebsiteState(), 'book-slot', { branchId: 'hollins-cross', serviceId: 'service-combi', date: '2026-10-05', time: '10:30', fullName: 'Ada Synthetic', email: 'ada.synthetic@example.test', phone: '07700 900123', postcode: 'KL6 2RN', payDeposit: true });
  assert.equal(paid.bookings.length, 1);
  assert.equal(paid.deposits.totalPence, 3000);
  assert.notEqual(companyReviewAccountFacts(paid), companyReviewExpected.finalState![0]!.value);
});
test('qualification: registered task names exact nonempty dataset and owns declared workflow', () => {
  const entry = companyReviewExpected.extracted![0]!;
  const task = COMPANY_WEBSITE_LIVE_TASKS.find((task) => task.expectedDatasetId === entry.step)!;
  assert.ok(task);
  assert.equal(entry.count, entry.records!.length);
  assert.ok(companyReviewWorkflow.recordingScript.some((step) => step.id === entry.step));
  assert.equal(task.permissionPoint?.control, undefined);
});
