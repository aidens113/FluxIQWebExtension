# Codex live acceptance lane 3

Status: disclosure recovery repair complete and frozen for supervisor integration; all final gates passed. Earlier recent-group-posts paid run failed and was debugged. Paid queue remains held for supervisor release.

Initial preparation of paired task `task/t566-a8-lane-4`: downstream HEAD `be9639c4e069f5428ace62de9e9cd1d2a8e827a3`, Core HEAD `c4c23666b0e7632fcc8af569706e3580be006930`. Both were clean then. Supervisor committed social fixes at downstream `97f970e7` / Core `7005f611`, independently reviewed/tested them, then merged latest dev into both trees without conflict. Later ancestry/build updates appear below; current checked pair is downstream5f35ee3f/Coreeff2657b, including supervisor's company integration.

## Preparation

- Read main plan Current State and `codex-social-live-acceptance` brief, own completion report, prior `live-lane-3.md`, and debug notes for failed recent-group-posts/hide-suggested runs.
- `lab-slots/slot-3/owner` assigns t566 / bf-slot-3 to this lane. Latest recorded bf-slot-3 launch finished; no open run from this instance. No STOP file is present.
- Provider-key presence verified through `providerKeySource`, source `.env.local` in this downstream tree. No value printed/copied.
- Cache-off Core production library build **passed**: `$env:FLUXIQ_BUILD_CACHE_DIR='off'; node scripts/build-cache/cli.mjs contracts:build fluxiq:build client-gateway-websocket:build`. Contracts reused current stamp2.1s; fluxiq rebuilt88.9s; gateway reused0.4s. Only paired t566 outputs changed, now frozen. Supervisor notified build completion before its integrated tests.
- Once-only post-integration domain package check **passed/stamped**,24.9s; extension check **passed/stamped**,117.4s (source/test typechecks and all browser bundles). Both structure audits **passed**: downstream208 warnings/638 baselined; Core401 warnings/1154 baselined. Both HEADs include local dev (read-only ancestry check). Supervisor owns combined tests. No source changes, commits, merges, pushes, live launch or user panel management by this worker.

## Authorized live sequence

After explicit release: `social-network-feed-recent-group-posts`, then `social-network-feed-hide-suggested-posts`, each with a separate persistent-isolated workspace, instance bf-slot-3, real extension chat entry, judged whole run and one zero-call replay. Initial per-run ceiling $0.25 and250 calls. No guard override or task/oracle/model-example edits.

Launch shape from downstream root (task/workspace differs per run):

```powershell
$env:FLUXIQ_BUILD_CACHE_DIR='off'
$env:FLUXIQ_TEST_TARGET='persistent-isolated'
$env:FLUXIQ_TEST_ENV_FILES='none'
$env:FLUXIQ_DEMO_HEADLESS='false'
$env:FLUXIQ_LAB_INSTANCE='bf-slot-3'
$env:FLUXIQ_LAB_CORE_BRANCH='task/t566-a8-lane-4'
$env:FLUXIQ_LLM_RUN_COST_CEILING_USD='0.25'
pnpm.cmd lab run social-network-feed --live-llm --llm-profile lab-create-flow --llm-provider deepseek --llm-model deepseek-flash --authoring-mode project --llm-task create-flow --instruction-task social-network-feed-recent-group-posts --target persistent-isolated --workspace bf-codex-social-recent-acceptance --replays 1 --llm-max-cost-usd 0.25 --llm-max-calls 250 --llm-max-run-tokens 48000000
```

Project builds are required by the runner to originate in the extension chat. Keep source/build outputs frozen while a run is active. Inspect each actual outcome/cost/replay account. A failure needs an evidence-backed debug before any changed-source rerun; source changes require exact supervisor assignment.

## Results

Supervisor independent post-integration verification (reported and owned by supervisor): combined Core read-account/candidate/subflow trial feedback **37/37 passed**; combined extension paging/person/next-page/complete-reader/disclosure **103/103 passed**. Earlier supervisor own Chromium proof **2/2** and domain tests **19/19** also passed. These are supervisor-observed results, separate from this worker's build/type/audit observations above.

Preparation made no paid calls. New release/run tracking follows.

Supervisor released after merging the social unit into both dev branches and fast-forwarding this pair to downstream `1164196e` / Core `5add836b` (only documentation/merge ancestry beyond checked source). Exact launch above started in workspace `bf-codex-social-recent-acceptance`, instance bf-slot-3. Run id `run-mvdec14t-5b320706`; guard admitted and all three Core leases held immediately. Launcher prelude176.7s rebuilt domain host/domain, isolated extension and test runner, reused scenario/contracts/evidence, and passed staleness checks. Runtime startup ongoing; initial step/event streams empty, no model call observed yet. No manual source/build changes while live. Pending canonical reset/hybrid paging repairs belong to supervisor elsewhere; report any occurrence here without workaround.

Runtime reached real browser with side-panel verified open. Core production web build compiled successfully113s and completed before servers started. Chat build active:21 recorded steps including `project.read_task`, structure detection and registered node execution. Mid-build UI reviews captured panel/overlay; one scenario screenshot capture timed out4s while its panel capture succeeded. No functional outcome yet; no cost/replay result claimed.

First candidate trial (step29) returned `candidate.execution_incomplete` with `incomplete_text` in feedback: the new refusal was exercised live. Builder continued repair; an unsupported revised parameter was refused before execution. A later revision3 submission (step76) was accepted as draft and a second trial started at step78. No final verdict or helper/dataset acceptance proof yet. UI review probes have had two4s scenario capture/text timeouts; panel captures/checkpoints continued and later scenario captures succeeded.

Final **FAILED runtime.behavior**, no Flow/oracle/whole replay reached;59 calls,118 recorded steps, runtime1015.085s, ledger estimated cost **$0.047741538**. Full read refused four attempts in each failed trial. Exact debug: `docs/working/language-driven-flow-loop-plan/debugs/run-mvdec14t-5b320706.md`. Trial3 actually clicked See more, then full first-page read passed; page move succeeded, next page's unexpanded text refused. Initial/final authored targets and ordering did not form an expansion loop: initial t476 was cookie decline, final preceding t1886 was Close, and t573 was after the failing read. No false-guard evidence or reset/hidden-loadMore stopping cause established. Guard live proof is positive; full task/dedupe/judge acceptance remains open.

Supervisor requested a bounded, executable generic recovery path proof before any feedback/source edits. Proposed per-page minimal helper rows -> existing row-bound optional clicks -> full read -> page move, preserving passive boundaries. Hide-suggested and later independent sites remain held until coordination direction.

## Disclosure recovery order follow-up (in progress)

Supervisor reviewed/committed debug5085e6f9 and synchronized this pair with current dev judge fixes (Coreae0180e8). Written brief `codex-disclosure-recovery-order` owns the disclosure helper/owning test, existing social browser spec, extension architecture, and this report; Core is read-only. The approved domain test location is existing `node-run/tests/run.test.ts`, replacing a proposed new file because the directory already contains25files. No baseline changes or unrelated moves authorized.

Cache-off paired Core3-library build passed before browser proof: contracts reused1.147s, fluxiq rebuilt121.699s, gateway reused0.468s. This follows the supervisor's between-run sync; no paid/browser live session was active and no Core source changed.

Added an in-progress provider-free browser test using real public Core Repeat/For Each and domain native registered actions. Initial attempt failed before native actions because the cyclic test graph omitted Start; corrected to supported Start/success. Feedback source still unchanged. A literal selector-based helper filter in this first low-level proof is not authorable through detected-column handles, so it cannot establish the requested supported-route proof: the next revision must use normal detection/resolution and a link-only helper over all rows, with existing optional row-scoped clicks.

Read-only feedback inspection found a separate likely seam: `domain/.../action-failure/refusal.ts` deliberately does not forward arbitrary failure.actual; OUTPUT_NOT_OBSERVED instead gets closed read-shortfall feedback. Improving extension actual alone therefore may not reach the builder. Will prove through approved runtime composition test and request exact additional source ownership if confirmed. No domain source changed and no new product guidance written.

Approved domain composition regression confirmed the seam: `DOMAIN_TEST_BUILD_LABEL=disclosure-composition pnpm --filter @fluxiq-web-extension/domain test runtime/llm-evidence/node-run/tests/run.test.ts` produced23existing passes/1new expected failure. A detected-handle list read receiving the current closed incomplete_text failure returned only output_not_observed plus current page; no detail or repair route survived. Supervisor conditionally approved exact additional domain paths (refusal.ts/owning test, tool-rejection.ts, rejection-next/next-sentence.ts/owning test), only after normal authoring/Core-loop browser proof passes. None changed yet.

Normal-detection/resolution browser attempt (headless Chromium, real social-network-feed content harness, no provider) exercised link-only helper25rows -> real Core For Each25row inputs ->5successful disclosures/20legitimate optional skips -> full34-row read passed with0collapsed controls. All node executions succeeded; Next then returned ended. The intended two-page assertion correctly failed (1helper pass, expected2). This proves existing supported one-page recovery; it does **not** prove repetition after a genuine page movement. No product guard was relaxed, no implicit click added.

Audited recent-group-posts workflow confirms this task uses the home feed, not a separate paginated group listing. Feed batches arrive in groups of5on scrolling. Current `list-reader.ts` lines498–504 calls awaitListComplete before a non-paginated current-page read, unbounded when no maxItems; minimal helper therefore reveals the feed before row actions. The full read then sees34rows and Next truthfully ends. Will not manufacture pagination, mutate fixture controls, or use unrepresentative bounded slices to make the test pass. Reported this seam to supervisor; held at frozen boundary for coordinated sync/next direction. Browser and compiler sessions finished; only approved two test files and own report changed. Feedback/helper/domain production sources remain unchanged. Both in-progress regression tests intentionally remain red pending complete proof and authorized repair.

Supervisor accepted actual full-feed one-page proof plus explicit logical ordering coverage (no genuine next-page disclosure proof claimed), and required normal observed-click resolution, real compiler optional-shape proof, and no masked failed click. Synced both trees at frozen boundary to Corebb858c89/downstream72fb4d80 with tests/report preserved. New paired cache-off Core build passed: contracts reused1.517s, fluxiq rebuilt293.666s, gateway reused0.393s. Revised browser proof now resolves the page-view click handle normally, compiles optional: yes through public real script acceptor and asserts its exact Merge branches, removes injected sometimesPresent metadata, accepts only target.not_found for optional absence, and expects full home-feed read followed by truthful Next ended. Browser result pending; production feedback remains unchanged.

That revised run passed normal click resolution and real optional-script compilation, then failed the final strict expand trace predicate after completing the graph. Initial interpretation that inline browser-failure assertions had passed was incorrect: Core can catch exceptions thrown inside effectDispatcher and route an optional failed effect through Merge, so inline assertion errors can themselves be masked. Supervisor notified immediately. All callback checks now collect structural issues/click outcome codes; assertions run outside runAutomationStudioGraph. Added mandatory nonempty helper identity checks to prevent null scope fallback. This diagnostic rerun uses current downstream9e7be390/Corebb858c89, no production source changed, no new Core build or paid run.

Outer diagnostics established the actual cause: helper included non-post feed units with null link identities;4clicks returned target_ambiguous,5disclosures succeeded and16absences skipped. The four ambiguity failures had been swallowed by the optional failed->Merge path; they are now explicitly rejected outside Core, not relabelled as legitimate skips. Supervisor approved existing authorable `where: [{field: "identity", is: "present"}]` for helper/full requests, resolved using renamed detected-column vocabulary. This excludes unusable scope rows without reading incomplete text or inventing a selector filter. That bounded rerun is pending. No guard/scope semantics or feedback source changed; both missing/ambiguous scope refusals remain intact.

**Supported route PASSED**: `node scripts/test-content.mjs social-read-completion.spec.ts --grep 'normally authored optional' --workers=1`, headless full Chromium,1/1passed,1.6m total/1.1m test. Exact pair downstream9e7be390/Corebb858c89. All outer checks passed: normally resolved detected columns/Next and observed click handle; real script optional:yes compiles to the exact executed Merge shape; minimal link-only helper retains only present identities; real Core For Each supplies nonempty per-row context; every click succeeds or is genuinely target_absent, no ambiguity/unexpected failure masked; full feed read is validated complete with0collapsed fields; helper replace/final append kept separate; Next truthfully returns ended. No genuine later-page disclosure proof claimed. Production feedback remains unchanged, Core source read-only. Supervisor notified; no active worker processes, frozen for coordinated company sync before approved closed-reason feedback implementation/final gates.

## Implemented feedback and final verification

Supervisor synchronized latest company integration; paired cache-off Core build passed on Coreeff2657b: contracts reused0.378s, fluxiq rebuilt113.541s, gateway reused0.482s. Core source stayed read-only. Exact compiler-derived browser proof then passed1/1(3.6m total/1.2m actual), log `test-runs/disclosure-recovery/compiler-route.log`: graph now resolves compiler-produced optional node parameters, instantiates compiler metadata/consequences/Merge node and actual optional edges, and requires both a real successful disclosure and a genuine target_absent skip. This was observed **before** feedback source edits.

Changed feedback only after that proof: extension actual carries generic helper/For Each/own-row optional-click/full-read order; existing guard detection/coverage/passive semantics unchanged. Domain recognizes only leading `incomplete_text:` on non-timeout OUTPUT_NOT_OBSERVED, returns closed reason with fixed generic recovery ordering, and never forwards arbitrary failure text, field names or page values. Negative tests cover other codes, near/nonleading/missing prefix, timeout, read-account precedence, repeated refusal and private values. Core/tool protocol unchanged; no implicit click or new option.

Fail-first: focused domain43tests had40existing passes/3new failures; disclosure2had1existing negative pass/1new feedback failure. After repair, worker domain43/43and disclosure2/2passed. Supervisor independently observed domain43/43, log `node_modules/codex-disclosure-supervisor-domain.log`. Explicit status/payload mapping replaced an audit-forbidden spread in owning refusal test; affected refusal14/14and warm domain package check22.297s passed after that adjustment. Earlier domain package check53.745s also passed. Core audit passed401warnings/1154baselined.

Final browser test also invokes a real incomplete content read through normal detected-handle domain evidence runtime before the compiled loop, asserting closed reason/ordering reaches builder and disclosure remains unclicked. Static preflight caught four test-scaffolding types: optional selector undefined,2result-conversion calls and optional declared outputs. Fixed exact optional types, required registered definition outputs, and reused actual `gatewayActionResultFromBrowserResult` through runtime barrel, with no result cast. Cancelled superseded browser/static readers before edits; those cancellations are not failures or successful browser evidence. Audit contract-spread and direct-file import violations were corrected without baseline changes. Final extension check and audit ran first; final Chromium3cases started only after observed static exit0.

Final static/preflight results observed: extension source/test checks and all browser bundles **passed/stamped 77.937s**; downstream structure audit **passed, 210 warnings/638 baselined**; Core audit **passed, 401 warnings/1154 baselined**; git diff --check passed. Playwright `--list` exited0 and listed exactly3tests, also proving the production runtime barrel initializes under harness imports. Only then launched final headless Chromium3cases on frozen source. Domain **43/43** and owning disclosure **2/2** are green; after explicit status/payload test mapping, affected refusal **14/14** and warm domain check **22.297s** are green. No further Core build or source changes required.

**Final Chromium 3/3 PASSED**, 3.0m total on downstream5f35ee3f/Coreeff2657b. Cases: direct partial-text refusal then explicit click/whole text (12.1s); raw links versus opted-in tracking-free identities (9.1s); real failed browser read through actual domain builder-feedback composition, then normal/compiler-derived optional For Each and full nonempty feed read (2.2m). The third case requires positive helper/full row counts, nonempty stable raw identities, at least one actual disclosure and one genuine absent-control skip, zero ambiguous/unexpected failures, zero remaining collapsed controls, and Next ended. All assertions passed outside executor callbacks. Log `test-runs/disclosure-recovery/browser.log`; retained standard Playwright HTML result under `apps/extension/e2e/test-results/content/report/`. No provider calls in this follow-up and no genuine subsequent-page disclosure proof claimed.

New positive-data requirement acknowledged: every scraping task needs actual matching rows and a nonempty verifiable expected dataset; no zero-result acceptance. This proof already requires positive data. Supervisor confirms recent-group-posts has actual matching rows; its paid task/oracle/whole-run/replay acceptance remains open. Corpus corrections belong to the next separately assigned brief.

Exact changed paths (all supervisor-authorized; no other source ownership):

- `apps/extension/src/content/extraction/text-disclosure/text-disclosure.ts`
- `apps/extension/src/content/extraction/text-disclosure/tests/text-disclosure.test.ts`
- `apps/extension/e2e/content/tests/extraction/tests/social-read-completion.spec.ts`
- `domain/src/runtime/llm-evidence/action-failure/refusal.ts`
- `domain/src/runtime/llm-evidence/action-failure/tests/refusal.test.ts`
- `domain/src/runtime/llm-evidence/tool-rejection.ts`
- `domain/src/runtime/llm-evidence/rejection-next/next-sentence.ts`
- `domain/src/runtime/llm-evidence/rejection-next/tests/next-sentence.test.ts`
- `domain/src/runtime/llm-evidence/node-run/tests/run.test.ts` (approved substitution for proposed new test file)
- `docs/architecture/extension-client.md`
- this own report.

Ignored validation logs under `test-runs/disclosure-recovery/`: `domain.log`(43), `extension.log`(2), `refusal-final.log`(14), `domain-check.log`, `extension-check.log`, `structure.log`, `core-structure.log`, `compiler-route.log`, and final `browser.log`. Red evidence logs are `red-domain.log`/`red-extension.log`. No logs/builds/artifacts/private data copied into tracked files. No worker commit/merge/push, user panel management or new paid call. Recent task/whole-run/replay acceptance and independent hide/later-site queue remain unverified/held until supervisor release. Single full-home-feed recovery and truthful Next ended are proven; genuine next-page disclosure repetition is explicitly unproven.
