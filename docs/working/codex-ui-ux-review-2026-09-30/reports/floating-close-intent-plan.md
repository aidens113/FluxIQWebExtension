# Floating overlay close intent plan

Status: Complete (bounded executable plan; product/test implementation held)
Owner: runtime_contracts
Date: 2026-10-01

## Written brief

- Entry-focus two paths remain frozen for root independent and full Core checks. Own only this downstream report; no source/test or check commands. Read parent Current State and completed floating-overlay-close-intent-audit.md F1/F2.
- Read exact Core automation-studio/workspace/overlays/accessible-floating-overlay.tsx, ViewAdderOverlaySubscriber.tsx and LayoutPickerOverlaySubscriber.tsx plus directly owning overlay-hardening and atomic-command tests only. Supervisor additionally releases read-only programs/overlay-environment.ts option types and returnFocus release invocation only to establish the actual callback seam. Entry focus/source policy is now settled.
- Prepare exact later three-product-path + NEW owning close-intent test partition, or request precise extra scope. Specify wrapper optional current return predicate, explicit/Escape cancellation return, outside/action/teardown suppression and Surface lifetime fences. Preserve current request-keyed store closes, failed action feedback and accepted issued-action semantics. Do not infer arbitrary Modal/Drawer contracts or widen environment.
- Supervisor additionally releases read-only overlays/contracts.ts ViewAdder/LayoutPicker request-command declarations and their referenced AutomationView definition, plus atomic-command.ts dispatcher/hook declarations only. Preserve source-compatible optional prop; distinguish synchronous ref ownership from effect cleanup ordering hypotheses. New actual wrapper/subscriber synthetic tests should prove eligible Cancel returns, action/outside/teardown leaves destination, old callbacks cannot dispatch/close a newer request and errors keep current Surface open.
- No implementation, shared docs, commits, heavy/broad/browser/Lab/provider/panel/private data. Record executable algorithm, exact proposed paths, tests-first schedules and limitations. Root coordinates integration and releases only after current Core gates close.

## Source evidence and exact partition

Read parent Current State, F1/F2, the three named product sources and existing hardening/atomic-command tests. Entry focus remains frozen and correct; return capture already uses panel.ownerDocument. Actual ViewAdder and LayoutPicker subscribers key Surface by request.id and bind store.close(channel, request.id); preserve that protection. Surfaces currently invoke the same onClose on explicit cancellation and successful execute, and their add/arrange entry points have no mounted lifetime fence. The atomic tests prove pending deduplication/snapshotting and failed-command retry; this plan does not replace or weaken that gate.

Proposed original write partition is four Core paths; the fifth owning fixture reconciliation below is explicitly proposed for the next release:

- `apps/web/src/features/automation-studio/workspace/overlays/accessible-floating-overlay.tsx`.
- Same directory `ViewAdderOverlaySubscriber.tsx`.
- Same directory `LayoutPickerOverlaySubscriber.tsx`.
- NEW same directory `tests/floating-close-intent.test.tsx`.

No helpers, exports, store/dispatcher contracts, environment, Modal/Drawer, observer/styles or subscribers outside these files. The three product files remain below400advisory/800hard; wrapper is182lines at its frozen entry checkpoint. New private refs/guards and optional wrapper prop can remain inside the owning files. Existing atomic/hardening/environment/architecture assertions stay unchanged; only the explicitly identified entry fixture identity assertion needs behavioral reconciliation.

## Environment seam confirmed by bounded supervisor release

Root explicitly released only environment option types and return release invocation for read. Actual `OverlayEnvironmentOptions.returnFocus` is `FocusTarget | null`, where FocusTarget has `focus(options?: FocusOptions)` and optional isConnected; it is NOT a target-supplier function or existing boolean-predicate option. Release checks top-stack ownership, document interaction, target eligibility and whether focus is still body/inside the owned panel/root, then calls target.focus. A custom focus callback is supported by that structural FocusTarget boundary.

Use a private return target proxy's focus callback to apply close intent; do not invent an environment option or pass a supplier as returnFocus. The proxy must have a dynamic isConnected getter and must recheck the ORIGINAL captured native target's ownerDocument, connection, disabled/hidden/inert/input-hidden/rect/CSS visibility and current document focus/visibility before delegating. A plain `{focus: callback}` would lose native target eligibility because the environment intentionally permits minimal public FocusTarget proxies; that is insufficient. Preserve environment stack/body/inside ownership and never invoke native target focus directly from cleanup independently of environment release.

The existing private eligibility function can accept a private `requireFocusable` boolean default true: entry selection keeps its settled focusability requirement; the return callback passes false to retain the environment's native focus-target eligibility semantics, including negative tabIndex. No new exported helper/API. Do not currently update the frozen entry owner-document test: its target identity assertion needs the explicit fifth-path release below. Root reviews the moved expectation and its stronger behavioral replacement; no other old assertion/test scope is proposed.

## Wrapper algorithm and source-compatible optional predicate

Add only optional `shouldReturnFocus?(): boolean` to AccessibleFloatingOverlay props and current behaviorRef. No existing caller needs to pass it; entry focus, onClose shape, busy, viewport/frame/observer semantics and portal target remain intact.

Each environment-effect lifetime owns local `live=true` and dismissal `unknown | escape | outside`. canDismiss requires live and !current busy. Captured Escape/outside handlers check the same before any mutation, synchronously record their known reason and then call the current behaviorRef.onClose. Cleanup sets live=false before releasing environment; retired captured environment callbacks cannot publish a new close or reason. Do NOT condition return eligibility on live/mounted during cleanup: cancellation teardown necessarily retires the mount before return evaluation.

Return callback policy:

| Origin / current Surface predicate | Trigger return |
| --- | --- |
| Escape, no supplied predicate | Eligible original target may return |
| Explicit Surface Close / predicate true | Eligible original target may return |
| Escape with supplied predicate | Supplied predicate must be true |
| Outside pointer | Suppressed, even if Surface marks its generic close callback as cancel |
| Successful add/arrange / predicate false | Suppressed |
| Unknown/unrelated teardown, no predicate or predicate false | Suppressed |

The supplied predicate is authoritative, not OR-ed with Escape intent. Otherwise an ignored busy Escape could leave a true private reason that later overrides action=false on accepted completion. Surface cancellation records intent synchronously before onClose; action records no-return synchronously before onClose. Outside always vetoes. Default unknown teardown suppresses return rather than guessing which arbitrary caller action occurred. Keep the native environment eligibility/stack checks as additional requirements.

## Surface lifetime and operation ownership

Within each existing Surface keep a layout-mounted ref and local captured request ownership token; each token owns pending and close intent. Renew on actual request replacement and retire on unmount. Old tokens can be retired without clearing a newer operation. Subscriber request keys continue to remount on new IDs, and store.close still receives the originating ID. A merely recreated inline onClose/dispatch prop is not by itself proof of a new request: preserve ordinary same-request parent rerender compatibility and the atomic hook's existing latest-dispatch seam rather than dropping accepted completion solely because callback identity changed. Callback lifetime is bounded by its captured request token plus mounted state.

- Guard search updates, explicit Close and add/arrange ENTRY before state/callback/dispatcher mutation. No retired unmounted/replaced callback may dispatch or set cancel intent. For action entry require current request membership (view exists/enabled; layout preset belongs to current area choices), no local pending and current lifetime. The atomic gate remains the source of command snapshot/deduplication/status/error behavior.
- Set local pending synchronously before execute. Await the already issued immutable command without pretending to abort it. On successful result, recheck captured owner/lifetime; only a current Surface records action/no-return then calls its captured originating onClose. A retired accepted action may finish successfully but cannot close or reclaim focus for the newer Surface.
- On failure leave current Surface open with its existing gate error/retry behavior; no false accepted close or return. Clear only the initiating token's local pending in finally. A synchronous dispatch-triggered callback cannot cancel through the pending window before React busy commits.
- Explicit Close (ViewAdder's existing heading control) requires current and not pending, sets cancel intent, then calls onClose. LayoutPicker has no heading Close; do not add one. Its wrapper Escape cancellation uses the same guarded cancel callback. Both wrappers receive guarded cancellation onClose plus `shouldReturnFocus={() => currentContext.closeIntent === "cancel"}`. The predicate reads the synchronous captured ownership ref and does NOT require mounted during cleanup.

No close reason is inferred from stale passive cleanup, document.activeElement alone, arbitrary descendants, store resets or workspace dispatcher focus handling. Requests already dispatched retain real acceptance semantics. Atomic hook/gate source stays held; helper dispatch-rebinding/status details must not be claimed fixed by a Surface fence alone.

## Tests-first schedule and proof boundaries

After explicit implementation release, create only the new actual wrapper/subscriber test. Use the actual keyed store selection and actual atomic hook/gate with synthetic dispatch/deferred results; mock only portal/render-document boundary and instrument the environment seam. Real environment compatibility suites remain unchanged. Capture registration options and invoke the returned FocusTarget.focus callback from the synthetic release fixture under documented public-boundary conditions; prove native target eligibility and intent through actual refs/effect cleanup, not a selector/source-string assertion. Existing independent environment tests separately prove stack/body/outside-focus ownership. Prefer adding a delegating actual-environment fixture if its bounded synthetic document can support it without editing shared harnesses; report which variant was exercised.

Meaningful initial regressions on current source:

1. Actual ViewAdder heading Close with eligible trigger returns once; Escape returns for ViewAdder/LayoutPicker. Current search autofocus remains first and has no effect on close policy.
2. Outside dismissal followed by teardown does not focus source trigger; preserve a synthetic destination/body as appropriate. Unknown unmount/store reset and successful add/arrange also suppress trigger return, including action destination at body after content replacement.
3. Hidden/unfocused owner document, disabled/inert/hidden/disconnected/foreign/CSS-hidden/zero-rect original trigger and negative-tabindex eligible trigger exercise proxy safety without weakening native environment policy.
4. Pending actions reject Escape/outside/explicit Close and duplicate retained action activation. Deferred acceptance closes current initiating request once, no return; refusal/rejection keeps current Surface open with local retry/error and no return.
5. Actual store A→B replacement unmounts keyed A: retained A action/Close/query callbacks cannot dispatch or close B. Resolve already issued A accepted/failed operation and require B remains current with no trigger return or focus interference. B current action still executes. Include A→B→A ID reuse to ensure first mount callbacks never revive.
6. Retired environment dismissal callbacks after release cannot close current/new request; current valid outside/Escape still honor busy. No synthetic timer/order assertion is a claim about browser cleanup scheduling.

Then run the new owning suite plus unchanged atomic-command, overlay-hardening, overlay-state-store, overlay-architecture and entry-focus behavior through required heavy wrapper; include unchanged environment-focus tests for the helper contract. Exact actual-config scoped strict typing covers the four original roots plus the explicitly released fifth fixture and dependency diagnostics. Review whitespace/module budgets, freeze all released paths and report failures/native outcomes progressively; root independently observes and owns broad gates/integration.

No test/check/source edits have occurred for this read-only plan. Root subsequently released bounded request/option/view types and atomic hook declarations; these were read and are pinned below. Proposed write scope remains unchanged. Real native/browser focus, workspace destination activation and passive cleanup ordering remain unverified; no live/provider/panel/private data operation is authorized.

## Typed fixture and hook declarations pinned

`ViewAdderOverlayRequest` extends AutomationWindowAdderState (main/right area, anchor, optional targetWindowId) with id and readonly AutomationViewAdderOption[]. The option has view:AutomationViewInstance, group Flow/Evidence/Workspace, groupLabel, placement, scope and disabledReason:string|null. Actual view instance has id,label,type,icon and optional dirty/live/warning state; type `design` and imported Lucide Blocks icon are valid synthetic fixture choices. `LayoutPickerOverlayRequest` has id,area,anchor; arrangement preset is single/two-columns/two-rows/main-sidebar/three-columns/quad. Read actual referenced types rather than inventing an AutomationView contract.

Example new-test-only typed fixture:

```ts
const anchor = { top: 1, right: 10, bottom: 10, left: 1 };
const adder: ViewAdderOverlayRequest = { id: "synthetic-a", area: "main", anchor, options: [{
  view: { id: "design", label: "Synthetic automation", type: "design", icon: Blocks },
  group: "Flow", groupLabel: "This automation", placement: "Main area", scope: "Synthetic scope", disabledReason: null,
}] };
const picker: LayoutPickerOverlayRequest = { id: "synthetic-layout", area: "main", anchor };
```

Dispatcher accepts DeepReadonly<Command> and returns Promise<void>; gate execute returns Promise<boolean>. The hook retains one gate and delegates through a render-updated dispatchRef; execute identity stays stable. Therefore already issued commands remain awaited unchanged, pending deduplication remains the real gate behavior, and mounted same-request dispatch prop rebinding keeps existing semantics. Do not fabricate a new dispatcher owner contract or edit the hook. Actual store/controller selection can use the same createAutomationStudioOverlayStore/createAutomationStudioOverlayController imports already exercised by hardening tests; requests and command call assertions are synthetic.

### Explicit fifth-path fixture-only reconciliation proposal

Propose adding ONLY `apps/web/src/features/automation-studio/workspace/overlays/tests/floating-entry-focus.test.tsx` to the next release. Its owner-document test currently asserts registration returnFocus is the original trigger by object identity. Intent proxy intentionally moves that identity while preserving native target capture.

Strengthen the fixture and that assertion rather than weaken or skip it: make the owner-document trigger a connected native-shaped synthetic candidate with ownerDocument/matches/closest/client rects/visibility so the original target's eligibility is meaningfully exercised. Use typed acquired environment options, observe registration with the same doc/panel/root, invoke its current Escape callback, and configure the synthetic release to invoke returnFocus.focus during actual wrapper cleanup. Require one focus delegation to the ORIGINAL owner-document trigger with preventScroll and zero to the global/foreign trigger. Also make the original target ineligible before release and require no delegation, retaining all existing entry-focus priority/invalid-candidate/hidden/retired assertions. Minimal public FocusTarget proxies in the helper stay supported; this test's captured document activeElement needs native shape to verify native eligibility.

This fifth path changes fixture construction and moved return-target expectation only; it does not change product entry behavior, unrelated old assertions or the public environment. No existing test has been edited during this plan. Root explicitly instructed recording the proposal; actual source/test release still waits for active full Core gates.

Supervisor entry verification status: root independently observed the actual new26+hardening10+environment65=101tests passing/native0/1.18s and source checkpoint0e868679. Two filters in that root run named nonexistent paths, so it does NOT independently verify the worker's121-test architecture/Modal-inclusive claim; the active full suite will cover proper paths. This plan records the distinction and performs no additional checks.
