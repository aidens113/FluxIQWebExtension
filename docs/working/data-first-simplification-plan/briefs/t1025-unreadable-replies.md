# t1025 brief: why the model's replies come back unreadable, fixed at the root

Lead: Claude Code. Task t1025. Trees: Core `C:/Users/osrs_/FluxStuff/fxwork/t1025/!FluxIQ`, downstream `C:/Users/osrs_/FluxStuff/fxwork/t1025/!FluxIQWebExtension` (report only). Unknown cause. Fix the root cause, never cap the symptom: no fewer retries, no hidden errors, no special case for one tool. Model-facing words never mirror a realistic site or task.

Defect: every paid run today had decisions refused `llm.provider_output_invalid` (reply case `content_off_shape`). Each one is a full priced call of about 120k input tokens that does nothing. Recordings (read only, never commit page data) are under `C:/Users/osrs_/FluxStuff/fxwork/recorded-evidence/t1015-bigbox/`:
- `run-mwuxd2v9-33928ea3/steps`: 11 of them (e.g. steps 74, 78, 200, 202, 204);
- `run-mwuuo3zk-75b482b3/steps`: steps 45/124/144/219/226/232/247. Step 247's `decision.json` names a miss `response.decision.toolId` "must be exactly \"web.detect_repeating_structure\"";
- `run-mwus396e-5447c6f6/steps`: step 45.
Each `NNNN-decide` folder has `request.json`/`request.txt` (what the model was offered and told), `response.txt` (what it wrote) and `decision.json` (the misses).

Find, across all of them: what the model wrote, against which schema, and why it did not fit. Is the decision schema the model is given the one the parser holds it to? Did a change of offers (looks withdrawn, a tool refused, `core.loop_decision` offered) leave a decision schema the model was not told, or a per-tool exact `toolId` constraint that makes a near-correct reply unreadable? Is something the model cannot know required? Does the feedback after an unreadable reply say exactly what to fix? Then fix where the cause is: the schema or offers given, the parser, or the feedback. A reply that means one offered decision must read as it. Keep the re-ask and its loop-detection handling as they are (t1014).

Owned: Core `packages/fluxiq/src/runtime/llm/**` decision schema, offers, reply parsing and unusable-decision feedback (`unusable-decision*.ts`, `models/failures/**`, the provider adapter's decision schema), tests beside each. Must not touch: `runtime/llm/harness-options/draft-acts.ts`, `runtime/llm/evidence-progress/**`, `runtime/llm/draft-amendment-feedback/**`, `runtime/llm/decision-handlers/amendment.ts` (t1023), `answer-first/result/**` (t1024), `apps/extension/**` and `domain/**` (t1022), `scripts/lab/**`, the shared Core, `lab-slots/`. No Lab, browser or paid run. If you need a file another lane owns, stop and say so in your report.

Acceptance (quote outputs): a test per cause built from each recorded reply's shape (the reply text a model wrote is fine to paraphrase; no page data), failing before the fix; Core `vitest-groups --groups=parallel,real-sql` over each changed directory; `pnpm --filter fluxiq check` exit 0; Core `node scripts/structure-audit.mjs`. Count how many of the recorded unreadable replies your fix would have read, and list the ones it would not, with why. Leave versions alone.

Report: `C:/Users/osrs_/FluxStuff/fxwork/t1025/!FluxIQWebExtension/docs/working/data-first-simplification-plan/reports/t1025-unreadable-replies.md`. No git. No `node -e`. End with the return contract.
