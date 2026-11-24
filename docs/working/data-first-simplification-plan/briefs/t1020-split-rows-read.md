# t1020 brief: a list read whose rows each hold one field, and a model that cannot get off it

Lead: Claude Code. Task t1020. Trees: downstream `C:/Users/osrs_/FluxStuff/fxwork/t1020/!FluxIQWebExtension` and Core `C:/Users/osrs_/FluxStuff/fxwork/t1020/!FluxIQ` (branch `task/t1020-split-rows-read` in both). Debugging with an unknown cause; fix at the root (AGENTS.md: never cap a symptom, never teach to the test).

Recording (read only; never commit its page data): `C:/Users/osrs_/FluxStuff/fxwork/recorded-evidence/t1015-bigbox/run-mwuuo3zk-75b482b3/` (`steps/`, `work-logs/core.log`, `fluxiq-root/`). Paid bigbox run, 2026-11-24, Haiku, stopped by the lead at step 309 ($1.80) after 40 decisions without an act and 8 identical `web.detect_repeating_structure` calls. The earlier run `.../run-mwus396e-5447c6f6/` read the same search page correctly (card-level item, name/url/price/rating/pickup).

What the lead established:
1. The draft's list read is pinned to `extraction.18`, whose binding's item is `main > div > section > div:nth-of-type(3) a` (the links inside each product card) with the card as a `group` (`group_heading`). Replayed (step 235, `core.replay.replayed`, "kept 16 rows"), every row holds only `name` or only `url`: no price, no rating.
2. The read was accepted as a good read anyway.
3. The model said, step after step, that "the extraction lacks rating and pickup" and re-detected; detection on a card target gave a good card-level structure (`extraction.27`, step 174), but the model never read with it nor replaced the draft's read step: it detected again (refused as a repeat), tried to complete (refused `processing_binding_missing` / `processing_schema_missing`), and started over. Loop handling steered it 11 times without effect.

Find, from the steps (call/result/decision/request files):
- where `extraction.18` was made (which step, which target) and why detection chose links-in-cards with a group, and whether that grouping is a defect in the domain's structure detection (`domain/src/**` detection and `dom-extract_list` binding) for a page like this;
- why a read whose rows are split (each row a fraction of the item's fields, alternating) is accepted rather than refused or told as a wrong item unit;
- what the model was told after each detection and after each refused completion, and whether it is told plainly how to put a new detection into the draft's read step (read with the new handle, replace the step); whether any refusal blocked a correct replacement.
Then fix each real cause where it belongs (domain detection or read admission downstream; Core guidance or amendment only if that is where the cause is; say before editing Core, in your report). Generic wording only: no realistic site, product or task in any model-facing text.

Owned: what the causes need, in `domain/src/**`, `apps/extension/src/**` (only if the cause is in the content script), Core `packages/fluxiq/src/**`; tests beside each. Must not touch: `scripts/lab/**`, the shared Core `fxwork/!FluxIQ`, `lab-slots/`, any Lab run (no live or paid run).

Prove offline on the recording: `pnpm lab recorded-read` (docs/architecture/testing-facility.md, `read-oracle/`) or a domain test built from the recorded page shape (synthetic markup of the same structure, no recorded page data committed): the bad binding is refused or told; detection on that structure yields card-level items with all fields; the model-facing next step after a detection says how to use it.

Acceptance: the narrow tests beside each change pass (quote them); `pnpm --filter @fluxiq-web-extension/domain check` and, if Core changed, `pnpm --filter fluxiq check` exit 0; both `node scripts/structure-audit.mjs` pass. Leave versions alone.
Write the run's debug too: `docs/working/language-driven-flow-loop-plan/debugs/run-mwuuo3zk-75b482b3.md` (verdict, path, calls, cost, cause, fix), following `.../debugs/run-mwus396e-5447c6f6.md` on dev.

Report: `docs/working/data-first-simplification-plan/reports/t1020-split-rows-read.md` in the downstream tree. No git. No `node -e`. End with the return contract.
