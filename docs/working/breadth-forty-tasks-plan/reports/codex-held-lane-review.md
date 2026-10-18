# Codex held-lane review

Status: Review complete; integration validation pending.
Scope: Core `94c3c49f` (t563), downstream `83d883b4` and Core `4d90c6e7` (t567), compared with t719 commits `62eb9b41` / `61160ebe`.

Read-only source review completed 2026-10-17 (client date). Read Current State, the three lane reports, Core boundary rules, changed implementation/tests, the content harness spec, and package/test-runner commands. No tests, builds, branch changes, merges, commits, paid runs or runtime mutations were performed. Only this report was written. Prior reports' pass counts are historical claims, not verification by this reviewer.

## Recommendation

- **Core t563: merge after narrow checks and dev integration.** The settled-row filter and refuted-no clause exclusion implement the reported behavior. The clause is ignored only for known stored rows with left-out copies, with no unknown/left-out row and no remaining negative claim. Tests cover the two judge answers, an independent complaint, unknown-copy shape, and unchanged unsettled listing. No blocking source defect found. A fresh rated-delivery-towels live run remains necessary to prove the judges now accept the correct answer; this code re-asks a refuted no rather than forcing a yes.
- **Core t567 drawing plus downstream t567: merge as one paired unit after rebuilding Core and narrow checks.** Drawing is now projected on recordings and supplied from retained evidence to repair resolution; the bounded repair target retains it when shedding attributes/classes. Core normalizes the declared opaque token across flat/canonical/candidate/metadata/action shapes. Neither Core's identifiability threshold nor its matching logic is broadened. No blocking source defect found in drawing transport. The reports correctly flag that separate Core/domain tests do not prove the complete persisted-repair route.
- **Downstream reveal: retain, validate the browser harness, then prove company-website live.** It re-resolves the target on every attempt, carries DOM references only in a local WeakMap, scrolls between attempts, and preserves the retry counter/deadline. It does not execute hidden controls directly. Two concrete limitations below should be tracked; neither disproves the reported company-website path.

## Findings and remaining behavior

1. **Reveal diagnostics can assert visibility without evidence (medium, narrow follow-up).** `apps/extension/src/content/action-runtime/recovery/attempt.ts:184` sets `shown` whenever the final failure code is anything except TARGET_NOT_SHOWN. A page can remove the target after scrolling, yielding TARGET_NOT_FOUND, yet the sentence becomes "which revealed it". A different failure is not positive evidence that the target was shown. The new reveal-attempt tests cover success and persistent hidden failure, not disappearance after scrolling. Add that regression and use positive visibility/actionability evidence, or a sentence that accurately states only the changed refusal. This affects diagnosis rather than permission or action dispatch.
2. **Nested scrolling visibility is incomplete (low, coverage gap).** `apps/extension/src/content/action-runtime/reveal/reveal-aim.ts:62` / `:117` considers only the outer viewport for a target that has a box. An opacity/visibility-hidden target can have coordinates inside that viewport while lying outside the visible part of a nested scrolling panel. The early return then prevents the panel scroll that could reveal it. The display:none branch does consider a nearest scrolling container at `:125`; the boxed-target branch does not. Existing tests exercise a nested panel only for display:none. Validate with a real scrolling container before claiming general nested-panel support.
3. **The full discovery-to-act route is still unproven.** The company-website harness deliberately calls by selector, and sets consent/dismissals through fixture APIs; it proves content-script recovery, not that the model discovers the hidden button, builds a correct Flow, resets it, and replays. The lane report's `find_on_page` caveat remains open. Do not treat its proposed wording as already implemented, or assume every hidden control is revealable.
4. **Cross-repository persisted repair still needs an assertion.** Core's added normalizer tests and domain's override tests prove adjacent pieces separately. After rebuilding Core, verify a drawing-bearing resolved override through the real save/normalize/reload path (the existing `runtime/tests/live-patch-target-override.test.ts` and service-adaptation durable-patch tests are starting points). Re-running current tests alone does not add that missing assertion. This is a validation gap, not evidence that the signal is currently lost.

## t719 interactions

Changed-path intersection of the reviewed commits with the original R1 commits is downstream `apps/extension/src/shared/dom-element.ts` only. R1 adds `DomElementContext.subject`; t567 changes the identity-signal/wire omission declarations below it. These are separate hunks and should merge cleanly. Preserve both: R1 subject context and t567's wired `drawing`; never restore `drawing` to `UnwiredElementField` when resolving conflicts.

There are no overlapping Core files between R1 and these held commits. Semantically, R1's undo subject/page bookkeeping and t567's drawing evidence both travel retained evidence/element descriptors, so run the R1 admission/state-diff tests and the drawing transport tests against the combined tree. Do not discard R1 additions to capture/sanitize/stable handles while integrating t567's extra argument in `llm-evidence/tools.ts`. t563's result verification is independent of R1 admission but must judge a trial whose own effects were actually reset.

These overlap findings concern the named commits, not unreviewed future edits. Merge current dev into each task before its final gate, inspect the resulting diff, and revalidate combined behavior. The lane reports also live outside the held code commits; preserve needed reports/debug documentation during integration.

## Exact narrow validation commands (not executed here)

Run sequential build/integration operations only while the relevant paired tree has no live run. Never rebuild the Core backing a live lane. These checks are targeted, not full-suite sweeps.

From the paired Core root after both Core changes and dev integration:

```powershell
pnpm.cmd --filter fluxiq check
pnpm.cmd --filter fluxiq exec vitest run src/programs/automation-studio/runtime/result-verification/refuted-no/tests src/programs/automation-studio/runtime/result-verification/request-rows/tests src/programs/automation-studio/runtime/result-verification/value-readings/tests/text-settled-judge.test.ts src/programs/automation-studio/model/tests/action-element-target.test.ts
node scripts/structure-audit.mjs
pnpm.cmd --filter fluxiq build
```

From the paired downstream root, with that Core build complete:

```powershell
pnpm.cmd --filter @fluxiq-web-extension/domain check
pnpm.cmd --filter @fluxiq-web-extension/extension check
node scripts/structure-audit.mjs
```

From downstream `apps/extension`:

```powershell
$env:EXTENSION_TEST_BUILD_LABEL='codex-held-lanes'
node scripts/test-extension.mjs content/action-runtime/ content/actions/ background/connection/tests/ shared/tests/
node scripts/test-content.mjs -- tests/reveal-by-scroll --workers=1
```

From downstream `domain`:

```powershell
$env:DOMAIN_TEST_BUILD_LABEL='codex-held-lanes'
node scripts/test-domain.mjs runtime/llm-evidence/target/tests/ runtime/llm-evidence/plan-resolution/tests/ element-fingerprint/
```

The commands test changed directories plus action callers and identity guards. Existing domain override tests alone do not prove save/reload; add or exercise the assertion described above if treating persistence as verified. Re-run the separate R1 worker's exact tests after combining R1; they own the revised undo rules and may have changed during this review.

Live acceptance after integration: rated-delivery-towels must match all expected records and be accepted by FluxIQ's judges; company-website apprentices must complete build, judged run and zero-call replay; drawing identity must survive a recorded/saved or repaired wordless target and match the intended control. Retain the R1 everything-store proof of preserving pre-existing state. Use existing A8 launch instructions, realistic scenarios, per-lane slots and isolated state. No live acceptance was performed by this reviewer.
