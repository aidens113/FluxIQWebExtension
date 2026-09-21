# W2 MVP latency critical-path audit

Status: read-only audit complete. The warm panel is already fast, the largest proven run delay has already been cut, and the next product optimization should target the remaining post-action readiness waits without weakening before/after evidence.

## Normalized observed timeline

These are existing live observations, not a synthetic benchmark. “Upper envelope” means the named interval contains more than the row's subsystem and must not be attributed wholly to it.

| Path | Boundary | Observed | Confidence | Interpretation |
| --- | --- | ---: | --- | --- |
| Cold Lab/runtime | Next production server ready | 0.637–0.655 s | High | Process startup only; paid once by a retained manual panel. |
| Cold replay campaign | Core restart → authenticated, pages ready, project open, extension connected, graph verified | 14.425 s cumulative | Medium | Operational setup, not per-run product latency. The measured deltas were 4.791 + 0.828 + 2.175 + 1.797 + 1.517 + 3.317 s. |
| Warm panel | Navigation → selected project interactive | 0.305–0.323 s | High | Healthy. Project list and gateway requests overlapped; no fixed wait was found. |
| LLM creation | Explore click → high-token modal ready | 0.839 s | High | Instruction save and authenticated preflight are serial in the panel. |
| LLM creation | Explicit confirmation → generation response | 7.541 s | High for the interval; low for attribution | Contains one provider call, one evidence action, normalization and persistence. The accepted proposal used 6,736 input + 332 output tokens and 2,087 evidence bytes. Existing evidence does not split provider time from browser action time. |
| LLM creation | Generation response → durable proposal checkpoint | 1.139 s | High for Lab; low for product UI | Includes response settlement, visible-error inspection, durable list/detail reads and evidence recording. It is not evidence that the human-facing UI waited the whole interval. |
| LLM creation | Explore click → verified durable proposal | 9.610 s | High | Current successful one-call creation envelope. No redundant provider call exists on this path. |
| Saved Flow run, old warm baseline | Four actions → panel response | 14.774 s | High | Included four 1.001–1.005 s readiness waits plus before/after state capture. |
| Saved Flow run, current integrated proof | Four actions → panel response | 8.165 s | High | One-shot snapshot readiness reuse saved 6.609 s (44.7%) with 4/4 actions and oracle passing. |
| Pre-fix action trace | Per action pre / readiness / page verb / post | 67–814 / 1,001–1,005 / 3–7 / 67–943 ms | High | Transport was 0–1 ms. The page verb is not the bottleneck. |
| Baseline finalization | Core run duration → panel response | ≤0.942 s | Medium | Difference between 13.832 s Core duration and 14.774 s panel step; includes dispatch/serialization/final response. |
| Post-response durability | Panel response → durable routed detail | 0.091 s | Medium | One integrated smoke observation; persistence/read-back is not currently a leading owner. |
| Runtime Debug UI | Terminal detail refresh without reload | Passed; exact latency not measured | High for correctness, none for duration | The observer intentionally waited 5.014 s before its DOM snapshot, so that value is not UI latency. |

## Necessary, accidental, and already removed work

- Necessary today: the single structured provider request; bounded live evidence action; before/after host-state refs and diff; durable proposal/run write; explicit approval; terminal Runtime Debug mutation refresh.
- Already removed: redundant Lab screenshots around internal snapshot commands (1.016 s Lab improvement) and the unconditional pre-action one-second readiness poll when an immediately preceding snapshot proves the same document (6.609 s product improvement). Both are already represented in current t027 history.
- Rejected by live A/B: general process-memory or session “tab was ready” caching. It measured 14.847/14.820 s versus the comparable 14.774 s baseline and was correctly reverted.
- Accidental serialization: exploration saves the normalized instruction and only then asks preflight, even though preflight uses the already-built request payload and not the save response (`apps/web/.../BlankFlowAuthoringPanel.tsx`).
- Likely redundant wait, not redundant evidence: after a successful non-navigation action, the immediately following `after_action` snapshot has no snapshot-readiness proof and falls back to `waitForTabReady`. The three type/select actions cannot navigate by contract, yet each can still pay the fixed one-second settle. Before/after captures themselves must remain.
- Test-only polling (`100 ms` loops), response-body diagnostic deadlines, and durable proposal re-reads improve closed observation but should not be presented as product latency. The successful response path did not spend the two-second failure deadline.
- Panel load, persistence/read-back, and Runtime Debug refresh are below or unmeasured relative to the 8.165 s run and 9.610 s creation envelopes. Optimizing them first would be evidence-free.

## Ranked next actions

### 1. Reuse a successful non-navigation action as readiness proof for its immediate after-state capture

Owner: downstream `apps/extension/src/runtime/action-runner.ts` and `automation-tab.ts`; the correctness consumer remains Core `runtime/executor/{node-execution,host-state}.ts` plus downstream `domain/src/runtime/host-runtime.ts`.

Scope: after a successful action contractually incapable of navigation, record the same bounded URL/document-UUID/freshness proof used by snapshot readiness. The immediate `after_action` capture may consume it once. Click, submit-like, explicit navigation, unknown actions, document replacement, URL change, expiry, or any unavailable identity must retain the existing wait. Do not suppress either snapshot or the state diff.

Estimated saving: best case about **3.0 s** for the proven type/select/type/click Flow (three non-navigation actions × the measured one-second fixed wait); likely **2–3 s**, pending a clean segment trace on the current 8.165 s code. This estimate is an inference from the measured fixed wait and current command ordering, not a post-change measurement.

Live-first experiment: fresh-profile A/B of the exact saved four-action Flow, adding only closed segment durations. Require 4/4 durable attempts, submitted oracle, identical routes/state-ref presence/diff categories, zero provider/adaptation activity, and a material median reduction over at least two warm candidate runs. Stop/revert on any document mismatch reuse, missing before/after ref, changed diff/oracle, navigation regression, or improvement below noise.

### 2. Overlap instruction persistence and preflight on the creation click

Owner: Core web `apps/web/src/features/automation-studio/authoring/BlankFlowAuthoringPanel.tsx`.

Scope: launch the instruction save and request preflight together, then require both to succeed before displaying high-token limits or issuing a grant. Preserve the new project/Flow/normalized-body continuation binding and its post-await revalidation. Prefer overlap over a long-lived preflight cache; it removes serialization without making freshness policy.

Estimated saving: hard upper bound **0.839 s**, the entire observed click-to-modal interval. The exact likely saving is `min(save duration, preflight duration)` and is not recoverable from existing evidence; claim **0–0.839 s until the first timed live run**, not a fabricated midpoint.

Live-first experiment: record only endpoint start/finish timings, then run one normal and one newly-high request through the production UI. Require exactly one saved normalized instruction, no grant before both operations succeed, truthful high-token state, unchanged provider-call count, one durable unapplied proposal, and no stale modal after a mid-await identity change. Stop if either failure can be masked by the other or authorization begins before both settle.

### 3. Retain one isolated campaign topology across adjacent live phases

Owner: downstream `packages/test-runner/src/demo-workspace/core-process.ts`, `browser-session.ts`, and the creation/exploration lane coordinator. This is iteration throughput, not end-user per-run latency.

Scope: give a bounded campaign one production Core/panel/gateway and one verified extension build/profile, with explicit scenario reset and per-phase evidence bundles. Restart remains a deliberate oracle phase, not the default between setup, creation, apply and first rerun. Current `withPersistentDemoCore` persists only inside one operation and cleans up afterward; adjacent CLI lanes still repay setup.

Estimated saving: best case up to the measured **14.425 s** cold replay setup on each subsequent adjacent phase. A realistic likely saving is **8–12 s per reused phase** after retaining necessary fixture reset/reselection; this is an inference and must be replaced by campaign measurements.

Live-first experiment: run setup → creation → apply → first deterministic rerun inside one isolated topology, then perform the required full restart only for saved-reuse proof. Compare phase wall time and product checkpoints to the existing split-lane journey. Stop if state/provider accounting crosses phase boundaries, a rebuilt extension is not verifiably reloaded, cleanup becomes ambiguous, or the restart oracle is skipped.

## Measurement required before provider optimization

The largest creation interval is 7.541 s, but it combines provider, evidence action, normalization and persistence. The successful path already used one provider call—the minimum under the present contract—and only 7,068 total tokens. Do not merge stages, change models, or weaken evidence from this aggregate. The next authorized creation run should emit closed timestamps for provider dispatch/return, evidence dispatch/return, normalization, proposal write and response serialization. Optimize prompt packing only if provider time is then proven dominant; optimize browser evidence only if its own segment is dominant.

No source, test, live process, panel/store, provider/browser API, raw run/page data, commit, or push was touched by this audit.
