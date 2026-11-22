# Offline replay and scoreboard intake
Role: read-only discovery worker, gpt-6.1-sol, medium. No agents or git mutations.
Goal: give the lead a concrete S1/S2/S6 implementation brief while P4 waits on t979 integration.
Read main downstream data-first-simplification-plan.md S1/S2/S6 and trace-offline-trials-plan.md Current State.
Inspect packages/test-runner/src/attempt-lane/scripted-model/**, related offline replay entry points, and named scenario task IDs.
Inspect metadata only from recorded campaign evidence under fxwork/t959 and t960; never print/copy captured page data, credentials, provider requests/replies or browser state.
Questions: can recorded failed runs be replayed through real product code with recorded replies until divergence; what is missing; exact ten task IDs for fixed scoreboard; which existing scripts/preflights cover each?
Distinguish scripted happy-path browser proof, recorded-response replay, and zero-model-call successor proof; do not substitute one claim for another.
Report a bounded file-owned implementation sequence, exact provider-free commands and expected acceptance artifacts, and whether raw evidence is available locally.
No code edits, builds, browsers, paid calls or panel changes.
Owned write: docs/working/data-first-simplification-plan/reports/offline-intake.md in t983 downstream tree.
Finish with Outcome/Changed/Validation/Not verified/Report/Notes.
