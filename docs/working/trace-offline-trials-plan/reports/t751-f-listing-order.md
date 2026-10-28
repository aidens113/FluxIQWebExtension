# t751-f-listing-order: worker report

## Outcome

Done. The web read's node definition now declares how its rows come out (`answersRows: "page_order"`) and where a model writes its two process keys (`recordProcessWrittenAt`). Core's listing-order rule reads both:

- it admits a limit of N with no sort when the lasting repeat stops after the same N;
- it refuses a sort at the key the model wrote;
- its answer never names `extractList.sort`.

A listing node that declares nothing keeps the t741 rule word for word. One edit falls outside the paths I own: a 2-line change to `domain/src/output-nodes/definitions.ts` (see Open questions 1).

## What changed and why

### Core (`C:/Users/osrs_/FluxStuff/fxwork/t751/!FluxIQ`)

**`packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/script-statements/listing-order-in-repeat.ts`**
- It reads two definition metadata keys through the existing `definition.metadata` channel, the one that already carries `recordsPath` and `effect`. No change to Core's node-definition type was needed, because `metadata` is a `JsonObject`.
  - `answersRows: "page_order"`.
  - `recordProcessWrittenAt: { sort?: "<dotted parameter path>", limit?: "<dotted parameter path>" }`.
- A sort or limit written at a declared path counts as one, whether or not the domain has already moved it into `recordOutput.process`. The refusal path is that authored path (for example `parameters.extractList.sort` or `parameters.extractList.maxItems`), never a `process` key the model never wrote.
- Page-order listings:
  - **Admitted:** a limit of N with no `process.sort`, no `process.where`, and every lasting For Each fed by the listing having `stopAfter` (`repeat most`) equal to N.
  - **Still refused:** a sort, a limit that differs from `repeat most`, a repeat with no `repeat most`, and a limit beside a `process.where`. The last one saves rows the repeat did not act on.
  - **The page-order `instead`** names `extractList.where`, `repeat most: N`, and the limit written where this listing already writes it. That is `extractList.maxItems: N` when the model wrote maxItems, otherwise `"limit": N` in `recordOutput.process`. It then says "Take `<key>` out" for the sort or `process.where`, naming the key where it was written. It never names `extractList.sort`.
- A listing that declares neither key gets the same `MESSAGE`, `INSTEAD` and path as before.

**`.../script-statements/tests/listing-order-in-repeat.test.ts`**
- `rowsLoop` takes an optional `stopAfter`.
- 7 new tests in a "page order" describe block, using a registry whose read declares both keys:
  - limit equal to `repeat most` is admitted;
  - a limit that differs, or no `repeat most`, is refused;
  - a limit beside `process.where` is refused;
  - a sort is refused and the `instead` has no `extractList.sort`;
  - the refusal sits at the authored key;
  - applying the `instead` literally gives a listing the rule admits;
  - a listing with no capability is unchanged.

**`.../flow-bootstrap/plan/flow-script-format.ts`**
- The listing-order sentence now carries the condition. Whether a listing can hand its rows on in another order is up to its node:
  - where it can, the `extractList.sort` example stays (the invoices example, a kind of site no realistic scenario is);
  - where the node hands rows on in page order: `extractList.where`, `repeat most: N`, and a limit of the same N with no sort; a refusal of a sort says which kind a listing is.
- Every substring `loop-format.test.ts` pins is kept. The new words avoid that test's banned-word regex.
- A header paragraph records why (t751).

### Downstream (`C:/Users/osrs_/FluxStuff/fxwork/t751/!FluxIQWebExtension`)

- **New `domain/src/output-nodes/extract-list/rows-order.ts`:** exports one constant, `WEB_AUTOMATION_EXTRACT_LIST_ROWS_ORDER = { answersRows: "page_order", recordProcessWrittenAt: { sort: "extractList.sort", limit: "extractList.maxItems" } }`. The pairs are the mapping `record-output-process.ts` makes (`sort` stays `sort`, `maxItems` becomes `limit`).
- **`domain/src/output-nodes/extract-list/index.ts`:** one new export line, `export * from "./rows-order"`, with a comment. This was required so `definitions.ts` can import the constant through the barrel.
- **`domain/src/output-nodes/definitions.ts` (outside my owned paths):** the import, plus one spread into `metadata` for `web.dom.extract_list` only. This file is where every output node's metadata is put together; `extract-list/` only supplies parts, as `recordsPath` already does.
- **`domain/src/runtime/llm-evidence/plan-resolution/extraction/run-record-output.ts`:** NOT changed. See Open questions 2.
- **New `domain/src/runtime/llm-evidence/plan-resolution/extraction/tests/listing-order-in-repeat.test.ts`:** 4 tests. Each runs Core's public `checkAutomationStudioFlowBootstrapCompletion` on a script whose listing this domain resolves through `createWebAutomationLlmEvidenceRuntime(...).resolvePlanNodeParameters`, with the real web node definitions and parameter contracts:
  1. The live shape (`extractList.where` + `extractList.maxItems: 3` + click `repeat over` + `repeat most: 3` + `consequences: modify_existing` + a `recordOutput`) is admitted.
  2. `maxItems: 5` with `repeat most: 3` is refused, and the feedback names `extractList.maxItems`, not `process.limit`.
  3. The actionable-answer contract. Start from a listing with `extractList.sort` (what the t741 sentence advised) and confirm it is refused at `extractList.sort`. Apply the refusal's `instead` literally with a small interpreter: write a sort shape if one is shown; drop every "Take `x` out" key; obey "take sort and limit out of recordOutput.process"; set "write `extractList.k: N`"; set a `"limit": N` in `recordOutput.process`. The result must pass the completion check.
  4. `recordOutput.process: {"limit": 3}` is admitted; a process sort plus limit is refused.
- I first put the test in `plan-resolution/tests/`. I moved it to `extraction/tests/` (the brief allows that) because the first directory went over the 25-file audit limit.

## Commands run and observed results

**Core tests, new code.** `pnpm exec vitest run .../script-statements/tests/listing-order-in-repeat.test.ts` in `packages/fluxiq`: 12 passed.

**Core tests shown failing first.** I restored the original rule with `git show HEAD:<file> > <file>` and ran the same file: "12 tests | 6 failed". All 6 new page-order tests failed. The 6 that cover today's rule passed, including "leaves a listing that declares no capability on today's rule". Then I restored my version (diff stat confirmed: 148 insertions, 22 deletions).

**Core rebuild.** `pnpm --filter fluxiq build` completed in about 390 s with "not stamped, because inputs changed while it ran". Other lanes were editing Core at the same time. I confirmed the dist has my changes: `answersRows` and `recordProcessWrittenAt` appear in `dist/.../listing-order-in-repeat.js`, and the new sentence appears in `dist/.../flow-script-format.js`.

**Core prompt contract and neighbouring tests.** `pnpm exec vitest run` on these 9 files: 9 files and 102 tests passed.
- `script-statements/tests/listing-order-in-repeat`
- `llm/harness-options/tests/listing-order-in-repeat-feedback`
- `plan/tests/loop-format`
- `plan/tests/extraction-vocabulary`
- `plan/tests/issue-feedback`
- `plan/tests/issue-feedback-word-forms`
- `plan/tests/issue-feedback-words`
- `llm/deepseek/tests/system-prompt`
- `candidate/tests/refusal-locator-corpus`

**Core typecheck.** `pnpm exec tsc --noEmit -p .` in `packages/fluxiq`: exit 0, no output.

**Domain tests, new code.** `DOMAIN_TEST_BUILD_LABEL=t751-f-listing-order node scripts/test-domain.mjs runtime/llm-evidence/plan-resolution/extraction/tests/listing-order-in-repeat`: 4 of 4 passed.

**Domain tests shown failing first.** I temporarily replaced the metadata spread in `definitions.ts` with `...(false ? ... : {})`, so the read declares nothing. With nothing declared, Core runs exactly the t741 rule, which the Core test above pins. Result: 0 passed, 4 failed. Test 1 reproduces the live refusal: actual `['record_output.process_order_in_repeat']`, expected `[]`. Then I restored the file.
- I did not rebuild the pre-change Core dist to run these against the literally old Core, because each build takes about 6.5 minutes. The declaration-less run stands in for it.

**Domain tests beside the touched files.** `node scripts/test-domain.mjs` on the new test, `plan-resolution/extraction/tests`, `output-nodes/extract-list/tests`, `output-nodes/tests/definitions` and `output-nodes/tests/model-facing-catalog`: 175 tests, 175 passed, 0 failed.

**Domain typecheck.**
- `pnpm --filter @fluxiq-web-extension/domain check` was refused by its Core-staleness gate: "FluxIQ Core's build ... is not current with its source. Stale: ... no stamp." This is the unstamped concurrent build above.
- So I ran the same two commands the script wraps. `pnpm exec tsc -p tsconfig.json --noEmit` exited 0. `pnpm exec tsc -p tsconfig.test.json --noEmit` exited 0, also after the test move.

**Core structure audit.** `node scripts/structure-audit.mjs`: 1 violation, `[statement-packing] .../reset-admission/tests/admission.test.ts`. That is another lane's file, not mine. None of my Core files are listed.

**Downstream structure audit.** `node scripts/structure-audit.mjs`, after the move: 2 violations, both caused by another worker's new `plan-resolution/tests/step-spot.test.ts`:
- `[directory-files] plan-resolution/tests/: 26 source files exceeds the 25-file limit`: there were 25 files plus `step-spot.test.ts`.
- `[statement-packing] .../step-spot.test.ts`.

Before the move I also had an `[imports]` violation (deep imports to `output-nodes/native-runtime` and `output-nodes/parameter-contracts`). I fixed it by importing from the `output-nodes` barrel.

## Not verified

- Live behaviour. No live run was made, per the brief.
- The domain tests against a rebuilt pre-change Core dist (see above).
- Full suites, by rule.
- How the model reads the new format sentence and `instead`. Only the contract tests ran.

## Open questions or contradictions found

1. **Ownership mismatch.** The brief places "the web read's node definition" in `D/output-nodes/extract-list/`. The definition's `metadata` is actually put together in `domain/src/output-nodes/definitions.ts` (`createWebAutomationOutputNodeDefinition`), which I do not own. I put the constant in `extract-list/rows-order.ts`, which I own, and added a 2-line wiring edit to `definitions.ts`: one import name and one spread line limited to `web.dom.extract_list`. That follows the existing `recordsPath` pattern. Please review it, or reassign the file.
2. **`run-record-output.ts` is unchanged.** "Refused at the key the model wrote" cannot be done inside that function: it only returns parameters, and the refusal path is computed by Core's rule. The authored-key reporting is done instead by the declared `recordProcessWrittenAt`, which Core reads to decide which key to refuse at. This also covers a step with no `recordOutput`, where `webPlanRunRecordOutput` writes no `process` at all; Core still sees `extractList.sort`/`maxItems` there. Keeping the mapping (t510, one reader) was left intact.
3. **The `instead` departs slightly from the brief.** When the model wrote the limit as `extractList.maxItems`, the `instead` names `extractList.maxItems: N` rather than `process.limit: N`. The read's `maxItems` wins over a record-output `process.limit` in `withReadProcess`, so telling the model to write a process limit while a different `maxItems` stands would not be literally actionable. When no maxItems is written, it names `"limit": N` in `recordOutput.process`.
4. **`MESSAGE` is unchanged.** It still begins "This listing sorts or limits its rows in recordOutput.process". That stays true of the resolved plan, but when the refusal sits at `extractList.sort` a domain-specific opening might read better. I left it alone because the old rule's message is pinned by tests.
5. **The model cannot see the capability before its first attempt.** The format sentence says "a refusal of a sort says which kind a listing is", because the node catalog does not show definition metadata, and the extract-list grammar has 0 of its 700 characters left. A domain catalog line (for example in `WEB_AUTOMATION_EXTRACT_LIST_DESCRIPTION`, which has room within 240) saying its rows go on in page order would let the model pick the right shape first time. Not done: the brief did not ask for it, and it is model-facing text.
6. **The Core build is unstamped** because other lanes edited Core while it built. The supervisor will need a clean `pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build` before `pnpm --filter @fluxiq-web-extension/domain check` will run through its gate.

### Cross-repository contract (Core doc text to add; I did not edit docs)

Proposed for Core's architecture docs, next to the node-definition metadata keys (`recordsPath`, `effect`):

> **`metadata.answersRows`** (optional, `"page_order"`): the node hands the rows it keeps to the next node in the order the page shows them, and nothing it is given reorders them. Core's listing-order rule (`flow-bootstrap/script-statements/listing-order-in-repeat.ts`) then admits a record-output `process.limit` of N with no `process.sort` and no `process.where` when every lasting For Each the listing feeds has `stopAfter` N. Its refusal of a sort names only the listing's narrowing, `repeat most` and that limit.
>
> **`metadata.recordProcessWrittenAt`** (optional, `{sort?: string, limit?: string}`): dotted parameter paths where the node's author writes the record-output process key of that name. Core counts a value there as that process key, and refuses it at that path. The web domain declares `{sort: "extractList.sort", limit: "extractList.maxItems"}` on `web.dom.extract_list` (downstream `domain/src/output-nodes/extract-list/rows-order.ts`).
