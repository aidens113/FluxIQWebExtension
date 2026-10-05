# t268-deep-link (worker report)

Tree: Core `C:/Users/osrs_/FluxStuff/fxwork/t268/!FluxIQ`, branch `task/t268-ux-early-units`. Nothing committed.

## Outcome

Done. A deep link with `detail=adaptation:<id>` on a top-level Flow now opens Suggested changes (`adaptations` view) for
that Flow with the adaptation selected, once; later manual navigation is not overridden.

## What changed and why

- `apps/web/src/features/automation-studio/live/hooks/useAutomationDeepLinkRuntime.ts`: new required option
  `openAdaptation(flowId, adaptationId)`. A link counts as an adaptation link when it has a `flowId`, no `subflowId`,
  `detail.kind === "adaptation"`, and either no `view` or `view=adaptations`. For such a link the target view is
  `adaptations` (even without `view`), and after load/select the hook calls `openAdaptation` instead of `openView`. If
  the Flow and the adaptations view are already showing, it still calls `openAdaptation` once (the view being visible
  says nothing about which adaptation is selected). An explicit other view (e.g. `runtime-debug`) stays authoritative and
  the adaptation detail is ignored, as before. The existing `restoredRef` key already includes the detail, so the link is
  applied once per distinct link.
- `apps/web/src/features/automation-studio/live/components/AutomationStudioSession.tsx`: the `useAutomationDeepLinkRuntime`
  call moved below `useAdaptationWorkspaceNavigation` (it needs `adaptationNavigation.openAdaptation`, which is a stable
  event) and passes `openAdaptation: adaptationNavigation.openAdaptation`. `openAdaptation` is the existing path the
  conversation dock uses: `persistSelection` into the `adaptations` view state for the Flow, then `openView(adaptations)`.
  No change to `useAdaptationWorkspaceNavigation.ts`.
- New test `apps/web/src/features/automation-studio/live/hooks/tests/useAutomationDeepLinkRuntime.test.tsx` (6 tests,
  react-test-renderer): adaptation link selects `x` once and two later manual navigations do not re-trigger; detail without
  `view` goes to Suggested changes; already-visible Flow+view still selects; plain Flow link keeps router; explicit
  non-adaptation view stays authoritative; link waits for the Flow to be indexed.

## Commands run and observed results

- `npx vitest run` (in `apps/web`) on the new test, `live/tests/automation-studio-live-ownership.test.ts`,
  `live/components/tests/studio-start-entry.test.tsx`, `live/hooks/tests/browser-start-intent.test.tsx`
  -> `Test Files 4 passed (4)`, `Tests 65 passed (65)` (new file: 6 tests).
- `node scripts/build-cache/cli.mjs web:check` -> first run exit 2 (a `.mock` typing error in my test), fixed with
  `vi.mocked`; rerun exit 0.
- `node scripts/structure-audit.mjs` -> first run exit 1 (my imports of `views/view-registry` bypassed the barrel), switched
  to `../../views`; rerun exit 0, `structure-audit: passed (245 warning(s), 349 baselined)`.

## Not verified

- No browser/live check: the adaptations view actually rendering the selected adaptation from the persisted
  `selectedAdaptationId`, and the extension side (W-C/W-E) sending `view=adaptations&detail=adaptation:<id>`.
- Did not run the new test against the old hook to show it fails first (by inspection it would: the old hook never calls
  `openAdaptation`).
- Not run: whole web vitest suite (per the twice-a-day rule).

## Open questions or contradictions found

- Adaptation links with a `subflow` are ignored (the subflow opens in the flow editor as before), because
  `openAdaptation` would reselect the parent Flow and undo the subflow. The design does not cover subflow adaptation links.
- Right after `selectFlow`, `openAdaptation` sees the previous `selectedTaskGraph.flowId` and may call `setSelection` with
  the same Flow selection a second time. It is idempotent in tests; not checked for extra renders live.
