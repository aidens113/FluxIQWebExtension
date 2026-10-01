# t211: an unreadable model reply never ends a build

Worker report. Branch `task/t211-malformed-reply-retry`; every code change is in Core
(`C:/Users/osrs_/FluxStuff/fxwork/t211/!FluxIQ`). This report is the only downstream file. No Lab run, no
model call, nothing committed.

## Outcome

Done. One part is still unproven: no live reply's content was ever recorded, so the cause fix is aimed at a
strong correlation rather than at a captured broken reply (see "Not verified").

Ready to commit (Core, all under `packages/fluxiq/src/programs/automation-studio/runtime/` unless shown):
`llm/unreadable-reply.ts` (new), `llm/evidence-loop/decision-refusal.ts` (new), `llm/evidence-loop/rerun-input.ts` (new),
`flow-bootstrap/unfinished-build/replies-unreadable.ts` (new), `llm/evidence-loop.ts`, `llm/evidence-loop/index.ts`,
`llm/evidence-loop/result.ts`, `llm/evidence-loop/rerun-request.ts`, `llm/loop-configuration.ts`, `llm/unusable-decision.ts`,
`llm/index.ts`, `llm/draft-amendment-feedback.ts`, `flow-draft/amendment.ts`, `flow-bootstrap/unfinished-build/{contracts,round-ending,phases,index}.ts`,
`flow-bootstrap/generation-failure/{build-ending,codes,failure-state,evidence-failure,diagnostic}.ts`, `recovery/exploration-outcome.ts`,
`activity/build.ts`. The new tests are `llm/evidence-loop/tests/unreadable-replies.test.ts`, `llm/evidence-loop/tests/rerun-input.test.ts`,
`flow-bootstrap/unfinished-build/tests/replies-unreadable.test.ts` and `tests/service-bootstrap/tests/unreadable-replies.test.ts`.
The updated tests are `llm/tests/unusable-decision.test.ts`, `llm/evidence-loop/tests/rerun-request.test.ts`,
`llm/decision-context/tests/{recorded-runs.ts,recorded-windows.test.ts}`, `flow-bootstrap/generation-failure/tests/round-trip.test.ts` and
`recovery/tests/exploration-outcome.test.ts`. Docs: `docs/architecture/automation-studio/llm-flow-bootstrap.md` (repo root). Downstream: this report.
Validation: `npx tsc --noEmit -p tsconfig.json` -> exit 0; vitest llm + flow-bootstrap -> 131 files / 1605 tests passed;
vitest tests/service-bootstrap -> 20 files / 104 tests passed; `node scripts/structure-audit.mjs` -> passed (203 warnings, 354 baselined).

## Root cause of the malformed replies

**What the evidence is.** None of the lane bundles (`fxwork/{t174,t193,t194,t195}/!FluxIQWebExtension/test-runs/instances/*`) holds an
F16 reply account. Every `llm.provider_malformed_response` row was recorded before F16 landed, and no live run has happened since. So the
case (fenced, unclosed, mismatched and so on) is not on record for any live reply, and the cause below comes from the rows' neighbours,
their output tokens and their timing.

1. **Not truncation, and not the output reserve.**
   - The reserve for the reply is 8,000 tokens. It was 8,000 before t200 (`48,000 / 8,000 / 56,000`) and is 8,000 after
     (`window − 8,000 / 8,000 / window`, `llm/session-key-provider.ts`). t200 enlarged only the input side.
   - A reply cut off at the limit arrives with `finish_reason: "length"`. The adapter reports that as `llm.provider_output_truncated` or
     `padding_truncated`, never as malformed (`deepseek/response-envelope.ts`). Neither code appears in any lane bundle.
   - The decisions those runs recorded were 66 to 593 output tokens long.
2. **The malformed replies are the long rerun replies.** Lane C's three runs recorded 35 malformed rows: 14 in `run-munw7ffn-fe1cecd2`,
   16 in `run-munv53gt-a0e6f545` and 5 in `run-muntc23v-7fcc4110`.
   - 32 of the 35 sit between `amend_draft` reruns or list-read calls of 443 to 593 output tokens.
   - They take as long as one of those calls (2.6 to 3.2 s). Short decisions in the same build took 1.3 to 2.0 s.
   - Within `munw7ffn`, the re-author's reruns were 550 to 590 tokens and 14 of its 35 replies were malformed. The other adaptation's
     reruns were 235 to 486 tokens, and none of its replies were malformed.
   - Lanes A and D mostly made 80 to 120-token tool calls. They had one malformed reply per run of 26 to 66 rows.
3. **Why reruns are long and deep.** A rerun's `input` was declared as `{ type: "object" }` with "the whole argument … write every key it
   needs". To change one condition, the model rewrote the node, rows, columns, conditions, paging and consequences from memory, four to
   five levels deep, as free-form JSON with thinking disabled. `content_mismatched` is already a known live failure: the adapter's
   surplus-`}` repair exists because of it.
4. **Schema and shape mismatches** ended the loop without asking again. This is the t208 residual. Three kinds of reply did it:
   - a reply that was JSON but that `automationStudioLlmEvidenceParseDecision` rejects, such as a tool call with a key the grammar does not
     list (`exactKeys` is strict) or an `amend_draft` whose every amendment is mistyped;
   - a `complete` before completion was offered;
   - an `amend_draft` when editing was not offered.

   Each one ended as a bare `llm_evidence_loop.invalid_decision`, which the person saw as `flow_bootstrap.evidence_invalid_decision`.

**Cause fix.** A rerun's `input` is now a JSON merge patch (RFC 7386) over the argument the step last ran with. The model sends only the
keys that change: a list replaces the old one whole, and `null` removes a key (`llm/evidence-loop/rerun-input.ts`, used by
`rerun-request.ts`). The schema and refusal wording say so, and the wording is no longer than before. A model that still sends the whole
argument gets exactly that argument.

## What changed and why

- **An unreadable reply is asked again** (`llm/unreadable-reply.ts`, `llm/evidence-loop.ts`, `llm/unusable-decision.ts`).
  - These codes count as unreadable: `llm.provider_malformed_response`, `output_truncated`, `output_padding_truncated`,
    `response_oversize`, `output_invalid` and `usage_invalid`.
  - Such a reply has its own in-a-row count. It no longer moves the no-progress guard, so it does not trigger the stall redirection, and
    it no longer counts toward the far backstop.
  - It is asked again with the same context plus a `core.decision_check` note: `code: llm_evidence_loop.reply_unreadable`, the case,
    what was wrong in words ("its brackets did not match: …"), and "N unreadable replies in a row stop this build; that was k".
  - Its usage is counted in accounting and the budget, as F16 already did, and its row keeps `resultReason: <case>`.
  - Any reply that can be read resets the count.
- **Repeated unreadable replies end the build with a message.**
  - After 6 in a row (`AUTOMATION_STUDIO_LLM_EVIDENCE_LOOP_DEFAULT_MAX_UNREADABLE_REPLIES_IN_A_ROW`, configurable as
    `unusableDecisions.maxUnreadableInARow`), the loop returns `llm_evidence_loop.unreadable_replies` with
    `unreadable: { inARow, total, cases, said }`.
  - The round ending gets a new kind, `unreadable`. `phases.ts` ends the build there without testing again, keeps the draft, and builds
    the ending `replies_unreadable`, published as the new code `flow_bootstrap.model_replies_unreadable` (retryable, `ending` required).
  - The message reads: "The build stopped because the model's replies could not be read: 6 in a row came back unreadable -- because its
    brackets did not match … -- and each was asked again with a note of what was wrong. In all, 6 of 6 replies could not be read, over
    one live round; each was paid for and counted in the build's budget." It goes on to say what is done and still to do, what the test
    found, and whether the Flow so far was kept.
  - The chat title is "Build stopped: the model's replies could not be read" (`activity/build.ts`).
- **Shape and offer mismatches are asked again** (`llm/evidence-loop/decision-refusal.ts`). They are refused as
  `llm_evidence_loop.decision_shape_invalid`, `complete_not_offered` or `amend_not_offered`, each with its own instruction, and go
  through the ordinary `refuseDecision` path. They still count toward the no-progress guard, because sending the same wrong shape again
  is the model repeating itself. A loop that does not ask again (no `unusableDecisions`) behaves exactly as before.
- **Code tables that list every code:**
  - `evidence-failure.ts` maps `unreadable_replies` to `flow_bootstrap.provider_response_malformed`, for a caller outside the build
    phases;
  - `recovery/exploration-outcome.ts` maps it to `failed`.
- **Import cycle avoided.** `replies-unreadable.ts` imports only types from the llm barrel. Its first version imported a value from it,
  and the `flow-bootstrap ↔ llm` barrel cycle then left `runAutomationStudioLlmHarness` undefined in two
  `generation-failure` tests. The summary now carries its own `said`.

## Commands run and observed results

All from `fxwork/t211/!FluxIQ/packages/fluxiq` through `heavy.sh` unless shown.

- `npx tsc --noEmit -p tsconfig.json` -> exit 0. Run after the last edit.
- `npx vitest run src/programs/automation-studio/runtime/llm src/programs/automation-studio/runtime/flow-bootstrap --maxWorkers=2 --minWorkers=1`
  -> `Test Files 131 passed (131)`, `Tests 1605 passed (1605)`.
- `npx vitest run src/programs/automation-studio/runtime/tests/service-bootstrap --maxWorkers=2 --minWorkers=1` -> `Test Files 20 passed (20)`,
  `Tests 104 passed (104)`.
  - An earlier full run had two `adaptation.test.ts` 15 s timeouts. Those tests passed when run alone and in the final run; t208 recorded
    the same timing-only failure.
  - That earlier run also failed `unfinished-build.test.ts` "ends not doable" with `pre_provider_request_total_exceeded`. Restoring the
    old `amendment.ts` text made it pass, which showed the cause: the test's request sits at its 10,000-token default limit, and my first,
    longer rerun wording pushed it over. The final wording is no longer than the original.
- `npx vitest run src/programs/automation-studio/runtime/recovery src/programs/automation-studio/runtime/activity --maxWorkers=2 --minWorkers=1`
  -> `48 passed`, `557 passed`. This run needed `exploration-outcome.test.ts` updated for the new code.
- `node scripts/structure-audit.mjs` (Core root) -> `passed (203 warning(s), 354 baselined)`.
  - The count is the same as before my changes.
  - "1 baseline entries can be lowered" was already printed before my changes.
  - The first version of my loop test pushed `llm/tests/` to 26 files, over the 25-file limit; it now lives in `llm/evidence-loop/tests/`.
  - `evidence-loop.ts` is 794 lines, under the 800-line limit.

## Not verified

- **No live run** (brief). No live reply's malformed case has been captured, so the merge-patch fix is aimed at the correlation above and
  not at a recorded broken reply. The next live run's `unusable` rows now carry `resultReason: <case>` (F16) and the
  `core.decision_check` note. Read those to confirm the cause, or to name another one.
- It is untested whether the model follows the merge-patch rerun live, sending only changed keys and using `null` to remove a key.
- Not run:
  - the full Core vitest suite, `pnpm check` (contracts, web and client-gateway checks) and `pnpm build`;
  - any downstream checks. Downstream does not enumerate the changed codes or ending kinds; I searched `apps/`, `domain/src` and
    `packages/`.

## Open questions or contradictions found

- **The rerun semantics change.** A model that leaves a key out of a rerun, meaning to drop it, now keeps the old value; it has to send
  `null`. The wording says so. Merge, rather than replace, was the deliberate choice.
- **`invalid_decision` remains reachable** wherever a loop does not ask again (no `unusableDecisions`, for example the recovery runtime
  exploration), and when a completion check throws without `propagateDecisionErrors`. The bootstrap build path no longer reaches it.
- **The limit of 6 is my choice.** The longest live run of malformed replies was 4 (`munv53gt` iterations 21-24), followed by a good
  reply. The service does not set `maxUnreadableInARow`, and the budget and declared call counts still bind beneath it.
- **A fragile fixture:** `unfinished-build.test.ts` "ends not doable" runs at the edge of the default 10,000-token test limit, so any
  growth in the prompt will fail it with `pre_provider_request_total_exceeded`.
- **A stale doc paragraph.** `llm-flow-bootstrap.md` still says creation fails `evidence_unusable_decision` after three refusals in a row,
  which predates t208. I added the t211 paragraph beside it but did not rewrite t208's part.
