# Crossborder final-judge review

Status: Ready for supervisor review; generic guidance validated, live correction unverified

## Outcome

Run run-mvddq555-2804ed24 (t565 / bf-slot-2) failed after a Flow was promoted and the first person handoff succeeded. It used 42 paid calls / $0.054874467. Original extraction matched 10 ordered records and 40 fields. The ACTUAL final oracleVerdict is failed: records held, but two passive unchanged-state page facts were unobserved after later result repair. Neither row counts alone nor absent page counters prove a full pass or a lasting mutation.

The first result refusal is an unsupported literal-title restriction: judges0054/0056 exclude one hub because its title lacks the contiguous search phrase. The authored task uses those words for retrieval, then asks for every qualifying hub; it does not require exact title wording. The judge advice tightens/adds that literal condition. Later reauthor judges0081/0082 call the newly excluded row missing and complain about diagnostic field readings; reauthor ultimately meets another person check and ends user_intervention_required. The saved original answer and later diagnostic reads must remain distinct.

## Evidence and current guards

Read-only inspection used actual requests/decisions in steps0053-0056 and0081-0082, plus evaluation.json and snapshots/flow-lane.json under C:/Users/osrs_/FluxStuff/lab-runs/2026-10-17/run-mvddq555-2804ed24. No raw page records, seller/product names, tokens or credentials are copied here. Original t565 source/state was not modified.

Replaying actual judge0054/0056 input through current built Core returned wholly=false with zero contradiction findings. The original summary holds 10 stored rows; price/shipping/sponsorship bounds have settled witnesses. The disputed kept row is a search-phrase/title claim, rather than a failed numeric bound.

Current request-rows/unstated-exclusions.ts intentionally protects search-word-only and named-row-kind disputes (t628/t660) so Core does not override a genuinely wrong-kind no from word overlap. Those conservative exemptions were retained. A semantic override based on this scenario's oracle would be unsafe.

## Authorized change

Supervisor approved generic shared judge guidance only: retrieval text does not impose literal title/name wording unless explicitly requested, and actual type/content determines qualification; a query match alone is insufficient. This neither forces a yes nor changes any oracle or refutation exemption.

Final Core paths:
- packages/fluxiq/src/programs/automation-studio/runtime/llm/diagnosis-instructions.ts
- packages/fluxiq/src/programs/automation-studio/runtime/llm/tests/diagnosis-channel.test.ts

The regression runs the actual harness and DeepSeek outbound system/user request composition for both finished-run and build-test prompts, preserves a mocked no, and checks the strict response schema. Its abstract fixture mirrors no realistic scenario.

The initially approved standalone test would have made 26 files in a tests directory whose budget is 25. Supervisor approved substitution into existing diagnosis-channel.test.ts; the temporary new test was removed. No baseline relaxation or unrelated restructuring occurred.

## Observed validation

- Fail-first prompt-composition test: both cases failed before guidance, 34.88 s.
- Bigbox related parser regression was independently fail-first: 1 failed / 2 negative controls passed, before admitting the alone modifier.
- Final command, from Core packages/fluxiq: `pnpm.cmd exec vitest run src/programs/automation-studio/runtime/result-verification/refuted-no/tests/missing-claim-copy.test.ts src/programs/automation-studio/runtime/result-verification/refuted-no/tests/missing-claim-clause.test.ts src/programs/automation-studio/runtime/result-verification/refuted-no/tests/weigh.test.ts src/programs/automation-studio/runtime/result-verification/refuted-no/tests/together-rows.test.ts src/programs/automation-studio/runtime/result-verification/refuted-no/tests/reask.test.ts src/programs/automation-studio/runtime/llm/tests/diagnosis-channel.test.ts --maxWorkers=2 --minWorkers=1`: 6 files / 86 tests passed, exit 0, 46.52 s.
- Core `pnpm.cmd --filter fluxiq check`: actual compiler passed, exit 0, 87.603 s (before relocating the identical prompt cases into the existing file).
- Final `node scripts/structure-audit.mjs`: passed, 401 warnings / 1154 baselined, exit 0.
- `git diff --check`: exit 0.

Paired source changes for both findings are exactly four approved Core files, 64 insertions / 2 deletions; no other source or generated output changed. No commit, merge, push, production build or paid rerun was performed after these fixes. Both failure debug files are written in t563. Prompt delivery tests do not prove corrected real-model judgment; supervisor integration and fresh live acceptance remain required.

Validation output provenance: final Vitest output was observed directly in tool session 62963; compiler output in session 85567. Neither command redirected a disk log. Actual audit output files are C:/Users/osrs_/AppData/Local/Temp/t563-judge-fixes-structure.log (historical initial failure) and t563-judge-fixes-structure-final.log (final pass). Actual bigbox launcher/runtime output is C:/Users/osrs_/AppData/Local/Temp/codex-lane1-bigbox.log. Source is frozen for supervisor independent verification; no build or live launch is running from this worker.

Final integrated frozen gates also passed after supervisor integration: 7 files / 111 focused tests (including social read-account accounts), Core library build and fluxiq check, downstream domain/extension checks, and both structure audits. Exact outputs/log paths are in codex-live-lane-1.md, Final integrated gate results. No further worker source edits, build or paid launch after those gates; await supervisor release for fresh model acceptance.
