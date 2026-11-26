# Brief: a stalled candidate or project build repairs instead of failing (follow-up to t1056)

**Goal.** A build ends only with its result, its purse, or Stop. This is the user's rule; see AGENTS.md, "A task ends
only with its final result or with its budget gone" and "No arbitrary limit ends or resets a run". After t1056,
loop detection ends a round as a stall:
- The bootstrap path (`runtime/flow-authoring/bootstrap/unfinished-build/phases.ts`) then tests, judges and repairs
  in a new round.
- Candidate builds (`framework/automation-service/service/flow-bootstrap-commands/candidate-generation.ts`) and
  project builds (`framework/automation-service/service/project-build/run.ts`) instead turn the stall into the build's
  failure (`flow_bootstrap.evidence_repeat_without_progress`, `evidence_unusable_decision`). Read t1056's report,
  round 3, questions 13 and 14.

**Steps.**
1. Establish, with file and line evidence, whether each of the two paths is reachable from a client: the extension
   chat, the panel, the SDK, or a Lab authoring mode.
2. For each reachable path, give a stall the bootstrap's repair round. Reuse the unfinished-build phases; never copy
   them. The path's tests must then end on the result or the purse.
3. For an unreachable path, change nothing and report the evidence. The lead decides on removal.
4. Downstream, remove the call-count fields from the Lab and e2e contracts:
   - `packages/test-contracts/src/llm-validation.ts`: `maxCallsPerRun`, `LLM_LAB_MAX_CALLS_PER_RUN`, and "retries must
     fit within maxCallsPerRun";
   - `apps/extension/e2e/site-reset/scripted-provider.ts`.

   Records already on disk may still carry the field, so read it as optional and ignored, never required.

**Owned.** Core: `flow-bootstrap-commands/candidate-generation.ts` and its tests; `project-build/**`; and, read-only
unless step 2 needs an exported seam, `unfinished-build/**`. Downstream: the two files in step 4 and their tests.

**Must not touch.** Answer-first (`service/answer-first/**`, `runtime/answer-first/**`), the purse
(`runtime/llm/build-purse/**`), and the evidence loop (`runtime/llm/evidence-loop*`). Live lanes run against those.

**Checks.**
- vitest over the changed directories;
- `pnpm --filter fluxiq check` through the heavy gate;
- `node scripts/structure-audit.mjs`;
- downstream, `pnpm --filter @fluxiq-web-extension/test-contracts test` and the domain check.

No `node -e`, no git, no paid or live runs.

**Report.** `docs/working/page-diff-delivery-plan/reports/<task id>.md`, ending with the return contract.
