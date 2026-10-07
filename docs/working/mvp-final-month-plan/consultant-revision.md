# Consultant review and revised MVP execution plan

Reviewed 2026-10-06 (America/Los_Angeles). Planning task t295. This is the
execution detail for [the final-month plan](../mvp-final-month-plan.md).
It revises the order of work; it does not claim implementation or fresh live passes.

## Recommendation

Adopt separate discovery and explicit candidate submission, independent outcome
verification, and a common acceptance gate for creation and repair. Keep the
existing Flow representation, executor, identity resolver, datasets, permission
system and adaptation records. Bring these boundaries forward before building
another editing language or adding unrestricted page scripts.

The consultant's diagnosis fits the code and recorded failures. Several proposed
capabilities already exist, however, and some protections cover only particular
Flow shapes. The implementation should extend those seams, with fail-closed
behavior for unsupported shapes, rather than introduce parallel systems.

## Baseline and evidence limits

- Downstream starting head: `92d790d7`; Core: `e9b7d691`. Both trees were clean
  at intake. Claude's handoff is dated 2026-10-07 05:10 UTC, which is still
  October 6 locally. Dates below use the user's local calendar.
- Read-list S1-S6, t267 adaptation work, t268 preview/deep-link work, t270/t273
  binding/wiring, and the week-review fixes have landed. Their old briefs and
  schedule are historical; do not execute them again as unfinished work.
- A has historical individual passes; B/C/D have no qualifying passes. No lane
  has two consecutive qualifying creation passes. Round 5 was cancelled.
- Cached extension workers invalidated evidence for the **new background code**
  in affected persistent profiles. This does not erase observed historical page
  outcomes or zero-call replay receipts; it means those receipts do not establish
  behavior of the intended newer background build. Re-prove on an identified pair.
- The cached-worker deletion is wired before Lab launch, but a running-worker
  identity assertion remains absent. Deleting all `Default/Service Worker` data
  also affects fixture-site workers; keep that workaround within owned Lab profiles.
- Audits are source/document findings. No builds, product tests, browser sessions,
  provider calls or user-panel management were performed for this planning review.

Audit evidence: [Core](reports/consultant-core-audit.md),
[browser and Lab](reports/consultant-browser-lab-audit.md),
[working-doc reconciliation](reports/consultant-doc-context.md).
Those reports distinguish confirmed code behavior from untested hypotheses.

## Critiques and changes to the consultant's proposal

| Proposal | Decision and correction |
| --- | --- |
| Separate exploration from authoring | Accept and move forward to the first structural implementation slice. Discovery must not auto-add nodes, hidden dependencies, retained clicks or builder claims to the candidate. |
| Submit a complete candidate | Accept behind a feature flag, using the current Flow/topology schema. Include graph/router/subflow ownership, bindings, permissions and dataset mappings; avoid inventing a second graph format. Reject unsupported topology without modifying the accepted Flow. |
| Independent evidence checks | Accept. Core evaluates generic checks; domain observations establish browser facts. Page changes alone cannot prove shipping origin, pickup eligibility or which record was changed. Preserve original instruction fragments, identity, coverage and provenance. |
| Three outcomes | Core already has `answers`, `does_not_answer`, `unsure`. Add requirement-level receipts and make aggregation fail closed; do not merely add another verdict enum. Unknown means insufficient proof and cannot promote automatically. |
| Test from starting state | Accept. The Lab already resets before persisted playback; the missing seam is using declared starting conditions for candidate acceptance **before promotion**, instead of relying on discovery state. Reuse reset and execution infrastructure. |
| Desired-state primitives and durable locators | Extend existing `check`, `type`, `select` and identity fingerprints. The missing behavior is implementation reliability and freshness, not absence of these abstractions. |
| Scripts and requests | Keep the user's requested direction, but stage feasibility and pre-execution permissions. Runtime page/network observations are audit evidence, not a way to prevent an effect that already happened. |
| One repair lifecycle | Accept at the validation/execution/verification/promotion boundary. Patch, reauthor and target recovery can remain candidate-producing strategies. Preserve their useful deterministic paths. |
| Flexible budget with reserve | Accept within existing purse/true-cost accounting. The $0.10 Lab ceiling and flash default remain in force; this audit does not authorize stronger-model spend or a higher ceiling. |
| Replay and checkpoints | Accept throughout. Stored-Flow zero-call replay, controller decision replay and model checkpoints prove different things; report them separately. Stop decision replay on observation/schema divergence. |
| Defer full node audit | Modify: the user explicitly ordered the full audit. Finish navigation/gaps and merge all four reports into a ranked backlog, while implementing only blockers first. Broad expansion need not precede the structural proof. |
| Split large services | Extract touched responsibilities with tests and stable interfaces. Keep one owner for orchestration and shared schema wiring. A wholesale file split is not a separate MVP dependency. |
| Narrow MVP promise | Publish supported task families and unverified limits. Keep the agreed ten realistic-site corpus and the final 26 acceptance items; this recommendation does not silently reduce user scope. |

### Concrete source findings driving the order

1. Core `runtime/result-verification/agreement.ts:122-123` retains a first
   `answers` when the second verdict is not `does_not_answer`, including unsure
   or silent responses; `result-verification/build-test/judge.ts` can turn that
   into `yes`. Fix aggregation before optimizing judge prompts.
2. `runtime/flow-draft/flow-signature.ts:34` already fingerprints step inputs,
   settings, routing and acts. Keep that guard, extend identity to the complete
   submitted topology and dataset output contract, and bind receipts to revisions.
3. `runtime/service/runtime-adaptation/held-candidate.ts:54-56,75-91` holds only
   the supported selected single-subflow shape. Other topology shapes apply before
   the judged rerun. Fence them off immediately; later execute detached candidates
   through the normal runtime. Do not rely on rollback to make early apply safe.
4. `runtime/flow-draft/entry.ts:89` still teaches add/act/amend/retention semantics.
   Run-node discovery can be unkept, but it shares the draft machinery. Separation
   must remove automatic opener insertion and claim-derived completion too.
5. Downstream `packages/test-runner/src/guarded-browser/launch-guarded-context.ts:35`
   clears cached workers; this is not a handshake proving which code is running.
6. `apps/extension/src/content/action-runtime/checkable-state.ts` sets `.checked`
   and emits input/change rather than a browser-like click; `check.ts` already
   requests desired state and checks the DOM property. Controlled-component state
   still needs a real regression fixture and post-settle observation.
7. Next-page change detection uses row-element identity/count. A site updating
   existing rows in place can look unchanged. Use semantic row/page evidence and
   explicit ended/failed distinction, with bounded waiting and no duplicate press.
8. `domain/src/runtime/llm-evidence/plan-resolution/step-permission.ts:79` names
   click/keypress/dialog as committing actions, while `content/actions/type.ts:75`
   can press Enter with `submit:true`. This declaration mismatch needs a boundary
   test. It does not by itself prove that Core permits an unauthorized action.
9. Core `packages/fluxiq/src/client-gateway/service/commands.ts:27,64,72,84`
   uses an in-memory pending map, new IDs per dispatch, timeout deletion and ignored
   late acknowledgements. Durable uncertain-outcome reconciliation is missing in
   that path; duplicate effects after a retry are a risk to reproduce, not a claimed
   observed failure.

Paths beginning `runtime/` above are relative to Core
`packages/fluxiq/src/programs/automation-studio/`. No Core files are edited by
this review. Implementation must create a paired working doc and alert the user
before its first Core edit.

## Binding design contracts

**Requirement brief.** Immutable original instruction plus requirement IDs,
source spans, outcomes, qualifiers, quantified subjects, constraints, and
`create` versus `ensure`. Page inspection may establish available options;
material intent ambiguity uses the existing conversation channel. No obligatory
giant approval checklist for straightforward work. Builder annotations never
change requirements or count as evidence. Negated constraints such as leaving
other requests untouched are requirements too.

**Evidence receipt.** Link requirement, candidate revision/hash, run, command,
observation/page generation, subject identity, timestamp and coverage. Distinguish
executor-produced observation from model-suggested mapping and derived values.
Domain code extracts facts; Core checks trusted predicates (`exists`, equality,
counts, membership, comparisons, every-subject). A model-generated field or
`success:true` is not an observed fact. Partial lists cannot establish `all` or
`cheapest`. Missing evidence stays unknown; concrete contradiction outranks a
semantic yes. Semantic interpretation must retain its source and limitations.

**Candidate.** Core assigns revision and fingerprint, validates the current Flow
schema and computes the diff. Evidence and positive verdicts do not transfer to
an edited revision. Discovery operations append evidence only. Pure computation
over extracted data is distinct from code with page/browser/network capabilities.

**Acceptance.** Validate → execute candidate under allowed scope → verify required
outcomes and constraints → promote atomically, or retain draft/refuse. Static
validation, simulation and verify-only checks are useful receipts but cannot
certify an unperformed lasting effect. Unsupported topology remains a draft.
No accepted graph changes before its specific acceptance receipt. Promotion must
check the base accepted revision to prevent overwriting newer work.

**Execution facts.** Ran/succeeded/failed/not-run with reason, separate from
requirement satisfied/unsatisfied/unknown. A legitimate `ensure` can succeed
already satisfied; `create` requires a new run-attributable result. No-op control
clicks, empty repeats and mere existence of a final button prove no lasting action.

**Recovery.** Known deterministic recovery first. Session recovery may continue
without being saved; reusable change goes through the candidate gate. At restart,
recover pending candidate/promotion state and reconcile uncertain commands before
retrying writes. Persist bounded IDs/receipts locally where necessary; durable
Flow/recording/policy ownership remains Core.

## Ordered implementation slices

### P0 — Trust and readiness, first

Owners: Core result verification and adaptation promotion; downstream Lab build
identity and extension run controls. Partition by files; shared façade wiring
has one supervisor/owner.

1. Add failing negative cases for yes+unknown/silent/unavailable, a withheld action,
   zero executed nodes, builder-claimed success, wrong shipping origin, only one of
   two pickup items, partial rows and an edited candidate with an older receipt.
2. Make automatic acceptance require sufficient outcome evidence. Fence off
   apply-before-judged topology shapes, preserving the previously accepted graph.
   Keep unsupported cases visible as draft/unknown instead of reporting success.
3. Add running background/content build identity and Core/domain/protocol identity
   to the Lab preflight. Compare with the intended build pair, refuse mismatch
   before a provider call, and store screened identity in each run report.
4. Expose Stop/build cancellation through existing Core commands; prove dispatch
   stops, late results cannot promote, and the UI settles. Source audit alone is
   insufficient. A supervisor can then stop a stalled paid build reliably.
5. Define the requirement/evidence receipt seam and capture negative replay cases.
   Do not spend this slice designing a universal verification language.

Exit: owning negative tests pass, no unsupported early promotion, deliberate stale
build refused provider-free, Stop/cancel exercised with the real extension and
isolated runtime. No paid A-D round before this readiness gate.

### P1 — Discovery and candidate submission, one vertical slice

Owners: Core node-tool interface, candidate validator/controller, domain plan
resolution and candidate UI status. Start with lane A's representative graph.

1. Add a feature flag selecting the new authoring interface; legacy behavior stays
   available for comparison. Capability/tool selection is explicit per session.
2. Make observation and discovery action tools record evidence without draft
   mutation, hidden opener insertion or instruction-act completion. Keep the
   existing consequence gates for every action.
3. Add one submit operation accepting the existing graph/topology representation.
   Validate node IDs/parameters, routes, loop bindings (`$row`, `$step`, Flow inputs),
   ownership, target identity, record outputs, consequence declarations and bounds.
   Return consolidated path-specific diagnostics; Core owns revision/diff.
4. Submit a revision on repair; accepted Flow remains immutable. Reuse existing
   graph assembly/executor seams, not a JSON-to-script conversion.
5. Test fresh/stale handles, invalid bindings, an exploration mistake corrected
   before submission, and a candidate encoding reusable selection rather than a
   discovered hardcoded answer. Persist locator descriptions, not `tN` handles.
6. Shorten the model context to original task/brief, capabilities, compact current
   evidence, candidate when needed and latest actionable failure. Add build,
   missing-evidence and repair examples. Measure request bytes and decisions.

Exit: one representative Flow can be proposed and revised with no keep/drop/act/
excuse/amend conversation, and discovery detours do not enter the saved graph.
Provider-free controller tests precede one bounded live probe after P2 is ready.

### P2 — Candidate execution and one promotion gate

Owners: Core candidate execution/acceptance adapter, current recovery callers;
Lab starting-state/reset orchestration and evidence publication.

1. Declare starting conditions and expected outcomes before execution. For owned
   resettable fixtures, reset/reseed through the existing control API, navigate to
   the declared start and execute the exact detached candidate with the normal
   runtime. Navigation alone does not reset consent, carts, settings or records.
2. Separate builder-visible page evidence from private Lab oracle/expected rows;
   candidates cannot read the scenario control channel or hidden answer table.
3. Evaluate requirement receipts after execution and before promotion. Expose
   unresolved requirements to the UI without upgrading them to success.
4. Route bootstrap, reauthor, target override, patch and recovery promotion through
   the same gate. First support the real MVP shapes; other shapes refuse safely.
   Then add detached full-topology execution where demanded by selected tasks.
5. Add concurrency/crash tests: candidate revised during verification, late result,
   process death before/after receipt, duplicate promotion event and base revision
   changed. Applying a draft must never overwrite the accepted Flow on unknown/no.
6. Preserve a global hard purse and protected verification/repair allowance. Record
   paid schema refusals separately from execution attempts; stop unfinished when
   insufficient budget remains. Do not discard cheap correctness checks as reuse
   confidence grows.
7. Define real-app behavior separately: reversible exploration, supervised first
   execution when needed, or explicit untested suffix. Never reset personal data or
   repeat purchases/posts/messages merely to obtain test evidence.

Exit: actual candidate outcome establishes promotion; exploration leftovers and
untested revisions cannot pass. Builds and repairs share acceptance semantics.

### P3 — Browser blockers alongside P0-P2

Finish navigation and gaps audit reports, then merge all four families into one
ranked list: contract, source owner, existing tests, failure, tasks unblocked,
new regression and live proof. This completes the ordered audit without requiring
all proposed nodes to be built before A-D.

Priority implementations: controlled checkbox/radio behavior; coherent type/select
and submit permissions; Next page in-place rerender/ended distinction; row identity
after list mutation; disabled/covered/hidden controls; extraction completeness and
rejected-row leakage; interruption/rate-limit recovery; latest page/target handles.
Use bounded waits and desired-state readback. Do not blindly repeat a mutating
click when an acknowledgement or effect is uncertain.

Retest the remaining round-4 causes after mapping each to a new boundary: A C1b;
B 1b/3; C R4-2/R4-3; D D4-2b/3/4/5; UI R4-U items. Delete obsolete edit-language
requirements only when the replacement has proof, retaining historical evidence.

Exit: owning unit/content-browser regressions pass, and A-D use shared robust
primitives without scenario-specific authoring exceptions.

### P4 — Fallback feasibility, then bounded capability

Do the browser/API/CSP/store-policy design alongside the first slices; a blocked
script channel must not delay typed candidate proof. Preserve explicit user rules:
typed operations first, JS last resort after about three failed typed attempts,
JS-assisted Lab result = **partial success, used JS**, direct requests OFF by
default in both configuration and Settings; no debugger for JS, network debugger
only if absolutely needed and requests are enabled.

1. Separate pure transforms of serialized extracted data from page scripts and
   HTTP requests. Prefer existing dataset processing or a packaged bounded
   computation mechanism. Isolation and enforceable cancellation are requirements
   for arbitrary loops; a Promise timeout alone does not interrupt them.
2. Prove permitted script channel per browser using a disposable strict-CSP page
   and production manifest. `scripting.executeScript` packaged files/functions do
   not establish an arbitrary code-string execution channel. Chrome `userScripts`
   is a channel to evaluate, with permission, version and user-toggle implications;
   its availability alone does not establish approval for model-generated code.
3. Define pre-execution capability/consequence restrictions. A script cannot be
   considered read-only by assertion; page/world access can mutate or send. Keep
   delete/money/send-or-publish gates and secret screening. Never infer permission
   from a post-effect page diff or HTTP method alone (GET can mutate too).
4. Requests need explicit origin/session policy, host grants, redirects, timeout,
   byte bounds, redaction, credential handles, unknown-write outcome handling and
   no blind retry. Requests OFF must disable both execution and network capture.
5. Synchronize domain schemas/output-node registrations, gateway types, capability
   advertisements, content/background routing, manifests, settings, tests and docs.
   Rows must enter existing datasets with provenance/coverage, not trusted verdicts.

Official sources checked for feasibility:
[userScripts](https://developer.chrome.com/docs/extensions/reference/api/userScripts),
[scripting](https://developer.chrome.com/docs/extensions/reference/api/scripting),
[MV3 policy](https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements),
[worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle).
Chrome documents version-dependent user-script toggles and lost worker globals.
These are constraints to validate, not a claim of store approval or browser parity.

### P5 — Creation live qualification, then repair and breadth

Use the live protocol below. A-D first; then Phase 1b new task shapes and recording
as evidence beside mandatory instructions, including detours/undone wrong clicks.
Recording-alone refusal remains required. Never count a copied erroneous recording
as a faithful outcome. S7 retirement of read-owned paging waits for lane C proof.

Next, qualify build → changed-site failure → diagnosis → exploration → candidate
repair → whole-run acceptance → persistence → continuation → later zero-call reuse,
twice on at least three sites. Use the instruction-built
`crossborder-marketplace-hub-to-cart-basket-redesign-after-creation`, plus bigbox
pickup, job-board, regrouped social feed and company quote request tasks. The old
`crossborder-marketplace-repair-basket-redesign` is recorded-Flow coverage and
must not substitute for the instruction-built chain.
Separate result-driven repair from target drift; both need outcome evidence.

Then cover the ten sites with at least one creation and one repair task each.
Inventory all 67 tasks; prioritize and report qualification denominator explicitly.
Broader coverage cannot substitute for the adaptation chain or false-acceptance tests.

## Live testing protocol and gates

**Preflight, every new run.** Single supervisor; own lane slot 1-4, worktree and
labelled instance; no shared workspace/profile writes. Rebuild the compatible
Core libraries, domain host, test-runner and extension in the lane tree. Run owning
typechecks/tests and structure audit, stopping at first nonzero exit. Run campaign
dry-run to verify the intended task/target/workspace/chat/headed settings and $0.10
ceiling. Verify running worker/content identity before paying, not only files on
disk. Never create Lab override files; they are user-controlled.

Keep off-peak guards: weekdays 01-04 and 06-10 UTC are refused unless the user's
override exists. Consult the guard for admission; do not launch simply because a
document's date says off-peak. Default DeepSeek flash, max-attempts 1, prompts through
real extension chat, headed browser supervised throughout. No unattended relaunch.
Use owned Lab topology; this does not authorize starting/restarting the user's panel.

| Lane | Task | Qualifying outcome |
| --- | --- | --- |
| A | `crossborder-marketplace-hub-to-cart` | Exact four fixture facts, correct Spain shipping-origin evidence and required item/variant/quantity, no unintended purchase. Check origin separately from seller location. |
| B | `bigbox-retail-pickup-cart-store-remembered-after-creation` | Correct store; paper towels 12 Double Rolls ×2 and napkins 250 Count ×1, both pickup; existing soap untouched, no checkout. Verify remembered-state scenario remains reusable. |
| C | `everything-store-plus-earbuds-under-50` | Exactly 13 ordered rows and 52 exact fields, correct Plus/rating/strict price/accessory rules, all five pages; one-page reads + Next page + repeat + run-end processing. Expected answer must not be hardcoded into the candidate. |
| D | `social-network-feed-confirm-requests` | Exactly four accepted requests and verbatim name/mutualFriends rows; all excluded requests unchanged, including missing-count and “one named plus four others” cases; rate-limit interruption handled; fresh post-action observation. |

Task IDs/oracles are authoritative in fixture definitions. Older live reports have
stale paging instructions and slot assignments: use reports for failure evidence,
current fixture/contracts for launch and expectations.

**Sequence.** Provider-free negatives and browser probes → one new-interface
representative live build → debug/integrate every agreed fix → A-D measured round.
Initially use one lane until the shared boundary works; then up to four independent
lanes. Run another paid build only after debug, material code/evidence change or a
passed run warranting the second independent qualification. Lab refusal is a stop,
not permission to override a guard. Re-run a new bounded dry-run after fixes.

Each lane needs **two consecutive independent qualifying builds on the same
integrated source/build pair** from declared starting conditions, with at least
two separate saved-Flow zero-call replays. A code change resets that pair's streak.
Two replays do not count as two builds. A JS fallback result remains partial under
the user's rule even when the task oracle is correct. Product acceptance and Lab
oracle must both hold; measure false acceptance and false rejection separately.

Command templates (PowerShell; complete instance/slot/model settings from the
existing lane launch brief and dry-run, not from guesses):

```powershell
$env:FLUXIQ_TEST_ENV_FILES = 'none'
$env:FLUXIQ_LAB_INSTANCE = '<allocated-instance>'
pnpm.cmd lab:campaign <task-id> --dry-run --max-attempts 1 -- --target persistent-isolated --workspace <lane-workspace> --llm-cost-ceiling-usd 0.10
# After readiness and identity checks, use the same command without --dry-run.
pnpm.cmd lab:campaign <task-id> --max-attempts 1 -- --target persistent-isolated --workspace <lane-workspace> --llm-cost-ceiling-usd 0.10
pnpm.cmd lab replay <scenario> --workspace <lane-workspace> --project <project-id> --flow <flow-id> --instruction-task <task-id>
```

For replay, use the existing secret-free environment wrapper: the runner refuses
provider credential variables. Do not print or delete stored keys. Require observed
zero calls, interventions and harness activations, exact saved Flow hash unchanged
and exact dataset/state oracles. Missing accounting stays unknown.

**Freshness/variation proof.** After baseline passes, use declared fixture variants
that perturb initial consent/store state, DOM identities, order/values and list
mutation. For `ensure`, exercise already-correct and incorrect initial state. For
`create`, use fresh isolated records and verify new identity attributable to the run.
Changes to scenario semantics need a reviewed oracle, not a convenient lower bar.

**Every run report.** Build pair/worker/browser/target/task/variant/start conditions;
candidate hash, commands and execution facts; requirement receipts and completeness;
private oracle versus product verdict; UI behavior and Stop; priced calls/cost for
all stages including failures; fallback use; exact reproduction and next fix.
The $0.10 limit is per build, not a claim that total learning cost is capped at
ten cents across failed attempts and repair builds. Compare cost only with matched
task/source/model/price pins and report the full learning spend denominator.
Screen all evidence and keep raw run artifacts/profiles untracked. Debug every run
before another; leave user-required live servers running only when explicitly asked.

**Three distinct evaluation tracks.** Saved-Flow replay establishes reuse.
Recorded-decision replay tests controller transitions with a schema/observation
compatibility check and divergence stop. Paid checkpoint evaluation tests whether
the model understands the changed interface; it requires explicit model/settings
selection and obeys the existing spending policy. None replaces end-to-end proof.

## UX, reliability and release remain required

Throughout live runs, review chat/overlay freshness, plain blockers, unknown/draft
versus ready, row counts/coverage, permission stops, dataset preview/export, learned
messages and Open in FluxIQ. Existing t268 preview fixes are verification tasks now.
After early Stop/cancel, wire remaining Pause/resume/takeover/return-control through
existing Core APIs and verify no action proceeds while user control is held.

Before freeze: onboarding under five minutes, extraction and recording paths after
their gate, acceptance/learning visibility. Before release: browser/runtime restart,
extension reload, network drop before/after an effect, late acknowledgement, tab
closure, interrupted repair, cancellation and LLM failure; restart receipts must
avoid duplicate effects and never promote an unknown candidate.

Run installed production Chrome/Edge and Firefox separately on clean test profiles;
Chromium Lab evidence is not Firefox/Edge proof. Verify supported fallback channels
or document exact unsupported behavior. Complete privacy/redaction review, diagnostics,
cost per verified reusable Flow (including failures), AI cost per 100 successful
executions and replay performance. Package/install/update outside the dev checkout.

## Calendar and scope checkpoints

| Window (local date) | Target / dependency |
| --- | --- |
| Oct 6-9 | P0 fence, build identity, cancel proof; complete bounded node audit/design feasibility; P1/P2 vertical slice. |
| Oct 10-16 | A-D two-build and zero-call qualification, structural regression fixes; S7 only after C proof. Dates are targets, not evidence. |
| Oct 12-23 | Adaptation chain on three sites once qualifying creation exists; no edits to shared Core owners in concurrent units. |
| Oct 17-28 | Phase 1b after A-D gate; recording evidence, remaining sites/task families and Simple UX. |
| Oct 23 | If repair chain is not green, record blocker and propose a smaller qualification set; do not silently relax gates or cut acceptance requirements. |
| Oct 29 | Feature freeze. Only MVP blockers, reliability, UX and release work thereafter. |
| Oct 29-Nov 4 | Reliability matrix, privacy, diagnostics, performance, installed browser packages. |
| Nov 5-10 | Clean-profile 13-step release script and all 26 acceptance items, ideally an unfamiliar user. Main merge/tag/store submission require the user's approval. |

Full suites remain at most twice daily on dev as background sweeps. Per-change
integration uses touched-package typechecks, owning tests and structure audit.
Fix sweep failures forward. Never call compilation or a worker report live proof.

## Immediate next brief

Implement P0 as bounded paired tasks: (a) Core fail-closed agreement plus unsupported
early-promotion fence and negative tests; (b) downstream worker/content build-identity
preflight and provider-free mismatch fixture; (c) extension Stop/build-cancel relay
and live isolated proof. Finish navigation/gaps read-only audit in parallel by report
file. Then one owner wires the P1/P2 representative candidate slice. Do not dispatch
the old small-edit-language or “every refusal offers script” briefs unchanged.
