# t1038 brief (W2): how the model acts

Sub-supervisor, Opus. Task t1038, trees `C:/Users/osrs_/FluxStuff/fxwork/t1038/!FluxIQWebExtension` and its Core `.../t1038/!FluxIQ` (branch `task/t1038-native-decisions-one-read` in both). Read `briefs/common.md` first; it binds you.

**Goal:** decisions D12 and D13 of the plan, built and proven offline.
- **D12. Decisions are native tool calls.** Each offered action is one provider tool, so the provider constrains the call's shape; the reply is a tool call, not a JSON string inside JSON. Do it for every adapter Core has (Anthropic and DeepSeek), keeping Core provider-neutral. t1025's shared decision reading (`runtime/llm/decision-reading/`) stays the one reader of what comes back, and every check a decision passes today still applies. The judge's reply goes the same way where its adapter allows.
- **D13. A list read is one call that detects the list itself.** The model names the list by a handle in the view (or by its words); the read detects the list there and keeps every field it finds on each item (the user's 2026-11-20 rule: extraction keeps every column; the asked columns are a view over those rows). A separate detection stays available but is no longer needed first. Refusals for a read point the model to that one call.

**Owns (Core `packages/fluxiq/src`):** `runtime/llm/anthropic/**` (including `decision-check.ts`), `runtime/models/providers/**`, `runtime/models/failures/**`, `runtime/llm/decision-reading/**`, `runtime/llm/provider-task/**`, `runtime/llm/tool-call-keys/**`, `runtime/llm/verification-checked/**`, `runtime/llm/harness/{structured-response,provider-result,run}.ts`.

**Owns (downstream):** `domain/src/runtime/llm-evidence/structure/**`, `domain/src/runtime/llm-evidence/rejection-next/**`, `domain/src/runtime/llm-evidence/node-run/**` (read paths), `domain/src/extraction/**`, `domain/src/actions/extraction/**`, `apps/extension/src/content/extraction/**`.

**Must not touch:** W1's paths (`briefs/t1036-page-diff-delivery.md`): the context packet, context window, evidence loop, page channel, look withdrawal sources, node tools and catalog, harness options, earlier rounds, attempt and completion, page view, stable handles, page find, fingerprints, target reacquire, content snapshots. W3's: `runtime/flow-authoring/**`, `decision-handlers/amendment.ts`, `draft-amendment-feedback/**`, `evidence-loop/held-amendments.ts`. The draft's step shape is W3's: record a read in the draft as the call it is; if D13 needs a draft change, report it instead.

**Stable interfaces (fixed by the lead):**
- W1 owns what the request's context holds and its order. You change only how tools and the reply are encoded; the context content stays byte-identical, and the tool list you are given is the one you send, unchanged across the run (D11), so the prompt cache holds.
- The offered tools keep their type (`AutomationStudioLlmDecisionReadingTool` and the decision schema's variants) and the loop receives the same decision shape it does today.
- Look withdrawal is gone with W1: drop the withdrawn-action allowance in `anthropic/decision-check.ts` (t1034 added it) and stop importing `decision-handlers/withdrawn-actions.ts`.
- Handles keep their `tN` form; resolve them through the existing resolver. W1 makes them stable across captures.

**Known lead (t1034's report, open):** an enum miss's rule in `runtime/models/providers/anthropic/schema-misses.ts` can run past `MISS_RULE`'s bound in `runtime/models/failures/reply-account.ts`, and the miss is then dropped. With native tools this path may vanish; if it does not, word the miss within the bound rather than raising it.

**Acceptance:** the narrow checks in `common.md`, all passing; the P4 replay over the five recordings: every recorded decision, unreadable ones included, re-expressed as a native tool call and read by the new path, with the counts of what would now be read, refused or impossible; the recorded detect-then-read pairs re-run offline as single reads with the same rows. One provider-free `bigbox-retail` Lab run in lab slot 3 whose list reads are single calls. Report: `docs/working/page-diff-delivery-plan/reports/t1038-native-decisions-one-read.md`. Budget: up to four workers.
