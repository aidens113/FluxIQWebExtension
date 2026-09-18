import assert from "node:assert/strict";
import test from "node:test";
import { resolveScenarioWorkflow, validateWebScenario } from "@fluxiq-web-extension/test-contracts";
import { allMatchingCompanies, browseCompanies, COMPANY_PAGE_SIZE, defaultCompanyBrowse } from "../browse.js";
import { companyBands, companyEntries, companySectors } from "../companies.js";
import { letterOf, profilePath, registerColumns, sectorCode, RENAMED_SECTOR } from "../format.js";
import { companyDirectoryScenario as scenario } from "../scenario.js";
import type { CompanyBrowse, CompanyDirectoryState, CompanyVariant } from "../types.js";

type Selection = { workflowId?: string; variantId?: string };

const manifest = scenario.manifest;
const context = { runToken: "company-directory-unit-token", seed: 163 };
const browse = (overrides: Partial<CompanyBrowse> = {}): CompanyBrowse => ({ ...defaultCompanyBrowse(), ...overrides });
const apply = (state: CompanyDirectoryState, operation: string, payload: unknown) => scenario.mutate(state, operation, payload);
const label = ({ workflowId, variantId }: Selection) => `${workflowId ?? "primary"}/${variantId ?? "baseline"}`;
const count = (html: string, needle: string) => html.split(needle).length - 1;
const bodyOf = (html: string) => html.slice(0, html.indexOf("<script"));
const armed = (variant: CompanyVariant) => ({ operation: "set-variant", payload: { variant } });

function route(state: CompanyDirectoryState, subpath: string, query = "", method: "GET" | "HEAD" = "GET") {
  const handler = scenario.route;
  assert.ok(handler);
  return handler(state, { subpath, query: new URLSearchParams(query), method }, context);
}

function renderArmed(variant: CompanyVariant): string {
  return scenario.render(apply(scenario.createState(163), "set-variant", { variant }), context);
}

/** The primary workflow and every `workflows[]` entry, each bare and under each of its variants. */
function selections(): Selection[] {
  return [undefined, ...(manifest.workflows ?? []).map(({ id }) => id)].flatMap((workflowId) => {
    const workflow = workflowId === undefined ? manifest : manifest.workflows?.find(({ id }) => id === workflowId);
    return [undefined, ...(workflow?.variants ?? []).map(({ id }) => id)]
      .map((variantId): Selection => ({ ...(workflowId ? { workflowId } : {}), ...(variantId ? { variantId } : {}) }));
  });
}

function datasetsOf(selection: Selection) {
  return resolveScenarioWorkflow(manifest, selection).expected.extracted ?? [];
}

test("the manifest is a valid scenario declaring five workflows, two variants and a playback goal", () => {
  const result = validateWebScenario(manifest);
  assert.equal(result.valid, true, result.valid ? "" : JSON.stringify(result.issues));
  assert.deepEqual(manifest.workflows?.map(({ id }) => id), ["sector-sweep", "no-companies", "profile-lookup", "enrich-register"]);
  assert.deepEqual([manifest, ...(manifest.workflows ?? [])].map((workflow) => (workflow.variants ?? []).map(({ id, arm }) => ({ id, arm }))), [
    [],
    [{ id: "relabelled-columns", arm: armed("relabelled-columns") }, { id: "resectored", arm: armed("resectored") }],
    [],
    [],
    [],
  ]);
  assert.equal(selections().length, 7);
  assert.equal(manifest.playbackGoal?.id, "last-page-of-logistics");
  assert.deepEqual(manifest.playbackGoal?.successFacts.map(({ value }) => value), ["Showing: Logistics", "Page 3 of 3", false]);
});

test("every workflow is judged: each declares a dataset per extract step, and a final state to check it against", () => {
  for (const selection of selections()) {
    const { expected, recordingScript } = resolveScenarioWorkflow(manifest, selection);
    const extractSteps = recordingScript.filter(({ operation }) => operation === "extract");
    assert.ok(extractSteps.length > 0, label(selection));
    assert.deepEqual(datasetsOf(selection).map(({ step }) => step), extractSteps.map(({ id }) => id), label(selection));
    for (const dataset of datasetsOf(selection)) assert.equal(dataset.records?.length, dataset.count, `${label(selection)} ${dataset.step}`);
    assert.ok((expected.finalState ?? []).length > 0, label(selection));
    assert.equal(expected.failure, undefined, `${label(selection)} must be a workflow the product can pass`);
  }
});

test("no workflow is judged on refusing: every dataset but the impossible size search expects records", () => {
  assert.deepEqual(datasetsOf({ workflowId: "no-companies" }).map(({ count: records }) => records), [0]);
  const others = selections().filter(({ workflowId }) => workflowId !== "no-companies").flatMap(datasetsOf);
  assert.ok(others.length >= 7);
  assert.ok(others.every(({ count: records }) => (records ?? 0) > 0), "a scraping corpus must not pass by collecting nothing");
});

test("the register is identical for every seed and shaped for the questions the workflows ask", () => {
  assert.equal(companyEntries.length, 320);
  assert.equal(new Set(companyEntries.map(({ name }) => name)).size, companyEntries.length);
  assert.equal(new Set(companyEntries.map(({ slug }) => slug)).size, companyEntries.length);
  assert.equal(companySectors.length, 8);
  assert.deepEqual([...companyEntries].sort((left, right) => left.name.localeCompare(right.name)).map(({ name }) => name), companyEntries.map(({ name }) => name));

  // An independent retailer never reaches a thousand staff, so that sector and
  // the largest band together are a search with no answer at all.
  assert.deepEqual(allMatchingCompanies(browse({ sector: "independent-retail", size: "1001-plus" })), []);
  assert.ok(allMatchingCompanies(browse({ sector: "independent-retail" })).length > 30);
  assert.ok(allMatchingCompanies(browse({ size: "1001-plus" })).length > 10);

  // A company that has filed no headcount is an ordinary part of a directory.
  const undisclosed = companyEntries.filter(({ employeeBand }) => employeeBand === undefined);
  assert.ok(undisclosed.length >= 20 && undisclosed.length <= 60, String(undisclosed.length));
  assert.ok(companyEntries.every(({ employeeBand }) => employeeBand === undefined || companyBands.includes(employeeBand)));

  // Every sector sweep is several pages, and three letters are filed under nobody.
  for (const sector of companySectors) assert.equal(allMatchingCompanies(browse({ sector: sectorCode(sector) })).length, 40, sector);
  assert.ok(Math.ceil(40 / COMPANY_PAGE_SIZE) >= 3);
  const filed = new Set(companyEntries.map((entry) => letterOf(entry)));
  assert.deepEqual(["V", "X", "Z"].filter((letter) => filed.has(letter)), []);
  assert.ok(allMatchingCompanies(browse({ letter: "B" })).length > COMPANY_PAGE_SIZE);

  const initial = scenario.createState(scenario.seed);
  assert.deepEqual(scenario.createState(1), initial);
  assert.deepEqual(scenario.createState(9_999), initial);
  assert.deepEqual(initial.oracle.matchCount, companyEntries.length);
  assert.equal(initial.oracle.pageCount, 22);
});

test("expected records are what each workflow reads, with literal spot checks of the page's own formatting", () => {
  const firstPage = browseCompanies(defaultCompanyBrowse()).entries;
  const register = datasetsOf({})[0];
  assert.equal(register?.count, COMPANY_PAGE_SIZE);
  assert.deepEqual(register?.records?.map((record) => record.name), firstPage.map(({ name }) => name));
  assert.deepEqual(register?.records?.[0], {
    name: "Abbeyfield Construction",
    sector: "Construction",
    location: "Alnwick, Northumberland",
    employees: "11\u201350",
    url: "/scenarios/company-directory/companies/abbeyfield-construction",
  });
  // A headcount nobody filed reads as no value, never as "".
  assert.ok((register?.records?.filter((record) => record.employees === null).length ?? 0) >= 1);
  assert.equal(register?.records?.some((record) => Object.values(record).includes("")), false);
  assert.deepEqual(register?.optionalFields, ["employees"]);

  // The sector sweep is the whole of Logistics, in the register's order, over every page.
  const logistics = allMatchingCompanies(browse({ sector: "logistics" }));
  const sweep = datasetsOf({ workflowId: "sector-sweep" })[0];
  assert.equal(sweep?.count, logistics.length);
  assert.equal(sweep?.pages, 3);
  assert.deepEqual(sweep?.records?.map((record) => record.name), logistics.map(({ name }) => name));
  assert.ok(sweep?.records?.every((record) => record.sector === "Logistics"));

  // The renamed sector changes the words in the column and nothing else.
  const resectored = datasetsOf({ workflowId: "sector-sweep", variantId: "resectored" })[0];
  assert.ok(resectored?.records?.every((record) => record.sector === RENAMED_SECTOR.to));
  assert.deepEqual(
    resectored?.records?.map(({ sector: _sector, ...rest }) => rest),
    sweep?.records?.map(({ sector: _sector, ...rest }) => rest),
  );

  // The relabelled table changes no value, so it inherits the sweep's records.
  assert.deepEqual(datasetsOf({ workflowId: "sector-sweep", variantId: "relabelled-columns" }), datasetsOf({ workflowId: "sector-sweep" }));

  // One company's profile, with the four facts the table has no column for.
  const searched = companyEntries.find(({ name }) => name === "Quarrendon Software");
  assert.ok(searched);
  assert.deepEqual(datasetsOf({ workflowId: "profile-lookup" })[0]?.records, [{
    name: searched.name,
    sector: searched.sector,
    employees: searched.employeeBand ?? null,
    founded: String(searched.founded),
    website: searched.website,
    telephone: searched.telephone,
  }]);
  assert.match(searched.telephone, /^0\d{4} \d{3} \d{3}$/);
  assert.equal(searched.website, "quarrendon-software.example");

  // The per-row enrichment reads one company per page visit.
  const enriched = datasetsOf({ workflowId: "enrich-register" });
  assert.equal(enriched.length, 3);
  assert.deepEqual(enriched.map((dataset) => dataset.records?.[0]?.name), firstPage.slice(0, 3).map(({ name }) => name));
  assert.deepEqual(enriched.map((dataset) => dataset.records?.[0]?.founded), firstPage.slice(0, 3).map(({ founded }) => String(founded)));
});

test("show records each served browse, clamps pages, refuses values the controls do not offer, and ignores bad payloads", () => {
  const initial = scenario.createState(163);
  const second = apply(initial, "show", { page: 2 });
  assert.equal(second.browse.page, 2);
  assert.deepEqual(second.browseHistory, [second.browse]);
  assert.equal(apply(initial, "show", { page: 999 }).browse.page, 22);
  for (const page of [0, -1, 1.5, "2", null]) assert.equal(apply(initial, "show", { page }).browse.page, 1, String(page));
  const sector = apply(initial, "show", { sector: "logistics" });
  assert.equal(sector.oracle.matchCount, 40);
  assert.equal(sector.oracle.pageCount, 3);
  assert.equal(apply(initial, "show", { letter: "b" }).browse.letter, "B", "a letter is read however it was cased");
  // Anything the controls do not offer is read as "any", never passed through.
  const forged = apply(initial, "show", { letter: "!", sector: "cryptocurrency", size: "enormous" });
  assert.deepEqual(forged.browse, defaultCompanyBrowse());
  assert.equal(apply(initial, "show", { query: "  quarrendon  " }).browse.query, "quarrendon");
  assert.equal(apply(initial, "show", { query: "x".repeat(200) }).browse.query.length, 60);
  for (const payload of [null, "page", 3, ["page"]]) assert.equal(apply(initial, "show", payload), initial);
  assert.equal(apply(initial, "unknown-operation", { page: 2 }), initial);
  let busy = initial;
  for (let index = 0; index < 60; index += 1) busy = apply(busy, "show", { page: (index % 3) + 1 });
  assert.equal(busy.browseHistory.length, 50);
});

test("set-variant arms each rendering from the top of the register, and view-profile records only real companies", () => {
  const initial = scenario.createState(163);
  const browsing = apply(initial, "show", { page: 3, sector: "logistics" });
  for (const variant of ["relabelled-columns", "resectored"] as const) {
    const state = apply(browsing, "set-variant", { variant });
    assert.equal(state.variant, variant, variant);
    assert.deepEqual(state.browse, defaultCompanyBrowse(), variant);
    assert.deepEqual(state.oracle, initial.oracle, variant);
  }
  assert.deepEqual(apply(apply(initial, "set-variant", { variant: "resectored" }), "set-variant", { variant: "baseline" }), initial);
  for (const payload of [{ variant: "bogus" }, {}, null]) assert.equal(apply(initial, "set-variant", payload), initial);

  const opened = apply(initial, "view-profile", { slug: "quarrendon-software" });
  assert.deepEqual(opened.profileViews, ["quarrendon-software"]);
  for (const payload of [{ slug: "not-a-company" }, { slug: 7 }, {}]) assert.equal(apply(initial, "view-profile", payload), initial);
});

test("the front page opens on the whole register, with the A-Z index, the sectors, the search and a Next control", () => {
  const html = scenario.render(scenario.createState(163), context);
  const body = bodyOf(html);
  assert.match(body, /<h1>Company register<\/h1>/);
  for (const testId of ["search-form", "search-input", "size-filter", "search-submit", "alphabet", "sector-list", "results", "register", "company-rows", "result-count", "page-status", "next-page"]) {
    assert.equal(count(body, `data-testid="${testId}"`), 1, testId);
  }
  assert.equal(count(body, '<tr class="company"'), COMPANY_PAGE_SIZE);
  assert.match(body, /<p class="result-count" data-testid="result-count" role="status">320 companies listed<\/p>/);
  assert.match(body, /<p class="page-status" data-testid="page-status">Page 1 of 22<\/p>/);
  assert.equal(count(body, 'data-testid="browse-summary"'), 0, "the whole register is showing, so it names no filter");
  assert.equal(html.includes(context.runToken), false);

  // The A-Z index offers every letter, and the three nobody is filed under are plain text rather than links.
  assert.equal(count(body, "<span aria-disabled=\"true\">"), 3);
  for (const letter of ["V", "X", "Z"]) assert.match(body, new RegExp(`<span aria-disabled="true">${letter}</span>`));
  assert.equal(count(body, "data-letter="), 23);
  for (const sector of companySectors) assert.equal(count(body, `data-testid="sector-${sectorCode(sector)}"`), 1, sector);

  // Nothing in a row is reachable by a test hook: the value is the cell under the heading.
  const row = body.slice(body.indexOf('<tr class="company"'), body.indexOf("</tr>", body.indexOf('<tr class="company"')) + 5);
  assert.equal(row.includes("data-testid"), false);
  assert.match(row, /<a class="company-link" href="\/scenarios\/company-directory\/companies\/abbeyfield-construction">Abbeyfield Construction<\/a>/);
  assert.match(row, /<td class="sector">Construction<\/td>/);
  assert.match(row, /<td class="location">Alnwick, Northumberland<\/td>/);
  assert.match(row, /<span class="employees">11\u201350<\/span>/);
  assert.deepEqual(registerColumns("baseline").map(({ heading }) => heading), ["Company", "Sector", "Location", "Employees"]);

  // The front page always opens on the whole register, whatever the run last looked at.
  assert.equal(scenario.render(apply(scenario.createState(163), "show", { page: 7, sector: "logistics" }), context), html);
});

test("a company that has filed no headcount has an empty cell with no element in it", () => {
  const body = bodyOf(scenario.render(scenario.createState(163), context));
  assert.match(body, /<td class="employees-cell"><\/td>/);
  assert.equal(body.includes('<span class="employees"></span>'), false, "the element is absent, never present and empty");
  const withBand = count(body, '<span class="employees">');
  const blank = count(body, '<td class="employees-cell"></td>');
  assert.equal(withBand + blank, COMPANY_PAGE_SIZE);
});

test("the results route serves each page of a browse and records it, and answers an impossible filter with nothing", () => {
  const initial = scenario.createState(163);
  const first = route(initial, "results");
  assert.equal(first?.status, 200);
  assert.equal(count(first?.body ?? "", '<tr class="company"'), COMPANY_PAGE_SIZE);
  assert.deepEqual(first?.mutation, { operation: "show", payload: defaultCompanyBrowse() });

  const lastPage = route(initial, "results", "sector=logistics&page=3");
  assert.equal(count(lastPage?.body ?? "", '<tr class="company"'), 40 - 2 * COMPANY_PAGE_SIZE);
  assert.equal(count(lastPage?.body ?? "", 'data-testid="next-page"'), 0, "the last page offers no way on");
  assert.match(lastPage?.body ?? "", /Page 3 of 3/);
  assert.match(lastPage?.body ?? "", /<p class="browse-summary" data-testid="browse-summary">Showing: Logistics<\/p>/);

  const nothing = route(initial, "results", "sector=independent-retail&size=1001-plus")?.body ?? "";
  assert.match(nothing, />0 companies listed</);
  assert.match(nothing, /<p class="no-results" data-testid="empty-results">No companies match this search\./);
  assert.equal(count(nothing, 'data-testid="register"') + count(nothing, 'data-testid="pagination"'), 0);
  assert.match(nothing, /Showing: Independent retail \u00b7 1,001\+ employees/);

  const searched = route(initial, "results", "q=Quarrendon+Software")?.body ?? "";
  assert.equal(count(searched, '<tr class="company"'), 1);
  assert.match(searched, />1 company listed</);
  assert.equal((route(initial, "results", `q=${encodeURIComponent("<script>alert(1)</script>")}`)?.body ?? "").includes("<script>"), false);
  assert.deepEqual(route(initial, "results", "page=2", "HEAD"), route(initial, "results", "page=2"));

  let walked = initial;
  for (const page of [2, 3]) {
    const response = route(walked, "results", `sector=logistics&page=${page}`);
    assert.ok(response?.mutation);
    walked = apply(walked, response.mutation.operation, response.mutation.payload);
  }
  assert.deepEqual(walked.browseHistory.map(({ page }) => page), [2, 3]);
  assert.equal(walked.oracle.matchCount, 40);
});

test("a company's profile carries the four facts the table has no column for, records the visit, and 404s everything else", () => {
  const initial = scenario.createState(163);
  const entry = companyEntries.find((candidate) => candidate.employeeBand !== undefined);
  assert.ok(entry);
  const response = route(initial, `companies/${entry.slug}`);
  assert.equal(response?.status, 200);
  assert.deepEqual(response?.mutation, { operation: "view-profile", payload: { slug: entry.slug } });
  const body = response?.body ?? "";
  assert.match(body, new RegExp(`<dt>Founded</dt><dd class="founded">${entry.founded}</dd>`));
  assert.match(body, new RegExp(`<dt>Website</dt><dd class="website">${entry.website}</dd>`));
  assert.match(body, /<dt>Telephone<\/dt><dd class="telephone">0\d{4} \d{3} \d{3}<\/dd>/);
  assert.match(body, /<dt>Registered office<\/dt><dd class="registered-office">Unit \d+, /);
  assert.match(body, /data-testid="back-to-register" href="\/scenarios\/company-directory\/"/);
  assert.equal(profilePath(entry), `/scenarios/company-directory/companies/${entry.slug}`);

  // None of those four facts is anywhere in the register table.
  const table = bodyOf(scenario.render(initial, context));
  assert.equal(table.includes(entry.website), false);
  assert.equal(table.includes(entry.telephone), false);

  // A company that has filed no headcount has no Employees row at all.
  const undisclosed = companyEntries.find((candidate) => candidate.employeeBand === undefined);
  assert.ok(undisclosed);
  const undisclosedBody = route(initial, `companies/${undisclosed.slug}`)?.body ?? "";
  assert.equal(undisclosedBody.includes('class="employees"'), false);
  assert.equal(undisclosedBody.includes("<dt>Employees</dt>"), false);
  assert.match(undisclosedBody, /<dd class="founded">/);

  for (const subpath of ["companies/not-a-company", "companies/", "companies/Quarrendon-Software", "results/extra", "unknown"]) {
    assert.equal(route(initial, subpath), undefined, subpath);
  }
});

/**
 * Each armed rendering is a control for one property of the page, so these
 * assertions are written against the served markup: a rendering that changed
 * anything else would show up here rather than hide behind a record
 * comparison that happens to still match.
 */
test("each armed rendering changes one thing and leaves the rest of the register alone", () => {
  const baseline = bodyOf(scenario.render(scenario.createState(163), context));

  const relabelled = bodyOf(renderArmed("relabelled-columns"));
  assert.deepEqual(registerColumns("relabelled-columns").map(({ heading }) => heading), ["Company", "Location", "Industry", "Team size"]);
  assert.match(relabelled, /<thead><tr><th scope="col">Company<\/th><th scope="col">Location<\/th><th scope="col">Industry<\/th><th scope="col">Team size<\/th><\/tr><\/thead>/);
  assert.equal(count(relabelled, '<tr class="company"'), COMPANY_PAGE_SIZE);
  assert.equal(count(relabelled, '<td class="sector">Construction</td>'), count(baseline, '<td class="sector">Construction</td>'), "the values are the values they were");
  assert.equal(relabelled.includes('data-testid="sector-logistics"'), true, "only the table was relabelled");

  const resectored = bodyOf(renderArmed("resectored"));
  assert.equal(resectored.includes('data-testid="sector-logistics"'), false, "the recorded click has nothing to land on");
  assert.match(resectored, /<a data-testid="sector-transport-and-logistics" data-sector="logistics" href="\?sector=logistics">Transport and logistics<\/a>/);
  assert.equal(count(resectored, '<td class="sector">Logistics</td>'), 0);
  assert.equal(count(resectored, '<td class="sector">Transport and logistics</td>'), count(baseline, '<td class="sector">Logistics</td>'));
  assert.match(resectored, /<th scope="col">Sector<\/th>/, "only the sector's name moved; the headings did not");
});
