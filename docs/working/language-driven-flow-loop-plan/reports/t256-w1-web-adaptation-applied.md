# t256-w1: the web app says whether an adaptation's patch was applied, and why not

## Outcome

Done. Core already delivers `applied` and `notAppliedReason` all the way to the web client. The only place they were dropped was the Adaptations view, which never read them. The view now shows both, and tests pin both the record path and the rendering.

## Trace

1. `runtime/service/runtime-adaptation/judged-promotion.ts` `settleOne` writes `metadata.approvalDecision` with `applied: true`, or with `applied: false` plus `notAppliedReason` (and `error` for `apply_failed`). It saves this through `saveFlowAdaptation`.
2. `service.ts` `saveFlowAdaptation` calls `AutomationStudioProjectAdaptationStore.putAdaptation`. `storage/project/adaptation-store.ts` `adaptationStatusDetail` stores the whole `adaptation.metadata` in `status_detail_json`. `adaptationFromRow` reads it back as `metadata`. `applyApprovedAdaptation` spreads the existing metadata, so the decision survives the apply. If there is no typed store, the JSON fallback writes the whole adaptation.
3. `service.ts` `getFlowAdaptation` returns `adaptationFromTypedStoreDetail(...)` (`runtime/service/adaptation-projections/typed-store.ts`), which spreads `detail.adaptation.metadata`. That keeps the decision.
4. `api/handlers/runs.ts` `get-flow-adaptation` returns `{ adaptation: await service.getFlowAdaptation(...) }` unchanged.
5. In the web app, `adaptation-queries.ts` `getFlowAdaptation` types the adaptation as `any` and passes it through untouched.
6. Where it was dropped: `AdaptationsView.tsx`. The "Current Decision" section read only `autoApply`, `requiresManualApproval` and `reason`. Its header even said "Automatically allowed" for a patch that had been held back.

The list summary rows (`list-flow-adaptations`, `adaptationSummaryFromTypedStore`) do not carry the decision. The inbox table shows only the lifecycle status. I did not change that, because the brief asked for the view's detail.

No edits were needed under the forbidden directories `runtime/flow-bootstrap/`, `runtime/flow-draft/`, `runtime/llm/` or `runtime/result-verification/`, and none were made. No Core source changed; only a test was added.

## What changed and why

Core tree: `C:/Users/osrs_/FluxStuff/fxwork/t256/!FluxIQ`

- **New file:** `apps/web/src/features/automation-studio/adaptations/application-state.ts`. It exports `adaptationApplication(adaptation)`, which returns `{ state, title, detail }` or `null`, and the type `AdaptationApplication`.
  - **Applied:** "Applied to the Flow", with the detail "A whole run from the Flow's start used this change and its result was judged to answer the request." If the adaptation was later reverted, it adds "It was reverted later."
  - **Held back:** "Not applied to the Flow", with one plain sentence for each of Core's eight reasons: `not_rerun`, `run_cancelled`, `run_failed`, `refuted`, `not_judged`, `run_parked`, `run_errored`, `apply_failed`.
    - For `apply_failed` it adds "The Flow said: <error>".
    - If a person later applied it through review, it adds "A person applied it later through review."
    - An unknown code is named in brackets, not hidden.
  - **Still waiting** (`applied: false` with no reason yet): "Waiting for a judged run".
  - **No boolean `applied`** (for example a manual-review decision): returns `null`, and no section is shown.
- `AdaptationsView.tsx`: on the Summary tab, a new section labelled "Whether this change is in the Flow" sits before "Current Decision". It has the header "In The Flow", shows the title in the header span, and puts the detail in `automation-adaptation-copy`. It uses the same pattern as the neighbouring Scope and Current Decision sections. The change is 6 lines.
- `adaptations/index.ts`: the barrel now exports `./application-state`.
- **Tests:**
  - `apps/web/.../adaptations/tests/application-state.test.ts` (new, 5 cases): every state, all eight reasons in distinct plain wording that never shows the raw code, apply_failed with its error, a later manual apply, an unknown reason, waiting, and `null`.
  - `apps/web/.../adaptations/tests/adaptations-view.test.tsx`: one new case. It renders `AdaptationsViewContent` with an applied adaptation and a held-back (`run_parked`) one, and asserts the section's title and plain-words detail. It also asserts that the raw code is absent.
  - `packages/fluxiq/src/programs/automation-studio/runtime/service/adaptation-projections/tests/judged-decision.test.ts` (new, 2 cases): a held-back decision round-trips through the real typed store (`putAdaptation` then `getAdaptation`) and `adaptationFromTypedStoreDetail` with `applied` and `notAppliedReason` intact. An applied decision keeps `applied: true` after `applyApprovedAdaptation`.

I first placed the Core test in `storage/project/tests/`. That pushed the directory to 26 files, over the 25-file budget, and I could not append to `adaptation-store.test.ts` because it is already 787 of 800 lines. So it lives in the projection's own `tests/` folder and imports the store through the `storage/project` barrel. I named the web file `application-state.ts` rather than `adaptation-application.ts` because a fifth `adaptation-` prefix fails the naming rule (baseline 4).

## Commands run and observed results

- `npx vitest run src/programs/automation-studio/runtime/service/adaptation-projections/tests` (in packages/fluxiq): 1 file, 2 tests passed.
- `npx vitest run src/features/automation-studio/adaptations/tests` (in apps/web): 6 files, 27 tests passed. The output also has the existing "react-test-renderer is deprecated" stderr notices.
- `bash heavy.sh "t256 fluxiq check" pnpm --filter fluxiq check`: exit 0 (tsc built, about 8.4 s on the rerun).
- `bash heavy.sh "t256 web check" pnpm --filter @fluxiq/web check`: exit 0 (tsc --noEmit, about 44.7 s).
- `node scripts/structure-audit.mjs`, first run: 2 violations, both mine (directory-files on storage/project/tests at 26 files; naming on the 5th `adaptation-` prefix). After moving and renaming the files: "structure-audit: passed (228 warning(s), 349 baselined)."
- `node scripts/docs-reference.mjs --check`: "Deterministic framework reference is current." No public declaration changed, so nothing was regenerated.

## Not verified

- The view has not been seen in a live browser or the running web panel; only the react-test-renderer render was checked.
- The JSON-fallback store path (no project database) has no new test. It writes and reads the whole adaptation object, so it carries the fields by construction.
- The inbox list does not show the applied or held-back state; only the detail Summary tab does.
- No full suites were run, per the brief.

## Open questions or contradictions found

- The "Current Decision" header still says "Automatically allowed" for a held-back patch. That is accurate about the promotion gate, but next to "Not applied to the Flow" it can read oddly. Rewording it to "Allowed after a judged run" when `applyAt === "judged_whole_run"` would be a one-line follow-up. I left it alone to keep the scope narrow.
- The list summaries could carry `applied` and `notAppliedReason` if the inbox should show them. That would mean editing `summaries/sql-conversions.ts` and the store's list columns, which is outside this brief.

## Follow-up

The coordinator asked for two things. First, "Current Decision" must not say "Automatically allowed" for a patch that was not applied. Second, the inbox rows must show the three states in short form.

### Outcome

Done. The list rows needed a Core change, because `list-flow-adaptations` summaries did not carry the decision at all. No forbidden directory was touched.

### What changed and why

All paths are relative to the Core tree `C:/Users/osrs_/FluxStuff/fxwork/t256/!FluxIQ`.

**Core**

- **New file:** `packages/fluxiq/src/programs/automation-studio/runtime/durable-behavior/judged-application.ts`.
  - It holds the type `AutomationStudioJudgedApplication = { applied: boolean; notAppliedReason?: string }` and the function `automationStudioJudgedApplication(decision)`. The function returns `undefined` for a decision that never recorded `applied`.
  - I put it beside the existing judged-decision readers (`judged-decision.ts`), since that directory depends only on core. Both storage and the service can import it; storage already imports `runtime/flow-change`.
  - It is exported from the directory barrel.
- `storage/project/adaptation-store.ts`:
  - `AutomationStudioAdaptationSummaryRecord` gains an optional `judgedApplication`.
  - `summaryFromRow` reads it from `status_detail_json`'s `metadata.approvalDecision`. That column is already in the row, so the list still reads no object payloads. The file is now 779 lines, under the 800 limit.
- `runtime/service/summaries/sql-conversions.ts`: `adaptationSummaryFromTypedStore` passes `judgedApplication` through.
- `runtime/service/adaptation-projections/listing-rows.ts`: `adaptationSummaryFromAdaptation` sets `judgedApplication` for the JSON-index path, used by projects without a database.
- `runtime/service/indexes/types.ts`: `AutomationStudioAdaptationSummary` gains an optional, documented `judgedApplication`.
- `docs/reference/framework-reference.md` and `packages/fluxiq/docs/reference/framework-reference.md` were regenerated with `node scripts/docs-reference.mjs` (3034 public declarations, up 2: the new type and the new function).

**Web**

- `adaptations/application-state.ts`:
  - `AdaptationApplication` gains `decision`, the Current Decision heading, and `short`, the inbox words.
  - The helper now also reads a row's `judgedApplication` when there is no `metadata.approvalDecision`.
  - Each reason has a short plain form, for example "Not applied: result judged wrong" or "Not applied: run waiting on a person".
  - Other short forms: "Applied to the Flow", "Applied, then reverted", "Waiting for a judged run", and "Held back, then applied by a person".
- `AdaptationsView.tsx`:
  - The Current Decision header uses `application.decision` when the decision recorded `applied`: "Allowed automatically and applied", "Allowed automatically, but held back", or "Allowed automatically, waiting for a judged run".
  - A held-back or waiting patch also gets the same plain sentence as "In The Flow", under the decision's own reason.
  - Decisions without `applied` keep the old wording, for example "Manual review required".
  - Each inbox row shows the short form as a `<small>` under the status badge in the Status cell. It follows the same pattern as the adaptation id under the trigger, so the table keeps its 4 columns.

**Tests**

- `runtime/durable-behavior/tests/judged-application.test.ts` (new, 3 cases): the reader.
- `runtime/service/adaptation-projections/tests/judged-decision.test.ts` (+2 cases):
  - `listAdaptationsPage` rows passed through `adaptationSummaryFromTypedStore` carry held back with its reason, waiting, and nothing for a manual decision. This uses the real typed store.
  - `adaptationSummaryFromAdaptation` carries the same for the JSON index.
- `adaptations/tests/application-state.test.ts` (+2 cases):
  - The decision heading and short form for every state, and no "Automatically allowed" for any of the eight reasons.
  - A row's `judgedApplication` is read the same way.
- `adaptations/tests/adaptations-view.test.tsx`:
  - The summary case now also checks that the Current Decision section has the matching heading, never contains "Automatically allowed", and carries the reason sentence for the held-back patch.
  - A new case renders the inbox with applied, held-back, waiting and manual rows and checks each row's text.

### Commands run and observed results

- `npx vitest run .../adaptation-projections/tests .../durable-behavior/tests .../storage/project/tests/adaptation-store.test.ts` (in packages/fluxiq): 4 files, 33 tests passed. This includes the existing adaptation-store suite.
- `npx vitest run .../runtime/service/summaries/tests .../runtime/service/indexes` (in packages/fluxiq): 8 files, 65 tests passed.
- `npx vitest run src/features/automation-studio/adaptations/tests` (in apps/web): the first run had 1 failure, my own test. The original applied case used `toEqual`, which broke once the two new fields were added; I changed it to `toMatchObject`. The rerun gave 6 files, 30 tests passed.
- `bash heavy.sh "t256 fluxiq check" pnpm --filter fluxiq check`: exit 0.
- `bash heavy.sh "t256 web check" pnpm --filter @fluxiq/web check`: exit 0.
- `node scripts/structure-audit.mjs`: "structure-audit: passed (228 warning(s), 349 baselined)."
- `node scripts/docs-reference.mjs --check`: the first run printed "docs/reference/framework-reference.md is stale". I then ran `node scripts/docs-reference.mjs`, which wrote both reference files. A rerun of `--check` printed "Deterministic framework reference is current."

### Not verified

- No live browser or running panel was checked for the inbox or the Current Decision section; only react-test-renderer renders were.
- Rows written to the JSON index before this change have no `judgedApplication` until the adaptation is saved again. Typed-store rows read it live from `status_detail_json`, so they need no backfill.
- No full suites were run.

### Open questions

- The held-back reason sentence now appears in both "In The Flow" and "Current Decision" on the Summary tab, as asked. If that reads as repetitive, "In The Flow" could drop its paragraph for the not-applied state.
- No authored architecture doc in Core describes the adaptation listing row. I updated only the generated reference.

### Follow-up 2: the reason is said once

The coordinator asked for the held-back reason sentence to appear once on the Summary tab. This replaces the previous open question about the repeated sentence.

- `AdaptationsView.tsx`: removed the extra paragraph under "Current Decision". That section now has only its heading ("Allowed automatically and applied", "Allowed automatically, but held back" or "Allowed automatically, waiting for a judged run") and the decision's own recorded reason. The full plain-reason sentence stays in "In The Flow" only.
- `tests/adaptations-view.test.tsx`, in the summary case, for both the applied and the held-back adaptation:
  - The Current Decision section does not contain the reason sentence.
  - The Summary tab body (`automation-adaptation-detail-body`) contains the sentence exactly once.
- **A fix to my earlier test.** The Current Decision lookup took the first `section` whose text includes "Current Decision". That was the outer workspace section, so the follow-up's heading assertions were weaker than intended. It now takes the innermost match (`.at(-1)`), which is the Current Decision section itself. The first run of the new assertion failed for exactly this reason: the outer section contained the "In The Flow" sentence.

Commands and observed results:
- `npx vitest run src/features/automation-studio/adaptations/tests` (in apps/web): the first run had 1 failure, caused by the outer-section lookup described above. After the fix: 6 files, 30 tests passed.
- `bash heavy.sh "t256 web check" pnpm --filter @fluxiq/web check`: exit 0.
- `node scripts/structure-audit.mjs`: "structure-audit: passed (228 warning(s), 349 baselined)."
- Core was not changed in this step, so `pnpm --filter fluxiq check` was not rerun.

Not verified: the change has not been seen in a live browser.
