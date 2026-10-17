import assert from "node:assert/strict";
import test from "node:test";
import { savedPostings, viewJobHref } from "../../board/index.js";
import { POSTINGS, postingById } from "../../catalog/index.js";
import { JOB_BOARD_LIVE_TASKS } from "../../live-tasks.js";
import { closedJobsAccountFacts } from "../../qualification/index.js";
import { jobBoardScenario as scenario } from "../../scenario.js";
import { createJobBoardState } from "../../state.js";
import type { JobBoardState } from "../../types.js";
import {
  halvardCareersRolesExpected, halvardCareersRolesWorkflow, halvardLabsOfficeJobsExpected, halvardLabsOfficeJobsWorkflow,
  remoteEasyApplyExpected, remoteEasyApplyWorkflow, saveQuillmarkRemoteExpected, saveQuillmarkRemoteWorkflow, UNCHANGED_ACCOUNT,
} from "../index.js";

/*
 * The breadth oracles are literals. Each is checked here against the catalog
 * it describes, and against the page the board actually serves, so a literal
 * that drifted from the fixture fails before any live run is spent on it.
 */

const context = { runToken: "job-board-breadth-token", seed: 246, alternateOrigin: "http://127.0.0.1:9" };
const records = (expected: typeof remoteEasyApplyExpected) => expected.extracted![0]!.records!;
const finalFact = (expected: typeof remoteEasyApplyExpected) => String(expected.finalState![0]!.value);
const save = (state: JobBoardState, ...ids: string[]) => ids.reduce((next, id) => scenario.mutate(next, "save", { key: postingById(id).key }), state);

function serve(state: JobBoardState, subpath: string, query = "") {
  const response = scenario.route!(state, { subpath, query: new URLSearchParams(query), method: "GET" }, context);
  assert.ok(response, `${subpath}?${query} answered 404`);
  return { body: response.body ?? "", state: response.mutation ? scenario.mutate(state, response.mutation.operation, response.mutation.payload) : state };
}

/** Organic cards on a served results page, in page order, as a reader sees them. */
function organicCards(html: string) {
  const markup = html.slice(0, html.indexOf("<script"));
  return [...markup.matchAll(/<article [^>]*?data-jk="([0-9a-f]{16})"[\s\S]*?<\/article>/gu)].map((match) => {
    const card = match[0];
    const [, href, title] = /<h2[^>]*><a href="([^"]+)"[^>]*>([^<]*)<\/a>/u.exec(card)!;
    const [, company, location, salary] = /<\/h2><span[\s\S]*?<\/span><\/div><div class="[^"]+"><span>([^<]*)<\/span><span>([^<]*)<\/span><\/div><div class="[^"]+">([^<]*)<\/div>/u.exec(card)!;
    const unescape = (text: string) => text.replaceAll("&amp;", "&");
    return { key: match[1]!, href: href!, title: unescape(title!), company: unescape(company!), location: unescape(location!), salary: unescape(salary!), easy: card.includes("Easily apply") };
  });
}

test("the unchanged account literal is the account the person arrives with", () => {
  assert.equal(closedJobsAccountFacts(createJobBoardState()), UNCHANGED_ACCOUNT);
  for (const expected of [remoteEasyApplyExpected, saveQuillmarkRemoteExpected, halvardLabsOfficeJobsExpected, halvardCareersRolesExpected]) {
    assert.equal(expected.pageFacts![0]!.value, UNCHANGED_ACCOUNT);
  }
});

test("remote easy apply: the records are the catalog's open remote UK quick-apply jobs with a salary, and the served page holds them in that order", () => {
  const derived = POSTINGS.filter((posting) => posting.location === "Remote (UK)" && posting.apply.kind === "easy" && !posting.closed && posting.salary.text !== "")
    .sort((a, b) => a.postedHours - b.postedHours)
    .map(({ title, company, salary }) => ({ title, company, salary: salary.text }));
  assert.deepEqual(records(remoteEasyApplyExpected), derived);
  const all = organicCards(serve(createJobBoardState(), "jobs", "wp=remote&sort=date&limit=50").body);
  assert.equal(all.length, 28);
  const read = all.filter((card) => card.easy && card.salary !== "").map(({ title, company, salary }) => ({ title, company, salary }));
  assert.deepEqual(read, records(remoteEasyApplyExpected));
  // Wrong paths: every quick-apply card, salary or not; or the first page of ten only.
  assert.notDeepEqual(all.filter((card) => card.easy).map(({ title, company, salary }) => ({ title, company, salary })), records(remoteEasyApplyExpected));
  const firstPage = organicCards(serve(createJobBoardState(), "jobs", "wp=remote&sort=date").body).filter((card) => card.easy && card.salary !== "");
  assert.ok(firstPage.length < records(remoteEasyApplyExpected).length, "page one alone already holds the answer");
  assert.equal(finalFact(remoteEasyApplyExpected), UNCHANGED_ACCOUNT);
});

test("save Quillmark remote: the account literal holds after the three saves in any order, and not after a lookalike save", () => {
  const forward = save(createJobBoardState(), "m1", "d12", "g5");
  const backward = save(createJobBoardState(), "g5", "d12", "m1");
  assert.deepEqual(POSTINGS.filter((posting) => posting.company === "Quillmark" && posting.location === "Remote (UK)" && !posting.closed).map(({ id }) => id), ["m1", "d12", "g5"]);
  assert.equal(closedJobsAccountFacts(forward), finalFact(saveQuillmarkRemoteExpected));
  assert.equal(closedJobsAccountFacts(backward), finalFact(saveQuillmarkRemoteExpected));
  assert.notEqual(closedJobsAccountFacts(save(forward, "d15")), finalFact(saveQuillmarkRemoteExpected), "Quillmark Labs counted as Quillmark");
  assert.notEqual(closedJobsAccountFacts(save(forward, "h1")), finalFact(saveQuillmarkRemoteExpected), "the hybrid London role counted as remote");
  assert.notEqual(closedJobsAccountFacts(scenario.mutate(forward, "unsave", { key: postingById("hv2").key })), finalFact(saveQuillmarkRemoteExpected), "a saved job was lost");
  assert.deepEqual(records(saveQuillmarkRemoteExpected), savedPostings(forward).map(({ title, company, location }) => ({ title, company, location })));
});

test("Halvard Labs office jobs: none exist, the board answers with lookalike recommendations, and saving one changes the account", () => {
  const labs = POSTINGS.filter((posting) => posting.company === "Halvard Labs");
  assert.ok(labs.length > 0 && labs.every((posting) => posting.workplace === "remote"));
  assert.deepEqual(records(halvardLabsOfficeJobsExpected), []);
  for (const wp of ["hybrid", "onsite"]) {
    const { body } = serve(createJobBoardState(), "jobs", `q=Halvard+Labs&wp=${wp}`);
    assert.match(body, /No jobs found for Halvard Labs jobs/u);
    const recommended = organicCards(body);
    assert.ok(recommended.some((card) => card.company === "Halvard Labs"), `${wp}: the Halvard Labs job is not among the recommendations`);
    assert.ok(recommended.length >= 3, `${wp}: the recommendations trap is not armed`);
  }
  assert.equal(finalFact(halvardLabsOfficeJobsExpected), UNCHANGED_ACCOUNT);
  assert.notEqual(closedJobsAccountFacts(save(createJobBoardState(), "hl1")), UNCHANGED_ACCOUNT);
  assert.notEqual(closedJobsAccountFacts(save(createJobBoardState(), "hv1")), UNCHANGED_ACCOUNT);
});

test("Halvard careers roles: the records are the careers site's own list, and a read off Rolefinch's search is not", () => {
  const body = serve(createJobBoardState(), "careers/halvard").body;
  const listed = [...body.matchAll(/<li><a href="([^"]+)">([^<]*)<\/a> <span>([^<]*)<\/span><\/li>/gu)].map(([, link, title, location]) => ({ title, location, link }));
  assert.deepEqual(listed, records(halvardCareersRolesExpected));
  const search = serve(createJobBoardState(), "jobs", "q=Halvard+Systems&limit=50").body;
  const board = organicCards(search).map((card) => ({ title: card.title, location: card.location, link: card.href }));
  assert.notDeepEqual(board, records(halvardCareersRolesExpected));
  assert.ok(board.every((record) => record.link.startsWith(viewJobHref(postingById("hv1")).split("?")[0]!)));
  // The search the journey starts from finds the one job it names.
  assert.deepEqual(organicCards(serve(createJobBoardState(), "jobs", "q=Site+Reliability+Engineer&l=Leeds").body).map(({ key }) => key), [postingById("hv1").key]);
  assert.equal(finalFact(halvardCareersRolesExpected), UNCHANGED_ACCOUNT);
});

test("each breadth task is registered, asks nothing, names every column, and owns the workflow its dataset step is in", () => {
  const pairs = [
    ["job-board-remote-easy-apply", remoteEasyApplyWorkflow],
    ["job-board-save-quillmark-remote", saveQuillmarkRemoteWorkflow],
    ["job-board-halvard-labs-office-jobs", halvardLabsOfficeJobsWorkflow],
    ["job-board-halvard-careers-roles", halvardCareersRolesWorkflow],
  ] as const;
  for (const [id, workflow] of pairs) {
    const task = JOB_BOARD_LIVE_TASKS.find((candidate) => candidate.id === id);
    assert.ok(task, id);
    assert.equal(task.permissionPoint, undefined, id);
    assert.equal(task.variantId, undefined, id);
    const step = workflow.expected.extracted![0]!.step;
    assert.equal(task.expectedDatasetId, step, id);
    const extract = workflow.recordingScript.find((candidate) => candidate.id === step);
    assert.equal(extract?.operation, "extract", id);
    for (const column of Object.keys(extract!.fields ?? {})) assert.match(task.instruction, new RegExp(`\\b${column}\\b`, "u"), `${id}: ${column} is not named`);
  }
});
