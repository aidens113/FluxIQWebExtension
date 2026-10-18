# Codex social read completion diagnosis (t566)

Status: Complete for supervisor review/integration. All narrow gates and provider-free Chromium proof passed. No paid live runs; no commits or pushes.

## Verified from archived run inputs/results

Inspected archived `run-mvd94oxq-e2b9abb5` locally, projecting configuration shapes and counts rather than copying page values or credentials into this report.

- Latest inspected submitted Flow declares dedupe in `recordOutput.process.dedupe.by`, naming its URL helper, while its `extractList` itself has no dedupe. Its authored schema marks that helper excluded, and `process.columns` lists only the five displayed answer columns.
- The actual judge input reports **94 collected, 9 duplicates removed, 81 filtered out, 4 kept**. The four displayed samples contain only **three distinct whole displayed rows**, one duplicate pair, and **three text cells ending with the disclosure control**. Therefore `reads[].dedupes: false` does not mean the dataset did not deduplicate; the dataset demonstrably removed nine duplicates.
- Archived exploratory read values include **28 post-link readings, 24 distinct raw values, 22 distinct path identities**; their only query key names are `__cft__[0]` and `__tn__`. No query values or post paths are copied here. Fixture source confirms each rendering's salt changes these tracking values while a repeated post keeps its post path.
- The submitted text field selects the message container, not a complete-text source. Fixture `markup/unit.ts` removes the undisclosed remainder from DOM entirely; `client/unit-script.ts` restores it only after an explicit disclosure press. A passive read cannot obtain the full text by changing textContent/innerText or selectors.

## Source-backed causes

1. **Tracking-bearing URL identity is a real cause.** `content/extraction/field-reader.ts::linkTarget` returns the link's raw resolved href. Dataset dedupe compares its helper values, so two appearances differing only in known tracking query values survive. Distinct meaningful parameters must remain distinct; dropping every query is unsafe.
2. **The schema's authored exclusion is not the missing helper cause.** `declared-columns.ts` retains helpers named by `process`, and `reconciled-record-output.ts` derives their real read schema. The resulting link helper is stored for processing and hidden from answer columns. Existing declared-column tests exercise this arrangement. The run's nine removals are consistent with it working.
3. **Judge dedupe metadata is stale relative to the one-page architecture.** Core `runtime/result-verification/read-account/accounts.ts::account` reads only `authored.dedupe` from the extraction request; it ignores `recordOutput.process.dedupe`. This is why the judge receives `dedupes: false` despite nine actual dedupe removals. It needs a generic processing-account fix, separate from URL identity.
4. **Incomplete text is a missing capability/evidence issue, not an ordinary text parser bug.** The field correctly reads what is displayed, including the disclosure. Completing it requires an explicitly authored executable step or option, routed through normal action safety. Structure detection and other passive observations must never click it implicitly. Existing row-bound repeat/click behavior can execute a disclosure once the Flow authors it.

## Initial proposed boundary (superseded by authorization below)

URL handling belongs downstream. A focused helper beside field-reader can recognize a closed list of known tracking-only query names, preserve every unknown parameter and fragment, and normalize only requested link identity. Whether that becomes default link extraction or an explicit field option is a product-contract decision; automatically changing raw `attribute: href` reads would violate their exact-attribute contract.

Disclosure requires explicit author intent. Safe options are (a) expose a row's incomplete-text/disclosure evidence and refuse silently truncated required full-text reads, so the author adds existing row-bound click steps, or (b) add an explicit disclosure option to the executable extraction contract and route its presses through the existing action gate. An automatic click added to passive discovery or a bare `.click()` in field-reader is not acceptable. The fixture's disclosure has `role=button` but no aria-expanded/aria-controls, so requiring those attributes alone cannot cover the measured path.

Initial diagnosis made no source edits. No scenario task, oracle or legacy multi-page reader has changed during implementation.

## Authorized first implementation ownership

Supervisor approved opt-in tracking-free identity **only for explicitly deduped excluded link helpers**, preserving displayed/raw href values, meaningful/unknown query parameters and fragments; and generic Core dedupe metadata. Exact downstream paths: `domain/src/actions/extraction/{request,read-request,schema}.ts`, owning `tests/read-request.test.ts`; `domain/src/output-nodes/extract-list/{dedupe-link-identity,dispatch,index}.ts`, owning `tests/dedupe-link-identity.test.ts`; `apps/extension/src/content/extraction/{field-reader,field-spec}.ts`, owning `tests/{field-reader,field-spec}.test.ts`; new focused `apps/extension/src/content/extraction/link-identity/{index,link-identity}.ts` and its `tests/link-identity.test.ts`; authored `docs/architecture/extension-client.md`. The helper uses a directory because extraction's root already has 25 source files. Exact Core paths: `packages/fluxiq/src/programs/automation-studio/runtime/result-verification/read-account/{accounts.ts,tests/accounts.test.ts}`, plus generic authored architecture note.

Disclosure decision: preserve existing explicit row-bound click actions; add truthful incomplete-text evidence/refusal and generic feedback so an unexpanded field never silently claims completeness. No implicit expansion action inside detection or reads.

## Additional authorized ownership and implementation

Supervisor explicitly authorized `content/extraction/text-disclosure/{index,text-disclosure}.ts`, its `tests/text-disclosure.test.ts`, existing `field-reader.ts`/test, `content/actions/tests/extract-list.test.ts`, `content/extraction/tests/list-reader.test.ts`, and authored extension-client documentation. A visible in-field native/role button with a positive text-expansion caption refuses executable list text or table-column reading with existing `web.validation.output_not_observed` and `incomplete_text` repair feedback. No page text enters the failure. Expanded controls, hidden controls/ancestors, plain prose, sibling controls and unrelated buttons are ignored. The existing typed-refusal boundary propagates it whole instead of skipping a row as an item fault or storing partial text. Feedback directs an explicit registered row-bound click, then re-reading.

Supervisor review identified passive inference also calling readField. The authorized correction owns `content/extraction/list-reader.ts`, `item-filter.ts` and owning tests: readField defaults to visible/passive preview, with explicit complete mode only for executable list and filter reads. `infer-fields.ts` remains untouched, avoiding conflict with R1. Scalar extraction has a separate reader and is outside this list-specific completeness guard.

Supervisor authorized realistic proof at `apps/extension/e2e/content/tests/extraction/tests/social-read-completion.spec.ts`. It uses only `social-network-feed`, real content bundle, headless Chromium, no provider. Test-only targeting corrections were necessary: fixture mounting removes data-uid, and expansion replaces the message element (losing its generated id). Final proof binds the article's ARIA position and selects its message within that row, surviving expansion. No fixture source changes.

Typecheck identified exhaustive optional-field constructors. Supervisor authorized `domain/src/runtime/llm-evidence/plan-resolution/extraction/columns.ts` and `tests/columns.test.ts`, plus `domain/src/runtime/llm-evidence/structure/packet.ts` and `tests/record.test.ts`. They preserve explicit link identity through handles and required-field mapping; raw attribute conversion omits it. Core authored note is `docs/architecture/automation-studio.md`.

## Validation in progress

- Core read-account tests **25/25 passed**; `pnpm --filter fluxiq check` **passed**, 135.6 s; structure audit **passed**, 401 advisory warnings / 1154 baselined.
- Core libraries built with `$env:FLUXIQ_BUILD_CACHE_DIR='off'; node scripts/build-cache/cli.mjs contracts:build fluxiq:build client-gateway-websocket:build`: **passed**. Contracts/gateway reused stamps; fluxiq rebuilt68.4 s. No Core source changes after build/check. No web build or full suite.
- Domain affected directories final **276/276 passed**, label `codex-social-final`: actions/extraction/tests, output-nodes/extract-list/tests, runtime/llm-evidence/plan-resolution/extraction/tests and structure/tests. Initial275/276 had only a new test incorrectly expecting explicit required:false where existing unset behavior omits it; corrected assertion. Final domain package typecheck **passed**,112.2 s.
- Extension final executable/passive seam run **265/265 passed**, label `codex-social-final2`, covering extraction/tests, link-identity/tests, text-disclosure/tests and actions/tests/extract-list.test. Prior focused24/24,61/61 and264/264 also passed.
- Final downstream structure audit **passed**,208 advisory warnings /638 baselined after executable/passive seam.
- Final Chromium proof **2/2 passed**, headless Chromium content harness,1 worker,1.4m. Normal collapsed-page detectStructure succeeded; executable extraction refused without pressing or returning partial rows; explicit registered scoped click expanded; same-row read passed with full visible text. Repeated-post helpers shared identity while requested raw URLs retained tracking. No paid live, full Flow, background routing, Core dataset replay or zero-call whole replay is claimed.
- Final review tightened automatic identity eligibility to require an explicit process.columns projection omitting the helper. Without that list, reconciliation may display a schema-excluded helper, so treating absence as an empty displayed set would alter requested output. Added regression **2/2 passed**; final domain check **passed and stamped**,56.2s; final audit **passed**,208 warnings/638 baselined. Source remains within approved paths.
- Extension check first completed exit0 but correctly declined to stamp when the last domain safeguard changed its inputs during the run. Final extension check on frozen source **passed and stamped**,208.3s, including source/test typechecks and every browser-entry bundle.

## Exact changed downstream files

Exact Core files: `packages/fluxiq/src/programs/automation-studio/runtime/result-verification/read-account/accounts.ts`, its `tests/accounts.test.ts`, and `docs/architecture/automation-studio.md`. Built/checked Core HEAD `d79b322e207f8d99f7cc0be0841e436fea326277` plus those uncommitted source/docs changes.

Narrow repeat commands (PowerShell, from each named package/repository):

```powershell
# t566/!FluxIQ, cache off
pnpm.cmd --filter fluxiq exec vitest run src/programs/automation-studio/runtime/result-verification/read-account/tests/accounts.test.ts
pnpm.cmd --filter fluxiq check
node scripts/structure-audit.mjs
# t566/!FluxIQWebExtension/domain
$env:DOMAIN_TEST_BUILD_LABEL='codex-social-final'
node scripts/test-domain.mjs actions/extraction/tests output-nodes/extract-list/tests runtime/llm-evidence/plan-resolution/extraction/tests runtime/llm-evidence/structure/tests
# t566/!FluxIQWebExtension/apps/extension
$env:EXTENSION_TEST_BUILD_LABEL='codex-social-final2'
node scripts/test-extension.mjs content/extraction/tests content/extraction/link-identity/tests content/extraction/text-disclosure/tests content/actions/tests/extract-list.test
node scripts/test-content.mjs social-read-completion.spec.ts --workers=1
# t566/!FluxIQWebExtension
pnpm.cmd --filter @fluxiq-web-extension/domain check
pnpm.cmd --filter @fluxiq-web-extension/extension check
node scripts/structure-audit.mjs
```

Completeness limitations: positive native/role-button text-expansion evidence only. CSS-only clipping without such a control, arbitrary site-specific captions, closed shadow content, scalar extraction, full Core replay/background lifecycle and model-authored repair are not established by these tests. No generic Core continuation contract or implicit action was added.

- apps/extension/src/content/actions/tests/extract-list.test.ts
- apps/extension/src/content/extraction/field-reader.ts
- apps/extension/src/content/extraction/field-spec.ts
- apps/extension/src/content/extraction/item-filter.ts
- apps/extension/src/content/extraction/list-reader.ts
- apps/extension/src/content/extraction/tests/field-reader.test.ts
- apps/extension/src/content/extraction/tests/field-spec.test.ts
- apps/extension/src/content/extraction/tests/item-filter.test.ts
- apps/extension/src/content/extraction/tests/list-reader.test.ts
- docs/architecture/extension-client.md
- domain/src/actions/extraction/read-request.ts
- domain/src/actions/extraction/request.ts
- domain/src/actions/extraction/schema.ts
- domain/src/actions/extraction/tests/read-request.test.ts
- domain/src/output-nodes/extract-list/dispatch.ts
- domain/src/output-nodes/extract-list/index.ts
- domain/src/runtime/llm-evidence/plan-resolution/extraction/columns.ts
- domain/src/runtime/llm-evidence/plan-resolution/extraction/tests/columns.test.ts
- domain/src/runtime/llm-evidence/structure/packet.ts
- domain/src/runtime/llm-evidence/structure/tests/record.test.ts
- apps/extension/e2e/content/tests/extraction/tests/social-read-completion.spec.ts
- apps/extension/src/content/extraction/link-identity/index.ts
- apps/extension/src/content/extraction/link-identity/link-identity.ts
- apps/extension/src/content/extraction/link-identity/tests/link-identity.test.ts
- apps/extension/src/content/extraction/text-disclosure/index.ts
- apps/extension/src/content/extraction/text-disclosure/tests/text-disclosure.test.ts
- apps/extension/src/content/extraction/text-disclosure/text-disclosure.ts
- docs/working/breadth-forty-tasks-plan/reports/codex-social-read-completion.md
- domain/src/output-nodes/extract-list/dedupe-link-identity.ts
- domain/src/output-nodes/extract-list/tests/dedupe-link-identity.test.ts
