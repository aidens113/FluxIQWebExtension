# t250 — Post-run-2 Current State and ledger draft

## Use of this draft

The blocks below are copy-ready for the two active plans **before t246 completes**. They record
t233, t239, and t243 as accepted local fixes; record t245 only as a read-only root-cause finding;
and leave the selected-Subflow replay correction pending. They deliberately preserve:

- run 2 as the latest accepted live measurement;
- the consecutive-pass streak at **0**;
- no live credit for the locally validated fixes;
- no claim that repair persistence or deterministic replay now works live;
- t217's terminal exhaustion behavior as unmeasured live.

Do not replace the pending-t246 sentence with completion language until a t246 report exists and
its recorded validation has been checked. No t246 report was available when this draft was written.

## `mvp-today-plan.md` — Current State additions/replacements

Insert after **t217 correction**:

```markdown
**Post-run-2 local fixes.** t233 narrowed the service-owned fallback after provider resolution and
stopped rewriting an admitted extend grant's purpose. t239 widened Flow Bootstrap diagnostics to
the truthful three-state provider-invocation vocabulary (`not_attempted | attempted | unknown`),
forwards observed harness provenance, preserves compatible historical records, and rejects
impossible invocation/response pairs. t243 added a scoped harness exception boundary: setup before
the harness remains `not_attempted / not_received`, while an untyped exception escaping the
harness is recorded at `provider_request` as `unknown / unknown`; structured failures remain
dominant. These changes are locally validated only. No provider-backed run has exercised them, no
MVP criterion receives new pass credit, and the consecutive-pass streak remains 0.

**Remaining replay defect.** t245 established that the real reauthor path can extend, approve, and
apply the selected Subflow, but the repair replay drops the selected `subflowId` and launches the
parent orchestration Flow. The replay then fails before post-apply result verification, so the
absence of a fourth provider call is expected. t246 is pending to forward that authoritative
Subflow id through result-verification replay into the existing selected-Subflow rerun path. Until
t246 is implemented and validated, repair replay remains a known local product defect rather than
a live-proven capability.
```

Replace **Next** with:

```markdown
**Next.** Complete and locally validate t246's selected-Subflow replay-target fix, then repeat the
same default-profile `everything-store-plus-earbuds-under-50` scenario. Debug that run before any
subsequent provider call. A pass begins the streak at one; another independent pass is still
required. Do not award pass credit to run 2, combine overlapping accounting representations, claim
t217 measured, or describe t233/t239/t243/t246 as live-proven before the rerun.
```

Replace **Blockers** with:

```markdown
**Blockers.** No external blocker. The remaining known product defect is repair replay losing the
Router-selected Subflow target after an applied reauthor; t245 isolated the boundary and t246 is
pending. The accepted diagnostic/provenance fixes are locally green but have not been exercised by
a provider-backed run.
```

Do not alter the four-row MVP criterion table, live-run-2 paragraph, run-2 accounting, or evidence
status. Those statements remain accurate until a new accepted live run exists.

## `mvp-today-plan.md` — ledger entry

Append this entry now:

```markdown
### 2026-09-26 — Run-2 failure provenance fixed locally and replay-target defect isolated
- Agent: supervisor with t233, t239, t241, t243, and t245
- Changed: Core's Flow Bootstrap service fallback, three-state provider-invocation diagnostic and parser, harness-failure projection, recovery carriage, scoped service harness boundary, focused tests, and t233/t239/t243/t245 reports
- Why: Stop pre-request setup from claiming a provider call, preserve observed or unknown invocation provenance end to end, retain structured failures, and establish why the applied wrong-answer reauthor still did not reach replay verification.
- Validation: t233 `pnpm --filter fluxiq test -- src/programs/automation-studio/runtime/tests/service-bootstrap/tests/accounting.test.ts src/programs/automation-studio/runtime/tests/service-bootstrap/tests/extend.test.ts src/programs/automation-studio/runtime/recovery/refuted-result/tests/reauthor.test.ts` -> 3 files, 33 tests passed; `pnpm --filter fluxiq check`, Core root `pnpm check`, and Core root `pnpm build` -> passed. t239 `pnpm --filter fluxiq exec vitest run src/programs/automation-studio/runtime/flow-bootstrap/generation-failure/tests/diagnostics.test.ts src/programs/automation-studio/runtime/flow-bootstrap/generation-failure/tests/round-trip.test.ts src/programs/automation-studio/runtime/flow-bootstrap/generation-failure/tests/provider-refusal.test.ts src/programs/automation-studio/runtime/recovery/refuted-result/tests/reauthor.test.ts src/programs/automation-studio/runtime/llm/harness/tests/run.test.ts src/programs/automation-studio/runtime/llm/provider-retry/tests/call.test.ts` -> 6 files, 329 tests passed; package check, Core root check, and Core root build -> passed. t243 `pnpm --filter fluxiq test -- src/programs/automation-studio/runtime/tests/service-bootstrap/tests/accounting.test.ts` -> 1 file, 13 tests passed; package check, Core root check, and Core root build -> passed. t245 was read-only and ran no tests or live work.
- Outcome: Accepted
- Follow-up: complete t246's selected-Subflow replay-target fix and its local regression suite, then run the same default-profile provider scenario; the live pass streak remains 0.
```

The long validation line is intentional evidence preservation. It may be wrapped without changing
its command text or results.

## `language-driven-flow-loop-plan.md` — Current State additions/replacements

Insert after **Latest accepted rung-1 measurement** and its accounting paragraph:

```markdown
**Locally validated after run 2, not live-proven.** t233 separated post-resolution setup from the
provider-request fallback and preserved admitted extend-grant purposes. t239 made provider
invocation three-state throughout Flow Bootstrap and recovery. t243 scoped untyped harness escapes
to `provider_request / unknown / unknown` while leaving pre-harness setup
`not_attempted / not_received` and preserving structured diagnostics. All three fixes passed their
recorded focused checks and Core check/build gates, but no provider-backed run has exercised them.
They do not change run 2's failed verdict or the consecutive-pass streak of 0.

**The next local defect is now exact.** t245 proved the reauthor can generate, approve, and apply an
extend adaptation for the selected Subflow. The replay loses that selected `subflowId`, launches the
parent orchestration Flow, fails before verification, and therefore makes no fourth provider call.
t246 is pending to carry the existing authoritative Subflow id through the replay port. This is not
yet a live repair or replay success.
```

Replace **The next action** with:

```markdown
**The next action** is to complete and locally validate t246's selected-Subflow replay-target fix,
then repeat `everything-store-plus-earbuds-under-50` under the default 26-call profile. Fully debug
that run before another provider call. The next pass starts the streak at one; the rung is left only
after two consecutive independent passes. t233, t239, t243, and any future accepted t246 result
remain local evidence until that provider-backed run exercises them.
```

Replace **Blockers** with:

```markdown
**Blockers:** no external blocker. The remaining known product defect is the applied wrong-answer
reauthor replay dropping its Router-selected Subflow target; t245 isolated it and t246 is pending.
The worktree spawn limitation remains operational rather than product evidence. The pass streak is
still 0.
```

Do not alter the sixteen-run history, run-2 measured fields, token/cost representations, or the
statement that repair persistence and deterministic replay remain unproven live.

## `language-driven-flow-loop-plan.md` — ledger entry

Append this entry now:

```markdown
### 2026-09-26 — Run-2 provenance repaired locally; applied-repair replay target isolated
- Agent: supervisor, with workers on t233, t239, t241, t243 and t245
- Changed: Core Flow Bootstrap failure provenance and scoped service classification, recovery diagnostic carriage, focused regressions, and the post-reauthor replay root-cause report
- Why: Make the next live run distinguish unsent setup, observed provider work, and genuinely unknown invocation; preserve structured wrong-answer repair failures; and explain why the locally applied Subflow reauthor did not reach replay judgement.
- Validation: t233 focused service/bootstrap/recovery suite -> 3 files, 33 tests passed, followed by FluxIQ package check, Core root check, and Core root build. t239 focused diagnostic/projection/recovery/harness/retry suite -> 6 files, 329 tests passed, followed by the same package/root check and build gates. t243 focused accounting suite -> 1 file, 13 tests passed, followed by the same package/root check and build gates. Exact commands are retained in `mvp-today-plan.md` and the t233/t239/t243 reports. t245 was read-only and performed no test or live run.
- Outcome: Accepted
- Follow-up: implement and validate t246, then rerun the same default-profile rung-1 scenario; zero live passes are carried forward.
```

## Conditional t246 wording

Until the t246 report exists, use only the pending wording above and do not add another ledger
entry. If t246 later reports an implemented fix with observed passing validation, replace the
pending sentences in both Current State blocks with:

```markdown
t246 now forwards the authoritative selected `subflowId` through the result-verification replay
port into the existing selected-Subflow rerun path. Its report records local regression and gate
results. This closes the known local replay-target defect, but it remains unmeasured by a
provider-backed run; repair persistence, post-apply judgement, deterministic replay, and the live
pass streak remain unproven, with the streak still 0.
```

At that point add a separate ledger entry only after copying t246's exact files, commands, counts,
and results from its report. Use `Outcome: Accepted` only if those recorded checks passed. If t246
is incomplete or failing, leave it in Follow-up; do not invent a validation line or use an accepted
outcome.

## Evidence boundary

This draft changes documentation claims only. It does not reinterpret run 2, award a pass, combine
overlapping accounting, claim t217 exercised, or treat local tests as provider evidence. No shared
plan, source file, or run artifact was edited, and no live action or commit was performed.
