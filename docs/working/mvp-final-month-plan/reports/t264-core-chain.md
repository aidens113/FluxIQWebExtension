# t264-core-chain (lead report)

Brief: `t264-core-chain` in `docs/working/mvp-final-month-plan.md`. Trees: `C:/Users/osrs_/FluxStuff/fxwork/t264/`
(`!FluxIQ` and `!FluxIQWebExtension`, branch `task/t264-core-integration-chain`, base Core `1fbfa5ef` / downstream
`bdda64b1`). `R/` = Core `packages/fluxiq/src/programs/automation-studio/runtime/`. One stage per hand-back; the
supervisor commits each stage.

## Stage S1 — instruction authority (A4 + B F1 kind fallback onto t262 split acts)

Status: done, verified by the lead, uncommitted (2026-10-05). Ready for the supervisor to commit on
`task/t264-core-integration-chain` (Core) with this report and the worker report (downstream).

### Result

- Ported: A4 (t174 w107) whole: per-act read, read before a lasting call reaches the domain, unanswered acts
  lasting, one thread line, read-decision wording, `automationStudioFlowDraftDeclaresLasting` export, A4 tests and
  the confirm-requests fixture reply. B F1 (t193): `LASTING_KINDS` and its three tests.
- Reworked onto t262: `instructedLastingActs` composes (a) kind, (b) t262's grounding (unchanged, extracted to
  `quotedLasting`), (c) per-act answer (`R/flow-bootstrap/action-permissions.ts`). The read grounds a split act's
  entries in `source.clause` (`R/action-permissions/instructed.ts`, `readAutomationStudioInstructedRead`,
  `groundedWords`). t262's grounding test runs on kind-less copies plus a kinds assertion; A4's gate tests run on
  kind-less copies (`UNKINDED`) so they still exercise (c).
- Dropped: nothing from A4 or F1. Not in scope and untouched: t195 w49/w50 hunks in the same files; t174 A2/A3 hunks.
- Behaviour change accepted by the lead (worker note 1): a Confirm is a `submit` act, so a per-row Confirm that
  declares nothing lasting is now checked per row (`verify`/`verified`), not pressed, even when the read answers
  "none". The test is renamed to "checks a Confirm that declares nothing lasting once per kept row ... because
  confirming lasts by its kind". Why: dev already checks a lasting-declared Confirm per row and never presses it
  (same file, first test), and run `run-murwcaj0-40e56557` R3 was a Confirm declared `[]` that tests pressed again
  on real requests. Lost coverage: no Core test now drives a per-row replay of an act-claiming step that declares
  nothing lasting through the confirm-requests service fixture. A `set`/`open` act would be needed for that.
- Consequence for later stages: a read answer of "none" can no longer clear an add/save/claim/move/submit act.
- Lead edit: `docs/architecture/automation-studio/flow-authoring.md` section "Lasting acts from counted-object
  instructions" (t262 text) rewritten to name the three paths and the clause-grounded entries (worker note 3).

### Changed files (Core tree `fxwork/t264/!FluxIQ`)

`R/action-permissions/instructed.ts`, `R/action-permissions/tests/instructed.test.ts`,
`R/service/instruction-authority.ts`, `R/service/tests/instruction-authority.test.ts` (new),
`R/flow-bootstrap/action-permissions.ts`, `R/flow-bootstrap/tests/action-permissions.test.ts`,
`R/flow-draft/verify-only.ts`, `R/llm/node-tools/dry-run-gate.ts` (comments),
`R/service/flow-bootstrap-commands/permission-outcome.ts` (comments),
`R/tests/service-authoring/tests/confirm-requests-build.test.ts`,
`docs/architecture/automation-studio/{llm-flow-bootstrap,flow-authoring}.md`. All LF. Downstream tree: this report and
`t264-s1-instruction-authority.md`.

### Lead validation (re-run by the lead, logs in scratchpad `t264-s1/`)

- `npx vitest run` (in `packages/fluxiq`) over set A (`action-permissions/tests/instructed`,
  `service/tests/instruction-authority`, `flow-bootstrap/tests/action-permissions`, `flow-draft/tests/verify-only`,
  `flow-bootstrap/instructed-acts/tests/`) plus set B (`llm/node-tools/tests/{lasting-acts,lasting-acts-build,
  replay-draft-acts,replay-draft-excused,replay-draft-loop,rerun-check}`, `llm/evidence-loop/tests/rerun-request`,
  `tests/service-authoring/tests/`, `tests/service-bootstrap/tests/`) -> exit 1, `Test Files 3 failed | 43 passed
  (46)`, `Tests 9 failed | 522 passed (531)` (`lead-sets-ab.log`). The 9 failures are `accounting.test.ts` (6),
  `generation.test.ts` (1), `judged-build.test.ts` (2). They are pre-existing on dev: the same 9 test names fail in
  the dev sweep (`sweep-2026-10-05/core-test.clean`, Core dev `1fbfa5ef`) with identical assertion messages
  (`totalProviderCallCount` mismatches, `expected [ false, false ] to deeply equal [ false, true, true ]`,
  `flow_bootstrap.provider_transport_unknown`).
- `node scripts/build-cache/cli.mjs fluxiq:check` -> exit 0.
- `node scripts/build-cache/cli.mjs structure-audit:check` after the lead's doc edit -> exit 0, `structure-audit:
  passed (245 warning(s), 349 baselined)` (fresh run, "inputs changed").
- `pnpm.cmd --filter @fluxiq-web-extension/domain check` (t264 downstream) -> exit 0, `core-build: FluxIQ Core's
  build ... is current with its source` (Core rebuilt by the worker with `pnpm.cmd build`, exit 0 per its report).
- Fixture screen: `grep -i` for URLs, cookies, bearer/authorization, passwords and e-mail domains in the three ported
  test files -> no hits.
- Not verified: no live, Lab or provider run; the read's new per-act question has not met a real model. The
  `extension check` was not run, because no extension file imports a changed contract.

### Sources read (lead)

- t174 A4 (w107) diff: `R/action-permissions/instructed.ts` (+141: per-act schema, `readAutomationStudioInstructedRead`,
  unanswered read, non-enumerable `acts`), `R/service/instruction-authority.ts` (per-act question, read decision
  wording, failed read = every act unanswered), `R/flow-bootstrap/action-permissions.ts` (read before a lasting call
  reaches the domain; unanswered acts lasting; one thread line), `R/flow-draft/verify-only.ts` (exports
  `automationStudioFlowDraftDeclaresLasting`), comment-only `R/llm/node-tools/dry-run-gate.ts` and
  `R/service/flow-bootstrap-commands/permission-outcome.ts`, fixture `R/tests/service-authoring/tests/confirm-requests-build.test.ts`,
  tests `action-permissions/tests/instructed.test.ts` (+66) and new `service/tests/instruction-authority.test.ts` (164).
  Doc hunks: Core `llm-flow-bootstrap.md` @@-132 (+26) and `flow-authoring.md` @@-195 (+3); the other t174 doc hunks
  belong to A2/A3b and are not S1.
- t193 F1 diff: `LASTING_KINDS = {add_to, save, claim, move, submit}` lasting whatever the read quoted; kind on the
  `instructedLastingActs` act type; three tests (run `run-musp4h2f-72e8ed99`); comment edits in `verify-only.ts`,
  `dry-run-gate.ts`.
- t262 on dev (`97e279de`): `instructedLastingActs` acts carry `source {clause, object}` for split objects and ground
  attribution in the original clause; test "grounds split objects ... without classifying an unquoted sibling".
- Facts checked on the t264 tree: the service passes `automationStudioInstructedActs(bootstrapInstructionText)` (full
  acts with `kind` and `source`) to `instructedLastingActs` (`service.ts:1575`); `bootstrapInstructionText` is
  `title\nbody` joined by `\n` (`service.ts:1508`), the same text A4's authority reads acts from; the gate returns the
  derived array object itself (keeps the non-enumerable `acts`) and a thrown derive becomes a plain empty list
  (`action-permissions/gate.ts:397`); real tool inputs carry `consequences` at top level; export counts stay under the
  15-value limit (verify-only 9 -> 10, instructed 4 -> 8); no baseline entry for any S1 file; downstream touches these
  contracts only in `domain/.../plan-step-permission.test.ts` (types).

### Lead decisions for S1

1. An own act is lasting when any of: (a) its kind is `add_to|save|claim|move|submit` (B F1; independent of the read,
   but the read is still forced so the cross-check reuses it); (b) t262's quote/`source` grounding matches, unchanged;
   (c) the read carries per-act answers and this act's answer (same id and folded quote) is missing, `null`, or names
   a class (A4). Otherwise it is not lasting. A thrown read leaves only (a).
   Why: an add/save/claim/move/submit pressed again by a test always repeats a real effect (B: cart 1 -> 12/13); A4
   closes skipped acts (the coupon); t262's grounding stays the quote path.
2. Split acts in the read: the authority's act list keeps `source`; an act's class entries are grounded in its own
   quote, or, when that quote is not in an instruction (an assembled split quote), in `source.clause`, the person's
   original span. The existing overlap rule keeps one entry per class per clause.
3. t262's grounding test keeps its assertions, run on kind-less copies of the acts; it gains one assertion that the
   same acts with kinds are both lasting.
4. Not in S1: any t195 w49/w50 hunk in `instructed.ts`/`instruction-authority.ts` (dropped per brief); t174's non-A4
   hunks.

### Worker brief S1 (dispatched as `worker-high`, foreground)

See the dispatch text; report at `docs/working/mvp-final-month-plan/reports/t264-s1-instruction-authority.md` in this
tree.
