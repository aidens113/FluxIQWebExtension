# Codex R1 reset review

Status: New-line preservation and generic extraction unit checked and frozen;
separate canonical-transfer continuation approved but implementation held for
supervisor commit/release. Paid/live release remains held.

## Current verified result

R1's destructive subject-only matching is replaced by complete resource-bound
pre-act destination witnesses and exact row-state restoration checks. Modern
unproved reversible leftovers block ordinary trials; wrong targets can be
corrected. Repeated own adds can share one proved removal. Scope/resource
transport stays private. Generic extraction retains late discovered columns
within64 instead of truncating at24. No task/oracle was changed.

Final worker results: Core116/116 narrow guards; cache-off Core check/build exited0;
domain67/67; infer-fields19/19 after two fail-first regressions; domain and
extension type/bundle checks exited0; Core and downstream structure audits0.
Real Chromium content run4/4 passed: whole-baseline reset proof15.5s, unchanged
task-named cart extraction7.9s, recorded read3.6s, automatic extraction7.8s.
Total browser invocation5.5min including harness setup. Supervisor independently
reported Core24/24, domain67/67, extension36/36 for this frozen source.

Canonical install still requires a positive collection-transfer inverse for
saving the pre-existing phonecase; current unit safely refuses that unproved
inverse. A separate approved bounded patch will also enforce original subject
order. No paid run, commit, merge, push, or user-state reset by this worker.
Billed cost remains zero. Historical review notes below record superseded
intermediate designs and failed checks; this summary is the current state.

## Findings recorded during review

R1 cannot yet be recommended for merge. A subject token identifies the product, not the amount of the build's effect. Core `flow-bootstrap/site-reset/ledger.ts` `target()` admits both Delete and Modify on a subject matched to an Add. If that Add increased a cart line which existed before the build, Delete removes baseline state. `allowed: []` merely leaves the normal permission gate in force; it is not an inverse-effect proof.

The same problem exists for quantities: multiple Modify undos on the same subject can reduce quantity below baseline. `undoSeen()` records only whether a page changed; `beforeTrial()` counts any changed undo as success for a trial act with no `place`. Existing tests explicitly expect subject-only deletion admission and do not represent baseline quantity.

The current declarations carry only `item`, `dialog`, `subject`, and `page`. Domain step diffs can vouch for newly created row tokens on a single unchanged document, but cross-page adds have no such evidence. Exact inverse validation needs additional domain-neutral effect/baseline evidence; a title match alone cannot supply it. No source edit or paid run has been made. Supervisor notified before expanding scope.

## Validation

Pending narrow checks.


## Implemented witness (validation in progress)

Supervisor authorized extending R1 after the fail-first preservation tests.
The passive domain start-state read already includes hidden elements. It now
carries all captured subject tokens and an opaque scope digest of location.
Core retains the first observed subject set per scope with the local act
sequence. Cross-page subject Delete is admitted only for create_new when the
destination was observed before that act, the subject was absent then and is
positively present now. It spends its removal once and completes only when a
later read of the same scope proves the subject absent. Unproved quantitative
Modify inverses are refused. A subject-only title match never grants removal.

The project reset observation router updates current evidence for existing act
owners but never seeds another builder's baseline from an independent host
resource. Nonlasting run-node calls observe their destination after the call;
lasting calls retain before/after observation. Generic tool guidance tells a
builder to inspect an effect's destination before creating it. No scenario
words were added to model guidance.

Required expanded source paths: Core site-reset/{act-places,start-check,
contracts,ledger,undoes-tool}.ts, action-permissions/declaration.ts,
flow-bootstrap/action-permissions.ts, llm/harness-options/binding.ts,
service/{candidate-trial/landed-acts,project-build/{reset-calls,brief-ports}}.ts;
downstream llm-evidence/{control-spot/{target,token},permission,start-state/observe,
tools}.ts and state-diff/places/snapshot.ts. Owning tests and authored reset/page
evidence architecture docs accompany these. New real-browser content proof
is created-identity/tests/site-reset-subject.spec.ts, everything-store only,
using isolated fixture state and comparing every baseline line after removing
only the newly added line.


Modern subject-bearing reversible acts require positive baseline restoration.
If an unproved inverse is kept or named cannotUndo, Core refuses the next
ordinary trial as candidate.trial_reset_unproved. It never measures leftovers
as a successful reset. Irreversible effects and legacy no-subject contracts
retain their existing semantics. Exact quantitative and saved-list inverse
operations remain unsupported by this subject witness and fail honestly.

## Checks observed so far

- Fail-first: two preservation regressions failed against original R1: subject-only deletion was admitted on an existing line; one changed undo was incorrectly accepted as exact restoration.
- After destination witness, before final strict-leftovers guard: 126/126 Core tests in 14 affected files passed, including reset-call routing, whole-project reset integration, and subflow-trial reset integration.
- Domain affected tests: 28/28 passed, including passive hidden/singleton subjects, scope transport through declarations and trial state diff, and distinct equal-heading locations.
- Core typecheck passed before final strict-leftovers guard; the first run found missing required kind in a newly added test fixture, corrected before the passing run.
- Core and downstream structure audits exited 0 with existing advisory warnings. Final audits will be repeated after the completed changes.
- Early downstream check/content-proof commands exited at the stale-Core-build guard. No browser was launched and these were not counted as test results. Awaiting final frozen-source Core build before retries.
- No full suites, paid runs, commits, merges, or pushes performed by this worker. Billed spend is zero.


## Supervisor review hardening (supersedes the page-only witness above)

The first implementation's page-only scope and DOM absence were insufficient:
independent tabs can share a URL, and a virtualized/lazy list can omit existing
items. The final design now requires positively complete semantic collections.
The generic domain validator accepts nonempty role=list collections only when
every listitem declares the same finite aria-setsize N, all N unique
aria-posinset values 1..N are captured, and every row has one unique subject.
Missing/partial/unknown/duplicate inventories grant nothing. Collection scope
hashes the trusted resource, location, frame, and collection selector.

The supervisor owns extension result transport sourceId, derived from actual
action-runner tabId/frameId, never from page data. This worker hashes validated
sourceId with the selected gateway session into resetResource and carries it
only in private bindings. The output dispatcher exposes its selected session
in result metadata so trial snapshots use the identical resource. Raw resource
metadata never enters published page summaries. Absent trusted metadata fails
closed. Existing project observation routing can no longer let another tab's
same-URL inventory overwrite the act's actual collection scope.

The realistic store cart now exposes truthful accessible list/listitem roles
and cardinality/position on active and saved lines. This changes no task or
oracle. Empty lists lacking an explicit finite-set witness remain unsupported;
this design never infers their completeness from an empty DOM.

Scope-only modern controls opt into exact reset enforcement even if a title
cannot be read. Wrong-target or unproved modern undo attempts are recoverable:
they touch nothing and can retarget. A modern control press under undoes cannot
bypass this gate by declaring no lasting consequence. Ordinary trials still
refuse unproved leftovers, including cannotUndo.

A witnessed removal may restore multiple create-new effects only when they
came from the same registered operation, same positively identified source
scope/item/subject, and same control name. The complete destination baseline
must predate every effect. Their subject must disappear on that same complete
collection afterward, so a second destructive press is unnecessary. Unrelated
operations or controls sharing a subject are not absorbed.

Additional owned paths: domain runtime/host-runtime.ts, io/gateway-output-
dispatcher.ts, llm-evidence/{sanitize,stable-handles,structure/detect,index}.ts,
control-spot/{collection,resource,index}.ts and owning tests; scenario-lab
scenarios/everything-store/pages/cart/main.ts and its scenario unit test.
Root owns extension result-mapping.ts/server-command-channel.ts and related
transport test and documentation paragraph, and must include those in review.

## Final preservation hardening (2026-10-17, review in progress)

The ledger now requires restoration of the complete destination subject inventory
and every baseline row's semantic state fingerprint. Disappearance alone is
insufficient: a newly present owned subject in another complete sibling list on
the same captured resource/page refutes restoration; a pre-existing sibling row
must retain its original fingerprint. Baseline sibling inventories must be
freshly observed. Core regressions cover fake Delete that moves to saved,
unchanged baseline sibling rows, changed sibling quantity, unrelated over-delete,
and two own adds restored by one remove. Latest narrow guard run: 116/116 in ten
files passed. Final cache-off Core check/build is running with all Core package
source and tests frozen; downstream checks must await its actual exit.

The combined provider-free browser run exposed two automatic extraction failures
in existing everything-store cart specs, alongside a passing reset proof and a
passing recorded extraction spec. No oracle changed. A real-DOM A/B probe will
compare current semantic wrapper markup, wrapper-only removal, and original
pre-ARIA markup before any extraction proposal-contract change is considered.

The provider-free real-DOM A/B passed: current markup, removal of only the active
list wrapper, and restoration of original pre-ARIA markup each detected two
rows, exactly 24 columns, and zero currency columns. The semantic fixture markup
did not push price out; the existing proposal limit also loses it on baseline
markup. No infer-fields source was changed for this probe. Temporary diagnostic
spec removed after recording its result.

## Separate generic extraction repair

Real-DOM A/B established that automatic cart extraction already omitted late
ordinary fields on original markup: all three variants produced 24 columns and
no currency column. The supervisor authorized the generic correction in
apps/extension/src/content/extraction/infer-fields.ts and its owning test.
The proposal bound now aliases the existing 64-source discovery bound. Existing
coverage, partial-field and positional-group retention still choose within64 if
mixed-template separation expands sources. No value-specific preference and no
oracle changes. Tradeoff: larger proposals, still bounded, documented in
 docs/architecture/web-capabilities.md. Keep these three paths grouped separately
from reset-preservation security/integration changes in review and commits.

Two regression cases first failed on the old24 bound (17/19 pass), then all19
infer-fields tests passed after the change: late ordinary data/partial lines,
deterministic order/keys, and >64-source bounded discovery. Browser regressions
and stronger whole-baseline reset assertions await final frozen Core build exit.

Final generic reset wording now explicitly asks builders to inspect a complete
destination inventory before creating effects removed elsewhere. Reset completion
schema and kept-act feedback no longer claim reversible leftovers admit ordinary
trials; ledger comments distinguish legacy unscoped policy. Core guard rerun:
116/116 passed after these wording edits. Final cache-off rebuild72857 running.

## Frozen-source verification commands for supervisor

Core package source/tests frozen after final generic wording; downstream source
frozen after the separate 64-column correction and strengthened browser reset
assertions. Await actual exit of final Core build before any downstream check.

Core cwd: C:/Users/osrs_/FluxStuff/fxwork/t719/!FluxIQ

```
pnpm.cmd --filter fluxiq exec vitest run src/programs/automation-studio/runtime/flow-bootstrap/site-reset/tests/ledger-subject.test.ts src/programs/automation-studio/runtime/service/project-build/tests/reset-calls.test.ts --maxWorkers 2 --minWorkers 1
```

This includes scoped missing-title gating, wrong-target correction, undeclared
undo bypass refusal, two same-operation own adds/one remove, pre-existing qty,
complete inventories, sibling fake-Delete move, unchanged/changed baseline-owned
sibling rows, over-delete and irreversible policy. Worker latest larger narrow
run passed116/116 in10files after all final Core edits.

Downstream cwd: C:/Users/osrs_/FluxStuff/fxwork/t719/!FluxIQWebExtension

```
$env:DOMAIN_TEST_BUILD_LABEL='supervisor-reset-review'
node domain/scripts/test-domain.mjs control-spot/tests state-diff/places/tests start-state/tests runtime/tests/host-runtime io/tests/gateway-output-dispatcher.test
$env:FLUXIQ_BUILD_CACHE_DIR='off'
pnpm.cmd --filter @fluxiq-web-extension/extension test:content -- --workers=1 site-reset-subject.spec.ts everything-store-cart.spec.ts everything-store-cart-names.spec.ts
```

Extension package cwd: .../!FluxIQWebExtension/apps/extension

```
$env:EXTENSION_TEST_BUILD_LABEL='supervisor-reset-review'
node scripts/test-extension.mjs content/extraction/tests/infer-fields.test runtime/tests/result-mapping.test
```

Parent owns the trusted wire mapping and its27 passing tests. Passive browser
proof uses realistic everything-store in isolated Chromium, real content bundle,
site's own controls and no provider. It checks subject emission, complete
collection witness, whole baseline SKU/text/quantity preservation and exact
semantic-state maps after removing only the new line. It does not prove an LLM
build invokes destination observation correctly, nor actual installed extension
background transport; those remain the held paid/install proof.

## Canonical install continuation: bounded transfer design (approved, held)

The canonical everything-store-kettle-to-cart install task requires two new
Sage1.7L kettles AND moving the existing phonecase to Saved for later. The
install-core-lead report names this exact task. The small-Sage task makes no
lasting change; there is no existing add-only everything-store task. Crossborder
mint-hub-fallback is add-only but has no complete-collection witness proven by
this work and cannot substitute for the canonical install acceptance.

The supervisor approved a separate transfer patch, held until the current
reviewed unit is committed and explicit worker release is sent. Exact paths:
Core site-reset/ledger.ts, tests/ledger-subject.test.ts, authored
llm-flow-bootstrap.md; downstream existing site-reset-subject.spec.ts only.
No domain production change, fixture/oracle change or task-shaped guidance.

A transfer inverse must have one unambiguous origin matching the act's own
scope, one destination in the same trusted resource/page group, and complete
origin+destination baselines observed before the act. Subject originally present
at origin and absent at destination must now be absent at origin and present at
destination. Admit one registered modify-existing inverse on that destination
subject; refuse deletion, quantity ambiguity, pre-existing destination subjects,
partial/post-effect baseline and cross-resource matching. A landed inverse is
spent once. Completion requires the original ORDERED subject sequences and all
baseline semantic row-state values in origin, destination and sibling complete
inventories. Fake inverse, swapped rows, or changed baseline quantity remains
unproved and blocks ordinary trial. Existing ordered arrays support this without
new public wire types; the current Set-only completion comparison must become
order-sensitive.


Final completed check sessions: Core72857 check140.4s/build189.4s exited0;
domain+extension62565 exited0 (domain48.1s, extension279.4s); domain70437 passed67;
browser34804 passed4. Core audit22322 passed400 advisories; downstream55798
passed208 advisories after replacing internal test import with public startState.
All product sources/tests remain frozen awaiting supervisor commit and transfer
release. Only this report was updated after final validation.
