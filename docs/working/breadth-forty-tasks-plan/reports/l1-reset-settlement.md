# L1: reset settlement redesign (t724)

Lane lead report. Branch `task/t724-reset-settlement-redesign` in both paired worktrees
(`fxwork/t724/!FluxIQ`, `fxwork/t724/!FluxIQWebExtension`), from dev (downstream 9d372c2f, Core fd9837cc).
No commits, no live or paid runs.

## Why

Site-reset failures recurred in seven shapes, each patched alone:

| Shape | Run | What broke |
| --- | --- | --- |
| A canonical r5 | run-mve8vn94-023a5213 | model claimed the failed first attempt (act-10), not its successful retry (act-11) |
| B canonical r6 | run-mvebqbm4-b3f3b742 | reset worked (own delete, inverse move) but took four dirty-trial refusals |
| C office r1 | run-mved5pro-91998cc2 | create_new Buy Now, cart unchanged: no rule used the unchanged destination (F1 fixed) |
| D job r1 | run-mvectfld-c2f5d958 | site-failed saves in no list: no way to settle (F1 fixed, only with a named destination) |
| E office r2 | run-mvfq94ff-c8c21493 | the trial's own act got no destination (`trialRan`); a retest after a settling look was answered `already_answered`; cannotUndo words false for strict acts; trial-act words "page not read" |
| F job r2 | run-mvfq94fg-64e82826 | `webResetCollections` trusts only aria-setsize/posinset, so plain lists never become originals and no `resetDestination` is ever issued |
| G photo r2 | run-mvfq959u-b7afdf80 | Unlike on the post page undoing a Like pressed in the post's dialog refused `undo_unproved`; a toggle's own state is not recorded |

The common cause: settlement was three narrow proofs (`originalGroupRestored`, `subjectRestored`,
`leftUnchanged`), each over a different evidence shape, each needing the model to make exactly the right look, and
the evidence (complete lists, a control's own state) existed only on some sites.

## Design: one settlement model grounded in observed state

Every lasting act of the build (explored or trial) carries **witnesses**: the before-state of each thing it could
change. An act is **settled** when fresh, complete observations of every witness equal its before-state; it is
**open** otherwise, and the refusal says, per act, exactly what to observe or undo.

### Witnesses

1. **Group witness** (a complete list group): the act's own list (its control sat in a complete original list read
   before it), every destination named for it (`resetDestination` on its own call, or on a later look naming it under
   `undoes`), the destination its creation was admitted against, and the destinations of the explored acts a trial act
   repeats (lazy: a destination named later for the explored act also covers the trial act).
   - Relevant scopes = the named/own scopes, plus every original scope of the group that held one of the act's
     subjects. Holds when each relevant scope is in the fresh read and restored row for row and value for value, and
     no other fresh scope of the group holds an act subject it did not hold originally with the same state.
     Unrelated lists on the same page (recently viewed, menus) no longer block (F1 required the whole group).
2. **Toggle witness** (the act's own control): for an act declaring exactly `modify_existing`, from the declaration's
   `control.place`/`control.state` and the reads just before and after it (explored), or the step diff's
   `controls` (trial). Exists only when exactly one control at the place changed from `state` to one other state.
   Holds when the place is back at the build's start counts for those states, as read right after a later landed
   press at that place, and still so on the latest read. A control that reverts by itself (a transient "Added") is
   never enough: the return must follow a press.

### Settlement

- **Fresh**: a group/page read complete after the act and after the latest landed lasting call or trial (ledger
  clock). Partial (domain completeness), malformed (`invalidCollectionGroups`) or stale reads never settle.
- **Settled restored**: all witnesses hold and a change was seen at some point (or an undo landed). Sticky, not listed.
- **Settled unchanged**: all witnesses hold and no read ever showed a change. Sticky; reported in every later trial's
  `startedWith.cannotUndo` as "left; nothing it could change showed a change" (the judge is told).
- **Open**: no witness at all, a stale witness, or a changed witness. Strict acts never leave by `cannotUndo`
  (unchanged invariant: a reversible effect is never waved through); legacy unscoped acts keep their old paths.
- **Core looks first**: before refusing, `beforeTrial` takes the target to each stale witness's location once
  (`checks.lookAt`, the arrival node, a settled read fed to every ledger), then decides. The model is asked only for
  what Core could not observe or what still differs.

### Admission (pre-existing items never touched)

Unchanged: own item, created item (non-strict), follow-up confirm, moving, subject delete of a subject proved absent,
witnessed transfer. New: **toggle back** -- an undo whose control has the act's `place` and shows the act's after
state, declaring `[]` or `[modify_existing]`, is admitted `own` with `modify_existing` unasked. A control on another
place, or already in the before state, is refused unrun.

### Feedback

Each open act in `actsToUndo` / `actsToRestore` / the reset brief carries `settle`: one generic sentence built from
its open reasons -- read `destination-N` at `<location>` completely again; `destination-N` still differs, undo it
there; its control at `<location>` still shows the state this act set, press it back; or nothing read shows where its
effect would be, so read that list completely and name its ref (listing the refs read complete before the act, with
counts and locations). A refused action is re-decided after any later call ran, a look included, so the retest after
a settling look reaches the ledger. `cannotUndo` words now say the truth for strict acts, and trial acts are worded as
"made by trial step N" instead of "page not read".

### Downstream evidence

- **List completeness (F)**: a native list or table is complete when the capture is not truncated, every item holds
  exactly one distinct subject, no item carries aria set attributes that disagree, and the extension's existing
  continuation detectors (`read-coverage/list-continues.ts`: Next, Load more, declared feed) report no way on, as a
  closed per-list fact on the passive capture (`listWayOn: "none"`). Absent fact = not complete. Aria path unchanged.
- **Control states (G)**: every visible stateful control (button, checkbox, switch, radio, menuitemcheckbox/radio,
  option, tab, or any element with aria-pressed/checked/selected) is reported per read as
  `controls: { [place]: { [state]: count } }`; `place` = digest(resource, location, role, subject of the record it sits
  in or ""), `state` = digest(name, pressed, checked, selected). The declaration and the step diff spot carry the
  acted control's `place` and `state`; the step diff carries `controls: { page, before, after }` at that place.

## Data shapes (pinned before dispatch, Core rebuilt)

- Core `action-permissions/declaration.ts`: `control.place?`, `control.state?` tokens; `controlPlace`, `controlState`.
- Core `flow-bootstrap/action-permissions.ts`: passes them on `declared.control`.
- Core `site-reset/contracts.ts`: `Spot.place?/state?`; `Read.controls?`; `TrialActPlace.controls?: {page, before, after}`;
  `Checks.lookAt?(location)`; `NamedAct.settle?`.
- Core `llm/harness-options/binding.ts`: `startState` answer `controls?`.
- Core `site-reset/start-check.ts`: `read()` passes validated `controls`; `lookAt(location, signal)` returns a settled read.

## Owners and briefs (partitioned by file)

| Brief | Agent | Repo | Owns |
| --- | --- | --- | --- |
| C1 settlement | worker-high | Core | `flow-bootstrap/site-reset/**` except `contracts.ts`/`start-check.ts` (new `settlement/` dir) + tests |
| C2 plumbing | worker | Core | `service/candidate-trial/landed-acts.ts`, `flow-bootstrap/candidate/authoring-loop.ts`, declaration/placeOf tests |
| C3 repeat | worker | Core | `llm/evidence-loop.ts`, `llm/repeat-policy.ts` + tests |
| D1 lists | worker-high | downstream | extension snapshot list fact, wire types, domain `elements.ts`/`sanitize.ts`, `control-spot/collection.ts` + tests |
| D2 controls | worker-high | downstream | domain `control-spot/` new modules + `target.ts`/`index.ts`, `start-state/observe.ts`, `state-diff/places/diff.ts`, `permission.ts`, `node-run/run.ts` + tests |
| C4 words | worker | Core | `project-agents/dispatch/reset-loop.ts`, `reset-done.ts`, `service/project-build/brief-ports.ts` (after C1) |
| D3 browser proof | worker-high | downstream | `apps/extension/e2e/site-reset/**` (after all) |

## Test list (provider-free regression corpus)

- Core `site-reset/settlement/tests/shapes.test.ts`: one case per shape A-G from the debugs' closed evidence with
  generic made-up fixtures, plus invariants (pre-existing never touched, partial/stale never settle, strict
  cannotUndo stays refused).
- Core `llm/tests/`: refused action retried after a look runs again; with nothing between it is answered from memory;
  refuse-look loops stay bounded.
- Domain `control-spot/tests/collection.test.ts`: plain list/table complete with the fact; not complete when continued,
  truncated, duplicate or missing subject, or fact absent.
- Domain `control-spot/tests/`: control places and states; toggle in a dialog and on the page share a place.
- Extension snapshot test: the per-list fact for pager, load more, declared feed, none.
- Existing: site-reset, project-build, supervisor, candidate-trial, dispatch tests; both structure audits.
- Browser: `installed-project.spec.ts` extended with one case per shape (scripted provider, headed).

## Work ledger

- 2026-10-19: debugs read (A-G); contract pinned in Core (declaration, contracts, binding, start-check); Core
  typecheck `npx tsc -p packages/fluxiq/tsconfig.json --noEmit` -> exit 0, no output; Core libraries rebuilt (2m40s),
  `node scripts/check/core-build.mjs` -> current.

## Worker Briefs

Core paths are under `C:/Users/osrs_/FluxStuff/fxwork/t724/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/`
(`RT/` below); downstream paths under `C:/Users/osrs_/FluxStuff/fxwork/t724/!FluxIQWebExtension/`. Reports go to
`docs/working/breadth-forty-tasks-plan/reports/<label>.md` in the downstream t724 tree. Phase 1 runs C1, C2, C3, D1
and D2 in parallel; downstream tests run through the direct scripts (no Core rebuild; Core's dist carries the pinned
contract while Core source is edited).

### Brief: l1-c1-settlement (worker-high)
See the dispatch prompt; owns `RT/flow-bootstrap/site-reset/**` except `contracts.ts`, `start-check.ts`,
`tests/start-check.test.ts`.

### Brief: l1-c2-plumbing (worker)
Owns `RT/service/candidate-trial/landed-acts.ts`, `RT/flow-bootstrap/candidate/authoring-loop.ts`,
`RT/flow-bootstrap/candidate/contracts.ts` (only to carry fields), declaration/placeOf/landed-acts/start-check tests.

### Brief: l1-c3-retest (worker)
Owns `RT/llm/evidence-loop.ts`, `RT/llm/repeat-policy.ts`, one new module beside them, `RT/llm/tests/` additions.

### Brief: l1-d1-lists (worker-high)
Owns the extension snapshot list fact, wire types, domain `elements.ts`/`sanitize.ts` (the field only),
`domain/src/runtime/llm-evidence/control-spot/collection.ts` and its test.

### Brief: l1-d2-controls (worker-high)
Owns new domain `control-spot/` control-state modules, `control-spot/target.ts`, `control-spot/index.ts`,
`start-state/observe.ts`, `state-diff/places/diff.ts`, `permission.ts`, and their tests.

## Ledger (continued)

- Phase 1 verified by the lead (C1 settlement, C2 plumbing, C3 retest, D1 lists, D2 controls): Core `npx vitest run`
  over site-reset, candidate, action-permissions, candidate-trial, project-build, dispatch, supervisor and
  repeat-policy -> 139 files, 1170 tests passed; domain `test-domain.mjs` over control-spot, start-state, state-diff,
  llm-evidence, page-find, state-digest, node-run -> 716/716; extension `test-extension.mjs` over content/extraction,
  read-coverage, content/tests, background/connection, shared -> 623/623; extension tsc src+test exit 0; downstream
  structure audit passed.
- Deviation accepted: C1's settlement modules are flat `site-reset/settlement-*.ts`, because `site-reset/settlement/`
  would exceed the audit's non-ratcheting 9-segment path depth. `ledger.ts` is at 799/800 lines and `site-reset/` at
  23/25 files: the next change there must split first (undo admission is the natural piece).
- Lead fix: D1 added `listWayOn` to every element's digest projection without bumping the digest version; bumped
  `web-state.v6` -> `v7` with a header note (the file's own rule: a projection change must not read as a state change).
- Finding (C6): every trial gate answers a reset refusal with `resultReason: "retry_allowed"`, which the repeat guard
  already exempts, so office r2's dead end was only the answered-request memory (C3). C6's precondition rule makes the
  guard independent of that reason. Decision: no further blocking of an identical retest with no call between (the
  memory layer already answers it).
- Decision (C4): a reset completion naming every listed act under `cannotUndo`, each already shown with its settle
  sentence, ends the reset `blocked` (honest unresolved) instead of being refused until the repeat guard ends it; the
  ledger still refuses every trial while such an act is open, so no trial runs on leftovers.
- Phase 2 verified by the lead (C4 words/look wiring, C5 trial carry-through, C6 reset precondition): Core vitest over
  flow-bootstrap, action-permissions, project-build, candidate-trial, subflow-trial, project-agents -> 321 files, 3348
  passed, 2 skipped; `runtime/llm` -> 220 files, 2117 passed; executor, summaries, flow-draft -> 157 files, 1376 passed;
  `npx tsc -p packages/fluxiq/tsconfig.json --noEmit` exit 0; `pnpm --filter ./packages/fluxiq check` exit 0; Core
  structure audit passed. Core libraries rebuilt; `core-build` current.
- Lead fix: the workers typechecked only `domain/tsconfig.json`; `tsconfig.test.json` failed on three lines (the
  domain's own `startState` type in `llm-evidence/tools.ts` lacked `controls`; an exactOptional fixture in
  `collection.test.ts`; `present.test.ts`'s exhaustive element). Fixed; `pnpm --filter @fluxiq-web-extension/domain
  check` exit 0; affected tests 42/42.
- Browser proof D3 (headed, provider-free): existing shapes A and B, job D+F and office C passed; it found two
  product defects. Office E: in a single-subflow plan the builder's test is the judged whole run, recorded in the
  supervisor's ledger, which held none of the builder's explored acts, so the trial press never inherited the cart ref.
  Photo G: the capture gave the icon-drawn Like/Unlike control no accessible name, so both states had one state token.
- Supervisor decisions (2026-10-19): fix both inside L1, no `test.fail` left; repeats match explored acts of every
  ledger of the build; name from content includes a descendant `svg[aria-label]`/`svg > title` plus a page-view-words
  fallback in `state.ts`; a navigation under `undoes` is a look, never an undo attempt; `NODE_OPTIONS` for the specs.
- C7 (Core): undo admission moved to `site-reset/undo-admission.ts` (ledger.ts 731 lines, `site-reset/` 24/25 files);
  build-wide repeats via `project-ledger.ts` (`buildExplored`); a call admitted `moving` that declares no lasting class
  and no item is a look (no attempt, no clock, no press). Changed expectation: t593's coupon "undo" with no item is now a
  look, so that possibly-lasting act stays listed as possibly in place (it never blocks a trial).
- D5 (extension/domain): the name is computed in `content/identity/accessible-name.ts` (not `shared/dom-element.ts`);
  name from content now includes a labelled descendant svg or its title, respecting aria-hidden; `state.ts` falls back to
  the page view's words. Lead fix: my `web-state.v7` bump broke 5 regex pins (`web-state\.v6`) in two state-digest tests
  that my literal search missed; updated; domain llm-evidence + state-diff -> 1229/1229.
- Playwright: setting the flag inside `e2e/playwright.config.ts` cannot reach the process that lists spec files (proved:
  "TypeScript parameter property is not supported in strip-only mode", "No tests found"). `apps/extension/package.json`
  `test:e2e` now starts the runner with `node --no-experimental-strip-types`; the config keeps `NODE_OPTIONS` for every
  process Playwright spawns and says a direct run needs the variable.
- D6 (specs only): office E's second test was the stored verdict of an already-passed revision (same trial run id), so
  it now tests a revision 2 (adds a capture step); photo G's Flow liked a target saved in the dialog from the standalone
  page (a saved control is not matched in another dialog by design), so it now likes in the dialog and then unlikes the
  trial's own Like under `undoes`. Decision: completion without undoing the final judged run is correct (the rule covers
  every trial and the judged run; the final run's effect is the person's task).
- D7 (both repos): the trial act's `settle` had no location because the supervisor's ledger saw no read of the trial's
  page before it held an act; the step diff's `controls` now carry `location`, the tracker records it, and Core's own look
  can reach it. Photo spec tests once more after the trial act's Unlike: admitted (Core answers the revision's standing
  yes, `alreadyJudged`).
- Final validation by the lead on the recovered machine (2026-10-19, 21:03-22:05; free commit 17.3 GB): Core
  `npx vitest run runtime/flow-bootstrap` -> 197 files, 2453 passed, 2 skipped; `action-permissions`, `service/project-build`,
  `service/candidate-trial`, `service/subflow-trial`, `project-agents` -> 126 files, 903 passed; `runtime/llm` -> 220 files,
  2117 passed; `npx tsc -p packages/fluxiq/tsconfig.json --noEmit` exit 0; `pnpm --filter ./packages/fluxiq check` exit 0;
  Core structure audit passed. (A first combined run, started beside the downstream suites, failed 3 tests in the untouched
  `verification/tests/durable-session.test.ts`; that file passed alone 10/10 and in its folder: load, not this lane.)
  Downstream: domain `test-domain.mjs src/runtime/llm-evidence src/runtime/state-diff` -> 1229/1229; extension
  `test-extension.mjs` over identity, action-runtime, content/tests, extraction, read-coverage, shared,
  background/connection -> 934/934; `pnpm --filter @fluxiq-web-extension/domain check` exit 0; extension `pnpm check`
  exit 0; structure audit passed. Browser: `pnpm test:e2e:build` then `node --no-experimental-strip-types
  node_modules/@playwright/test/cli.js test -c e2e/playwright.config.ts e2e/site-reset/tests/ --workers=2` (headed,
  scripted provider, zero model calls) -> 6 passed (9.0m): new-row inverse 59.7s, failed save vs retry 1.5m, job D+F
  39.0s, office C 53.4s, office E 1.1m, photo G 1.9m. No test.fail/fixme/skip remains.

## Files for commit (task t724)

Core (`C:/Users/osrs_/FluxStuff/fxwork/t724/!FluxIQ`):
     M docs/architecture/automation-studio/llm-flow-bootstrap.md
     M packages/fluxiq/src/programs/automation-studio/runtime/action-permissions/declaration.ts
     M packages/fluxiq/src/programs/automation-studio/runtime/action-permissions/tests/declaration.test.ts
     M packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/action-permissions.ts
     M packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/candidate/authoring-loop.ts
     M packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/candidate/contracts.ts
     M packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/candidate/index.ts
     M packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/candidate/tests/trial-gate-reset.test.ts
     M packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/candidate/trial-gate.ts
     M packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/site-reset/contracts.ts
     M packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/site-reset/create-baselines.ts
     D packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/site-reset/destination-unchanged.ts
     M packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/site-reset/index.ts
     M packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/site-reset/ledger.ts
     M packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/site-reset/project-ledger.ts
     M packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/site-reset/project-reset.ts
     M packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/site-reset/start-check.ts
     M packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/site-reset/tests/ledger-subject.test.ts
     M packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/site-reset/tests/ledger.test.ts
     M packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/site-reset/tests/start-check.test.ts
     M packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/site-reset/tests/trial-policy.test.ts
     M packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/site-reset/trial-policy.ts
     M packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/site-reset/words.ts
     M packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/subflow-candidate/contracts.ts
     M packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/subflow-candidate/tests/subflow-trial-gate.test.ts
     M packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/tests/action-permissions.test.ts
     M packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop.ts
     M packages/fluxiq/src/programs/automation-studio/runtime/llm/harness-options/binding.ts
     M packages/fluxiq/src/programs/automation-studio/runtime/llm/repeat-guard/outcomes.ts
     M packages/fluxiq/src/programs/automation-studio/runtime/llm/repeat-policy.ts
     M packages/fluxiq/src/programs/automation-studio/runtime/llm/tests/repeat-policy.test.ts
     M packages/fluxiq/src/programs/automation-studio/runtime/project-agents/dispatch/reset-done.ts
     M packages/fluxiq/src/programs/automation-studio/runtime/project-agents/dispatch/reset-loop.ts
     M packages/fluxiq/src/programs/automation-studio/runtime/project-agents/dispatch/tests/brief-loops.test.ts
     M packages/fluxiq/src/programs/automation-studio/runtime/project-agents/dispatch/tests/reset-done.test.ts
     M packages/fluxiq/src/programs/automation-studio/runtime/service/candidate-trial/landed-acts.ts
     M packages/fluxiq/src/programs/automation-studio/runtime/service/candidate-trial/tests/landed-acts.test.ts
     M packages/fluxiq/src/programs/automation-studio/runtime/service/project-build/brief-ports.ts
     M packages/fluxiq/src/programs/automation-studio/runtime/service/subflow-trial/run.ts
    ?? packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/candidate/trial-acts.ts
    ?? packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/site-reset/settlement-act-groups.ts
    ?? packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/site-reset/settlement-control-tracker.ts
    ?? packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/site-reset/settlement-decision.ts
    ?? packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/site-reset/settlement-group-witness.ts
    ?? packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/site-reset/settlement-observations.ts
    ?? packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/site-reset/settlement-toggle-witness.ts
    ?? packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/site-reset/settlement-transfer-witness.ts
    ?? packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/site-reset/settlement-trial-repeat.ts
    ?? packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/site-reset/settlement-words.ts
    ?? packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/site-reset/tests/ledger-looks.test.ts
    ?? packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/site-reset/tests/project-ledger-repeats.test.ts
    ?? packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/site-reset/tests/settlement-shapes.test.ts
    ?? packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/site-reset/tests/settlement-witnesses.test.ts
    ?? packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/site-reset/undo-admission.ts
    ?? packages/fluxiq/src/programs/automation-studio/runtime/llm/refused-action-retest.ts
    ?? packages/fluxiq/src/programs/automation-studio/runtime/llm/repeat-guard/tests/reset-precondition.test.ts
    ?? packages/fluxiq/src/programs/automation-studio/runtime/service/project-build/tests/project-build-reset-settle.test.ts

Downstream (`C:/Users/osrs_/FluxStuff/fxwork/t724/!FluxIQWebExtension`):
     M apps/extension/e2e/playwright.config.ts
     M apps/extension/e2e/site-reset/index.ts
     M apps/extension/e2e/site-reset/tests/installed-project.spec.ts
     M apps/extension/package.json
     M apps/extension/src/content/dom-snapshot.ts
     M apps/extension/src/content/extraction/read-coverage/index.ts
     M apps/extension/src/content/identity/accessible-name.ts
     M apps/extension/src/content/identity/tests/accessible-name.test.ts
     M apps/extension/src/shared/dom-element.ts
     M docs/architecture/page-evidence.md
     M domain/src/runtime/llm-evidence/control-spot/collection.ts
     M domain/src/runtime/llm-evidence/control-spot/index.ts
     M domain/src/runtime/llm-evidence/control-spot/target.ts
     M domain/src/runtime/llm-evidence/control-spot/tests/collection.test.ts
     M domain/src/runtime/llm-evidence/control-spot/tests/declared.test.ts
     M domain/src/runtime/llm-evidence/elements.ts
     M domain/src/runtime/llm-evidence/index.ts
     M domain/src/runtime/llm-evidence/look-alikes.ts
     M domain/src/runtime/llm-evidence/page-find/description.ts
     M domain/src/runtime/llm-evidence/permission.ts
     M domain/src/runtime/llm-evidence/start-state/observe.ts
     M domain/src/runtime/llm-evidence/start-state/tests/start-state.test.ts
     M domain/src/runtime/llm-evidence/state-digest/state-digest.ts
     M domain/src/runtime/llm-evidence/state-digest/tests/call-state-digests.test.ts
     M domain/src/runtime/llm-evidence/state-digest/tests/state-digest.test.ts
     M domain/src/runtime/llm-evidence/tests/present.test.ts
     M domain/src/runtime/llm-evidence/tools.ts
     M domain/src/runtime/state-diff/places/diff.ts
     M domain/src/runtime/state-diff/places/tests/places.test.ts
    ?? apps/extension/e2e/site-reset/diagnostic.ts
    ?? apps/extension/e2e/site-reset/installed-build.ts
    ?? apps/extension/e2e/site-reset/instrumented-runtime.ts
    ?? apps/extension/e2e/site-reset/page-view.ts
    ?? apps/extension/e2e/site-reset/project-build.ts
    ?? apps/extension/e2e/site-reset/scripted-provider.ts
    ?? apps/extension/e2e/site-reset/store-opening.ts
    ?? apps/extension/e2e/site-reset/tests/job-failed-save.spec.ts
    ?? apps/extension/e2e/site-reset/tests/office-buy-now.spec.ts
    ?? apps/extension/e2e/site-reset/tests/photo-toggle.spec.ts
    ?? apps/extension/e2e/site-reset/trial-answers.ts
    ?? apps/extension/src/content/extraction/read-coverage/list-way-on.ts
    ?? apps/extension/src/content/extraction/read-coverage/tests/list-way-on.test.ts
    ?? docs/working/breadth-forty-tasks-plan/reports/l1-c1-settlement.md
    ?? docs/working/breadth-forty-tasks-plan/reports/l1-c2-plumbing.md
    ?? docs/working/breadth-forty-tasks-plan/reports/l1-c3-retest.md
    ?? docs/working/breadth-forty-tasks-plan/reports/l1-c4-reset-words.md
    ?? docs/working/breadth-forty-tasks-plan/reports/l1-c5-trial-carry.md
    ?? docs/working/breadth-forty-tasks-plan/reports/l1-c6-reset-precondition.md
    ?? docs/working/breadth-forty-tasks-plan/reports/l1-c7-build-repeats.md
    ?? docs/working/breadth-forty-tasks-plan/reports/l1-d1-lists.md
    ?? docs/working/breadth-forty-tasks-plan/reports/l1-d2-controls.md
    ?? docs/working/breadth-forty-tasks-plan/reports/l1-d3-browser-proof.md
    ?? docs/working/breadth-forty-tasks-plan/reports/l1-d4-docs.md
    ?? docs/working/breadth-forty-tasks-plan/reports/l1-d5-drawn-toggle-names.md
    ?? docs/working/breadth-forty-tasks-plan/reports/l1-d6-spec-scripts.md
    ?? docs/working/breadth-forty-tasks-plan/reports/l1-d7-trial-toggle-location.md
    ?? docs/working/breadth-forty-tasks-plan/reports/l1-reset-settlement.md
    ?? domain/src/runtime/llm-evidence/control-spot/place.ts
    ?? domain/src/runtime/llm-evidence/control-spot/role.ts
    ?? domain/src/runtime/llm-evidence/control-spot/state.ts
    ?? domain/src/runtime/llm-evidence/control-spot/stateful.ts
    ?? domain/src/runtime/llm-evidence/control-spot/states.ts
    ?? domain/src/runtime/llm-evidence/control-spot/tests/controls.test.ts
