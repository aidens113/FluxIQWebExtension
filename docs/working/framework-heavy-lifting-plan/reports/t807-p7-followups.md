# t807 - P7 follow-ups (sub-supervisor report)

Trees: Core `fxwork/t807/!FluxIQ` (C), downstream `fxwork/t807/!FluxIQWebExtension` (W), branch `task/t807-p7-followups`. Nothing is committed.

## Outcome

**Partial.** Goals 1 and 3 are done. Goal 2 is plumbed in the dry-run replay and gate, but nothing passes a plan part to them yet, and the whole-Flow candidate path is not wired, because both need files in other lanes.

## Goal 1 - day-granular `within` (worker G1, Sonnet): Done

- A value that states only a day (ISO date, "22 Oct 2026", numeric date, "today", "yesterday", day-count ages such as "3 days ago" or "2w") is compared by whole UTC calendar days when `within` is in days or weeks: from the day of `now - n` through the day of `now`. With now = Oct 29 15:00, "within 7 days" keeps Oct 22. A later day is still out.
- A value that states a time ("5 hours ago", "45m", "just now", a clock time) keeps the instant span. Minute and hour units stay instants for every value (G1's choice; the span is sub-day).
- The undated rule is unchanged.
- Files (C): `contracts/.../process/date-within.ts` (returns `wholeDays`), `read-date.ts` (new `automationStudioRecordDateStatesOnlyDay`), `condition/holds.ts`, `condition/date-cases.ts` (1 case flipped: within 7 days of "2026-09-29" is now kept; 20 added), `condition/tests/date.test.ts`; `flow-bootstrap/plan/flow-script-format.ts` (Within line says whole days); regenerated both `framework-reference.md` files.
- No W source change: the twin imports Core's reader and judge.
- Fail-first shown by G1 (2 failed before the fix).

## Goal 2 - K5 defaults (worker G2, Sonnet): Partial

- Done: optional `partOf` on `replayAutomationStudioFlowDraft`, `automationStudioFlowDraftReplaySteps` and `automationStudioFlowDraftDryRunGate`, forwarded to every pass call, so the replay writes the record output the saved Flow has. New tests in `llm/node-tools/tests/replay-parity.test.ts`: with one owing part, replay and gate send the saved Flow's output; with no part or a part owing nothing, byte-identical to before.
- **Not done, needs another lane's files.** Nobody passes `partOf` yet:
  - the dry-run gate's only callers are `llm/evidence-loop.ts:376` (t806) and `service.ts:1666` (no plan parts in scope there);
  - the plan-aware whole-Flow paths are `project-agents/single-subflow/rebuild.ts` (t804) and `project-agents/supervisor/supervisor-loop.ts` (t806). The candidate controller already accepts `partOf`; those callers need `authoringScopePartOf(parts)` passed in.
  - An instruction-only build has no plan parts, so there is nothing to default from.
- Follow-up: once t804 and t806 merge, pass `authoringScopePartOf(...)` at those three call sites.

## Goal 3 - panel picker keeps `mark` (worker G3, Sonnet, plus my integration): Done

- G3: `panel/extraction/view-model.ts` and `confirm-payload.ts` carry `mark`; `field-row.ts` shows a plain label (with title text, not colour alone) and `extraction.css`; optional `mark` on `ExtractionConfirmField` in `shared/extraction-messages.ts`; tests updated in `panel/extraction/tests/`.
- Gap G3 found and I closed: `background/extraction/definition.ts` rebuilt each field without `mark`, so it was lost between the confirm message and the recorded definition. I added `mark` to `proposedColumns` and `fieldSpec` (the domain reader already drops a mark on a kind that cannot read it) and a test in `background/tests/extraction-confirm.test.ts`.

## Integration changes I made

- W `apps/extension/src/background/extraction/definition.ts` (two lines plus the source type) and the test in `background/tests/extraction-confirm.test.ts`.

## Commands run (inside the heavy-check lock)

- Contracts `npx vitest run src/record-sets` -> "Test Files 17 passed (17)", "Tests 259 passed (259)".
- fluxiq `pnpm check` -> exit 0.
- Core `pnpm check` -> exit 0 (includes `structure-audit: passed (0 warning(s), 0 baselined)` and builds).
- `pnpm docs:check` -> "Deterministic framework reference is current."
- `pnpm structure:check` -> "structure-audit: passed (460 warning(s), 1152 baselined)", exit 0.
- W domain `tsc` for `tsconfig.json` and `tsconfig.test.json` -> exit 0; extension `tsc -p tsconfig.json` -> exit 0 (and `tsconfig.test.json` exit 0 in the earlier run).
- `DOMAIN_TEST_BUILD_LABEL=t807 node scripts/test-domain.mjs actions/extraction output-nodes/extract-list runtime/llm-evidence/structure runtime/llm-evidence/plan-resolution runtime/llm-evidence/tests` -> "# tests 739 / # pass 739 / # fail 0".
- `EXTENSION_TEST_BUILD_LABEL=t807 node scripts/test-extension.mjs content/extraction panel background` -> "# tests 1946 / # pass 1946 / # fail 0".
- W `node scripts/structure-audit.mjs` -> "passed (234 warning(s), 616 baselined)"; `node scripts/check/model-text.mjs` -> "model-text: ok".
- fluxiq `pnpm test` over flow-bootstrap/record-defaults, llm/node-tools, flow-bootstrap/plan (holds the prompt-contract tests), flow-bootstrap/candidate -> parallel group "Test Files 83 passed (83)", "Tests 805 passed (805)"; real-sql group had no matching files; "all groups passed", exit 0.

## Not verified

- Fail-first was not shown for G2 and G3 (no stash allowed); tests were written with the change.
- No browser or live run (held by the coordinator); the picker label is unseen.
- Goal 2 end to end: no production caller passes a part yet.

## Open questions for the lead

1. Who passes `partOf` at `evidence-loop.ts:376`, `single-subflow/rebuild.ts` and `supervisor-loop.ts`? All are in open lanes (t806, t804).
2. Minute and hour `within` stay as instants even for a day-only value. Say if you want them whole-day too.
3. Test-build directories for labels `t807`, `t807g1`, `t807g3` are left for `pnpm task prune`.
