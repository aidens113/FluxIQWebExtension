# P8 Chromium commit-floor regression prepared

Outcome: Partial ? concrete real-browser test prepared; launch/build held as instructed until final Core 0.17 libraries.

Changed: `apps/extension/e2e/content/tests/action-effect/tests/client-floor.spec.ts` in task t824 downstream worktree.

## Actual boundary and oracle

The test uses the allowed job-board realistic scenario and existing positive posting `d1` from its catalog. Its own pane renders an unlabeled heart, not a Save/Saved text button. The selector uses the fixture-owned generated heart class under that posting key. The filled class remains independent of the stable selector; the same selector would unsave after an unsafe retry. No fixture DOM/state is invented or altered by the spec.

The actual canonical domain manifest and implementation bundle are registered in `AutomationStudioNativeNodeRuntime` with the domain runtime permissions/capabilities. `automationStudioRunGraphOptions` installs the actual SDK resolver, and the graph executes the canonical native click definition. The authored graph includes hostile legacy `effect: observe`, model metadata `actionEffect: observe`, idempotency and empty-consequence claims. There is a real failed-route alternative pointing to the same toggle, so premature routing would undo the save too.

The effect dispatcher reads the actual native `policy.output.dispatch` payload, sends its selector through the real content-script harness to Chromium, verifies succeeded browser action plus positive persisted saved state and filled heart, then throws a generic lost-acknowledgement error. No producer safety or success claim is given to Core. Core must stop with `run.outcome_uncertain`, one graph attempt/dispatch and no alternative. Independent oracle assertions demand exact persisted saved list `before + d1`, actual DOM filled heart, visible `Job saved`, and one actual `save` API request with no `unsave`.

## Transparent preflight

The existing fixture deliberately refuses the first Save per document without a server mutation. Following lead authorization, the test sends one separate preflight gesture through the actual harness, waits for the site's exact refusal notice, and verifies both the unchanged persisted list and unfilled heart. The Core graph then starts from this observed baseline. This is not browser proof of automatic first-refusal recovery: Core unit tests own proven-unacted retry semantics. Counts are explicitly separate: one non-mutating preflight gesture, one Core graph dispatch that really saves.

Other setup operations use only the site's existing consent/dismiss controls. No fixture reset, synthetic page, paid/model/provider/API call, Core panel, external site or user profile is used. The local Scenario Lab control API is used only by the existing test harness/setup.

## Validation and exact pending command

`git diff --check -- apps/extension/e2e/content/tests/action-effect/tests/client-floor.spec.ts` -> exit 0, no output. The new file was also inspected against the fixture pane/client-script/state sources and actual Core graph-options/native-runtime sources. As an untracked source file, it still requires the lead's usual staged whitespace/structure review.

No build, typecheck, test collection or browser launch run: explicitly held by lead. No concrete missing interface identified; runtime peer confirmed public graph factory and resolver setup. Source APIs now exist but final compiled library compatibility is pending.

From `C:/Users/osrs_/FluxStuff/fxwork/t824/!FluxIQWebExtension`, once the lead rebuilds and coordinates validation:

```powershell
pnpm.cmd --filter @fluxiq-web-extension/extension test:content action-effect/tests/client-floor.spec.ts --workers=1
```

Expected positive state: d1 newly present exactly once in the existing nonempty saved list; heart filled and same target present; visible Job saved; one save/no unsave since graph start. Expected Core outcome: failed with `run.outcome_uncertain`, exactly one save attempt/dispatch, no alternative.

Not verified: actual Chromium execution, extension/browser type checks, content bundle compatibility, final compiled SDK imports, background transport (content harness deliberately replaces background). No optional landed-observation second case added; the main unknown-ack regression remains focused.

## Lead audit correction

Switched board classes and job-board scenario imports to their existing directory barrels. No browser behavior changed. Launch remains held; source frozen for lead acceptance.

## Public SDK correction (not yet exercised)

Runtime peer corrected its earlier API advice: `automationStudioRunGraphOptions` is internal and is not exported from the public root. The prepared import had never been exercised because collection/build/launch were held. Removed that import. The spec now uses the public typed `AutomationStudioGraphExecutionOptions` adapter, forwarding actual native node/inputs/signal/hostContext to `runtime.execute` and node/raw parameters to `runtime.resolveActionEffect`, with runtime capabilities from the actual registry. This is the same canonical native execution/floor handoff installed by the internal factory, with no Core deep import, fabricated contract or new Core public surface. It still needs final compiled-library type/Chromium acceptance.

`node scripts/structure-audit.mjs --rule import-cycles` -> passed (0 warnings, 73 baselined), exit 0 after this correction. Browser launch/build remains held. Source frozen.
