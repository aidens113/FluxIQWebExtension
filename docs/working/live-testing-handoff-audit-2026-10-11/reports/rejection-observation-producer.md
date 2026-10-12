# Rejection observation producer and contract

Status: source frozen; current owning tests, cache-free types, domain/extension builds and source audit passed. Final doc-inclusive audit/supervisor review pending.
Owner: a-review. Paired t461. Bootstrap completed before edits. Supervisor approved the positional contract, continuation helper/test expansion, minimal public client export and original trial condition index. B owns column reconciliation; C owns generic Core consumer. No edits to their source or shared docs.

## Final optional contract

`rejectedObservations?: (Observation | null)[][]` sits beside `rejectedSamples` / `rejectedSamplesAlone`. Outer length matches the condition count; inner lengths match sample lists. The domain parser rejects malformed alignment, extra keys, incorrect condition index, nonpositive provenance and unknown reader kind. Absent whole companion and null entries remain unknown legacy evidence.

    Observation = {
      conditionIndex: number, // original zero-based predicate position
      state: "present" | "absent" | "unavailable" | "withheld",
      value?: string,        // required only for present, including empty string
      source: "field" | "read",
      readKind?: "text" | "attribute" | "value" | "link" | "column",
      page: number,          // positive one-based read pass
      item: number           // positive one-based position within that pass
    }

Value is forbidden for absent/unavailable/withheld. No selector, URL, frame, target, raw DOM/attribute map, handle or executable binding. Predicate ordinal refers back to existing authored context rather than copying raw operands/descriptors into the companion. Core accepts generic closed tokens without importing web contracts or evaluating the domain predicate.

The filter records the actual value from the existing evaluation once, only when rejected evidence is requested. Membership uses the unchanged domain predicate function. Empty string stays present; undefined from a successful read is absent. A throwing/sensitive/refused read remains the current extraction fault/refusal, and creates no absent witness. Existing seen passing examples are unchanged.

Collector groups rows and observations together, preserves alone leads, deep copies and continues them across documents. Identity includes row plus observation state/value/source/kind, so contradictory observations on equal records survive; location alone does not create redundant witnesses. Legacy rows retain null observations. Checkpoint producer and restore validate companion lengths/counts and copy it without shared arrays/objects.

The action verb slices observations with their alone rows. The actual public action-result mapping copies/validates the companion. Node replay projects `leftOutOnlyByThis[].observations` aligned with emitted row labels, and optional `conditionIndex` retains the ORIGINAL predicate position when earlier zero-alone groups are omitted. Consumer must not equate group array position with predicate index. Legacy groups retain absent index/companion. Domain replay applies existing text/denied-key screening before projection: present sensitive values become explicit withheld with no value, never a placeholder claimed as the original observation.

## Exact source ownership

Extension source:
- apps/extension/src/content/extraction/item-filter.ts
- apps/extension/src/content/extraction/list-reader.ts
- apps/extension/src/content/extraction/rejected-samples.ts
- apps/extension/src/content/actions/extract-list.ts
- apps/extension/src/shared/extraction-continuation.ts
- apps/extension/src/content/extraction/continued-read/read-checkpoint.ts (approved expansion)

Domain source:
- domain/src/actions/extraction/rejected-samples.ts
- domain/src/actions/extraction/summary.ts
- domain/src/client/index.ts (approved minimal parser/type export)
- domain/src/runtime/llm-evidence/node-run/replay-answer.ts

Exact tests:
- apps/extension/src/content/extraction/tests/item-filter.test.ts
- apps/extension/src/content/extraction/tests/rejected-samples.test.ts
- apps/extension/src/content/extraction/continued-read/tests/read-checkpoint.test.ts
- apps/extension/src/content/actions/tests/extract-list-rejected-samples.test.ts
- domain/src/actions/extraction/tests/rejected-samples.test.ts
- domain/src/runtime/llm-evidence/node-run/tests/replay-read-account.test.ts (existing nearest-owner file)

No new production module or wildcard client surface. Existing seen-values.ts and extraction barrel needed no change. Output schema/reconciliation files belong to B; all Core files belong to C.

## Fail-first and owning validation

Initial filter fixture incorrectly assumed an empty string fails is:present; existing membership semantics do not. Corrected neutral predicate contains:allowed rejects the empty string without changing membership. Then temporarily used exact HEAD item-filter source with the corrected fixture, ran the narrow owner, observed1failure/8tests on missing observation capture, and restored current owned source in a finally block. This corrected baseline is the meaningful producer fail-first proof; the earlier fixture failure is not counted as product evidence. Log fxwork/t461/a-filter-corrected-fail-first.log. No branch operation or unrelated source replacement.

Domain wire fail-first1/5failed (a-fail-domain.log); node replay observation fail-first1/1failed (a-replay-fail.log). These failures occurred before their respective implementations. Initial missing minimal client export was diagnosed and added only after supervisor approval. Checkpoint copy regression found shared array reference and was fixed, not disabled.

Observed native exits0:
- `node domain/scripts/test-domain.mjs actions/extraction/tests/rejected-samples.test.ts actions/extraction/tests/summary.test.ts node-run/tests/rejection-observations.test.ts` with DOMAIN_TEST_BUILD_LABEL=t461-a-owned:23tests pass; a-domain-owned.log.
- `node apps/extension/scripts/test-extension.mjs content/extraction/tests/item-filter.test.ts content/extraction/tests/rejected-samples.test.ts content/extraction/tests/list-reader.test.ts content/extraction/continued-read/tests/read-checkpoint.test.ts shared/tests/extraction-continuation.test.ts content/actions/tests/extract-list.test.ts`:78tests pass; a-extension-owned.log.
- After final checkpoint-count/type-fixture cleanup, `node apps/extension/scripts/test-extension.mjs content/extraction/continued-read/tests/read-checkpoint.test.ts content/actions/tests/extract-list-rejected-samples.test.ts`:8tests pass; a-final-owner-subset.log.
- git diff --check passes; line-ending notices only.

Cases cover absent/empty/present numeric observation, helper read exactly once, equal row with conflicting values, multi-rejection grouping, continuation round trip/deep copy, malformed counts/alignment/addressing metadata/unknown kind, explicit unavailable/withheld/value prohibition, thrown read with no absent witness, action-result mapping/alone slicing, credential withholding before replay evidence and sparse original predicate index. Neutral unit fixtures only; no model guidance/site task/example or oracle answers shipped.

## Handoff and remaining gates

Downstream source freeze sent to supervisor/B/C after narrow tests. Actual package types/builds and source-only audit are now observed as recorded below. Final native audits after supervisor documentation freeze remain coordinated; no post-doc audit is claimed. C owns actual generic stored/trial/saved judge consumption and screening; this report proves producer/wire/node-replay seams, not its final consumer integration or live verdict correctness. No browser/provider/panel/full suite/commit/merge/shared-doc/source-sync action. Supervisor retains independent verification/integration and authored architecture docs.


## Final current-source gates and structure correction

The initial native downstream audit found26test files against25limit and two packed-statement lines. No budget/baseline expansion: folded the two new neutral node-replay regressions into existing node-run/tests/replay-read-account.test.ts, deleted only the newly created test file, and unpacked the statements. Root/B/C notified before briefly reopening source, then notified at final refreeze. Tests now discovered under the existing owner; prior new-file test results are historical.

Current domain owner command, DOMAIN_TEST_BUILD_LABEL=t461-a-current:

    node domain/scripts/test-domain.mjs actions/extraction/tests/rejected-samples.test.ts actions/extraction/tests/summary.test.ts node-run/tests/replay-read-account.test.ts

Native0,40tests pass; a-domain-current.log. Final downstream native structure audit0 on stable source before supervisor authored doc edits; a-downstream-structure-final.log. No claim of a post-doc audit; supervisor asked workers to hold native audits until doc-freeze signal.

After C froze source and forced current Core library output (C reports7262outputs/digeste274f117a232ef898a6256ff1942f989191ac7932b6d23b693ba1926e1c31934), actual cache-free source/test checks ran on that paired output:

    pnpm.cmd --filter @fluxiq-web-extension/domain exec tsc -p tsconfig.json --noEmit --incremental false
    pnpm.cmd --filter @fluxiq-web-extension/domain exec tsc -p tsconfig.test.json --noEmit --incremental false
    pnpm.cmd --filter @fluxiq-web-extension/extension exec tsc -p tsconfig.json --noEmit --incremental false

All actual native0,6.9s/8.8s/10.0s respectively; a-domain-types.log/a-domain-test-types.log/a-extension-types.log. These invoke tsc directly, not cached wrapper success.

    pnpm.cmd --filter @fluxiq-web-extension/domain build
    pnpm.cmd --filter @fluxiq-web-extension/extension build

Both actual native0/current-Core guard passed and commands rebuilt changed inputs rather than stamp reuse. Domain11.300s/1143outputs/3,447,104bytes; extension17.236s/80outputs/46,233,084bytes, chrome/firefox/e2e-chromium targets each verified22files. Logs a-domain-build.log/a-extension-build.log. Existing Firefox placeholder addon-id warning remains unchanged, unrelated to this source unit. Domain was built before extension, no output race. All check/build sessions ended; source remains frozen.

## Bounded provider-free headed proof options (not launched)

Preferred: existing T2 realistic content harness on everything-store, a new owned profile and current stamped content/extension artifact. Use actual compiled production gateway command mapper and extract-list dispatch, rather than hand-shaped BrowserAction, through actual content action and public domain result mapping. Send that packet through compiled Core extraction-summary/read-account owner to prove per-row helper observation delivery, sparse condition indices, field order/alignment and screened evidence. Compare independent fixture DOM only as safe state/value-equality booleans and order ordinals; retain full packets/captures privately outside disposable worktree. No fixture patch, synthetic browser page, model, user panel, original lane reset or speculative semantic verdict. Limitation: this seam does not prove background/WebSocket/full Core-host delivery.

Alternative: full provider-disabled isolated extension topology on the same allowed realistic scenario, with explicit new owned project/profile and actual runtime receipt, has broader end-to-end coverage but needs its own written ownership/build/launch brief. No promoted C Flow currently exists; do not replay an invented qualifying Flow or reconstruct task answers as model guidance. Await supervisor's written proof brief before any browser launch. Unit privacy proof covers dummy credentials; browser proof must state actual sensitive-value count and avoid claiming withholding if that count is0.

## Authorized headed rejection proof: retained diagnostic attempts

Supervisor authorized existing T2 everything-store harness with current stamped production content, two diagnostic reads, no providers/Core host/panel/fixture changes. Driver and retained evidence are outside disposable paired trees:

    $env:FLUXIQ_TEST_ENV_FILES='none'
    $env:FLUXIQ_LLM_RUN_COST_CEILING_USD='0.25'
    node C:/Users/osrs_/FluxStuff/lab-runs/2026-10-12/t461-rejection-proof-driver.mjs

Pre-browser attempt `t461-rejection-proof-1791791789929` failed because private driver used CommonJS createRequire.resolve on import-only public Core nodes export. No browser/profile was created. Corrected only driver to exact compiled import target; original evidence retained.

First browser attempt `t461-rejection-proof-1791792015830` used a fresh retained headed Chromium profile, actual standard gateway mapper and content action, public domain result mapper, and compiled Core summary/read-account projection. Provider credential environment count0/provider calls0. Both content commands succeeded. Kept read produced20rows/0invalid; authored schema order1,2,3,4 preserved despite field-map order4,1,3,2, and compiled Core columns/sample-row order matched. Opposing diagnostic read saw20items, four predicates, rejected counts0/16/4/6, alone counts0/14/0/0, aligned14absent observations at original predicate index1. Public observation keys contain no addressing. No semantic eligibility/goal claim.

Driver assertions failed: earlier independent DOM sample contained15items, while subsequent content extraction saw20; four observation ordinals exceeded that earlier sample. Core observations equal wire after object-key canonicalization; driver's JSON.stringify comparison incorrectly required key insertion order. Opposing predicates plus numeric diagnostic cutoff also yielded only absent-alone observations, so assertion requiring present-alone coverage was unsupported. These are driver/probe defects; neither content success nor failed assertion establishes product rejection-observation failure. Private packets/screenshots/profile retained. Native exit1; no automatic unchanged relaunch.

Current stamped e2e content identity inputs digest `ffd6c7c463d716cbf808cc3a92f0564b4a168f078abd31178b5ab8022b2b9d78`; actual content hash `272ce5fc3fea47dcd47706d6b6636abe80d4cc958a397d6ba0b4a3016a8570d7`; compiled Core artifact digest `e274f117a232ef898a6256ff1942f989191ac7932b6d23b693ba1926e1c31934`. Separately retained normal-builder metafiles/hashes cover556inputs matching current production stamp inputs; normal placeholder bundle was not executed and no running stamp fabricated. Pipeline packet hash `69a7c440ac24db879f71bc96b184acfc1e265d71df11d6d144941af8f8b55e77`.

Actual browser page had2nonempty password/hidden input values; diagnostic readers did not request those controls, so this proof does not test withholding them. Owner-unit privacy proof remains separate. Continuation recovery is owner-unit-only here. T2 bypasses background/WebSocket/Core-host transport, uses an in-memory wrapper around compiled Core summary consumers rather than actual persisted runtime dispatch, and invokes no model judge. No broader end-to-end or semantic pass claimed. A bounded corrected fresh-browser proof awaits supervisor clearance.

## Corrected headed proof: passed, bounded seam

Supervisor cleared exactly one corrected fresh headed browser after the retained diagnosis. Private driver changes only: numeric diagnostic uses atMost3, independent DOM resampled immediately after extraction with before/after/itemSeen count equality, observation object keys canonicalized for equality, and actual CDP browser version recorded. Schema field-id/record key ordering remains exact and is never canonicalized. No product or fixture changes.

Command above ran native0; `a-headed-rejection-proof-final.log`. Final evidence outside cleanup:

    C:/Users/osrs_/FluxStuff/lab-runs/2026-10-12/t461-rejection-proof-1791792249162/proof.json
    C:/Users/osrs_/FluxStuff/lab-runs/2026-10-12/t461-rejection-proof-1791792249162/private-pipeline.json
    C:/Users/osrs_/FluxStuff/lab-runs/2026-10-12/t461-rejection-proof-1791792249162/private-kept-pipeline.json

Driver copy, normal-builder metafiles, exact production artifacts/stamps, private screenshot and fresh browser profile retained beside packets. Earlier failed attempts remain unchanged. Chrome/134.0.6998.35, headed1280x720, localeen-US/timezoneUTC; existing everything-store search page via established T2 facade. Normal-builder556inputs matched current stamp; executed current stamped production content hash `272ce5fc3fea47dcd47706d6b6636abe80d4cc958a397d6ba0b4a3016a8570d7` and same Core artifact digest listed above. No fabricated running identity receipt.

Two bounded diagnostic content commands, both succeeded; actual compiled extract-list dispatch and gateway mapper supply options, actual content action and public result mapper supply packets. First kept20rows/0invalid; requested/dispatch/compiled Core schema order1,2,3,4 preserved despite field-map order4,1,3,2. All compiled Core sample row key orders correct. Second read saw20items; independently observed before/after count stable20, itemSeen20. Four original predicates, rejected counts0/16/4/13, alone counts0/3/4/0 and aligned witness counts0/3/4/0. Three absent and four present observations independently matched actual DOM values/state; unavailable/withheld counts0. Opposing predicates exclude every row, and13 also fail the additional numeric predicate: multi-rejected rows do not enter alone witnesses. This is diagnostic accounting, not a task answer or eligibility/goal claim.

Wire companion/sample dimensions align; each witness retains original predicate index. Compiled Core saved read-account observation arrays equal wire after object-key canonicalization, all seven observations; domain trial replay groups retain sparse original indices1,2 rather than filtered group positions0,1. Public observation keys limited to approved passive union; no selectors/URLs/handles/raw metadata/addressing. Pipeline packet hash `7817696f67acee54218966dae1ec093460541ae9f4dfbbf59973a4d31c804fa7`. Safe proof reports only counts/order/state/equality/hash; raw labels/rows/values retained privately.

Provider credential environment count0/provider calls0; no Core host/panel/model/fixture mutation. Browser page again had2nonempty sensitive input values, but readers did not request those controls: no live withholding claim. Privacy/legacy-null/withheld/continuation remain owner-unit proof. Standalone browser read is exercised; continuation recovery is not. Compiled Core summary/read-account is invoked through an in-memory passive wrapper, not a persisted runtime dispatch; T2 bypasses background/WebSocket/gateway transport. No transport/model-verdict/semantic pass claimed. All browser/probe processes ended; profile/evidence preserved; product source remains frozen. Supervisor independent inspection pending.

## Supervisor acceptance

Root independently inspected source and observed Core72/domain78/extension83 owning tests, all cache-free affected typechecks and both native audits passed. Headed Chrome134 T2 packet/hash/DOM/schema-order checks passed independently; no background transport, model verdict, continuation or live withholding claimed. Current-dev integration and combined-source narrow gates still required before publication.
