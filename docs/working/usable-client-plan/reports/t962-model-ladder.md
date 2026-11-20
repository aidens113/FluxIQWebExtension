# t962: model ladder, and the model's own decision about a caught loop

Worker report (Core tree `C:/Users/osrs_/FluxStuff/fxwork/t962/!FluxIQ`). Nothing committed.

## Outcome

**Done.** Both parts are built and tested: the model ladder, and the model's own structured decision about a caught loop. Nothing is committed; the Core tree holds the changes.

Two parts, both in Core:

1. **Model ladder.** Every attempt's calls start on its base model and climb one rung at a time
   (claude-haiku-5-5, claude-sonnet-5-5, claude-opus-5-5), sticky for the attempt, only on a fact
   that says it cannot get there. A new attempt starts on its base again; a zero-call replay makes
   no call to route.
2. **Loop guard (revised by the lead's mid-task message, user 2026-11-19).** A detected repeat no
   longer "asks the person and carries on". The model is told what it repeated, how many times and
   what each repeat came back with, and must answer with one structured decision
   (`core.loop_decision`): `continue`, `change_approach`, `ask_person`, `escalate_model`,
   `finish_with_best`. The framework carries it out. The ladder's own rungs never ask the person;
   the person is asked only where the model decides so. The purse still ends the task.

## What changed and why

**Root cause of run-mwo3dp11-a47a032d.** The nine "ask the person" rungs were all
`core.completion_check near_repeat` (repeats 3 to 11): the completion-refused-again ladder
(`answer-first/loop-signal/completion-refused-again.ts`) returned `ask_person` from the third
refusal on, forever. `round.ts` then ended the round and `rounds.ts` posted a generic question and
steered a fresh round on the same model, which sent the same completion again. Nothing changed
model, nothing told the model what it repeated, and the question was Core's, not the model's. The
watch (`repeat-guard/loop-detection/watch.ts`) had the same `ask_person` rung after two fresh
approaches. Both producers are changed at the root; the consumers in `attempt/round.ts` and
`attempt/rounds.ts` (must-not-touch) were left as they are and still work: they post a question
only when the signal is `ask_person`, which now comes only from the model's own decision, carrying
its own question.

**The ladder** (`packages/fluxiq/src/runtime/llm/role-routing/ladder/`):
- `tiers.ts` the rungs; `state.ts` one attempt's ladder (level, climbs with from/to/reason/pattern,
  seed for a carried-on attempt); `frame.ts` an AsyncLocalStorage frame; `climb.ts` one rung up plus
  a `NNNN-escalate` step folder (`from`, `to`, `reason`, `pattern`, `level`) and a chat step.
- `role-routing/resolution.ts`: the explore model names the base (run override, caller's or Flow's
  `llmModel`, else `FLUXIQ_LLM_DEFAULT_MODEL`, which the Lab's `--llm-model` sets). Where none was
  named and the default is a Claude model, the base is Haiku 5.5 (new load-time flag
  `AUTOMATION_STUDIO_LLM_DEFAULT_MODEL_NAMED` in `models/catalog/default-model.ts`). Every rung up
  to Opus is resolved as the attempt starts. A model off the ladder (DeepSeek) has no ladder, and
  with no role models the resolver is asked exactly as before.
- `role-routing/provider.ts`: on a ladder, each role is served on its start rung plus the levels
  climbed (judge and repair climb too; a role configured stronger stays stronger; a role off the
  ladder stays put). `servedBy` names the serving model, so step logs, holds and costs are at the
  model that served.
- The ladder lives on the attempt record (`repeat-guard/loop-detection/attempt-record.ts`), which
  is one per attempt (created in `attempt/run-attempt.ts`, seeded only on a carry-on): that is what
  makes it sticky for the attempt and reset for a new one.
- `runtime/llm/attempt-loop/run.ts`: every evidence loop runs inside its record's ladder frame, so
  each decision and the completion check it asks are served on the current rung; a loop with no
  record shares the enclosing loop's ladder. `evidence-loop.ts` delegates to it (kept at 800 lines).

**Climb triggers (each exactly one rung):** the model's `escalate_model` (`model_decided`); a
completion refused again over unchanged evidence (`completion_refused_again`, each time, from the
second refusal of the same evidence); a repair round (the `repair` role frame) that ends without the
result and climbed nothing else (`repair_failed`; a Stop climbs nothing); the detector's window of
no progress (`no_new_evidence`); a round stopped because refusals did not stop a repeat
(`loop_persisted`); and, only on loops with nobody to decide (no `loopSignal`, e.g. builds), any
steer (`loop_detected`). At the top a cause climbs nothing and the steer stands.

**The decision** (`packages/fluxiq/src/runtime/llm/loop-decision/`, handler
`decision-handlers/model-decision.ts`, refusal ask `decision-handlers/refusal-decision-ask.ts`):
- `core.loop_decision` is offered from a loop's first decision where the loop has a `loopSignal`
  (the attempt's rounds), never added mid-loop (prompt cache).
- A watch steer (`loop-check.ts`) and a repeat-guard refusal (`refused-repeat.ts`) carry
  `decide: { tool, cameBack: [{callId, toolId, came}], instruction }`; the steer's sentence names
  the repeat and count. A completion refused again says so in `refused-words.ts`.
- The handler is handed the completion handler and the stall by `evidence-loop.ts` rather than
  importing them, which keeps it out of the loop's existing module cycle. A small step-log writer,
  `step-log/event-step.ts`, writes the `escalate` and `loop_decision` folders through the step-log
  barrel.
- Carried out: `continue` ends the incident so the repeat may run (an exact failed repeat on an
  unchanged page is still refused by the guard, and the model is told so), and a further catch asks
  again with the higher count; `change_approach` keeps the repeat refused; `escalate_model` climbs,
  or at the top answers `strongest_model` and asks again; `ask_person` raises the `ask_person`
  signal with the model's question, which `rounds.ts` posts (the stuck question now leads with the
  model's own screened question) without waiting; `finish_with_best` goes through the normal
  completion handler (the judge). A malformed decision is answered with what is missing.
- Recorded: attempt record `decisions` (codes only), `NNNN-loop_decision` step folder (decision,
  pattern, repeats, toolIds, the model's words), and a chat step.
- A round stopped on a repeat is told what it repeated and to take a different approach
  (`tried.loopStopped`, `told-fresh-round.ts`), from the record's `stoppedOn`.

**Attempt row** (`packages/contracts/src/task-attempts/tried-record.ts`, `tried-as-contract.ts`):
`tried.ladder { base, escalations[{from,to,reason,pattern?}] }` and
`tried.decisions[{decision,pattern?,repeats?}]`, parsed strictly (codes only).

**Docs:** `docs/architecture/automation-studio/failure-control.md` (the model decides; the model
ladder) and `llm-flow-bootstrap.md` (loop detection paragraph).

**Tests added/changed:** `role-routing/ladder/tests/state.test.ts`,
`role-routing/tests/ladder-resolution.test.ts`, `attempt-loop/tests/run.test.ts`,
`decision-handlers/tests/loop-decision.test.ts` (tests the handler in `model-decision.ts`), contract `tried-record.test.ts`; updated to the
new rule: `loop-detection/tests/ladder.test.ts`, `loop-signal/tests/{completion-refused-again,
stuck-question,stuck-steer}.test.ts`, `answer-first/tests/identical-rows.test.ts`,
`answer-first/tests/endings/tests/{person,refused-completion,stuck-with-nobody}.test.ts` (these
asserted that the attempt asks the person by itself when stuck; they now have the scripted model
choose `ask_person`, or assert nobody is asked).

## Commands run and observed results

- `node scripts/build-cache/cli.mjs contracts:build sdk:build fluxiq:build` (via heavy-slot, early in the task) -> exit 0; contracts and sdk stored, fluxiq built (not stamped because I wrote test files while it ran).
- `pnpm --filter fluxiq check` (via heavy-slot, mid-task, before the loop-decision rework) -> first run one TS error in my test helper, fixed; second run exit 0. A third run was queued and then cancelled on the lead's instruction (no package typechecks).
- Targeted type check instead: `tsc -p <scratch tsconfig extending packages/fluxiq/tsconfig.json, files = the 53 changed .ts files>` -> exit 0, no errors (scratch tsconfig removed).
- `node node_modules/vitest/vitest.mjs run <44 files>` in packages/fluxiq (every added or changed test file, plus the role-routing, anthropic provider, answer-first loop-signal, decision-handlers and loop-detection test folders) -> `Test Files 44 passed (44)`, `Tests 256 passed (256)`.
- `node node_modules/vitest/vitest.mjs run src/task-attempts/tests/tried-record.test.ts` in packages/contracts -> `Test Files 1 passed (1)`, `Tests 8 passed (8)`.
- Earlier, before the last structural edits: 170 behaviour-relevant files in four batches of up to 50 (every answer-first test plus every test naming the loop signal, attempt record, role routing or tried record) -> 166 passed, 4 failed. The 4 (13 tests: `identical-rows`, `endings/person`, `endings/refused-completion`, `endings/stuck-with-nobody`) asserted the superseded behaviour of the attempt asking the person by itself. I rewrote them to the new rule, and they pass in the 44-file run above.
- `node scripts/structure-audit.mjs` in Core -> `structure-audit: passed (556 warning(s), 911 baselined)`. It first failed on a new module cycle, deep imports past barrels and a `loop-` prefix group; I fixed all three (dependency injection, barrels, renamed the handler to `model-decision.ts`, and a direct `ladder/state.ts` import where the barrel would close a cycle).

## Not verified

- No live run (per brief). Whether Haiku with no thinking decides well, and how often models pick
  each decision, is for the lead's live campaign.
- The full suite and the package-wide typecheck were not run at the end (lead's instruction). Through barrels, the static import graph from the changed files
  reaches 2,248 of the package's test files (computed with a scratch script), i.e. the whole suite,
  which AGENTS.md reserves for the twice-daily sweep. Earlier I ran the 170 files that exercise the changed
  behaviour (every test naming the loop signal, attempt record, ladder/role routing, tried record,
  refusal words or loop steer, plus every answer-first test).
- The extension's Lab report does not yet print `tried.ladder` / `tried.decisions` or the
  `escalate` / `loop_decision` step folders; the data is on the attempt row and in the step log.
- An in-run repair inside a Flow run (`runtime/llm/node-tools/run/**`, must-not-touch) does not
  climb on failure; only repair rounds do.

## Open questions or contradictions found

- `ask_person` posts the model's question and does not wait for the answer: waiting would need
  `attempt/rounds.ts` (must-not-touch). The lead allowed parking here; it is not done.
- The judge climbs with the attempt (all roles step one rung per climb). Chosen because a Haiku
  judge wrongly refusing would otherwise never be outgrown; say if the judge should stay on its
  configured model.
- Live Lab runs without `--llm-model` pass Sonnet as Core's default (the Lab's own default), so the
  base is Sonnet there, not Haiku. Pass `--llm-model claude-haiku-5-5` for a Haiku base.
- The repeat guard still refuses an exact failed call on an unchanged page after `continue`; the
  model is told to repeat it once the page has changed. Lifting the guard on `continue` was not
  done.
