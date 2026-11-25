# t1037 brief (W3): the framework drafts the Flow

Sub-supervisor, Opus. Task t1037, trees `C:/Users/osrs_/FluxStuff/fxwork/t1037/!FluxIQWebExtension` and its Core `.../t1037/!FluxIQ` (branch `task/t1037-auto-draft` in both). Read `briefs/common.md` first; it binds you.

**Goal:** decision D16 of the plan (user, 2026-11-25: "Drafting the flow automatically will help in many situations, as long as the model is able and encouraged to edit it for more efficient flows").
- The framework writes the draft from the acts and reads that worked, in order, leaving out dead ends, failed and no-effect calls and repeats, with the asked table's read as the result.
- The model is able to edit it for a leaner Flow, and told to: loops over repeated steps, parameters for typed values, the result read, dropping waste. The draft-editing grammar shrinks to those edits.
- Rules kept: a lasting act is never done twice; permissions are untouched; the build still finishes only after one judged whole run from the start (AGENTS.md "Build the whole Flow first"); Flows stay general structure, not blind replay.

**Two phases.**
1. **Now:** design, then build the parts that live wholly in your paths. That means a pure drafting function from a run's landed calls to a draft, the reduced amendment grammar and its handler and feedback, and their tests. Write the design into your report before building: inputs (which recorded facts say a call "worked"), the draft it produces, the edits kept and dropped, the guidance words, and exactly where it must hook into the evidence loop.
2. **After W1 (t1036) merges into `dev`:** the lead merges `dev` into your tree and tells you; then wire the drafting into the loop through W1's merged shape. Do not edit the evidence loop, the context packet or the rounds before then.

**Owns (Core `packages/fluxiq/src`):** `runtime/flow-authoring/**`, `runtime/llm/decision-handlers/amendment.ts`, `runtime/llm/draft-amendment-feedback/**`, `runtime/llm/evidence-loop/held-amendments.ts`, and the draft's guidance text wherever it lives (name its file in your report before editing it, and check it is in no other list).

**Must not touch:** W1's paths (`briefs/t1036-page-diff-delivery.md`) and W2's (`briefs/t1038-native-decisions-one-read.md`), in either repository. In phase 2 you edit the evidence loop only through what W1 merged, and you list every W1-owned file you then touch.

**Stable interfaces (fixed by the lead):** a read enters the draft as the call it is; W2 makes a list read one call that detects its list (D13), so your drafting must accept a read with a list handle and no separate detection before it. The `add`/`act` keys on a call stay valid and keep their meaning; you may stop requiring them.

**Acceptance for phase 1:** the narrow checks in `common.md`, all passing; the drafting function run offline over the five recordings, showing for each the draft it would produce beside the draft the model actually authored, and the steps left out with the reason. Report: `docs/working/page-diff-delivery-plan/reports/t1037-auto-draft.md`. Budget: up to three workers; the design is yours or a `worker-heavy`'s.
