import type { JsonObject } from "fluxiq/core";
import { STORE_PATHS, TIDEWELL_KETTLES } from "../../../../scenario-lab/src/scenarios/everything-store/catalog/index.js";
import { expect, test } from "../../fixtures/extension-context";
import { watchCrossBrief } from "../cross-brief-watch";
import { bindInstrumentedRuntime, bindScriptedProvider, keepDiagnostic, openStoreDetail, pageHandle, pageHandleWhere, projectBuild, startInstalledBuild, startedWithActs, trialCode, type BuilderTurn, type ScriptedAnswer } from "../index";
import type { SupervisorTurn } from "../scripted-provider";

const TASK = "Find a kettle with the store's search and start a checkout for it.";
const SAGE = TIDEWELL_KETTLES.find(product => product.variant?.colour === "Sage Green" && product.variant.capacity === "1.7 L")!;
/**
 * What brief 1 types into the store's own search field: a search whose results list the page vouches is whole, so its
 * read is complete and a ref is issued for it. The broad "kettle" search (12 rows, three of them adverts) read no
 * complete list on this page in this harness, so it issued no ref (report t743-e2a-office).
 */
const QUERY = "gooseneck kettle";
/** Core's words for an act settled with no change seen (`site-reset/words.ts`, `leftUnchanged`). */
const LEFT_UNCHANGED = "nothing it could change showed a change";
/** A page of the store no brief is ever shown: no link, read or location names it. */
const NEVER_SHOWN = "/scenarios/everything-store/gp/cross-brief/never-shown";
const NAVIGATE = "web.output.browser-navigate";
const record = (value: unknown): JsonObject => typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonObject : {};
const isSearch = (location: string | undefined) => location !== undefined && new URL(location).pathname === STORE_PATHS.search;
const sameAddress = (left: string | undefined, right: string | undefined) => {
  if (left === undefined || right === undefined) return false;
  const [a, b] = [new URL(left, "http://fixture.invalid"), new URL(right, "http://fixture.invalid")];
  const query = (url: URL) => JSON.stringify([...url.searchParams.entries()].sort());
  return a.pathname.replace(/\/$/u, "") === b.pathname.replace(/\/$/u, "") && query(a) === query(b);
};

/**
 * Office rerun round 4 (`run-mvgvyaip-d856e135`, terminal cause): a repair and
 * a reset brief were refused `address_not_shown` for a search-results page an
 * earlier brief had stood on, because the domain forgot shown addresses at each
 * brief's fresh opening, and Core's own pre-trial look at the issued list on
 * that typed-search page was refused unrun the same way. t743 made shown
 * addresses belong to the build, exempted Core's own moves (`move: "core"`),
 * and seeds each brief's opening with the build's issued-list locations
 * (`places`).
 *
 * The scripted supervisor writes the default one-part plan and sends two build
 * briefs of the one subflow. Brief 1 types a search into the store's own search
 * field (the results list is read complete and its ref issued at the results
 * address, query included), presses Buy Now declaring create_new against that
 * ref, submits the subflow and ends partial without testing it. Brief 2's
 * builder writes a navigation straight to brief 1's results address, which must
 * run; writes one to a page nothing ever showed, which must still be refused
 * `address_not_shown`; presses Buy Now again against the results ref; and tests
 * a changed revision. Before that trial Core's own look must navigate to the
 * typed-search page and read it, and the trial then runs with the build's acts
 * settled.
 */
test("installed gateway project build keeps one site memory across briefs: a later brief and Core's own look reach a typed search's page", async ({ extensionSession }, testInfo) => {
  test.setTimeout(420_000);
  const installed = await startInstalledBuild(extensionSession);
  const { page } = installed;
  const detail = new URL(STORE_PATHS.product(SAGE), installed.origin).href;
  const neverShown = new URL(NEVER_SHOWN, installed.origin).href;
  const build = projectBuild(installed, "Installed reset office cross-brief", TASK);
  let brief = 1, briefStep = 0;
  let searchReference = "", searchLocation = "", buyHandle = "";
  const tests: JsonObject[] = [];
  const pages: Record<string, string> = {};
  const dispatches: JsonObject[] = [];
  /** The call index (into the watch's calls) at which brief 2 began, and at which its test was asked. */
  let brief2From = -1, testFrom = -1, readsAtTest = -1;
  /** What each builder turn had just been answered, by code and issue codes only. */
  const answers: Array<{ brief: number; step: number; toolId: unknown; ok: unknown; code: unknown; issues: unknown[] }> = [];
  const refusals: JsonObject[] = [];
  /** Every ref printed under resetDestinations, by the brief step whose answer printed it. */
  const receipts: Array<{ brief: number; step: number; collections: unknown }> = [];
  try {
    await openStoreDetail(page, installed.origin, detail);
    await installed.pair();
    const watch = watchCrossBrief(installed);
    const observed = bindInstrumentedRuntime(installed);
    const { reads } = observed;
    const checkoutFlow = (looksAtEnd: boolean) => [`flow: Checkout`, `step open: open the product`, `  node: web.browser-navigate`, `  url: ${JSON.stringify(detail)}`,
      `step buy: start the checkout`, `  node: web.dom.click`, `  target: ${buyHandle}`, `  consequences: create_new`,
      ...(looksAtEnd ? [`step check: look at the checkout page`, `  node: web.dom.capture_snapshot`] : [])].join("\n");
    /** The newest ref printed for a list read at the results page: a receipt names no page, so the newest read there tells which refs are its. */
    const newestSearchRef = (turn: BuilderTurn): string | undefined => {
      const collections = (record(turn.last("core.run_node")?.resetDestinations).collections as JsonObject[] | undefined) ?? [];
      receipts.push({ brief, step: briefStep, collections });
      const refs = collections.map(collection => collection.ref).filter((ref): ref is string => typeof ref === "string");
      return refs.at(-1);
    };
    const buildBrief = { kind: "build", subflowKey: "main", parts: ["p1"], entry: { caseId: "observed-current", predecessors: [] }, permittedActs: ["create_new"], maxIterations: 20 };
    const supervisor = (turn: SupervisorTurn): ScriptedAnswer => {
      if (turn.step === 1) return turn.call("plan", "project.write_plan", turn.plan());
      if (turn.step === 2) return turn.call("dispatch.first", "project.dispatch", { reason: "Build the subflow.", briefs: [buildBrief] });
      if (turn.step === 3) {
        dispatches.push(record(turn.last("project.dispatch")));
        brief = 2;
        briefStep = 0;
        brief2From = watch.calls.length;
        return turn.call("dispatch.second", "project.dispatch", { reason: "Build the subflow again from where the first brief left it.", briefs: [buildBrief] });
      }
      if (turn.step === 4) dispatches.push(record(turn.last("project.dispatch")));
      return turn.complete(record(turn.last("project.dispatch")?.complete));
    };
    const script = (turn: BuilderTurn): ScriptedAnswer => {
      const { last, node, call } = turn;
      pages[`brief-${brief}-step-${briefStep}`] = turn.shownPage();
      if (brief === 1) {
        if (briefStep === 1) {
          // The store's own search field, as the page view names it; the search is typed and sent in one step.
          const field = pageHandleWhere(turn.shownPage(), /^t\d+ (?!button\b|link\b).*"Search Brightaisle"/u) ?? pageHandle(turn.shownPage(), "Search Brightaisle");
          return node("search", "web.output.dom-type", { target: { handle: field }, text: QUERY, submit: true });
        }
        // A look at the results page once it has loaded: Core's read around it reads the results list complete and prints its ref.
        if (briefStep === 2) return node("results", "web.output.dom-capture_snapshot", {});
        if (briefStep === 3) {
          const located = [...reads].reverse().find(read => isSearch(read.location) && read.sizes.length > 0);
          if (!located?.location) throw new Error("diagnostic.search_results_not_read");
          searchLocation = located.location;
          const reference = newestSearchRef(turn);
          if (reference === undefined) throw new Error("diagnostic.search_destination_ref_missing");
          searchReference = reference;
          return node("detail", NAVIGATE, { url: detail });
        }
        if (briefStep === 4) {
          buyHandle = pageHandle(turn.shownPage(), "Buy Now");
          return node("buy", "web.output.dom-click", { target: { handle: buyHandle } }, ["create_new"], { resetDestination: searchReference });
        }
        if (briefStep === 5) return call("submit.first", "core.submit_subflow", { flow: checkoutFlow(false) });
        const submitted = last("core.submit_subflow");
        if (typeof submitted?.revision !== "number") {
          refusals.push(submitted ?? {});
          throw new Error("diagnostic.submission_refused");
        }
        return turn.complete({ ended: "partial", reason: "The checkout subflow stands untested; another brief finishes it." });
      }
      // Brief 2: the results page brief 1 typed its way to, written as an address.
      if (briefStep === 1) return node("again", NAVIGATE, { url: searchLocation });
      // A page no brief was ever shown.
      if (briefStep === 2) return node("made-up", NAVIGATE, { url: neverShown });
      if (briefStep === 3) {
        newestSearchRef(turn);
        return node("detail.second", NAVIGATE, { url: detail });
      }
      if (briefStep === 4) {
        // A lasting act of this brief, after its own read of the results page, so only a later read of that page can settle it.
        buyHandle = pageHandle(turn.shownPage(), "Buy Now");
        return node("buy.second", "web.output.dom-click", { target: { handle: buyHandle } }, ["create_new"], { resetDestination: searchReference });
      }
      if (briefStep === 5) return call("submit.second", "core.submit_subflow", { flow: checkoutFlow(true) });
      const submitted = last("core.submit_subflow");
      if (typeof submitted?.revision !== "number" || typeof submitted.digest !== "string") {
        refusals.push(submitted ?? {});
        throw new Error("diagnostic.submission_refused");
      }
      const candidate = { revision: submitted.revision, digest: submitted.digest };
      if (briefStep === 6) {
        testFrom = watch.calls.length;
        readsAtTest = reads.length;
        return call("trial.second", "core.test_subflow", candidate);
      }
      if (briefStep === 7) tests.push(record(last("core.test_subflow")));
      return trialCode(tests[0]) === "yes" ? turn.complete({ subflowKey: "main", ...candidate }) : turn.complete({ ended: "partial", reason: "The trial did not pass." });
    };
    const builder = async (turn: BuilderTurn) => {
      briefStep++;
      const previous = [...turn.evidence].reverse().find(entry => entry.toolId.startsWith("core.") && !["core.budget", "core.route_state", "core.evidence_history"].includes(entry.toolId));
      const issues = Array.isArray(previous?.value.issues) ? (previous.value.issues as unknown[]).map(issue => record(issue).code ?? null) : [];
      answers.push({ brief, step: briefStep, toolId: previous?.toolId ?? null, ok: previous?.value.ok ?? null, code: previous?.value.code ?? null, issues });
      try {
        return script(turn);
      } catch (error) {
        answers.push({ brief, step: briefStep, toolId: "script.error", ok: false, code: error instanceof Error ? error.message : "unknown", issues: [] });
        throw error;
      }
    };
    const provider = bindScriptedProvider(installed, { task: TASK, permitted: ["create_new"], instructionSourceId: build.instructionSourceId, maxIterations: 20, maxCallsPerRun: 40, builder, supervisor });
    const { ending, failure } = await build.run();

    const calls = watch.calls;
    const brief2Calls = brief2From < 0 ? [] : calls.slice(brief2From);
    const opening2 = brief2Calls.find(entry => entry.call.startsWith("initial."));
    const again = calls.find(entry => entry.call === "again");
    const madeUp = calls.find(entry => entry.call === "made-up");
    const looksBeforeTrial = testFrom < 0 ? [] : calls.slice(testFrom).filter(entry => /^site-reset\.look\.\d+\.arrival$/u.test(entry.call));
    const searchLook = looksBeforeTrial.find(entry => sameAddress(entry.url, searchLocation));
    /** Reads of the results page taken during the test call, before its trial ran: only Core's own look stood there then. */
    const searchReadsByLook = readsAtTest < 0 ? [] : reads.slice(readsAtTest).filter(read => sameAddress(read.location, searchLocation) && read.sizes.length > 0);
    const started = tests.map(tested => startedWithActs(tested));
    const summary = {
      ending, failure, briefs: dispatches.map(answer => record(answer).code ?? (record(answer).ok === true ? "ok" : null)),
      again: again && { ok: again.ok, code: again.code, actions: again.actions },
      madeUp: madeUp && { ok: madeUp.ok, code: madeUp.code, actions: madeUp.actions },
      opening2Places: opening2?.places ?? null,
      looksBeforeTrial: looksBeforeTrial.map(entry => ({ call: entry.call, toSearch: sameAddress(entry.url, searchLocation), actions: entry.actions, ok: entry.ok, code: entry.code })),
      tests: tests.map(trialCode), started: started.map(acts => acts.map(act => act.call ?? null))
    };
    await keepDiagnostic(testInfo, "reset-office-cross-brief.json", { ...summary, searchReference, searchLocation, brief2From, testFrom, readsAtTest, answers, receipts, refusals, dispatches, tests, calls, reads, declarations: observed.declarations, outcomes: observed.outcomes, builderStep: provider.builderSteps(), supervisorStep: provider.supervisorSteps(), supervisorReceipts: provider.receipts, gatewayErrors: installed.gatewayErrors, pages });
    console.log(JSON.stringify({ resetDiagnostic: summary }));

    // Brief 1 typed its search and stood on the results page, whose list was read complete and its ref issued there.
    expect(searchReference).toMatch(/^destination-[1-9][0-9]{0,3}$/u);
    expect(isSearch(searchLocation)).toBe(true);
    expect(new URL(searchLocation).searchParams.get("k")).toBe(QUERY);
    expect(observed.declarations.find(declaration => declaration.call === "buy")?.consequences).toEqual(["create_new"]);
    expect(calls.find(entry => entry.call === "buy")?.ok).toBe(true);
    // Both briefs were sent, and the second ran.
    expect(brief2From).toBeGreaterThanOrEqual(0);
    expect(brief2Calls.length).toBeGreaterThan(0);
    // Brief 2's opening carried the build's places, the results address among them.
    expect(opening2?.places?.some(place => sameAddress(new URL(place, installed.origin).href, searchLocation))).toBe(true);
    // Brief 2's written navigation to brief 1's results page ran: a navigation was sent, not refused unshown.
    expect(again?.code).not.toBe("address_not_shown");
    expect(again?.ok).toBe(true);
    expect(again?.actions).toContain("web.browser.navigate");
    // The rule still holds: a page no brief was ever shown is refused, and nothing is sent to the browser for it.
    expect(madeUp?.code).toBe("address_not_shown");
    expect(madeUp?.actions).not.toContain("web.browser.navigate");
    // Core's own look before the trial went to the typed-search page and read it: a navigation was sent, not refused.
    expect(searchLook).toBeDefined();
    expect(searchLook?.code).not.toBe("address_not_shown");
    expect(searchLook?.actions).toContain("web.browser.navigate");
    expect(searchReadsByLook.length).toBeGreaterThanOrEqual(1);
    // Core's own looks only navigate, declaring nothing lasting.
    for (const declaration of observed.declarations.filter(entry => entry.call.startsWith("site-reset."))) expect(declaration.consequences).toEqual([]);
    // The trial then ran, with the build's acts settled and listed as left.
    expect(tests).toHaveLength(1);
    expect(trialCode(tests[0])).toBe("yes");
    expect(tests[0]!.trialRunId).toMatch(/^trial\./u);
    expect(started[0]!.map(act => act.call).sort()).toEqual(["buy", "buy.second"]);
    for (const act of started[0]!) expect(act.did).toContain(LEFT_UNCHANGED);
    expect(ending).toBe("proposed");
  } finally {
    await build.stop();
    await installed.close();
  }
});
