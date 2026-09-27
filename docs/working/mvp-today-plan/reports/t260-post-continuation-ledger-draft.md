# t260 — Post-continuation Current State, ledger, and run-3 gate draft

Status: **Complete draft; t258 final validation remains conditional**

## Evidence boundary

Run 2 remains the latest accepted live measurement. It failed the product
verdict, and the consecutive-pass streak remains **0**. The selected-Subflow
replay and fourth judge described below are local Core composition evidence,
not provider-backed proof. No MVP criterion receives new pass credit until an
accepted live run exercises the path.

t255 is complete. It records 9/9 continuation tests, 45/45 combined
continuation/hold/grant tests, `pnpm --filter fluxiq check` passed, scoped Core
`git diff --check` passed with line-ending warning only, and `grants.ts` at 797
lines. Its report does not retain the exact Vitest command strings, so this
draft does not invent them.

t258 is provisional. The currently reported focused command/result is the
decisive `reauthor-service.test.ts` composition at **2/2 passed in 13.2 s**.
The success case observes the exact four-call sequence and the provider-failure
privacy case passes. The fixture now uses production `holdForRun`; its explicit
`maxCalls: 4` is test-only, and the product default remains 26. Broader t258
gates are still running. Do not copy t258 completion or `Outcome: Accepted`
until its final report exists and records all final-tree checks as passed.

## `mvp-today-plan.md` — copy-ready Current State

Insert after **t217 correction** once t258's final report is green:

```markdown
**Post-run-2 fixes, locally proven only.** t233, t239, and t243 narrowed the Flow Bootstrap
request boundary and preserve truthful three-state provider provenance. t246 forwards the selected
Subflow through repaired replay. t255 adds a fail-closed compare-and-swap that continues the same
held, claimed grant across the exact authorized Flow binding change without minting authority or
resetting uses, cost, tokens, reveal authorizations, or its run lease. t258 wires that primitive
only into the runtime-owned reauthor apply path: a successful durable apply continues the same
grant, deterministic selected-Subflow replay makes zero provider calls, recursive verification
makes the fourth judge call, and the enclosing run remains the terminal revocation owner. A
continuation refusal preserves the applied adaptation, skips replay and the fourth call, and records
a closed `grant_continuation` failure rather than pretending the apply failed.

The local service composition now proves the exact call order `loop_verification`,
`loop_verification`, `evidence_tool_decision`, `loop_verification`, successful selected-Subflow
replay, final success, and zero active grants. This is not live proof: run 2 remains failed, repair
persistence and replay remain unproven by a provider-backed run, and the consecutive-pass streak
remains 0. The test fixture's four-call allowance is local test configuration; the production
default remains 26 calls with no budget, retry, permission, capability, consequence, or grant-
issuance widening.
```

Replace **Next** with:

```markdown
**Next.** Apply t249's serial run-3 gate to the final t255/t258 tree, including Core focused and
root gates, output freshness, downstream compatibility/freshness, one-Lab checks, zero-provider
readiness, and a new no-hindsight debug. Then repeat the unchanged default-profile
`everything-store-plus-earbuds-under-50` scenario exactly once and fully debug it before another
provider call. A pass begins the streak at one; another independent pass is still required. Do not
award pass credit to run 2, combine its overlapping accounting representations, claim t217's
terminal exhaustion measured, or call the local continuation/replay composition live-proven.
```

Replace **Blockers** with:

```markdown
**Blockers.** No external blocker. The known run-2 grant/replay defects are locally corrected and
must now be measured by run 3 after the final validation and freshness gates. Until that run, repair
application, same-grant continuation, deterministic selected-Subflow replay, and the post-replay
judge remain local evidence only; the pass streak is 0.
```

Do not alter the four-row MVP criterion table, run-2 paragraph/accounting, evidence status, or t217
measurement statement before run 3. They describe live evidence and remain accurate.

## `language-driven-flow-loop-plan.md` — copy-ready Current State

Insert after **Latest accepted rung-1 measurement** and its accounting paragraph once t258 is final:

```markdown
**The run-2 repair chain is now locally closed, not live-proven.** t233/t239/t243 corrected request
provenance; t246 preserves the Router-selected Subflow through repaired replay; t255 continues only
the same held and claimed grant across the exact authorized binding change; and t258 connects
durable apply to that continuation before zero-provider replay and recursive judgement. The focused
composition proves two negative judges, one reauthor decision, selected-Subflow replay with no
provider call, one fourth `loop_verification`, final success, and terminal grant revocation. Its
failure case keeps the durable applied adaptation but closes replay with typed grant-continuation
provenance and no extra provider request.

This changes no accepted live measurement. Run 2 still failed before publishing repair/replay, the
sixteen-run history is unchanged, t217 remains unmeasured live, and the consecutive-pass streak is
0. The four-call focused fixture does not change the production 26-call default or any token, cost,
retry, timeout, permission, capability, consequence, or grant-issuance rule.
```

Replace **The next action** with:

```markdown
**The next action** is t249's updated run-3 gate on the final t255/t258 tree, followed by one
unchanged default-profile `everything-store-plus-earbuds-under-50` provider run and a complete
no-hindsight debug before any later provider call. The run measures the locally corrected chain;
it does not assume it. A pass starts the streak at one, and rung 1 is left only after a second
independent pass.
```

Replace **Blockers** with:

```markdown
**Blockers:** none external. The run-2 repair/continuation/replay chain is locally green subject to
t258's final report and final-tree gates, but remains unmeasured by a provider-backed run. The
worktree-spawn limitation remains operational rather than product evidence. The pass streak is 0.
```

Do not rewrite the sixteen-run table/history or state that a live repair, replay, or fourth judge
has succeeded before run 3.

## Ledger entries

The t255 entry may be appended now:

```markdown
### 2026-09-26 — Same-grant post-apply continuation primitive accepted locally
- Agent: supervisor with t251–t256
- Changed: Core grant-store continuation CAS, its internal exact-binding type/check import, focused continuation tests, and t251–t256 reports
- Why: Let one already held and claimed run continue across only the exact Flow adaptation it authorized, without relaxing ordinary binding drift or minting/resetting authority.
- Validation: t255 continuation suite -> 9/9 passed; continuation plus existing hold and grants suites -> 45/45 passed; `pnpm --filter fluxiq check` -> passed; scoped Core `git diff --check` -> passed with line-ending warning only; `grants.ts` -> 797 lines. The t255 report did not retain the exact Vitest command strings.
- Outcome: Accepted
- Follow-up: finish t258's runtime-owned apply/continuation wiring and final-tree gates; this primitive alone is not live evidence and the pass streak remains 0.
```

Append the following t258 entry only after its final report confirms every
stated result. Replace the bracketed validation clause verbatim from that
report; do not infer commands or counts:

```markdown
### 2026-09-26 — Runtime-owned reauthor now continues, replays, and re-judges locally
- Agent: supervisor with t258–t260
- Changed: Core runtime-owned Flow Bootstrap generation lifecycle, locked apply-and-continuation wiring, production grant binding, closed continuation-failure carriage, and the real-grant reauthor service composition
- Why: Preserve standalone build cleanup while allowing the same admitted run grant to cross only its own authorized apply, replay the selected Subflow without a provider, and spend its next existing use on post-replay judgement.
- Validation: decisive `reauthor-service.test.ts` composition -> 2/2 passed in 13.2 s, with exact four-call success order and provider-failure privacy retained; [COPY THE FINAL t258 FOCUSED/PACKAGE/ROOT TEST, CHECK, BUILD, AND DIFF-CHECK COMMANDS AND RESULTS HERE]. The fixture uses production `holdForRun`; `maxCalls: 4` is test-only and production remains at the default 26.
- Outcome: Accepted
- Follow-up: execute the updated t249 run-3 gate and unchanged default-profile provider scenario; local success does not change run 2 or the zero-pass streak.
```

If any final t258 gate fails, use `Outcome: Partial`, name the failed command
and result, keep run 3 at **NO-GO**, and do not use the completion Current State
blocks above.

## `t249-run3-preflight-delta.md` — gate update

Replace its opening decision with:

```markdown
Run 3 is a conditional GO only after t255 and t258 are complete on the final tree, the independent
integrated review has no unresolved authority/lifecycle finding, and the combined focused,
Core-root, freshness, downstream, one-Lab, and provider-free readiness gates below are green. The
live invocation remains the unchanged default 26-call `mvp-hard-scenario` command. Do not add a
call, token, cost, timeout, Lab-instance, run-root, or target override. A passing run 3 begins the
consecutive-pass streak at 1; one further independent default-profile pass is still required.
```

Add to **Delta under measurement**:

```markdown
- t255: the exact held/claimed/idle same-grant binding CAS, preserving every authority,
  accounting, reveal, and deadline field except the two binding fields.
- t258: private runtime-owned nested generation; durable apply and authoritative binding read under
  the Flow lock; continuation of that same grant; typed fail-closed continuation refusal; zero-
  provider selected-Subflow replay; the fourth judge call; and final run-owned revocation.

Run 3 measures this chain without hindsight. Stage 1 must name it before the provider call as the
change under measurement, not as an assumed outcome. The expected successful sequence is still
two initial result judgements, one reauthor decision, deterministic replay with zero provider
calls, and one post-replay judgement. The default production allowance remains 26; the focused
fixture's four-call cap is not a product-profile change.
```

Add these files to Core freshness ownership:

```text
packages/fluxiq/src/programs/automation-studio/runtime/llm/execution/grants.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/execution/grant-binding.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/execution/grant-checks.ts
packages/fluxiq/src/programs/automation-studio/runtime/service.ts
packages/fluxiq/src/programs/_shared/runtime.ts
packages/fluxiq/src/programs/automation-studio/runtime/recovery/refuted-result/attempt.ts
packages/fluxiq/src/programs/automation-studio/runtime/recovery/refuted-result/reauthor.ts
```

Add the continuation suite to the integrated focused command before
`reauthor-service.test.ts`:

```powershell
src/programs/automation-studio/runtime/llm/tests/execution-grant/tests/execution-grant-continuation.test.ts `
src/programs/automation-studio/runtime/llm/tests/execution-grant/tests/execution-grant-hold.test.ts `
src/programs/automation-studio/runtime/llm/tests/execution-grant/tests/execution-grants.test.ts `
```

Retain every existing t249 gate: Core package/root test, check and ordered build;
runtime/web freshness; downstream check and owned-output freshness; both one-Lab
checks; zero-provider dry-run; new pending debug; unchanged live invocation;
immediate run-id rename; and full debug before another provider call. Run 3 is
**NO-GO** if t258's final report is absent, any final-tree gate fails, an output
is stale, another Lab process/lock exists, readiness makes a provider call, or
the parsed lane/scenario/task/oracle/replay selection differs.

No shared plan, source, run artifact, live provider, browser, Lab, or commit
state was changed by this draft.
