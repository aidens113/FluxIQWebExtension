# t1036 brief (W1): what the model sees

Sub-supervisor, Opus. Task t1036, trees `C:/Users/osrs_/FluxStuff/fxwork/t1036/!FluxIQWebExtension` and its Core `.../t1036/!FluxIQ` (branch `task/t1036-page-diff-delivery` in both). Read `briefs/common.md` first; it binds you.

**Goal:** decisions D1-D8, D10, D11, D14 and D15 of the plan, built and proven offline. In short: one domain-neutral page channel in Core keeps, per run and per page key, the last state the model was given, and sends the whole view the first time and a keyed diff afterwards, on every round opening and every tool result that ran on a page; elements keep their key across captures within a run; the look capture and `find_on_page` leave the model's catalog and words; `core.full_page` (or a domain tool) returns the whole current view in parts under a per-request page budget; earlier rounds carry state and references, not every call's result whole; the offered tool list never changes mid-run; no judge call when nothing changed since the last judged no.

**Owns (Core `packages/fluxiq/src`):**
- `runtime/llm/harness/context-packet.ts`, `harness/sized-request.ts`, `runtime/llm/context-window.ts`, `runtime/llm/evidence-loop.ts`, `runtime/llm/evidence-loop/**` except `held-amendments.ts`, and a new page-channel directory (your choice of name under `runtime/llm/`).
- Look withdrawal and the catalog: `runtime/llm/decision-handlers/{look-withdrawal,withdrawn-actions}.ts` and that barrel's look exports, `runtime/llm/prior-nodes/tool-withdrawal.ts`, `runtime/project-agents/supervisor/look-budget.ts`, `runtime/llm/unusable-decision.ts`, `runtime/llm/node-tools/**`, `runtime/llm/harness-options/**`, `runtime/llm/evidence-recall/**`.
- Rounds and judging: `framework/automation-service/service/answer-first/{earlier-rounds,attempt,completion}/**`, `runtime/result-verification/{standing-no,agreement}/**`.

**Owns (downstream):** `domain/src/runtime/llm-evidence/page-view/**`, `domain/src/runtime/llm-evidence/stable-handles.ts`, `domain/src/runtime/llm-evidence/page-find/**` (keep `describe_element`: `run-description.ts`, `description.ts`), `domain/src/element-fingerprint/**`, `domain/src/runtime/target-reacquire/**`, and in `apps/extension/src/content/`: `snapshots.ts`, `dom-snapshot.ts`, `element-finder.ts` and the handle assignment they use.

**Must not touch:** W2's paths (`briefs/t1038-native-decisions-one-read.md`): Core `runtime/llm/anthropic/**`, `runtime/models/providers/**`, `runtime/llm/decision-reading/**`, `runtime/llm/provider-task/**`, `runtime/llm/tool-call-keys/**`, `runtime/llm/verification-checked/**`, `harness/{structured-response,provider-result}.ts`; domain `llm-evidence/structure/**`, `llm-evidence/rejection-next/**`, `domain/src/extraction/**`, `domain/src/actions/extraction/**`, `apps/extension/src/content/extraction/**`. W3's: `runtime/flow-authoring/**`, `decision-handlers/amendment.ts`, `runtime/llm/draft-amendment-feedback/**`, `evidence-loop/held-amendments.ts`.

**Stable interfaces (fixed by the lead):**
- You own what the request's context holds and its order: the stable prefix (system text, tools, draft) first, the page channel's content last (D8). W2 changes only how tools and the reply are encoded and must keep your context byte-identical.
- The offered tools stay the same type (`AutomationStudioLlmDecisionReadingTool` and the decision schema's variants); you change which tools are offered, W2 changes their transport.
- Look withdrawal ends at its source (yours). W2 drops the adapter's withdrawn-action allowance in `anthropic/decision-check.ts`; once no module writes the withdrawn note, delete `withdrawn-actions.ts` only if W2's tree no longer imports it, otherwise leave it and say so.
- Handles keep their `tN` form; their meaning becomes stable across captures (D2). W2's read resolves handles through the existing resolver.

**Order:** propose the page key, the keyed-line view and the per-request budget default (from the recordings' view sizes) first and record them in your report before building on them. Then D1-D3 and D2, then D4/D11/D15, D5-D7, D10, D14.

**Acceptance:** the narrow checks in `common.md`, all passing; the P4 replay table over the five recordings (page tokens and uncached tokens per request, decisions, old against new); one provider-free `bigbox-retail` Lab run in lab slot 2 showing the model's requests carry the first view whole, diffs after, no look or search tool, and the tool list unchanged across the run. Report: `docs/working/page-diff-delivery-plan/reports/t1036-page-diff-delivery.md`. Budget: up to six workers.
