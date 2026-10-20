# Report: t743-rerun4-structural (lane lead)

Trees: downstream `C:/Users/osrs_/FluxStuff/fxwork/t743/!FluxIQWebExtension`, Core
`C:/Users/osrs_/FluxStuff/fxwork/t743/!FluxIQ`, both on `task/t743-rerun4-structural` (downstream
`74b22c23`, Core `3b13e394`). No commits, merges or pushes.

## Outcome

Done for S1-S5. Every unit landed and the lead verified it: tests beside each change, the prompt
contract test (no pin moved), Core, domain and extension typechecks against the rebuilt Core, both
structure audits, the seven existing site-reset browser tests, and six new provider-free headed
reproductions (one or more per weakness). All passed. Nothing ran live or paid, and nothing was
committed, merged or pushed. One attempted extra fix (d5, a dialog view and a standalone page at one
address kept as two views) regressed a passing spec and was reverted; it is listed under open items.

What each round-4 run would now meet:

- **Office.** A read step reads a value its own earlier step changed: its target keeps its words,
  marked as the value it reads. The save guard counts them; the page never vetoes or prefers on them.
  Shown addresses belong to the build, so a repair or reset brief may go where an earlier brief stood.
  Core's own reset looks are not model calls and skip the address rule. Every brief's opening carries
  the build's issued-list locations (`places`). A witnessless trial act adopts only lists the build
  named as a destination, or lists on its own page; a search page nobody named is not adopted.
- **Job.** Each pass of a looped act is recorded on its own row (the state diff gets the attempt's
  inputs). A press the page answers only with a notice in its own alert or status region fails
  `web.action.page_reported_failure` and is retried, never counted as landed. Refusals name the failed
  condition and whether any call can meet it. An undo may remove, once, a subject newly present in a
  list the act itself named, so a save from an item's own page can be put back on its list.
- **Photo.** A list Core's own look cannot read again (a dialog's pushed address opening another
  document) is unreachable. An act whose toggle is back settles `restored`, and the judge is told. A
  list that is an act's only witness makes it `gate_unsatisfiable`: it leaves actsToUndo, trials stay
  refused, the brief is offered the honest exit, and its return carries
  `terminalReason: "gate_unsatisfiable"`. A press on a control already back is answered
  `candidate.undo_already_back`. The destination guidance asks for a destination only where a press has
  no other witness.
- **Every task (S3).** With money and at least three supervisor turns left, an ending is refused once
  per failed subflow (`project.completion_repair_first`) until it has had one changed brief, unless its
  return carries a closed terminal reason.
- **Social (S5).** Disclosure is checked only on rows a read's conditions keep. A trial past 40 steps
  still names the step that stopped it. The step log names a thrown error's real kind. Judge advice to
  add a field after an `incomplete_text` refusal is given as the disclosure order instead.

## Plan (2026-10-20)

Sources: rerun round 4 debug notes, office `run-mvgvyaip-d856e135` (t563), job
`run-mvgw1854-5d10955b` (t719), photo `run-mvgw7320-de416190` (t567). Social's round-4 debug is
still to come from the supervisor.

Starting state, checked before any edit: both structure audits pass (Core `passed (428 warning(s),
1152 baselined)`, downstream `passed (217 warning(s), 618 baselined)`); Core's dist is current
(`node scripts/check/core-build.mjs`: "current with its source"). Machine: 8 logical CPUs, 2.2 GB
free of 12 GB at the start, so at most four workers run at once and each runs only the tests
beside its change; the lead runs typechecks, audits, contract tests and rebuilds serially.

Structural constraints found:

- Core `flow-bootstrap/site-reset/` holds 25 source files, the directory cap, and `ledger.ts` is
  775 of 800 lines with 33 methods. New site-reset modules go in new subdirectories, and the
  ledger must shed a cohesive group of methods onto a collaborator before it grows.
- The existing `office-address-confirm.spec.ts` asserts that a witnessless trial act is settled
  `unchanged` by Core's own look at the cart (t741 A1). Any narrowing of A1 must keep that.

### Design decisions

**S1, one build-scoped site memory.** The address rule exists to stop the model navigating to
addresses it made up. An address the site showed to any brief of the build is not made up, so the
domain's shown-address memory belongs to the build: a later brief's fresh opening no longer
forgets it, and briefs run side by side share it. Core's own reset moves (`compare`, `compareAt`,
`lookAt`) are not model calls: Core marks them in its call frame (an async-context marker set
around the move, read into the frame the registry already writes; never by call-id shape), and the
domain skips the address rule for a marked call. Each brief's opening also carries the build's
places that Core prints (issued lists' locations) under a key read only on an opening, as
`repairs` is (t648), so every address Core's words name is one the domain admits even after the
in-process memory was lost.

**A1 narrowed to lists the act could have changed.** Core's tokens cannot say which list an act
affects (the page token is site-wide; a group is keyed by its page's location), and a same-page
rule would miss a product-page act whose effect shows in a list on another page. So a witnessless
trial or entry act adopts only (a) lists some act of this build named as where its effect shows,
and (b) lists read on the act's own page; never a list the model merely read (search results, home
rails). A list Core's own look cannot read again is dropped from the adoption, never held open
forever. The office-address-confirm spec's cart (Buy Now's named destination) stays adopted.

**S2, an actionable-answer contract.** Every site-reset refusal goes through one constructor that
requires a closed `failed` condition and whether any call can meet it (`canMeet`: this page,
another page, or no call). A source-scan test fails the build when a refusal is built by hand.
An act whose open reasons no call can meet (its only witness unreachable; nothing named for it with
refs closed) leaves `actsToUndo`, is listed with a closed `gate_unsatisfiable` reason, and the
refusal offers the honest exit (end the brief naming it). Trials stay refused while it is in place:
the reset rule is not weakened. A brief that ends this way carries the closed reason on its return.
An undo pressed on a control already showing the state the build found is answered with a closed
"already back" code, not "unproved".

**S3, repair before ending.** With money left, an `ended` completion is refused until every subflow
whose latest return failed has had one changed brief after it (a repair, or a brief after a plan
amendment), unless that return carries a closed terminal reason (allowance spent, build stopped,
`gate_unsatisfiable`, a person's refusal). Guidance step 7 says so.

**S4, specific defects.** A read step's target is not identified by the text it reads (office). A
looped step's state diff is scoped to its pass's row, so each pass's act carries its own row's spot
(job). A group witness whose location Core's look reaches but whose read does not show that group
is unreachable: with another witness holding and an undo landed (or a change seen) the act settles
`restored` and later judges are told the list could not be read again; as the only witness it is
`gate_unsatisfiable` (photo). The baseline guidance is qualified to presses with no other witness
(photo). A press the page answers with its own failure is traced and fixed (job).

### Work split (R = Core `packages/fluxiq/src/programs/automation-studio/runtime/`, L = downstream `domain/src/runtime/`)

| Wave | Worker | Unit | Owns |
| --- | --- | --- | --- |
| 1 | c2-answers (high) | S2 | R `site-reset/{undo-admission,words,create-baselines,reset-witness,undoes-tool,trial-policy,ledger (refusal sites only)}.ts`, new `site-reset/answers/` |
| 1 | c4-core-moves (high) | S1 | R `llm/harness-options/{evidence-build-scope,registry}.ts`, `site-reset/start-check.ts`, `project-agents/dispatch/{run-brief,reset-loop}.ts` (opening seeding) |
| 1 | c3-repair-first | S3 | R `project-agents/supervisor/{completion,guidance,state}.ts`, `project-agents/dispatch/ending.ts`, the builder-return contract |
| 1 | d2-read-identity | S4 office | L `llm-evidence/plan-resolution/` (element-identity, and the rebind trace) |
| 2 | c1-settlement (high) | S1/S2/S4 photo | R `site-reset/{ledger,settlement-*,project-ledger,contracts,index}.ts`, new subdirectory |
| 2 | d1-build-memory (high) | S1 | L `llm-evidence/node-run/{shown-addresses,run,arrival}.ts`, `node-run/build-state/build-key.ts` |
| 2 | d3-pass-spot (high) | S4 job | R `executor/host-state.ts`, `host-runtime.ts` type; L `host-runtime.ts`, `state-diff/places/` |
| 2 | d4-failed-press (high) | S4 job | traced first; files named by the trace, none of the above |
| 3 | lead + e2e workers | all | wiring `gate_unsatisfiable` into returns and the reset-first rule; provider-free headed specs |

## Progress log

- 2026-10-20: read the three round-4 debug notes and the seams they name (domain
  `node-run/shown-addresses.ts`, `run.ts`, `build-state/build-key.ts`, `state-diff/places/diff.ts`;
  Core `site-reset/{ledger,start-check,undo-admission,words,settlement-decision,settlement-group-witness,settlement-words}.ts`,
  `supervisor/completion.ts`, `executor/host-state.ts`, `llm/harness-options/{evidence-build-scope,registry}.ts`,
  `dispatch/{run-brief,ending}.ts`). Plan written above.
- 2026-10-20: wave 1 (c2-answers, c4-core-moves, c3-repair-first, d2-read-identity) dispatched in
  parallel. The supervisor added unit S5 (social `run-mvgw3ve5-294881b5`) while it ran.
- 2026-10-20, wave 1 verified by the lead:
  - c2-answers (Partial, gaps closed by the lead): every site-reset refusal now goes through one
    constructor that requires a closed `failed` condition and `canMeet`; `candidate.undo_already_back`
    answers a toggle already showing the found state; a source scan fails a hand-built refusal. Two
    gaps: the qualified destination sentence lives in `service/project-build/brief-ports.ts`; the
    lead wired `WORDS.actionDeclarations()` there.
  - Core audit after wave 1 failed 7 ways. Core caps paths at 9 segments, so `site-reset/answers/`
    (10) was illegal and site-reset (25 files) can grow neither in place nor downward. The lead moved
    it to the sibling `flow-bootstrap/reset-answers/` ({can-meet,condition-words,failed,refusal,index}.ts),
    with the condition words beside the closed set so the dependency runs one way (site-reset ->
    reset-answers; `site-reset/words.ts` `condition` delegates). Also fixed: five `as never` casts
    in c2's tests (typed `unchecked` helper; typed `Unmet`), one packed statement in
    `refusal-sites.test.ts` (which now scans both directories), and run-brief's non-barrel import of
    the withheld marker (now `../../executor/index.ts`; the cycle rule passes).
  - c4-core-moves (Partial): `move: "core"` is on Core's own reset arrivals' frame, set by an
    async-context marker (`llm/harness-options/core-move.ts`), never by call-id shape; proven through a
    real registry binding, with a mutation check. `places: string[]` rides every brief's opening, but
    no public read gives issued-ref locations yet: c1 adds a public `issuedRefs()` and the lead wires
    brief-ports after it.
  - c3-repair-first (Done): `project.completion_repair_first` holds an ending once per failed subflow
    while a repair brief is affordable (the dispatch's own sizing check); `terminalReason` on returns
    (`allowance_spent`, `stopped`, `person_ended`, `gate_unsatisfiable`). The lead wired run-brief's
    `endedAs` to `ending.personEnded` and forwarded `terminalReason` in `supervisor/dispatch-tool.ts`.
  - d2-read-identity (Done, but a regression found by the lead): stripping a read target's words
    leaves a bare `<p>` (office's address line) with one fingerprint signal, so the save-time guard
    (`element-fingerprint/shortfall.ts`, two signals) would refuse the very step office needs.
    Sent back as d2b in wave 2: keep the words for the guard but mark them as the read's value, so
    the extension's veto never refuses a read target whose text changed.
  - Checks: Core `pnpm run check` (packages/fluxiq): clean (after the restructure too). Core vitest
    `--maxWorkers=3 --minWorkers=1` over site-reset, reset-answers, harness-options, dispatch,
    supervisor, contracts, project-build, flow-bootstrap/tests and the prompt contract test:
    `Test Files 125 passed (125)`, `Tests 1066 passed (1066)` before the restructure; after it,
    `109 passed` plus the moved words test (`3 passed`, `20 passed`). Prompt contract: no pin moved.
    Core audit: `passed (428 warning(s), 1152 baselined)`. Core rebuilt
    (`pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build`:
    Done); `core-build.mjs`: current.
- 2026-10-20: wave 2 batch A (c1-settlement, d1-build-memory, d3-pass-spot, d2b-read-value) and batch B
  (w-unsat, w-read-mark, d4-failed-press, s5a-disclosure, s5b-core-feedback) dispatched and returned;
  then x-splits for three extension files past 800 lines.
- 2026-10-20, waves 2A/2B verified by the lead:
  - c1-settlement (Partial; the lead closed it): settlement modules moved to the sibling
    `flow-bootstrap/reset-settlement/` (site-reset could not grow: 25 files and a 9-segment depth cap);
    ledger.ts 775 -> 604 lines, 33 -> 29 methods. Unreachable groups; A1 narrowed to named and
    own-page lists; `gate_unsatisfiable` acts leave actsToUndo as `actsUnsettleable`; public
    `unsatisfiable()` and `issuedRefs()`. The lead fixed one test's excess-property literals
    (`reset-settlement/tests/witnesses.test.ts`).
  - w-unsat (Done): every "what is still on the site" consumer includes unsettleable acts as left;
    every "undo this" excludes them; a not-done return while one is in place carries
    `terminalReason: "gate_unsatisfiable"`; reset-first never holds for them; brief-ports passes issued
    refs with locations, so `places` now reaches every brief's opening.
  - c3's repair-first rule held an ending the supervisor had no turns left to act on (a t692 test's
    3-turn script fell through to the guard-end path). The lead threaded `turnsLeft` from the loop into
    the completion check (`llm/loop-configuration.ts`, `llm/evidence-loop/completion-attempt.ts`,
    `llm/decision-handlers/completion.ts`); `supervisor/completion.ts` holds only with at least
    `REPAIR_TURNS = 3` left; `supervise()` gained `spareTurns` and a new test covers the short case.
  - s5b-core-feedback (Done): the lead moved its new test into `subflow-candidate/tests/builder-loop.test.ts`
    (that folder was at 26 files). Cross-repo contract recorded: Core reads the domain refusal word
    `incomplete_text` to rewrite judge advice.
  - d2b + w-read-mark (Done): a read target keeps its words marked `readsWords`; the extension never
    vetoes or prefers on those words, and resolve-target does not look a drifted read up by them. The
    lead listed `readsWords` in `element-fingerprint/build.ts` (capture never marks it).
  - Downstream audit after the waves failed 6 ways; the lead extracted `plan-resolution/same-target-identity.ts`
    (resolve-plan-node.ts 803 -> 792; it was at 800 before this lane), merged the read-identity tests
    into `identity-guard.test.ts` (folder at 26), and replaced two call spreads; x-splits split
    `list-reader.ts` (826 -> 739, new `extraction/item-record/`), its test (834 -> 775) and
    `click.test.ts` (847 -> 445, new `actions/tests/click/`).
  - Checks: Core `pnpm run check`: clean. Core vitest over site-reset, reset-settlement, reset-answers,
    flow-bootstrap/{tests,subflow-candidate,candidate}, candidate-trial, project-build, project-agents,
    step-log, harness-options, executor/tests and the prompt test: `Test Files 280 passed`, one failure
    (the t692 test above), then after the turns fix `project-agents` + `llm/{evidence-loop,decision-handlers}`:
    `Test Files 115 passed (115)`, `Tests 906 passed (906)`; repair-repeats `22 passed`. Prompt
    contract: no pin moved. Core audit: `passed (429 warning(s), 1152 baselined)`. Core rebuilt: Done.
  - Domain `pnpm --filter @fluxiq-web-extension/domain check`: clean. Extension `... extension check`:
    clean. Domain `test-domain.mjs node-run/tests node-run/build-state plan-resolution/tests
    element-fingerprint state-diff/places runtime/tests/host-runtime-places client/tests
    output-nodes/targets rejection-next/tests action-failure/tests failure/tests llm-evidence/tests`:
    `# tests 860`, `# pass 860`, `# fail 0`. Extension `test-extension.mjs content/identity/tests
    content/tests/element-finder content/action-runtime content/extraction extraction/item-record/tests
    actions/tests`: `# tests 1200`, `# pass 1200`, `# fail 0`. Downstream audit: `passed (217 warning(s),
    618 baselined)`.
- 2026-10-20, browser wave (provider-free, scripted provider, headed, `--workers=1`, per-run output in the
  lead's scratchpad; Core and the extension built once by the lead: `pnpm test:e2e:build` -> `EXT_BUILD 0`):
  - Existing site-reset specs on the post-wave-2 build: 6 of 7 passed; `job-failed-save.spec.ts` failed by
    design. d4 now retries a save the page fails on first press, the retry lands (two clicks, My jobs 2 -> 3
    rows), and Core rightly asked for it to be undone; the spec assumed the failed save changed nothing.
  - The lead added an optional `supervisor` script to `e2e/site-reset/scripted-provider.ts` (`SupervisorTurn`),
    so a spec can send several briefs.
  - e2a-office (S1, Done): new `office-cross-brief.spec.ts`. Brief 2's opening carried `places` with brief 1's
    typed-search page; brief 2's navigation there ran; a made-up address was still refused `address_not_shown`;
    Core's `site-reset.look.1.arrival` navigated to that page; the trial answered yes; ending `proposed`.
  - e1-job (Blocked, product gap found): after the retried save landed, the correct undo (the new row's own
    remove control on the list the act named) was refused `subject_differs`. The item has one subject token on
    its own page and another as a row, and admission never read the destination the act itself named. The
    build looped to the repeat guard. Fixed by c5-dest-subject (Core `site-reset/undo-admission.ts`
    `destinationRemoval`): an undo may remove, once and unasked, a subject that the act's named destination did
    not hold in its original read before the act and holds in a fresh read now (removal classes only). Nothing
    that existed before the build can be touched. The lead reviewed it, then: Core typecheck clean; vitest
    site-reset, reset-settlement, reset-answers, project-build, dispatch, flow-bootstrap/tests:
    `Test Files 87 passed (87)`, `Tests 727 passed (727)`; Core audit passed. The lead updated the spec: an undo
    on a row the list held before is now refused `subject_there_before` / `no_call`.
  - e3-photo (Partial) -> e3b (Done): new `photo-dialog-destination.spec.ts`. Like named a dialog-view list's
    ref; the undo landed; a second press was refused `candidate.undo_already_back` with no click; the trial was
    admitted with `startedWith.cannotUndo` saying the named list could not be read again. Its trial
    ambiguity was the spec's order, not this lane's code (photo-toggle passed on the same build). It exposed
    a domain weakness: a dialog view and a standalone page at one address shared one view. d5-view-alias made
    them two views (`plan-resolution/target-packets.ts`: keyed by front dialog and document time origin;
    acted identity kept per address); a handle shown in both still resolves to the view shown last.
    Domain check clean, `plan-resolution/tests node-run/tests`: `# tests 444`, `# pass 444`; audit passed.
  - e2b-office (S4 office, Done): new `office-read-after-change.spec.ts`. A Flow chooses another saved address,
    then reads the bare address line by a handle captured before the change. The submission was accepted, the
    command carried `readsWords: true`, and the trial's read succeeded and stored the new line.
  - e4-repair (S3, Done): new `repair-first.spec.ts`. The first ending after a blocked brief was refused
    `project.completion_repair_first` naming the subflow and brief; a repair naming the failed trial was sent;
    the second ending was accepted with the supervisor's reason. The lead replaced the spec's import of a
    Core-internal dist path with the public `fluxiq/automation-studio` `automationStudioActivityHub`.
  - e5-social (S5, Done): new content spec `e2e/content/tests/extraction/tests/social-kept-row-disclosure.spec.ts`
    on social-network-feed, headed via `scripts/test-content.mjs`, passed twice. A condition rejecting the
    collapsed posts returns the kept rows whole; keeping a collapsed post is still refused `incomplete_text`;
    after its own disclosure control is pressed, the read succeeds.
  - Lead fixes: `cross-brief-watch.ts` typing (`record(record(result).evidence)`); `tool-rejection.ts` comment
    now names the three ways round `address_not_shown`. Extension check (covers e2e): clean.
  - Full site-reset suite on the final Core build, before d5: `11 passed (11.5m)` (installed-project 2,
    job-failed-save, office-address-confirm, office-buy-now 2, office-cross-brief, office-read-after-change,
    photo-dialog-destination, photo-toggle, repair-first).
- 2026-10-20, docs (t743-docs, Done): Core `docs/architecture/automation-studio/llm-flow-bootstrap.md`; downstream
  `docs/architecture/build-loop.md` and `extension-client.md` (d4 had updated `failure-taxonomy.md`). Both audits
  passed.
- 2026-10-20, final runs by the lead:
  - Prompt contract (`llm/deepseek/tests/system-prompt.test.ts`) plus `supervisor/tests/guidance.test.ts` on the final
    Core tree: `Test Files 2 passed (2)`, `Tests 44 passed (44)`; `system-prompt-pins.json` unchanged.
  - Full site-reset suite with d5 in the tree: `10 passed`, `1 failed` (13.9m). photo-dialog-destination's trial
    pressed the right control but saved it as "Unlike": d5 kept a control's acted identity per address, so a press in
    the dialog view overrode the standalone view that showed the handle last. The lead reverted d5
    (`plan-resolution/target-packets.ts` and its test back to HEAD; patch kept at
    C:/Users/osrs_/AppData/Local/Temp/claude/c--Users-osrs--FluxStuff--FluxIQWebExtension/53d1357c-b7da-4f48-9665-ff78992a8998/scratchpad/t743-d5-view-alias.patch;
    design in `t743-d5-view-alias.md`) and rewrote the `build-loop.md` paragraph as a known limit.
  - After the revert: domain check clean; `test-domain.mjs plan-resolution/tests node-run/tests` -> `# tests 440`,
    `# pass 440`, `# fail 0`; downstream audit passed; photo-dialog-destination and photo-toggle headed:
    `2 passed (3.5m)`. The rest of the code is the tree of the `11 passed (11.5m)` run above (since then only a
    comment in `tool-rejection.ts` and docs changed).

## Not verified

- No live or paid run (lane rule); the round-5 live reruns are the supervisor's.
- Full suites (`pnpm check`, `pnpm test`, Core's whole vitest) were not run (user rule: the twice-daily sweep).
- No new spec was falsified against the pre-t743 tree (that needs a rebuild of old code). The new specs assert the
  new codes and calls directly.
- Async-context framing of Core's moves is proven through a real registry binding and the installed gateway spec,
  not through the web panel's bundled copy.

## Open items for the supervisor

1. **Dialog view vs standalone page at one address (domain).** They share one view in the target-packet store.
   A Flow that opens the dialog and presses a handle last shown on the standalone page can fail
   `web.target.ambiguous`. A live photo builder could write that Flow. d5's attempt was reverted (see above). The
   fix needs the view a step stands on chosen from the step before it, or per-document handles.
2. **An `undo` reason no call can meet is not detected in general.** `gate_unsatisfiable` covers unreachable lists
   and nothing nameable. An act whose differing list has no admissible undo still loops until the repeat guard.
   c5 removed the case the job spec found.
3. **Trial feedback labels a read step with the words captured before a change** (e2b), although the step read the
   new value.
4. **Not taken from the debugs:** office C5/C6 (baselines on unrelated lists; "press again with this ref"); naming
   a looped trial act's pass in `trialRan`; `refused-repeat.ts` carrying the last refusal code.
5. **Cross-repository contract:** Core reads the domain refusal word `incomplete_text` to rewrite judge advice
   (documented in Core `llm-flow-bootstrap.md`).
6. **A1 choice:** a witnessless trial act with no adoptable list, once no ref can be issued, is now
   `gate_unsatisfiable` (trials refused, honest end), not settled on unrelated lists.
7. **Live rerun:** rebuild Core in each lane tree after sync. The e2e spec for job-board's failed first save now
   expects the retry to land and the build to undo it.

UNIT READY: Core (all of t743 as one unit, because S1-S5 share run-brief.ts, brief-ports.ts, ending.ts and completion.ts):
`docs/architecture/automation-studio/llm-flow-bootstrap.md`; `R/executor/host-state.ts`, `R/executor/tests/host-state/tests/diff-inputs.test.ts`;
`R/host-runtime.ts`; `R/flow-bootstrap/reset-answers/` (new); `R/flow-bootstrap/reset-settlement/` (new, the moved settlement modules);
`R/flow-bootstrap/site-reset/{act-places,contracts,create-baselines,index,ledger,ledger-act,project-ledger,project-reset,start-check,trial-policy,undo-admission,undo-claims,undoes-tool,words}.ts`
(deleted: `collection-groups.ts`, `settlement-*.ts`) and `site-reset/tests/` (new: project-ledger-adoption, refusal-sites, settlement-unreachable,
start-check-core-move, undo-admission; deleted: settlement-witnesses; updated: ledger-subject, ledger, project-ledger-entry-repeats,
project-ledger-repeats, reset-witness, settlement-adopted, settlement-shapes, undoes-tool, words); `R/flow-bootstrap/candidate/trial-stop.ts` + test;
`R/flow-bootstrap/subflow-candidate/{builder-loop,disclosure-advice,index,repeated-advice}.ts`, `tests/builder-loop.test.ts`;
`R/llm/decision-handlers/completion.ts`; `R/llm/evidence-loop/completion-attempt.ts`; `R/llm/loop-configuration.ts`;
`R/llm/harness-options/{core-move,evidence-build-scope,index,registry}.ts`, `tests/evidence-build-scope.test.ts`;
`R/llm/step-log/{summary,tool-step}.ts`, `tests/tool-step.test.ts`; `R/project-agents/contracts/builder-return.ts` + test;
`R/project-agents/dispatch/{ending,reset-done,run-brief}.ts`, `tests/{brief-places,terminal-reason,unsettleable-acts}.test.ts`;
`R/project-agents/supervisor/{completion,dispatch-tool,guidance,left-on-target,read-task,state,whole-trial}.ts`,
`tests/{left-on-target,repair-repeats,reset-next,supervisor-loop,supervisor-script,whole-trial}.test.ts`;
`R/service/candidate-trial/feedback.ts` + test; `R/service/project-build/{brief-ports,phase-start,reset-calls}.ts`,
`tests/{project-build-phase-start,project-build-reset-settle,project-build-reset,reset-calls}.test.ts`
(R = packages/fluxiq/src/programs/automation-studio/runtime/).

UNIT READY: downstream (all of t743 as one unit): `docs/architecture/{build-loop,extension-client,failure-taxonomy}.md`;
`domain/src/actions/types.ts`; `domain/src/client/gateway-mapping.ts`, `client/tests/gateway-mapping-read-mark.test.ts`;
`domain/src/element-fingerprint/build.ts`; `domain/src/output-nodes/targets/targets.ts`;
`domain/src/runtime/failure/codes.ts` + test; `domain/src/runtime/host-runtime.ts`, `runtime/tests/host-runtime-places.test.ts`;
`domain/src/runtime/state-diff/places/{diff,node-target,node-row-values,scoped-node,target-parameters}.ts`, `places/pass-row/`, `places/tests/pass-row-spot.test.ts`;
`domain/src/runtime/llm-evidence/{tool-rejection.ts,action-failure/refusal.ts,action-failure/tests/refusal.test.ts,rejection-next/next-sentence.ts,rejection-next/tests/next-sentence.test.ts}`;
`domain/src/runtime/llm-evidence/node-run/{arrival,run,shown-addresses}.ts`, `node-run/build-state/build-key.ts`, `node-run/build-state/tests/memory.test.ts`, `node-run/tests/shown-addresses.test.ts`;
`domain/src/runtime/llm-evidence/plan-resolution/{element-identity,read-identity,resolve-plan-node,same-target-identity}.ts`, `plan-resolution/tests/identity-guard.test.ts`;
`apps/extension/src/content/action-runtime/{resolve-target.ts,read-lookup/,ignored-press/{ignored-press-watch,index,live-region,settled-look}.ts,ignored-press/tests/{live-region,settled-look-notice}.test.ts,recovery/fault.ts,recovery/tests/fault.test.ts,tests/resolve-target-read-words.test.ts}`;
`apps/extension/src/content/actions/click.ts`, `actions/tests/click.test.ts`, `actions/tests/click/`;
`apps/extension/src/content/extraction/{item-filter,list-reader}.ts`, `extraction/item-record/`, `extraction/tests/{item-filter,list-reader}.test.ts`;
`apps/extension/src/content/identity/{index,read-words,score,veto}.ts`, `identity/tests/{read-words,veto-read-target}.test.ts`;
`apps/extension/e2e/site-reset/{scripted-provider,cross-brief-watch}.ts`,
`apps/extension/e2e/site-reset/tests/{job-failed-save,office-cross-brief,office-read-after-change,photo-dialog-destination,repair-first}.spec.ts`,
`apps/extension/e2e/content/tests/extraction/tests/social-kept-row-disclosure.spec.ts`;
`docs/working/trace-offline-trials-plan/reports/t743-*.md`.
