import assert from "node:assert/strict";
import test from "node:test";
import { resolveScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { applicationReferences, closedJobsAccountFacts } from "../qualification/index.js";
import { EXPECTED_ANSWERS, EXPECTED_REFERENCE } from "../candidate.js";
import { jobBoardScenario as scenario } from "../scenario.js";
import type { JobBoardState } from "../types.js";

/**
 * The apply task's reference is printed on the employer's thank-you page alone. A hidden element carries the
 * references the applicant system holds on the board's pages and on the thank-you page, so the fact reads the same
 * wherever the run ends; and the careers list page carries the account element the careers task is judged by.
 */
const fresh = () => scenario.mutate(scenario.createState(246), "set-mode", { mode: "baseline" });
const send = (state: JobBoardState, changes: Record<string, unknown> = {}) =>
  scenario.mutate(state, "submit-application", { ...EXPECTED_ANSWERS, phoneCountry: "+44", phoneNumber: "07700 900418", resumeText: EXPECTED_ANSWERS.resume, ...changes });
const serve = (state: JobBoardState, subpath: string, query = "") => scenario.route?.(state, { subpath, query: new URLSearchParams(query), method: "GET" }, { runToken: "t", seed: 246, alternateOrigin: "http://127.0.0.1:9" });

test("apply-quillmark: the references element holds the one right reference, and wrong endings read differently", () => {
  const fact = resolveScenarioWorkflow(scenario.manifest, { workflowId: "apply-remote-rust-role" }).expected.finalState?.find(({ id }) => id === "application-reference");
  assert.equal(fact?.subject, "job-application-references");
  assert.equal(applicationReferences(send(fresh())), fact?.value);
  assert.equal(fact?.value, JSON.stringify([EXPECTED_REFERENCE]));
  assert.notEqual(applicationReferences(fresh()), fact?.value, "nothing sent");
  assert.notEqual(applicationReferences(send(send(fresh()))), fact?.value, "sent twice");
  assert.notEqual(applicationReferences(send(fresh(), { firstName: "Someone Else" })), fact?.value, "another answer gives another reference");
  assert.notEqual(applicationReferences(send(fresh(), { website: "https://example.test/spam" , honeypot: "x" })), fact?.value, "a dropped spam submission has no reference");
});

test("the element is on the board's pages and on the thank-you page, and the careers list carries the account", () => {
  const sent = send(fresh());
  const reference = `[${JSON.stringify(EXPECTED_REFERENCE)}]`;
  for (const [subpath, query] of [["jobs", "q=rust"], ["myjobs", ""], ["embed/confirmation", "app=app-1"]] as const) {
    const body = String(serve(sent, subpath, query)?.body ?? "");
    assert.ok(body.includes(`data-testid="job-application-references">${reference}</script>`), subpath);
  }
  const careers = String(serve(sent, "careers/halvard", "")?.body ?? "");
  assert.ok(careers.includes(`data-testid="job-closed-account">${closedJobsAccountFacts(sent)}</script>`));
  assert.ok(!careers.slice(0, careers.indexOf("<script")).includes("job-application-references"), "no element inside the visible markup");
});
