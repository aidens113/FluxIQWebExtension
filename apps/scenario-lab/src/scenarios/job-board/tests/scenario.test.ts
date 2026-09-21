import assert from "node:assert/strict";
import test from "node:test";
import { resolveScenarioWorkflow, validateWebScenario } from "@fluxiq-web-extension/test-contracts";
import { applicationReference, normaliseApplication, suggestPlaces } from "../ats/index.js";
import { boardClasses } from "../board/index.js";
import { POSTINGS, postingById } from "../catalog/index.js";
import { APPLICATION_RECORD, EXPECTED_ANSWERS, EXPECTED_REFERENCE } from "../candidate.js";
import { halvardWeek, remoteRustRecords, shortlistFacts } from "../expectations.js";
import { JOB_BOARD_LIVE_TASKS } from "../live-tasks.js";
import { jobBoardScenario as scenario } from "../scenario.js";
import type { JobBoardMode, JobBoardState } from "../types.js";

const ORACLE_TEST_IDS = new Set(["saved-summary", "saved-list", "posting-status", "application-reference"]);
const context = (seed = 246) => ({ runToken: "job-board-unit-token", seed, alternateOrigin: "http://127.0.0.1:9" });
const fresh = (mode: JobBoardMode = "baseline") => scenario.mutate(scenario.createState(246), "set-mode", { mode });

/** One GET the way the server serves it: the response, then the state after the route's own mutation. */
function serve(state: JobBoardState, subpath: string, query = "", seed = 246) {
  const response = scenario.route!(state, { subpath, query: new URLSearchParams(query), method: "GET" }, context(seed));
  assert.ok(response, `${subpath}?${query} answered 404`);
  const next = response.mutation ? scenario.mutate(state, response.mutation.operation, response.mutation.payload) : state;
  return { response, body: response.body ?? "", state: next };
}

type Card = { key: string | null; ad: string | null; href: string; title: string; company: string; location: string; salary: string };

/** The cards on a rendered page, as a reader sees them. */
function cardsOf(html: string): Card[] {
  const markup = html.slice(0, html.indexOf("<script"));
  return [...markup.matchAll(/<article [^>]*?(?:data-jk="([0-9a-f]{16})"|data-ad="([0-9a-f]{16})")[\s\S]*?<\/article>/gu)].map((match) => {
    const card = match[0];
    const title = /<h2[^>]*><a href="([^"]+)"[^>]*>([^<]*)<\/a>/u.exec(card)!;
    const company = /<\/h2><span[\s\S]*?<\/span><\/div><div class="[^"]+"><span>([^<]*)<\/span><span>([^<]*)<\/span><\/div><div class="[^"]+">([^<]*)<\/div>/u.exec(card)!;
    return { key: match[1] ?? null, ad: match[2] ?? null, href: unescape(title[1]!), title: unescape(title[2]!), company: unescape(company[1]!), location: unescape(company[2]!), salary: unescape(company[3]!) };
  });
}
const unescape = (text: string) => text.replaceAll("&amp;", "&").replaceAll("&quot;", "\"").replaceAll("&#039;", "'").replaceAll("&lt;", "<").replaceAll("&gt;", ">");

/** A careful reader's floor for a salary line: pounds a year, or nothing when the line gives no yearly floor in pounds. */
function yearlyFloor(line: string): number | null {
  if (!line.startsWith("£") && !line.startsWith("From £")) return null;
  if (!/(a year|per annum)$/u.test(line)) return null;
  const first = /£([\d,.]+)(k?)/u.exec(line);
  if (!first) return null;
  return Number(first[1]!.replaceAll(",", "")) * (first[2] ? 1000 : 1);
}

/** What a person reading cards would keep: Rust in the title, remote in the UK, a yearly floor of at least £70,000. */
function qualifies(card: Card): boolean {
  const floor = yearlyFloor(card.salary);
  return /\bRust\b/u.test(card.title) && card.location === "Remote (UK)" && floor !== null && floor >= 70_000;
}
const asRecord = (card: Card) => ({ title: card.title, company: card.company, salary: card.salary, link: card.href });

test("the manifest is valid, with three workflows each carrying one armed variant", () => {
  const result = validateWebScenario(scenario.manifest);
  assert.equal(result.valid, true, result.valid ? "" : JSON.stringify(result.issues));
  assert.deepEqual(scenario.manifest.workflows?.map(({ id }) => id), ["remote-rust-roles", "apply-remote-rust-role"]);
  assert.deepEqual([scenario.manifest, ...(scenario.manifest.workflows ?? [])].map((workflow) => (workflow.variants ?? []).map(({ id, arm }) => [id, arm])), [
    [["overflow-save", { operation: "set-mode", payload: { mode: "overflow-save" } }]],
    [["no-exact-matches", { operation: "set-mode", payload: { mode: "quiet-market" } }]],
    [["posting-closed", { operation: "set-mode", payload: { mode: "posting-closed" } }]],
  ]);
  const closed = resolveScenarioWorkflow(scenario.manifest, { workflowId: "apply-remote-rust-role", variantId: "posting-closed" });
  assert.deepEqual(closed.expected.failure, { category: "target_not_found" });
});

test("the extraction oracle is the seven remote UK Rust roles paying £70,000 or more, newest first, and nothing in a quiet market", () => {
  assert.deepEqual(remoteRustRecords("baseline").map(({ title, company }) => `${title} @ ${company}`), [
    "Senior Rust Engineer @ Quillmark",
    "Rust Engineer, Settlement Systems @ Copperline Payments",
    "Backend Engineer – Rust @ Halvard Systems",
    "Staff Rust Engineer @ Parsec Grid",
    "Rust Developer (Embedded) @ Tidewell Energy",
    "Principal Engineer (Rust, Distributed Systems) @ Orbisat",
    "Rust Platform Engineer @ Verity Legal Tech",
  ]);
  assert.deepEqual(remoteRustRecords("quiet-market"), []);
  // The traps a careless reading falls into are all on the board.
  const traps = ["£650 – £750 a day", "Up to £95,000 a year", "£69,500 – £90,000 a year", "€85.000 – €100.000 a year", "$150,000 – $175,000 a year"];
  for (const line of traps) assert.ok(POSTINGS.some((posting) => posting.salary.text === line && /Rust/u.test(posting.title)), line);
  assert.ok(POSTINGS.some((posting) => posting.title === "Trust & Safety Engineer" && posting.location === "Remote (UK)"));
});

test("paging a natural search shows page one's last result again at the top of page two, and it is one of the seven", () => {
  const wanted = new Set(remoteRustRecords("baseline").map(({ link }) => link));
  for (const sort of ["relevance", "date"]) {
    const first = serve(fresh(), "jobs", `q=rust&wp=remote&sort=${sort}`);
    const second = serve(first.state, "jobs", `q=rust&wp=remote&sort=${sort}&page=2`);
    const pageOne = cardsOf(first.body).filter((card) => card.key);
    const pageTwo = cardsOf(second.body).filter((card) => card.key);
    assert.equal(pageOne.length, 10, sort);
    assert.equal(pageTwo[0]!.key, pageOne[9]!.key, `${sort}: the fresh posting did not shift the list`);
    assert.ok(wanted.has(pageTwo[0]!.href), `${sort}: the repeated result is not one of the seven`);
    assert.ok(cardsOf(second.body).every((card) => card.title !== "Rust Engineer (Developer Tooling)" || sort === "relevance"), `${sort}: the fresh posting sits on page two`);
  }
});

test("a person who reads every page by its number, skips repeats and sponsored cards, and reads each salary gets exactly the oracle", () => {
  let state = fresh();
  const seen = new Map<string, Card>();
  for (let page = 1; page <= 3; page += 1) {
    const served = serve(state, "jobs", `q=rust&wp=remote&sort=date&page=${page}`);
    state = served.state;
    for (const card of cardsOf(served.body)) if (card.key && !seen.has(card.key)) seen.set(card.key, card);
  }
  assert.deepEqual([...seen.values()].filter(qualifies).map(asRecord), remoteRustRecords("baseline"));
});

test("reading every card as a result -- sponsored, repeated and all -- does not match the oracle", () => {
  let state = fresh();
  const naive: Card[] = [];
  for (let page = 1; page <= 3; page += 1) {
    const served = serve(state, "jobs", `q=rust&wp=remote&sort=date&page=${page}`);
    state = served.state;
    naive.push(...cardsOf(served.body).filter(qualifies));
  }
  assert.notDeepEqual(naive.map(asRecord), remoteRustRecords("baseline"));
  assert.ok(naive.some((card) => card.ad !== null), "no sponsored card qualified, so the trap is not armed");
  assert.ok(naive.length > remoteRustRecords("baseline").length, "no repeated result reached the naive table");
});

test("the board's own salary filter matches a range's top, so it is not the task's criterion", () => {
  const filtered = cardsOf(serve(fresh(), "jobs", "q=rust&wp=remote&sal=70000&limit=50").body).filter((card) => card.key);
  const titles = filtered.map((card) => `${card.title} @ ${card.company}`);
  assert.ok(titles.includes("Rust Engineer @ Kestrel & Vane"), "the £69,500 floor is filtered out");
  assert.ok(titles.includes("Senior Rust Engineer @ Marlowe Freight"), "the ceiling-only line is filtered out");
});

test("at fifty per page every match is on one page, and the sponsored copy carries an ad id, not the job key", () => {
  const { body } = serve(fresh(), "jobs", "q=rust&wp=remote&sort=date&limit=50");
  const cards = cardsOf(body);
  assert.deepEqual(cards.filter((card) => card.key && qualifies(card)).map(asRecord), remoteRustRecords("baseline"));
  const quillmark = postingById("m1");
  assert.equal(cards.filter((card) => card.title === quillmark.title && card.company === quillmark.company && card.location === quillmark.location).length, 2);
  assert.equal(cards.filter((card) => card.key === quillmark.key).length, 1);
});

test("past page one the pager's Next points at the page it is on", () => {
  const first = serve(fresh(), "jobs", "q=rust&wp=remote");
  assert.match(first.body, /href="[^"]*page=2">Next</u);
  const second = serve(first.state, "jobs", "q=rust&wp=remote&page=2");
  assert.match(second.body, /href="[^"]*page=2">Next</u);
  assert.match(second.body, /href="[^"]*page=3">3</u);
});

test("every sixth results page is refused with a retry-after, and the next one is served", () => {
  let state = fresh();
  const statuses: number[] = [];
  for (let view = 0; view < 7; view += 1) {
    const served = serve(state, "jobs", "q=designer");
    statuses.push(served.response.status);
    state = served.state;
    if (served.response.status === 429) assert.equal(served.response.headers?.["retry-after"], "5");
  }
  assert.deepEqual(statuses, [200, 200, 200, 200, 200, 429, 200]);
});

test("from the fourth job pane opened, the pane carries the sign-in wall until it is dismissed", () => {
  let state = fresh();
  const walls: boolean[] = [];
  for (let view = 0; view < 5; view += 1) {
    const served = serve(state, "pane", `jk=${postingById("m1").key}`);
    walls.push(served.body.includes("See more jobs with a free account"));
    state = served.state;
  }
  assert.deepEqual(walls, [false, false, false, true, true]);
  state = scenario.mutate(state, "dismiss-wall", {});
  assert.equal(serve(state, "pane", `jk=${postingById("m1").key}`).body.includes("See more jobs with a free account"), false);
});

test("the shortlist oracle holds only when every one of the week's Halvard Systems jobs is saved and nothing already saved is lost", () => {
  const facts = (state: JobBoardState) => {
    const body = serve(state, "myjobs").body;
    return {
      summary: /data-testid="saved-summary">([^<]*)</u.exec(body)![1],
      list: unescape(/data-testid="saved-list">([\s\S]*?)<\/ol>/u.exec(body)![1]!.replaceAll(/<[^>]*>/gu, "")),
    };
  };
  const [summary, list] = shortlistFacts("baseline");
  assert.deepEqual(halvardWeek().map(({ id }) => id), ["m5", "hv1", "hv2", "h2"]);
  const done = halvardWeek().reduce((state, posting) => scenario.mutate(state, "save", { key: posting.key }), fresh());
  assert.deepEqual(facts(done), { summary: summary!.value, list: list!.value });
  // Pressing the already-filled heart of the job saved last week unsaves it.
  assert.notDeepEqual(facts(scenario.mutate(done, "unsave", { key: postingById("hv2").key })).list, list!.value);
  // Halvard Labs is not Halvard Systems.
  assert.notEqual(facts(scenario.mutate(done, "save", { key: postingById("hl1").key })).summary, summary!.value);
  // Following the company, which is what the redesigned heart does, saves nothing.
  const followed = scenario.mutate(fresh("overflow-save"), "follow", { company: "Halvard Systems" });
  assert.deepEqual(followed.saved, fresh("overflow-save").saved);
  assert.equal(scenario.mutate(fresh(), "save", { key: postingById("px").key }).saved.length, 2, "a closed posting was saved");
});

test("an application made exactly as instructed gets the expected reference however its answers were typed, and any other answer does not", () => {
  const base = {
    jobKey: EXPECTED_ANSWERS.jobKey, firstName: " Morgan ", lastName: "Ellery", email: "Morgan.Ellery@Example.net", phoneCountry: "+44", phoneNumber: "07700 900418",
    placeId: "bristol-england-gb", resumeText: `  ${EXPECTED_ANSWERS.resume}\n`, resumeFile: "", website: "https://morganellery.example.net/", rightToWork: "yes",
    sponsorship: "no", notice: "1-month", salary: "88000", source: "rolefinch", talentPool: false, privacy: true, confirmEmail: "",
  };
  const reference = (payload: Record<string, unknown>) => { const normalised = normaliseApplication(payload); return normalised ? applicationReference(normalised.answers) : null; };
  assert.equal(reference(base), EXPECTED_REFERENCE);
  assert.equal(reference({ ...base, phoneCountry: "+1", phoneNumber: "+44 7700 900418" }), EXPECTED_REFERENCE);
  assert.equal(reference({ ...base, phoneNumber: "7700900418" }), EXPECTED_REFERENCE);
  for (const [field, value] of [["phoneCountry", "+1"], ["placeId", "bristol-ct-us"], ["talentPool", true], ["notice", "2-months"], ["source", "other-job-board"], ["salary", "85000"], ["rightToWork", "no"]] as const) {
    const other = reference({ ...base, [field]: value });
    assert.ok(other !== null && other !== EXPECTED_REFERENCE, `${field} = ${String(value)} kept the expected reference`);
  }
  assert.equal(reference({ ...base, salary: "£88,000" }), null, "a salary with symbols was accepted");
  assert.equal(reference({ ...base, privacy: false }), null, "the privacy notice was not required");
  assert.deepEqual(APPLICATION_RECORD, { role: "Senior Rust Engineer", company: "Quillmark", reference: EXPECTED_REFERENCE });
});

test("a filled honeypot is accepted and thanked, with no reference; a genuine application is given its reference", () => {
  const payload = { ...EXPECTED_ANSWERS, phoneCountry: "+44", phoneNumber: "07700 900418", resumeText: EXPECTED_ANSWERS.resume, confirmEmail: "" };
  const genuine = scenario.mutate(fresh(), "submit-application", payload);
  const spam = scenario.mutate(fresh(), "submit-application", { ...payload, confirmEmail: EXPECTED_ANSWERS.email });
  assert.equal(genuine.applications[0]?.reference, EXPECTED_REFERENCE);
  assert.equal(spam.applications[0]?.flagged, true);
  assert.equal(spam.applications[0]?.reference, null);
  assert.match(serve(genuine, "embed/confirmation", "app=app-1").body, new RegExp(`data-testid="application-reference">${EXPECTED_REFERENCE}<`, "u"));
  const thanked = serve(spam, "embed/confirmation", "app=app-1").body;
  assert.match(thanked, /Thank you for applying, Morgan!/u);
  assert.doesNotMatch(thanked, /application-reference/u);
});

test("the filled posting takes no applications, its pane says so, and its careers page lists the roles still open", () => {
  const state = fresh("posting-closed");
  const payload = { ...EXPECTED_ANSWERS, phoneCountry: "+44", phoneNumber: "07700 900418", resumeText: EXPECTED_ANSWERS.resume, confirmEmail: "" };
  assert.deepEqual(scenario.mutate(state, "submit-application", payload).applications, []);
  const pane = serve(state, "pane", `jk=${postingById("m1").key}`).body;
  assert.match(pane, /data-testid="posting-status">No longer accepting applications</u);
  assert.doesNotMatch(pane, /Apply on company site/u);
  for (const id of ["d12", "h1", "d15"]) assert.ok(pane.includes(postingById(id).key), `similar job ${id} missing`);
  assert.match(serve(state, "careers/quillmark/jobs/QM-4471").body, /This position has been filled/u);
  assert.match(serve(state, "embed/job_app", "for=quillmark&token=QM-4471").body, /no longer accepting applications/u);
});

test("the only test ids anywhere on the site are the four oracle read-outs", () => {
  const closed = fresh("posting-closed");
  const genuine = scenario.mutate(fresh(), "submit-application", { ...EXPECTED_ANSWERS, phoneCountry: "+44", phoneNumber: "07700 900418", resumeText: EXPECTED_ANSWERS.resume });
  const pages = [
    scenario.render(fresh(), context()),
    serve(fresh(), "jobs", "q=rust").body,
    serve(fresh(), "pane", `jk=${postingById("m1").key}`).body,
    serve(closed, "pane", `jk=${postingById("m1").key}`).body,
    serve(fresh(), "viewjob", `jk=${postingById("m5").key}`).body,
    serve(fresh(), "myjobs").body,
    serve(fresh(), "careers/quillmark/jobs/QM-4471").body,
    serve(fresh(), "embed/job_app", "for=quillmark&token=QM-4471").body,
    serve(genuine, "embed/confirmation", "app=app-1").body,
  ];
  const ids = new Set(pages.flatMap((html) => [...html.matchAll(/data-testid="([^"]+)"/gu)].map((match) => match[1]!)));
  assert.deepEqual([...ids].filter((id) => !ORACLE_TEST_IDS.has(id)), []);
  for (const html of pages) assert.doesNotMatch(html, /aria-label="(?:Save|Follow|Minimi|Close|More)/iu);
});

test("class names and generated ids move with the seed; job keys, text and oracles do not, and the manifest names no class", () => {
  const one = serve(fresh(), "jobs", "q=rust", 1).body;
  const two = serve(fresh(), "jobs", "q=rust", 2).body;
  const classes = (html: string) => new Set([...html.slice(0, html.indexOf("<script")).matchAll(/class="([^"]+)"/gu)].flatMap((match) => match[1]!.split(" ")));
  const shared = [...classes(one)].filter((name) => classes(two).has(name));
  assert.deepEqual(shared, []);
  const ids = (html: string) => [...html.matchAll(/ id="([^"]+)"/gu)].map((match) => match[1]!);
  assert.notDeepEqual(ids(one), ids(two));
  assert.deepEqual(cardsOf(one).map((card) => card.key ?? card.ad), cardsOf(two).map((card) => card.key ?? card.ad));
  const manifest = JSON.stringify(scenario.manifest);
  for (const seed of [1, 2, 42, 246]) for (const name of Object.values(boardClasses(seed))) assert.ok(!manifest.includes(name), `the manifest names class ${name}`);
  const testIds = [...manifest.matchAll(/testid:([a-z-]+)/gu)].map((match) => match[1]!);
  assert.deepEqual(testIds.filter((id) => !ORACLE_TEST_IDS.has(id)), []);
});

test("the location lookup offers American Bristols before the English one", () => {
  assert.deepEqual(suggestPlaces("Bristol").slice(0, 3).map(({ id }) => id), ["bristol-ct-us", "bristol-tn-us", "bristol-england-gb"]);
  assert.deepEqual(JSON.parse(serve(fresh(), "embed/places", "q=bris").body).length, 6);
});

test("arming a rendering starts the board over, and an unknown operation or payload changes nothing", () => {
  const busy = scenario.mutate(scenario.mutate(fresh(), "consent", { choice: "accepted" }), "save", { key: postingById("m1").key });
  const armed = scenario.mutate(busy, "set-mode", { mode: "quiet-market" });
  assert.equal(armed.mode, "quiet-market");
  assert.equal(armed.consent, "pending");
  assert.equal(armed.saved.length, 2);
  assert.equal(scenario.mutate(busy, "set-mode", { mode: "nonsense" }), busy);
  assert.equal(scenario.mutate(busy, "launch-rocket", {}), busy);
  assert.equal(scenario.mutate(busy, "consent", { choice: "maybe" }), busy);
});

test("the live tasks name the variants and datasets the manifest declares", () => {
  assert.equal(JOB_BOARD_LIVE_TASKS.length, 8);
  const datasets = new Set(["extract-remote-rust-roles", "extract-application"]);
  for (const task of JOB_BOARD_LIVE_TASKS) {
    assert.equal(task.scenarioId, "job-board");
    if (task.expectedDatasetId) assert.ok(datasets.has(task.expectedDatasetId), task.id);
  }
});
