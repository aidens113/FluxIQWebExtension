# t811 w5-guidance (Core)

## Outcome
Done. DISPATCH now says kind, parts and failingReceipt may be left out and what Core then picks; reset stays described as never defaulted.

## What changed and why
File: C:/Users/osrs_/FluxStuff/fxwork/t811/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/project-agents/supervisor/guidance.ts (DISPATCH only).
- Opening now "Each brief needs only subflowKey."; kind may be omitted: repair when the subflow's latest return was not done after its builder ran, else build; "A reset is never picked: send it."
- parts may be left out: the plan's parts for that subflow. failingReceipt: "Left out, Core names one from the subflow's latest return."
- The tool-description length test caps dispatch at 2000 chars; the added words overflowed (2310), so other clauses were shortened (kept every phrase guidance.test.ts pins). The sentence "reason says why you send them." was dropped (reason is in the schema).

## Pin drift
No pin json covers DISPATCH. system-prompt-pins.json / system-prompt.test.ts pin the DeepSeek system prompt only (grep for DISPATCH words in them: no match). No pin key changed, no pin file or test header edited. The only text pins on DISPATCH are literal toContain checks in supervisor/tests/guidance.test.ts, all still satisfied.
Before (opening): "Each brief: kind (build, repair, or reset, which puts the target back the way this build found it before the whole test), subflowKey, parts it carries, optional entry {caseId, predecessors: the subflows whose proposals run first to reach its start}, ..."
After: "Each brief needs only subflowKey. kind (build, repair, or reset, which puts the target back as this build found it) may be left out: Core picks repair when that subflow's latest return was not done after its builder ran, else build. A reset is never picked: send it. parts may be left out: the plan's parts for that subflow. Optional entry {caseId, predecessors: subflows that run first}, observed-current and the plan's after when left out; ..."
Also: "It must name a trial that did not pass; ... Left out, Core names one from the subflow's latest return."

## Commands run
- guidance.test.ts alone: first 2310 then 2181 then 2029 chars (limit 2000) failing; final 5/5 passed.
- Acceptance vitest (inside lock): 57 of 58 files passed, 767/767 tests passed. One suite error: supervisor/tests/provider-stopped.test.ts "No test found in suite a supervisor a guard stopped, beside it" (a describe at line 57 with no tests). Not mine; looks like another worker's in-progress edit.
- An earlier run showed 26 files failing to load: flow-bootstrap/subflow-candidate/index.ts imports ./submit-then-words.ts which did not exist yet (another lane, since resolved on the second run).
- `node scripts/check/model-text.mjs` (downstream): "model-text: ok (208 scenario tokens, 385 model-facing Core files, 12022 string literals)".

## Not verified
tsc not run (brief's acceptance listed vitest and model-text only). The provider-stopped suite failure was not investigated beyond reading its describes.

## Open questions
provider-stopped.test.ts empty describe (line 57) belongs to someone else's concurrent edit; supervisor should confirm it is theirs.
