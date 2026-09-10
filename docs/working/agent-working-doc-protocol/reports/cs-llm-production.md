# Worker report: llm-production-automation-plan.md

Target: `f:/!FluxIQWebExtension/docs/working/llm-production-automation-plan.md`
Worker: Current State worker (header block + `## Current State` insertion only)
Date: 2026-09-10

## Status chosen and why

**Active.**

- The document's own status line (now line 69; originally line 3) reads: "Status: execution authorized; instruction-only creation, first live runtime adaptation, and parameterized `basic-form` creation/run are accepted; active work is repeatable generation/adaptation and reusable sanitized context". Work is explicitly ongoing, so it is neither Complete, Paused, nor Archived.
- The `## Active Phase: Reusable Sanitized Evidence And Run-Informed Adaptation` section (line 1220) opens with "This phase is under incremental implementation; it is not a claim that production memory is already enabled end to end" (line 1222), and its two dated status subsections (`### Core contract/store implementation status (2026-09-09)`, line 1389; `### Downstream producer implementation status (2026-09-09)`, line 1477) describe partially delivered slices with later slices still owed.
- `## Phase Status` (line 121) lists phases 4, 5, and 7 as deferred/pending and phase 6 as "first ... lane accepted live" with "Repeatable scenario coverage, run-informed retrieval, and broader hardening remain".
- No sentence in the document states that the effort is blocked, stopped, or handed to another document. The one explicit "current product-path blocker" claim (provider timeout, in `### 2026-09-09 focused live exploration iteration`, line 529 onward) is overtaken by later successful checkpoints in the same document, so Blocked would be wrong.

The status-detail wording in the new header block preserves the existing status prose verbatim.

## Owner

`root coordination agent` — taken from the document's existing "Primary owner: root coordination agent" line (now line 72). The document also states Core edits are made by dedicated Core subagents and that "The primary integrates and independently verifies but does not directly edit Core" (`## Ownership And Core Governance`).

## Paired Core document

**none.**

- The document never names a Core working document. Its only Core references are `F:\!FluxIQ` (generic behavior location) and `F:\!FluxIQ\AGENTS.md` (which Core subagents must read); its only "Related" link is the downstream `docs/working/automated-testing-facility-plan.md`.
- I listed `F:\!FluxIQ\docs\working\` (filenames only; I did not open any file there, per the brief). The closest candidate by name is `F:\!FluxIQ\docs\working\llm-assisted-deterministic-automation-expansion-plan.md`; `adaptive-flow-training-roadmap.md` is a weaker second candidate. Because the target document does not reference either and I could not read them to confirm they cover the same effort, I did not assert a pairing. The supervisor may want to verify the first candidate and update the `Paired document:` field if it matches.

## Five facts an agent resuming this work most needs

1. **Three lanes are certified live and provider-free validated; do not repeat them.** Instruction-only blank-Flow creation plus zero-LLM replay (`## 2026-09-08 Accepted Creation And Session-Authorization Checkpoint`, line 252); the first runtime adaptation (run `5be70f05-3849-4bb9-87b5-800aad3cb525`, two DeepSeek calls, applied selector `[data-testid="instruction-name-adapted"]`, validation run `80414559-...` 6/6 actions, zero provider calls — line 1099); and parameterized `basic-form` creation/run (one DeepSeek call, applied `adaptation.bootstrap.2bc9525d-...`, run `ada55134-...` 7/7 actions passing the registered oracle — line 1157). Resume only through the exact provider-free continuation commands (`demo:llm:explore:*`, `demo:llm:adapt:*`, `demo:llm:pending|state|revert|replay`).
2. **The active phase is reusable sanitized evidence, and it is deliberately disabled end to end.** Core has the `automation-studio.reusable-llm-context.v1` store (migration `0016`), feature-gated API, AES-256-GCM protected-content boundary, deterministic selection/packing (max five items, `min(8192 bytes, 10% of maxInputTokens)`), and a harness injection seam; downstream has the fingerprint/projection producer and a fail-closed coordinator. Production writes are rejected until the downstream web-panel host supplies key custody/content-protection provider injection; no harness caller populates `relevantRuns`/`relevantAdaptations`; retrieval population, creation/adaptation integration, and UI (steps 3-6 of the implementation sequence) remain.
3. **Safety envelope and testing policy are non-negotiable.** DeepSeek `deepseek-chat` via the ignored `DEEPSEEK_API_KEY`; strict creation profile 4,000/1,000/5,000 tokens, one call, zero retries; live calls manual, loopback-only, side-effect-free, excluded from CI; raw prompts/responses/page snapshots never retained or sent to the provider; LLM output is untrusted and always needs manual review, revision-bound apply, and zero-LLM replay. Use focused tests and `lab interactive` for small edits; full journeys only at material cross-boundary changes or certification checkpoints; workspace-wide `pnpm check/test/build` only at major checkpoints.
4. **Ownership split is strict.** Generic behavior (tasks, budgets, grants, proposal/review/apply/revert, graph validation, audit, reusable-context contract/store/ranking) lives in FluxIQ Core at `F:\!FluxIQ`, edited only by dedicated Core subagents; browser/DOM/URL/selector/tab/extension concepts, the web evidence sanitizer (`web-llm-evidence.v1`), and the Testing Lab live in this repository. After any Core source change, rebuild the linked Core `dist` before a live attempt (the document records two incidents where stale `dist` masked accepted source fixes).
5. **Known open product gaps beyond the active phase.** Phase 4 recording refinement deferred; Phase 5 existing-Flow editing pending; Phase 7 hardening lanes (cancellation, rate limit, malformed output, sensitive/prompt-injection, reconnect, dynamic DOM, iframe, long-document) pending; scenario ladder beyond `basic-form` not started; literal selectors still travel in evidence pending a provider-neutral Core seam for resolving `target.N` references; generic submit execution is deliberately blocked in the evidence loop; Core does not expose capture-unavailable/capture-failed provenance on the intervention DTO.

## Internal contradictions or stale statements noticed

- **Stale "active milestone".** `## Objective And Current Direction` (line 78) says "The active milestone is instruction-only blank-Flow authoring", while the status line says active work is "repeatable generation/adaptation and reusable sanitized context" and the `## Active Phase` section (line 1220) names reusable evidence as the active phase. The objective paragraph was never updated after the milestone was accepted.
- **Stale numbered "Next:" list under `## Immediate Next Steps`** (line 221, items 1-6: add DeepSeek cost accounting, retry creation via `pnpm demo:llm:create:focused`, then approve/apply/replay). These were completed by the `## 2026-09-08 Accepted Creation And Session-Authorization Checkpoint` section that follows (line 252), but the list is still phrased as pending. Several later "Next:" paragraphs (lines 295, 305, 347, 474, 523, 700, 747, 781) are likewise historical; the document itself acknowledges this once: "This checkpoint supersedes the stale `Next` statements immediately above." (line 481) but does not mark the others.
- **Stale blocker claim.** In `### 2026-09-09 focused live exploration iteration` (line 529 onward): "The provider timeout, not evidence correctness, is the current product-path blocker." Subsequent entries record a successful proposal-only checkpoint, apply, baseline, and adaptation, so this is no longer the blocker.
- **Phase Status item 3 partially stale** (line 125): "Remaining work is repeatable creation coverage beyond the first fixture and the wrapper's post-apply certification bookkeeping." The `basic-form` scenario later provides a second accepted fixture (line 1157). The post-apply bookkeeping item is never reported resolved, so its state is unknown.
- **Budget ceilings contradict the exploration envelope.** `## Live Safety Envelope` (line 97) states explicit profiles must remain "within the two-call, $0.25, and 50,000-total absolute contract ceilings", yet the evidence-guided exploration profile is "four calls, 12,000 tokens per call / 48,000 aggregate tokens, $1 aggregate cost" (line 248) and "a bounded four-call grant" in the global evidence-guided checkpoint. The two-call and $0.25 ceilings are not reconciled with the four-call/$1 exploration envelope.
- **Non-chronological layout.** `## Immediate Next Steps` (line 183) contains a 2026-09-08 checkpoint and a 2026-09-09 payload-efficiency checkpoint (line 243) that appear before the `## 2026-09-08 Accepted Creation` section (line 252) and before all later 2026-09-08/09 checkpoints. A reader following file order will encounter later facts before earlier ones. Left as-is per the no-reorder rule.
- **Per-call timeout values vary without a single reconciliation point.** Strict creation profile says 20 seconds (line 94 area); the exploration path says 45 seconds per call; the 2026-09-09 focused iteration reports a failure at "the 25-second per-call limit"; the payload-efficiency checkpoint (line 248) then explains the 25-second value is the persisted ordinary Flow timeout while Core authorizes 45 seconds per exploration call. Consistent once read in full, but confusing in file order.
- **Minor:** the document twice records the same `adaptationCount` run-summary correction (once after the runtime-adaptation checkpoint, once in the downstream producer status section). Not contradictory, just duplicated.

## Line counts

- Before: **1510** lines (`wc -l`, run before any change).
- After: **1577** lines (`wc -l`, run after the change).
- Inserted: **67** lines (1577 - 1510 = 67; the insert file was independently measured at 67 lines).

Verification actually run:

- `wc -l` before and after (values above).
- `grep -c $'\r'` on the target before and after: 0 both times (file is LF-only and stayed LF-only; the git "LF will be replaced by CRLF" warning is the repo's autocrlf setting, not a change I made).
- `diff` of the original file from line 2 onward against the new file from line 69 onward: identical. `diff` of line 1 (H1): identical.
- `git diff --stat`: `1 file changed, 67 insertions(+)`, zero deletions.
- The `## Current State` section occupies 54 lines (from its heading through the blank line before the closing `---`), under the 150-line cap.

Layout of the insertion (new lines 2-68): blank line after the H1, eight header fields on consecutive lines (`Status`, `Status detail`, `Created`, `Last updated`, `Owner`, `Scope`, `Paired document`, `Related`), one blank line, `---`, blank, `## Current State` ... content, blank, `---`. The original blank line and the pre-existing loose `Status:` / `Created:` / `Recovered after...` / `Primary owner:` / `Related baseline:` lines follow unchanged immediately after (now lines 68-73), as instructed.

Nothing was reordered, deleted, compacted, or reworded. No commit or push was made. No file other than the target and this report was written (a scratchpad copy of the original and the insert text exist only in the session scratchpad directory).
