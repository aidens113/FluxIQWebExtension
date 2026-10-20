# t738-c2-opening-arrived: report

## Outcome

Done in source. The refusal is reproduced and the real cause is fixed in Core. The downstream reproduction test only passes once Core's `dist` is rebuilt. I was told not to rebuild it, so that test fails right now, as it should before the fix.

## Root cause

The lead's trace was right about what happened and wrong about why. Core does frame a prepared builder's opening look with `opening: "fresh"`, and `told` does add `arrived: true`. The domain never sees that frame because it reads a different copy of Core's frame store:

- The web panel bundles Core into its server (`apps/web/next.config.ts`, `transpilePackages: ["fluxiq"]`). The office run's panel ran the build with that bundled copy.
- The web domain's host module is loaded with a native `import()`, and it imports Core's `dist` (`fluxiq/automation-studio`, kept external by `domain/scripts/build-web-panel-host.mjs`).
- So one process has two copies of `evidence-build-scope`, each with its own `AsyncLocalStorage`. The registry set the frame in the panel's copy. The domain's `webNodeBuildOf` read its own copy and got `undefined`, with no build and no opening. `webNodePreparedEntry` then returned nothing, and `arrived` became an unexpected key.

The run's own steps confirm it. After the refused opening at step 0102, brief-4's read `extract1` (step 0116) succeeded. If the domain had seen a fresh frame, the opening would have re-armed the arrival rule first, and that read would have been refused `not_at_start_location`.

Tests never caught this because each test loads only one copy of Core.

## What changed and why

Core (`C:/Users/osrs_/FluxStuff/fxwork/t738/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/llm/harness-options/`):
- `evidence-build-scope.ts`: the frame store is now kept once per process on `globalThis` under `Symbol.for("fluxiq.automation-studio.evidence-build-scope")`. A frame set by any copy of Core is the frame every copy reads. The header explains why. Only a registry binding still sets the frame, and the domain still only reads it, so a model-written call still cannot claim arrival.
- `evidence-build.ts`: the build-id frame gets the same per-process store, under `...evidence-build`. Right now the same copy sets and reads it, but a binding made in the other copy would hit the same break.
- `tests/evidence-build-scope.test.ts`: three new tests that load a second copy of the module with `vi.resetModules()`. A frame set in either copy is read by the other, for both stores. A registry binding's `initial.*` call is framed `fresh` for a reader on the other copy, and a later call carrying `arrived` is framed with no opening.

Domain (`C:/Users/osrs_/FluxStuff/fxwork/t738/!FluxIQWebExtension/domain/src/runtime/llm-evidence/node-run/tests/arrival.test.ts`). No domain source changed: `arrival.ts`, `run.ts` and `build-state/**` were already correct.
- Reproduction: "a builder on its prepared entry has arrived when Core's frame is set by another copy of Core, as the web panel's". It sets the frame through a second copy of Core's dist module (a `?copy=panel` file URL, the panel's situation) and sends the opening `initial.core.run_node` carrying `arrived: true`. It expects the look to run, a typed action to run without navigating, and a model-written `arrived` in the same frame to still be refused.
- Two seam tests through Core's registry, one copy: a prepared opening carrying `arrived` is run and counts as arrival, and a model-written call carrying `arrived` is refused. Both pass now.

## Commands run and observed results

- Core, before the fix: `npx vitest run .../harness-options/tests/evidence-build-scope.test.ts --pool=forks --poolOptions.forks.singleFork` printed `2 failed | 7 passed (9)`. Both cross-copy tests read `undefined`.
- Core, after the fix, same command plus `tests/registry.test.ts`: `Test Files 2 passed (2)`, `Tests 19 passed (19)`. After adding the build-id test, the scope file alone: `10 passed (10)`.
- Domain: `DOMAIN_TEST_BUILD_LABEL=t738-c2 node scripts/test-domain.mjs node-run/tests/arrival` printed `# pass 21`, `# fail 1`. The one failure is the reproduction, failing with exactly the run's refusal: `{"code":"invalid_input","detail":{"reason":"unexpected_input_keys","instead":["node","parameters","consequences"]}}`. It reads Core's existing, unfixed dist.
- Native Node check of the mechanism (scratch script `C:/Users/osrs_/AppData/Local/Temp/claude/c--Users-osrs--FluxStuff--FluxIQWebExtension/53d1357c-b7da-4f48-9665-ff78992a8998/scratchpad/c2/two-copies.mjs`, which imports one module twice by query URL). Fixed source via `--experimental-strip-types`: `other copy reads: {"projectId":"p","flowId":"f","buildId":"b","opening":"fresh"}`. Current dist: `other copy reads: undefined`.
- `node scripts/structure-audit.mjs`:
  - Downstream: `passed (211 warning(s), 618 baselined)`.
  - Core: `6 violation(s)`, all in files other workers are editing right now (`activity/wording/`, `conversations/commands/`, `flow-bootstrap/plan/` and its `tests/`, `authoring/draft-routing.ts` at 812 lines, and `tab` vocabulary in `candidate/trial-view.ts` and `subflow-candidate/builder-loop.ts`). None are in `harness-options/`; that directory shows only advisory warnings.

## Downstream needs Core's dist rebuilt

Yes. The domain reproduction test imports Core's `dist`, so it fails until the lead rebuilds Core. It should pass after the rebuild with no other change. The live fix also needs the rebuilt dist and a rebuilt web panel, because both copies must carry the shared store. A panel built from the old source creates a private store, and a new dist cannot reach into it.

## Not verified

- Did not rebuild Core's dist, run tsc, or run a live Lab or browser run. Not checked live: that a prepared builder's opening now runs in the real panel.
- Did not check that the new build-id test fails before the fix. It is the same mechanism as the scope test, which did fail before.
- Did not check typing of `import.meta.resolve` and the `typeof import("../evidence-build-scope.ts")` type in the tests under the lead's tsc. `@types/node` declares `ImportMeta.resolve`.

## Open questions or contradictions found

- Larger than this brief. In the live panel, since t728, no domain call has seen Core's frame at all. Other things broke the same way:
  - A repair brief's opening carrying `repairs`, and a continuing round's opening carrying `held`, would also have been refused `unexpected_input_keys`.
  - Every build memory was keyed by project and Flow alone, and none was persisted, because the build id was undefined.
  - `repeatedRefusals.startedOver` never fired.
  - This fix restores all of them, but the lead should expect the next live run to behave differently on those paths.
- Structural risk. Any other Core module-level state the domain reads or writes at runtime is duplicated the same way while the panel bundles Core and the host imports `dist`. Two structural fixes, neither in my ownership, are worth considering:
  - Make `fluxiq` a server-external package in `apps/web/next.config.ts`, so there is only one copy. That touches the build-identity reasoning in that file.
  - Add a check that flags module-level `AsyncLocalStorage` or singletons on Core's public exports that are not keyed per process.
