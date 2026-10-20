import type { JsonObject } from "fluxiq/core";
import { STORE_PATHS, TIDEWELL_KETTLES } from "../../../../scenario-lab/src/scenarios/everything-store/catalog/index.js";
import { expect, test } from "../../fixtures/extension-context";
import { bindInstrumentedRuntime, bindScriptedProvider, digest, openStoreDetail, pageHandle, projectBuild, rowControl, startInstalledBuild, type BuilderTurn } from "../index";

const TASK = "Create one new store line.";
const SAGE = TIDEWELL_KETTLES.find(product => product.variant?.colour === "Sage Green" && product.variant.capacity === "1.7 L")!;
const record = (value: unknown): JsonObject => typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonObject : {};

for (const retryTransfer of [false, true]) test(retryTransfer
  ? "installed gateway project build distinguishes a failed save from its successful retry inverse"
  : "installed gateway project build preserves original collection authority for a new-row inverse", async ({ extensionSession }, testInfo) => {
  test.setTimeout(180_000);
  const task = retryTransfer ? `${TASK} You may temporarily move the original first cart line to the saved collection while building, then restore it before a trial.` : TASK;
  const permitted = retryTransfer ? ["create_new", "modify_existing"] : ["create_new"];
  const installed = await startInstalledBuild(extensionSession);
  const { page, service } = installed;
  const cart = new URL("/scenarios/everything-store/cart", installed.origin).href;
  const detail = new URL(STORE_PATHS.product(SAGE), installed.origin).href;
  const build = projectBuild(installed, "Installed reset diagnostic", task);
  const targetDescriptors: JsonObject[] = [];
  let baseline: string | undefined, restored: string | undefined;
  let missingClicksBefore = 0, missingClicksAfter = 0;
  let missingCreateCode: unknown;
  let destinationReference = "";
  let originalItem = "", failedSaveAct = "", retryAct = "";
  let wrongClicksBefore = 0, wrongClicksAfter = 0, wrongHashBefore: string | undefined, wrongHashAfter: string | undefined;
  let wrongInverseCode: unknown, correctInverseCode: unknown;
  let otherEffectActs: string[] = [];
  let rowSelectionFailure: JsonObject | undefined;
  let correctClicksBefore = 0, correctClicksAfter = 0;
  const transferStages: Array<{ stage: string; readIndex: number }> = [];
  try {
    // The first real domain observation knows this detail address. The builder
    // must still visit Cart itself before Add to establish original authority.
    await openStoreDetail(page, installed.origin, detail);
    await installed.pair();
    const observed = bindInstrumentedRuntime(installed);
    const { reads, declarations } = observed;
    const transferStage = (stage: string) => { transferStages.push({ stage, readIndex: reads.length - 1 }); };
    let addHandle = "", inverseHandle = "";
    const builder = async (turn: BuilderTurn) => {
      const { last, node, call } = turn;
      const builderStep = turn.step;
      const handle = (label: string) => pageHandle(turn.shownPage(), label);
      // Match only words already observed in the original row, then choose
      // its freshly observed control. No selector or raw snapshot picks it.
      const inRow = (label: string, identity?: string) => rowControl(turn.shownPage(), label, identity, facts => {
        const latest = turn.evidence.at(-1);
        const latestSearch = last("web.find_on_page");
        rowSelectionFailure = {
          builderStep, ...facts, originalIdentityPresent: originalItem.length > 0,
          latestToolId: latest?.toolId ?? null,
          latestHasFullPage: typeof latest?.value.page === "string",
          latestHasFound: typeof latest?.value.found === "string",
          latestFoundHasRequestedControl: typeof latest?.value.found === "string" && latest.value.found.includes(JSON.stringify(label)),
          searchHasRequestedControl: typeof latestSearch?.found === "string" && latestSearch.found.includes(JSON.stringify(label)),
          shownPageSourceIsLatest: turn.shownIsLatest()
        };
      });
      if (builderStep === 1) {
        addHandle = handle("Add to Cart");
        missingClicksBefore = observed.clicks();
        return node("add.missing", "web.output.dom-click", { target: { handle: addHandle } }, ["create_new"]);
      }
      if (builderStep === 2) {
        missingCreateCode = last("core.run_node")?.code;
        missingClicksAfter = observed.clicks();
        provider.receipts.push({ call: "add.missing", code: missingCreateCode });
        return node("original", "web.output.browser-navigate", { url: cart });
      }
      if (builderStep === 3) {
        baseline = reads.at(-1)?.hash;
        if (retryTransfer) {
          originalItem = inRow("Save for later").identity;
          transferStage("original");
        }
        const destinations = record(last("core.run_node")?.resetDestinations).collections as JsonObject[] | undefined;
        const reference = destinations?.[0]?.ref;
        if (typeof reference !== "string") throw new Error("diagnostic.original_destination_ref_missing");
        destinationReference = reference;
        return node("detail", "web.output.browser-navigate", { url: detail });
      }
      if (builderStep === 4) {
        addHandle = handle("Add to Cart");
        return node("add", "web.output.dom-click", { target: { handle: addHandle } }, ["create_new"], { resetDestination: destinationReference });
      }
      if (builderStep === 5) return node("destination", "web.output.browser-navigate", { url: cart });
      if (retryTransfer && builderStep === 6) {
        transferStage("postAdd");
        return node("save.failed", "web.output.dom-click", { target: { handle: inRow("Save for later", originalItem).handle } }, ["modify_existing"]);
      }
      if (retryTransfer && builderStep === 7) {
        transferStage("failedSave");
        await page.getByText("Try again", { exact: true }).waitFor({ timeout: 10_000 });
        return node("retry.observe", "web.output.dom-capture_snapshot", {});
      }
      if (retryTransfer && builderStep === 8) return node("save.retry", "web.output.dom-click", { target: { handle: inRow("Try again", originalItem).handle } }, ["modify_existing"]);
      if (retryTransfer && builderStep === 9) {
        transferStage("postRetry");
        return node("moved.observe", "web.output.browser-navigate", { url: cart });
      }
      const step = builderStep - (retryTransfer ? 4 : 0);
      if (step === 6) return call("submit", "core.submit_subflow", { flow: [`flow: New line`, `step open: open the product`, `  node: web.browser-navigate`, `  url: ${JSON.stringify(detail)}`, `step add: add the product`, `  node: web.dom.click`, `  target: ${addHandle}`, `  consequences: create_new`].join("\n") });
      const submitted = last("core.submit_subflow");
      const tested = last("core.test_subflow");
      if (typeof submitted?.revision !== "number" || typeof submitted.digest !== "string") throw new Error("diagnostic.submission_refused");
      const candidate = { revision: submitted.revision, digest: submitted.digest };
      if (step === 7) return call("trial.dirty", "core.test_subflow", candidate);
      if (step === 8) {
        provider.receipts.push({ call: "trial.dirty", code: tested?.code });
        const acts = tested?.actsToUndo as JsonObject[] | undefined;
        const act = acts?.find(value => value.call === "add")?.act;
        if (typeof act !== "string") throw new Error("diagnostic.reset_act_missing");
        if (retryTransfer) {
          const failed = acts?.find(value => value.call === "save.failed")?.act;
          const retried = acts?.find(value => value.call === "save.retry")?.act;
          if (typeof failed !== "string" || typeof retried !== "string" || failed === retried) throw new Error("diagnostic.retry_act_receipts_missing");
          failedSaveAct = failed;
          retryAct = retried;
        }
        return node("undo.arrival", "web.output.browser-navigate", { url: cart }, [], { undoes: act });
      }
      if (step === 9) {
        inverseHandle = handle("Delete");
        return call("describe.inverse", "web.describe_element", { target: inverseHandle });
      }
      if (step === 10) {
        const description = String(last("web.describe_element")?.element ?? "");
        const tag = description.match(/<(\w+)>/u)?.[1];
        const box = description.match(/box: x=(-?\d+) y=(-?\d+) (\d+)x(\d+)/u)?.slice(1).map(Number);
        const elements = (installed.latestRawSnapshot()?.interactiveElements as JsonObject[] | undefined) ?? [];
        const matches = elements.filter(element => {
          const bounds = record(element.documentBounds);
          return element.tagName === tag && box?.every((number, index) => number === Math.round(Number(bounds[["x", "y", "width", "height"][index]!])));
        });
        const features = (element: JsonObject): JsonObject => ({
          tag: element.tagName ?? null,
          rolePresent: typeof element.role === "string",
          tabindexPresent: Object.hasOwn(record(element.attributes), "tabindex"),
          ownHandlerBool: element.hasClickHandler === true,
          cursorPointer: element.cursor === "pointer",
          subjectPresent: typeof record(element.context).subject === "string"
        });
        const matched = matches.length === 1 ? matches[0] : undefined;
        const row = matched ? digest(record(matched.context).record) : undefined;
        const siblings = matched ? elements.filter(element => element !== matched && digest(record(element.context).record) === row && (element.accessibleName === "Delete" || element.visibleText === "Delete") && Object.hasOwn(record(element.attributes), "tabindex")) : [];
        targetDescriptors.push({ handleHash: digest(inverseHandle), matchCount: matches.length, ...(matched ? features(matched) : {}), sameRowAlternatives: siblings.map(features) });
        if (!matched) throw new Error("diagnostic.descriptor_match_unproved");
        const acts = tested?.actsToUndo as JsonObject[] | undefined;
        const act = acts?.find(value => value.call === "add")?.act;
        if (typeof act !== "string") throw new Error("diagnostic.reset_act_missing");
        return node("undo", "web.output.dom-click", { target: { handle: inverseHandle } }, ["delete"], { undoes: act });
      }
      if (step === 11) {
        const undone = last("core.run_node");
        provider.receipts.push({ call: "undo", code: undone?.code ?? (undone?.ok === true ? "ok" : "unknown") });
        if (undone?.ok !== true) throw new Error("diagnostic.inverse_refused");
        if (retryTransfer) {
          transferStage("afterDelete");
          return node("wrong.observe", "web.output.dom-capture_snapshot", {});
        }
        restored = reads.at(-1)?.hash;
        return call("trial.clean", "core.test_subflow", candidate);
      }
      if (retryTransfer && step === 12) {
        wrongClicksBefore = observed.clicks();
        wrongHashBefore = reads.at(-1)?.hash;
        return node("undo.failed", "web.output.dom-click", { target: { handle: inRow("Move to cart", originalItem).handle } }, ["modify_existing"], { undoes: failedSaveAct });
      }
      if (retryTransfer && step === 13) {
        const refused = last("core.run_node");
        wrongInverseCode = refused?.code;
        const related = refused?.otherActsWithObservedEffect;
        otherEffectActs = Array.isArray(related) ? related.map(value => record(value).act).filter((value): value is string => typeof value === "string") : [];
        wrongClicksAfter = observed.clicks();
        wrongHashAfter = reads.at(-1)?.hash;
        transferStage("afterWrong");
        provider.receipts.push({ call: "undo.failed", code: wrongInverseCode });
        if (refused?.ok !== false || wrongClicksAfter !== wrongClicksBefore) throw new Error("diagnostic.wrong_claim_dispatched");
        return node("correct.observe", "web.output.dom-capture_snapshot", {});
      }
      if (retryTransfer && step === 14) {
        correctClicksBefore = observed.clicks();
        return node("undo.retry", "web.output.dom-click", { target: { handle: inRow("Move to cart", originalItem).handle } }, ["modify_existing"], { undoes: retryAct });
      }
      if (retryTransfer && step === 15) {
        const corrected = last("core.run_node");
        correctInverseCode = corrected?.code ?? (corrected?.ok === true ? "ok" : "unknown");
        provider.receipts.push({ call: "undo.retry", code: correctInverseCode });
        restored = reads.at(-1)?.hash;
        correctClicksAfter = observed.clicks();
        transferStage("afterCorrect");
        if (corrected?.ok !== true) throw new Error("diagnostic.correct_retry_inverse_refused");
        return call("trial.clean", "core.test_subflow", candidate);
      }
      provider.receipts.push({ call: "trial.clean", code: tested?.code ?? tested?.verdict });
      return turn.complete({ subflowKey: "main", ...candidate });
    };
    const provider = bindScriptedProvider(installed, { task, permitted, instructionSourceId: build.instructionSourceId, maxIterations: retryTransfer ? 30 : 20, maxCallsPerRun: retryTransfer ? 40 : 30, builder });
    const { ending, failure } = await build.run();
    const receipts = provider.receipts;
    const diagnostic = { ending, failure, supervisorStep: provider.supervisorSteps(), builderStep: provider.builderSteps(), baseline, restored, receipts, reads, declarations, outcomes: observed.outcomes, targetDescriptors, rowSelectionFailure, missingCreate: { code: missingCreateCode, clickDispatchesBefore: missingClicksBefore, clickDispatchesAfter: missingClicksAfter }, retryTransfer: retryTransfer ? { failedSaveAct, retryAct, wrongInverseCode, correctInverseCode, otherEffectActs, wrongClicksBefore, wrongClicksAfter, wrongHashBefore, wrongHashAfter, correctClicksBefore, correctClicksAfter, stages: transferStages } : null, gatewayErrors: installed.gatewayErrors };
    await testInfo.attach("reset-structural.json", { body: Buffer.from(JSON.stringify(diagnostic)), contentType: "application/json" });
    console.log(JSON.stringify({ resetDiagnostic: diagnostic }));
    expect(ending).toBe("proposed");
    expect(missingCreateCode).toBe("candidate.create_baseline_required");
    expect(missingClicksAfter).toBe(missingClicksBefore);
    expect(destinationReference).toMatch(/^destination-[1-9][0-9]{0,3}$/u);
    expect(baseline).toMatch(/^[a-f0-9]{20}$/u);
    expect(restored).toMatch(/^[a-f0-9]{20}$/u);
    const original = reads.find(read => read.hash === baseline && read.sizes.length === 2 && read.sizes[0] === 2 && read.sizes[1] === 2);
    const postAdd = reads.find(read => read.sizes.length === 2 && read.sizes[0] === 3 && read.sizes[1] === 2);
    expect(original).toBeDefined();
    expect(postAdd).toBeDefined();
    if (!original || !postAdd) throw new Error("diagnostic.complete_inventory_missing");
    expect(original.subjects).toHaveLength(4);
    expect(postAdd.subjects).toHaveLength(5);
    expect(original.scopes.every(scope => /^p:[a-f0-9]{32}$/u.test(scope))).toBe(true);
    expect(postAdd.scopes).toEqual(original.scopes);
    expect(postAdd.groups).toEqual(original.groups);
    const add = declarations.find(declaration => declaration.call === "add");
    const inverse = declarations.find(declaration => declaration.call === "undo");
    expect(add?.subject).toMatch(/^s:[a-f0-9]{32}$/u);
    expect(add?.permitted).toBe(true);
    const refused = declarations.find(declaration => declaration.call === "add.missing");
    expect(refused?.permitted).toBe(false);
    expect(refused?.subject).toBe(add?.subject);
    expect(inverse?.permitted).toBe(true);
    expect(inverse?.subject).toBe(add?.subject);
    expect(inverse?.scope).toBe(postAdd.scopes[0]);
    expect(original.subjects).not.toContain(add?.subject);
    expect(postAdd.subjects).toContain(add?.subject);
    expect(targetDescriptors).toHaveLength(1);
    expect(targetDescriptors[0]).toMatchObject({ matchCount: 1, tag: "span", rolePresent: false, tabindexPresent: false, ownHandlerBool: false, cursorPointer: true, subjectPresent: true });
    expect(receipts.find(receipt => receipt.call === "trial.dirty")?.code).toBe("candidate.trial_reset_required");
    expect(receipts.find(receipt => receipt.call === "undo")?.code).toBe("ok");
    if (retryTransfer) {
      const failed = declarations.find(declaration => declaration.call === "save.failed");
      const retried = declarations.find(declaration => declaration.call === "save.retry");
      const wrong = declarations.find(declaration => declaration.call === "undo.failed");
      const correct = declarations.find(declaration => declaration.call === "undo.retry");
      expect(failed?.consequences).toEqual(["modify_existing"]);
      expect(retried?.consequences).toEqual(["modify_existing"]);
      expect(failed?.subject).toMatch(/^s:[a-f0-9]{32}$/u);
      expect(failed?.subject).not.toBe(add?.subject);
      expect(original.subjects).toContain(failed?.subject);
      expect(retried?.subject).toBe(failed?.subject);
      expect(retried?.scope).toBe(failed?.scope);
      expect(original.resourceHash).toMatch(/^[a-f0-9]{20}$/u);
      expect(failed?.resourceHash).toBe(original.resourceHash);
      expect(retried?.resourceHash).toBe(original.resourceHash);
      expect(failed?.scope).toBe(original.scopes[0]);
      const staged = (stage: string) => {
        const at = transferStages.find(value => value.stage === stage)?.readIndex;
        if (at === undefined || !reads[at]) throw new Error("diagnostic.transfer_stage_missing");
        return reads[at]!;
      };
      expect(staged("postAdd").sizes).toEqual([3, 2]);
      expect(staged("failedSave").subjects).toEqual(staged("postAdd").subjects);
      expect(staged("postRetry").sizes).toEqual([2, 3]);
      expect(staged("postRetry").subjects.slice(0, 2)).not.toContain(failed?.subject);
      expect(staged("postRetry").subjects.slice(2)).toContain(failed?.subject);
      expect(staged("afterDelete").sizes).toEqual([1, 3]);
      expect(wrongInverseCode).toBe("candidate.undo_unproved");
      expect(otherEffectActs).toEqual([retryAct]);
      expect(wrongClicksAfter).toBe(wrongClicksBefore);
      expect(wrongHashBefore).toMatch(/^[a-f0-9]{20}$/u);
      expect(wrongHashAfter).toBe(wrongHashBefore);
      expect(wrong?.permitted).toBe(false);
      expect(wrong?.subject).toBe(failed?.subject);
      expect(correct?.permitted).toBe(true);
      expect(correct?.subject).toBe(failed?.subject);
      expect(correct?.scope).toBe(original.scopes[1]);
      expect(correctInverseCode).toBe("ok");
      expect(correctClicksAfter).toBe(correctClicksBefore + 1);
      expect(staged("afterCorrect").sizes).toEqual([2, 2]);
    }
    expect(restored).toBe(baseline);
    expect(receipts.find(receipt => receipt.call === "trial.clean")?.code).toBe("yes");
  } finally {
    await build.stop();
    await installed.close();
  }
});
