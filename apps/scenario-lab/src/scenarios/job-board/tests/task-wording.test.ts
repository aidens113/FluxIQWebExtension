import assert from "node:assert/strict";
import test from "node:test";
import { remoteEasyApplyExpected } from "../breadth/index.js";
import { parseSearchQuery, postedDateText, POSTINGS, searchPostings } from "../catalog/index.js";
import { APPLY_TARGET } from "../candidate.js";
import { remoteRustRecords, remoteRustRoles } from "../expectations.js";
import { JOB_BOARD_LIVE_TASKS } from "../live-tasks.js";

/*
 * The task audit of 2026-10-17: every task's instruction, read against the
 * site alone, must lead to exactly its oracle. These pin the wording the audit
 * fixed, against the catalog it is about.
 */

const instructionsFor = (datasetId: string) => JOB_BOARD_LIVE_TASKS.filter((task) => task.expectedDatasetId === datasetId).map((task) => task.instruction);

test("the apply instructions name one posting: Quillmark's full-time remote UK Senior Rust Engineer, not its contract namesake", () => {
  const quillmarkRemote = POSTINGS.filter((posting) => posting.company === "Quillmark" && posting.location === "Remote (UK)" && !posting.closed);
  // The contract role carries the same title with "(Contract)" after it, so title, company and place alone name two jobs.
  const sameTitle = quillmarkRemote.filter((posting) => posting.title.startsWith("Senior Rust Engineer"));
  assert.deepEqual(sameTitle.map(({ id }) => id).sort(), ["d12", "m1"]);
  const fullTime = sameTitle.filter((posting) => posting.jobType === "Full-time");
  assert.deepEqual(fullTime, [APPLY_TARGET]);
  const applying = instructionsFor("extract-application");
  assert.equal(applying.length, 2);
  for (const instruction of applying) assert.match(instruction, /the full-time Senior Rust Engineer job at Quillmark that is fully remote in the UK/u);
});

test("the quiet-market task has a positive record and explicit columns, formats and ordering", () => {
  assert.equal(remoteRustRecords("quiet-market").length, 1);
  const rows = JOB_BOARD_LIVE_TASKS.filter((task) => task.expectedDatasetId === "extract-remote-rust-roles");
  assert.equal(rows.length, 3);
  for (const task of rows) {
    assert.match(task.instruction, /columns title, company, salary and link/u);
    assert.match(task.instruction, /salary is written exactly/u);
    assert.match(task.instruction, /newest posting first/u);
    assert.doesNotMatch(task.instruction, /empty table/u);
  }
});

test("remote easy apply: two answers share a posting date, and the tiebreak the instruction names -- the results' own order -- gives the oracle's order", () => {
  const oracle = remoteEasyApplyExpected.extracted![0]!.records!.map(({ title, company }) => `${title} @ ${company}`);
  const answers = oracle.map((name) => POSTINGS.find((posting) => `${posting.title} @ ${posting.company}` === name)!);
  assert.ok(answers.every(Boolean), "an oracle row names no posting");
  // Pane dates and card ages alike: Trust & Safety (50 h) and Halvard Labs (52 h) both print 19 September 2026.
  const dates = answers.map((posting) => postedDateText(posting.postedHours));
  assert.ok(dates.length > new Set(dates).size, "no two answers share a posting date, so the tiebreak clause is not needed");
  // Every pair of answers sharing a date: the oracle puts them in the order the results list them, under either sort.
  const tied = answers.flatMap((first, at) => answers.slice(at + 1).filter((second) => postedDateText(second.postedHours) === postedDateText(first.postedHours)).map((second) => [first, second] as const));
  assert.ok(tied.some(([first, second]) => first.id === "d4" && second.id === "hl1"), "the Trust & Safety and Halvard Labs tie is not among the tied pairs");
  for (const sort of ["relevance", "date"] as const) {
    for (const freshLive of [false, true]) {
      const query = parseSearchQuery(new URLSearchParams({ wp: "remote", sort, limit: "50" }));
      const listed = searchPostings("baseline", query, freshLive);
      assert.ok(answers.every((posting) => listed.includes(posting)), `${sort}: an answer is not listed`);
      for (const [first, second] of tied) assert.ok(listed.indexOf(first) < listed.indexOf(second), `${sort}${freshLive ? " (fresh live)" : ""}: ${second.id} is listed before ${first.id}`);
    }
  }
  const [task] = JOB_BOARD_LIVE_TASKS.filter((candidate) => candidate.expectedDatasetId === "extract-remote-easy-apply");
  assert.match(task!.instruction, /newest posting first, and where two postings show the same posting date, in the order Rolefinch's results list them\./u);
});

test("the remote Rust roles' newest-first order is decided by the dates the postings show", () => {
  const dates = remoteRustRoles("baseline").map((posting) => postedDateText(posting.postedHours));
  assert.equal(new Set(dates).size, dates.length, `two roles share a posting date: ${dates.join(", ")}`);
});
