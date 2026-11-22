# t986: truthful processing declarations in scripted Lab replies
Role: existing p0_judge, gpt-6.1-sol medium. No new agent or task branch.
Goal: update fresh scripted instruction replies to the P2 root process contract without changing tasks, oracles, historical replies or production model guidance.
Context: data-first Current State and t984 taskProcessing interpretation contract; omitted process is missing, null is explicit N/A, object is actual deterministic criteria.
Owned: downstream packages/test-runner/src/attempt-lane/scripted-model/scripts/*.ts and adjacent tests only.
Read: those scripts and the exact existing scenario/task instruction+oracle each already uses. Inspect actual fields, values and expected presentation.
Must not touch: t984/Core, run-attempt-command.ts, cost-progress, original captures, scoreboard task identity, scenario fixture/oracle data or generic prompts.
Social stranger-request deletion already has process:null; preserve that change and its test.
Inventory the actual supported scripts; do not assume there are ten or invent missing fixtures.
For each data result, declare the instruction's actual predicates, output columns, sort, limit and any intentional empty-result allowance through the existing dialect. Keep current task wording and oracle unchanged.
For a genuinely action-only task use null. Mixed acts+rows need truthful data criteria, not N/A.
Do not apply a blanket null/empty-object default or reinterpret missing historical metadata as N/A.
If a criterion cannot be expressed or its field identity is unavailable, report that exact dependency instead of guessing or weakening it.
Tests must assert each fresh interpretation reply and its task-specific declaration. They are fixture tests, not passing whole-task evidence.
No new heavy job, browser or provider call during the gate hold; add the exact owning checks to the final queued validation list after hold is lifted.
Report: append concise inventory, criteria rationale, changed paths and not-run checks to t986-offline-proof report (or its existing report name).
Return Outcome/Changed/Validation/Not verified/Report/Notes; continue prior t986 responsibility after this bounded compatibility work.
