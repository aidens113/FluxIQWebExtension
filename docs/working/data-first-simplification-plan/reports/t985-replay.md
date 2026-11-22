# Saved replay continuity progress

2026-11-22: lead read F4/F18/F23/F24 campaign findings and traced the F24 production cause to completion/replay-stands.ts. It unconditionally rejects any retries > 0, including a successful unchanged replay, and tests explicitly required a judge for that case. F18 already has t972 person-cleared coverage; F4/F23 need deeper recorded-path diagnosis.

Lead implemented the independent F24 subset in two Core completion files plus saved-flow-defects architecture documentation. Historical step_retried remains readable; new decisions no longer emit it. Failed/incomplete/repaired/rerouted/shape-changed/unproven cases keep their independent checks. Added successful retry completion tests for counts 1 and 3 and retained negative failure/incomplete assertions.

Validation: `git diff --check` -> exit 0. Focused tests, package typecheck, audit and parent sync are pending. No acceptance claimed. No paid calls, browser run or full suite. Remaining P5 diagnosis/repair persistence is not implemented.
