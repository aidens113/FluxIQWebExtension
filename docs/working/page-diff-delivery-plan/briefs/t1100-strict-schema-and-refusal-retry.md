# Brief t1100: a strict tool the provider refuses is demoted; a refused request is never retried as "not answering"

**Goal.** The user's replay on the panel (fluxiq 0.55.0, Haiku) ran the saved steps. The judge then said "not there
yet", and every decision after that was refused. The step log
(`C:/Users/osrs_/AppData/Local/Temp/claude/bc302d3e1bd85154/1bda39b1-1940-4a03-9ca6-eeeb61191390/scratchpad/panel-steps-v055/0008-decide`
to `0011`, read only) shows HTTP 400, `invalid_request_error`: "tools.8.custom: For 'object' type,
'additionalProperties' must be explicitly set to false".

Tool 8 is `core_set_result_processing`, sent strict. Its `input.process` is `{"type": ["object", "null"]}`, an open
object. The chat then said "The model service is not answering, so I am waiting 5/10/20/40 seconds and then asking
again" (`runtime/answer-first/keep-going/backoff.ts`). The user stopped it, because it was "very unclear what was
happening".

**Three fixes.** No count caps anything (AGENTS.md).
1. **The schema check sees nullable objects.**
   - `runtime/models/providers/anthropic/grammar.ts` treats a schema as an object only when `type === "object"` or it
     has `properties`.
   - A `type` array holding `"object"` is an object too. An open one (no `additionalProperties: false`) is not
     representable, so its tool goes non-strict.
   - Find every other place in the wire that tests `type === "object"`.
   - Test with this exact tool schema (copy its `input_schema` into a fixture; it holds no secrets).
2. **A strict tool the provider refuses is demoted, like the grammar refusal.**
   - t1093's `strict-fit/` demotes the largest strict tool when the grammar is too large.
   - When a 400 names a strict tool's schema (`tools.N…`), demote that tool and send again, remembered per tool-set
     digest, the same way.
   - Each pass demotes one tool, so it ends by itself.
   - The refusal is free.
3. **A refused request is not silence.**
   - `runtime/answer-first/keep-going/thrown-kind.ts`, and whatever feeds `backoff.ts`, must class a non-retryable 4xx
     refusal apart from a silent provider.
   - A refusal that 2 cannot fix is shown once, in t1093's words: "the model provider refused the request: <its
     message>".
   - It ends the round as a provider refusal. It is never waited on with growing delays, since the same request will
     be refused again.
   - Real silence (network, timeouts, 5xx, 429) keeps its backoff and its wording.
   - Put the decision in the code's header: retrying an identical refused request cannot reach the result, so this is
     no new way for a task to fail.

**Read first.**
- t1093's report (`docs/working/page-diff-delivery-plan/reports/t1093.md`) and its `strict-fit/` module.
- `runtime/answer-first/keep-going/`.

**Owned.** Core (`C:/Users/osrs_/FluxStuff/fxwork/t1100/!FluxIQ`): `runtime/models/providers/anthropic/**`,
`runtime/llm/anthropic/**`, `runtime/answer-first/keep-going/**`, and their tests.

**Must not touch.**
- `runtime/automation-activity/**` and `@fluxiq/ui-components` (t1099, the live statuses).
- `scripts/structure-audit*` (t1098).
- The main checkouts: the user's panel runs from them.

**Checks.**
- The tests beside each change, plus the `runtime/models`, `runtime/llm/anthropic` and `runtime/answer-first` groups.
- Core `pnpm check`. Vitest does not type-check.
- `node scripts/structure-audit.mjs`. No one-file test groups.
- **One API check, after the code passes** (free when refused, cents when accepted). Run `scripts/anthropic-contract-check.mjs`
  over the panel step log's `0008-decide` body. Re-shape it through the fixed wire first (a scratch script is fine;
  never print the key).
- Heavy commands through the heavy slot. No git.

**Report.** `docs/working/page-diff-delivery-plan/reports/t1100.md` in the downstream tree, ending with the return
contract.
