# t332 — Run 4 serial gate

## Decision

**Run 4 is conditionally authorized but currently NO-GO.** T327 authorizes exactly one unchanged default-profile retry, not retries-until-pass. Before launch, the outstanding t329 debug wording must be corrected and attested, and the active plan Current State must be updated from run 2 to the accepted run-3 Stage-2 failure. Every gate below is serial; a failure stops before provider contact.

The retry must remain the same isolated `everything-store` created-Flow lane, DeepSeek `mvp-hard-scenario`, task `everything-store-plus-earbuds-under-50`, expected-dataset oracle `extract-plus-under-fifty` at step 16, one replay, and the unchanged default authorization. Do not add a call, token, cost, timeout, retry, concurrency, Lab-instance, target, or run-root override.

## What remains valid after documentation-only edits

Prior focused/root tests, Core/downstream checks, ordered builds, and output-freshness evidence remain acceptable **only if a fresh read-only identity/diff audit proves that every change since that accepted validation is documentation-only** and that no source, test, package/configuration, dependency/lockfile, script, environment contract, or generated runtime output changed.

- Authored edits limited to `docs/working/**` do not invalidate compiled product outputs or require ceremonial product rebuilds; t249 explicitly says report-only changes do not trigger a rebuild.
- A documentation commit may change branch `HEAD`, so the old repository identity cannot be reused verbatim. Capture the current branch, exact HEAD, Core HEAD, and validation-relevant dirty paths after documentation/index maintenance settles. Record report-only churn separately.
- Reuse requires the same validated production/test scope and the same Core/downstream pairing. Any source/config/dependency/generated-runtime drift invalidates reuse and sends the work back through the already-defined focused tests, Core/downstream checks, root tests/builds, freshness checks, and diff review.
- T315's 11/11 output-marker presence is historical presence evidence only. Its timestamps are not a reservation or a new freshness proof. Output freshness may be reused from the accepted settled-tree evidence only after the doc-only diff condition above is proved.
- The current plan's older local-validation counts are not authority for run 4. Preserve the actual accepted final validation ledger; update only documentation facts unless product scope changed.

## Exact serial prerequisites

### 1. Close run 3 completely

1. Apply t329's sole remaining correction in the run-3 debug: terminal progression ended with **a draft rerun**, not “repeated draft reruns.”
2. Re-attest the corrected debug against t325/t326 without reopening artifacts. Evidence support, no-hindsight Stage 1, privacy, accounting, and `NO EVIDENCE` boundaries must all be GO.
3. Update both active plans to make run 3 the latest accepted measurement: Stage 2/build stop, 26/26 build calls, no proposal, truthful `flow_bootstrap.evidence_unusable_decision` / `bootstrap.cannot_answer_instruction`, and streak 0. Remove the stale claims that run 2 is latest and that t217 remains unmeasured live.
4. Settle any required working-document index regeneration/validation through its owning documentation procedure before capturing tree identity.

**Hard stop:** unresolved debug contradiction, stale Current State, unrecorded run-3 classification, or any attempt to award pass credit to run 3.

### 2. Record the one-retry disposition

The supervisor must record that none of t327's fix-before-retry thresholds is present: no false answerability rejection, omitted eligible tool/guidance, lost actionable feedback, incorrect budget accounting, proven semantic rerun cycle, destructive context/draft truncation, or deterministic implementation reproduction.

Record that this is the **single** authorized unchanged retry. A pass starts the streak at 1; a second independent pass would still be required. A failure leaves it at 0. A repeated post-t217 Stage-2 cannot-answer exhaustion permanently ends unchanged retries until a privacy-safe deterministic investigation and measured fix.

**Hard stop:** any threshold contradiction is found, or anyone proposes a speculative fix, weakened answerability, increased budget, or automatic relaunch under this authorization.

### 3. Settle and identify the exact product tree

After all documentation maintenance stops, capture current downstream/Core branch and HEAD identity plus validation-relevant dirty scope. Compare it to the final accepted validation/build/freshness scope.

- If all intervening changes are documentation-only, explicitly accept the earlier product checks/builds/freshness as still applicable.
- If any product input or generated runtime output changed, rerun the complete affected validation and build closure from narrow to full, then re-prove output freshness and scoped diff identity before proceeding.
- Do not launch from a tree changing under a concurrent worker or validation run.

**Hard stop:** unknown identity, unexplained dirty product path, changed dependency/config/script, stale/missing required output, concurrent tree mutation, or a failed/partial gate.

### 4. Freeze a fresh run-4 no-hindsight record

Choose a new, unused pending debug path dedicated to run 4; never reuse or overwrite a run-1/run-2/run-3 debug. Complete its Header and all Stage 1 fields before provider contact: verbatim instruction, nine-step expected chain, plausible wrong answer, 13-record ordered oracle, hypotheses, authority/accounting invariants, pass threshold, and streak rule.

Stage 1 may carry the unchanged scenario contract and product delta/disposition, but must not turn run-3 observations—ten reruns, cannot-answer sequence, node rejection, call usage, or inferred model behavior—into a run-4 prediction. Keep run id, timestamps, outcome, and all observed fields pending. Independently attest completeness and no-hindsight preservation. Do not edit Stage 1 after launch.

**Hard stop:** pending path already exists, destination would overwrite another debug, any run-3 outcome leaks into the pre-run oracle/prediction, or Stage 1 is incomplete.

### 5. First immediate machine/one-Lab gate

Immediately before the provider-free dry-run, repeat t315's read-only machine predicate:

- zero matching Lab/test-runner/Scenario-Lab processes after excluding the checker;
- `.lab-locks/build.lock` absent;
- required Core/downstream output markers present;
- no second live/browser/provider campaign in flight.

Report process name and PID only. Never print command lines or environment values. Do not delete a lock or kill an owner; wait and recheck. Do not set `FLUXIQ_LAB_INSTANCE`. T315's prior GO cannot be reused because it was a point-in-time snapshot, not a reservation.

**Hard stop:** any matching process, build lock, missing marker, uncertain owner, or concurrent live run.

### 6. Repeat the exact provider-free readiness dry-run

T310 proved run-3 readiness only. Repeat the same frozen command for run 4 with process-only environment-file isolation and the real credential kept process-only. Require all of:

- exit 0 and parseable `status: "ready"`;
- `providerCallCount: 0` and no run artifact;
- lane `created-flow`, target `isolated`;
- scenario `everything-store`, workflow `plus-under-fifty`, task `everything-store-plus-earbuds-under-50`;
- judgement `expected-dataset`, oracle `extract-plus-under-fifty`, step 16;
- exactly one replay accepted by parsing;
- DeepSeek / `create-flow` and default 26 calls, with no max-call override.

Disable environment-file loading process-only as in t310; clear stale base URL, gateway, workspace, Flow, Lab-instance, path, and run-root overrides. Never print or inspect the credential. The dry-run must make exactly zero provider calls.

**Hard stop:** non-zero/ambiguous result, any provider call, wrong lane/target/scenario/task/oracle/replay, unexpected artifact, or effective-profile drift.

### 7. Authorization and second immediate machine gate

Confirm the unchanged effective live plan immediately before launch: configured DeepSeek model; `create-flow` / `build_and_adapt`; 26 calls; 560,000 run tokens; 25,000 ms effective timeout; zero provider retries; USD 0.25 per-call and USD 2 total estimate ceilings; one concurrent run; frozen consequence permissions; one replay. Treat ceilings as authorization, not expected spend.

Then repeat the full process/lock machine gate a second time after Stage 1 and dry-run are complete. Any material delay, build, Lab action, or process change after this snapshot requires another recheck.

**Hard stop:** credential/config isolation cannot be proved, effective values differ, a command-line override is present, another process/lock appears, or the snapshot is stale due to intervening activity.

### 8. Launch exactly once with t266 privacy capture

State the scenario, exact unchanged command, and authorized exposure, then invoke once. Preserve t266's capture order:

1. suppress live stderr to the null sink;
2. retain stdout only in memory and never print/save the raw result object;
3. parse only the final nonblank JSON line;
4. require a safe run id, then immediately rename the pending Stage-1 debug to `<run-id>.md` **before** bundle inspection;
5. reject a pre-existing destination; validate the default `test-runs/<run-id>` path and closed CLI verdict;
6. clear raw in-memory objects;
7. run `inspect` with stdout retained in memory and stderr suppressed; never print inspection JSON or hashes;
8. require matching run id/path and valid integrity result before any semantic artifact read.

A non-zero CLI exit with a safe run id may be a product failure and still proceeds to bounded inspection/debugging. Missing/unsafe run id, unparseable output, wrong root, identity mismatch, or integrity failure stops content reading and all further provider calls.

### 9. Redaction gate and minimal evidence reads

After integrity succeeds, read only the artifact index and `run.json` first. Require index schema `0.1`, exactly indexed artifacts, every redaction state `applied|verified`, matching run identity/verdict, and manifest redaction `verified|not_applicable`. Do not print hashes or artifact contents.

Only then read the minimal indexed structured set in t266 order: manifest/summary/evaluation, live-LLM snapshot, Flow-lane snapshot when indexed, mismatch snapshot only for a judged mismatch, and repair-lane snapshot only when indexed and Stage 6 was reached. Use `NO EVIDENCE:` for absent fields; never widen into provider sidecars, prompts/responses, raw logs, events, screenshots/video/HTML, browser profiles/databases, raw page snapshots, or raw datasets. Keep accounting representations separate.

**Hard stop:** unsafe/missing redaction, marker/index/digest failure, identity/verdict mismatch, unindexed requested artifact, or pressure to inspect raw content.

### 10. Close the single measurement

Fully debug and classify run 4 before any later provider call. If every MVP stage passes, record streak 1 only. If it fails, record streak 0 and investigate before another call. If it repeats the Stage-2 `evidence_unusable_decision` / `cannot_answer_instruction` family, enforce t327's fix-before-retry stop; no second unchanged retry is authorized.

## Launch-ready checklist

Run 4 becomes **GO** only when all are true in order:

1. t329 correction and final attestation are GO;
2. active plans state run 3 accurately and streak 0;
3. t327 disposition thresholds remain absent and single-retry scope is recorded;
4. current Core/downstream identity is settled and prior validation is either explicitly reusable after a doc-only diff or rerun successfully;
5. fresh run-4 Stage 1 is complete, independent, and immutable;
6. first immediate machine/lock gate passes;
7. repeated provider-free dry-run passes with zero provider calls;
8. effective authorization is unchanged;
9. second immediate machine/lock gate passes;
10. t266 capture/privacy procedure is ready to execute without disclosure.

## Scope

Read reports t249, t266, t310, t315, t327, t329 and only the current plan's Current State. I did not open `test-runs`, run artifacts, provider/page content, or other plan sections; did not run checks, builds, dry runs, browser/live/provider commands, or machine/process scans; and did not edit shared documents. This report is the only change.
