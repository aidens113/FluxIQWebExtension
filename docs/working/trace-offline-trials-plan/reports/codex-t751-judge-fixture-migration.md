# t751 integrated judge fixture migration

## Current State

STOPPED at the user's explicit stop-all request (2026-10-21). No more source edits, checks, builds, reruns, commits or pushes. All worker-owned process sessions have ended. Current fixture source is uncommitted and frozen for handoff; supervisor owns any later review/integration.

Last observed result: facade-only final gate17584 had already completed native0 before the stop reached it:1file/11tests passed, both parallel/real-sql groups passed (parallel selected none). The time-limit file passed3/3 in preceding2file run23076 and was unchanged afterward. The exact2file combined rerun after the final facade-only correction was NOT run; no completed final combined-native0 claim. No final worker type/audit/build verification. Earlier2file run27064:12pass/2fail; run23076:13pass/1fail (both native1); all failures/corrections recorded below.

Dirty worker files: paired Core project-build/tests/project-build-facade.test.ts and project-build-time-limit.test.ts; own downstream report codex-t751-judge-fixture-migration.md. No other source owned or edited. External logs under lab-runs/2026-10-21/codex-t751-review survive task cleanup. No owned live browser, paid run, panel or background process.

## Root cause and correction

The integrated gate failed facade:282 and time-limit:218 with not_judged. Both scripted provider branches called shared service-bootstrap judgeReply("no"), whose actual diagnosis includes answersRequest and optional string prose only, omitting defects. Current verification's production provider-result parser rejects a no without a well-formed defect list (`llm_output.verification_defects_required`), yielding an unusable diagnosis and not_judged. Positive/unrelated replies do not need migration.

These fixtures request `Create a deterministic Start to End Flow.` Their actual plans execute Start/End, or two short waits with ordinary success, and expose no answer rows, unmet measured task requirement or legitimate row defect. A supported negative would require fabricated evidence. Both local negative branches now explicitly list defects:[] without changing the shared provider helper or adding default/fake defects. Their current negative is usable but unsupported: reconciliation keeps it unknown/nonpromotable instead of no. Supervisor independently confirmed this honest outcome.

Facade still verifies the persisted draft, no proposal, not_performed verification, forbidden promotion and exact build-ending accounting. Its deliberately unsupported one-part builder stops partial after the first unknown trial instead of repeatedly retesting the same unconfirmed candidate. This isolates the intended draft-ending scenario while retaining normal in-trial verification retries. Exact end prose now says could not be confirmed wherever Core describes the unconfirmed trial; the record still counts the one part and both actually executed steps.

Time-limit still uses the held test clock, original6000/8000 deadlines, two passed parts, assembled candidate, no promotion, exact timeout/candidate codes and exact truthful time-limit row. Only whole-trial semantic outcome changes to unknown/candidate.trial_unsure and could not be confirmed; the timeout is not extended. Scoped positive judgements remain unchanged.

## Validation

Authorized freeze received from worker751 and root before running. Exact command, cwd t751 Core/packages/fluxiq:

```text
pnpm.cmd test src/programs/automation-studio/runtime/service/project-build/tests/project-build-facade.test.ts src/programs/automation-studio/runtime/service/project-build/tests/project-build-time-limit.test.ts
```

Package runner uses parallel then real-sql. Session27064 active; final observed counts/native status pending. No temporary diagnostics introduced.

First exact2file gate ended native1:12passed/2failed of14 real-SQL tests; parallel selected none. Both failures were expected public service vocabulary only: the internal build-test unknown is exposed as draft trial.verdict unsure, and its code is candidate.trial_unconfirmed, not candidate.trial_unsure. Actual diff proves usable unconfirmed result now replaces not_judged. Corrected exactly those two expected service fields. Preserved all timeout and draft assertions. Told worker751 gate stopped so its final independently partitioned wording correction can proceed; rerun held pending source freeze. No production change or timing increase.

Second2file gate ended native1:13passed/1failed of14; time-limit passed3/3 unchanged afterward. Facade reached exact ending text: exposed tool verdict is also unsure, so the fixture's new partial-stop branch using unknown had not fired and the record truthfully counted3trials. Corrected that branch to the actual tool vocabulary unsure, retaining the intended one-trial ending case; exact whole-test prose includes Core's suffix to do what was asked. Final facade-only grouped gate17584running in external judge-fixture-facade-final.log. No production/timing changes.


## Stop-all handoff

User explicitly requested stop everything. Sent Ctrl+C to final facade session17584; tool returned already-completed native0. Final external judge-fixture-facade-final.log confirms1file/11tests passed, all groups passed,60.53s. Also closed prior2file session23076 (completed native1;13/14passed). Session27064 had already ended native1; no other worker process was started for this bounded task. No active test was resumed and no new validation was run after stop. Read only existing final log/owned dirty-file list for this handoff; no source edit after stop.

Remaining supervisor work if user resumes: independently review two fixture diffs and this report; decide whether the final facade11pass plus unchanged time-limit3pass evidence is sufficient or run the exact2file combined gate, then required integration/type checks. Nothing committed or pushed by this worker.
