# s45-f: refusal of a handle renumbered by a reload

## Outcome

Partial. Both owned halves are built and tested: the packet store records the fact, and the refusal says it. The
refusal a model gets from `core.run_node` will not say it until a two-line change is made in
`plan-resolution/resolve-plan-node.ts`, which the brief lists under Must not touch. That change is spelled out below.

## What changed and why

**How the domain knows the page was reloaded.** Every capture carries `evidence.navigation.type`: the Navigation
Timing type of the document, which the page view prints as `ARRIVED reload`. The debug records that the rerun's reset
showed `ARRIVED reload`. Nothing else is recorded. `node-run/replay.ts` `resetPage` writes no marker, and
`node-run/arrival.ts` deliberately ignores a reset. The type alone is not enough, because it persists for the
document's whole life. In the run, both 0062 and 0066 landed on documents of type `reload`. So the store marks a handle
only when both of these hold, which it can check for itself without any timing:
1. A view that replaces a page's handles arrived by reload.
2. The control the dropped handle named (same tag and words) is shown in that view under another handle. This is the
   renumbering.

A control that left the page is never marked. Neither is a drop with no reload, nor a wordless control.

- `domain/src/runtime/llm-evidence/plan-resolution/target-packets.ts` (the packet store):
  - Adds `renumbered` to each Flow: per page, the set of handles marked as above. `markRenumbered` runs before
    `remember` and before a full (non-truncated) `rememberLook`.
  - A handle shown again loses its mark. A page that is let go drops its marks. Marks are capped at 4096 per page.
  - `resolve` still answers `unknown` (or `stale`) for such a handle, and adds `renumberedByReload: true`. This field
    is optional and additive, so `resolve-plan-node.ts` and `next-page-slot.ts` compile unchanged.
  - Header comment added.
- `domain/src/runtime/llm-evidence/tool-rejection.ts`:
  - Adds a new resolver code, `web.handle.renumbered_by_reload`, mapped in `HANDLE_ISSUE_REASONS` to
    **`handle_not_in_packet`**. The reason word is unchanged because Core reads it:
    - `repeat-guard/outcomes.ts` `HANDLE_UNSHOWN` regex;
    - `ui/activity-action/failure-reason.ts` ("FluxIQ was looking at an older view of the page").
  - So the reload sentence goes in `detail.next`, which is set when the reason is `handle_not_in_packet` and `instead`
    carries that code. `next` is read off the codes, so a repeat (`repeated-refusal.ts`) says it again.
  - The sentence: "Nothing was done. The page was reloaded (put back) since the view this handle came from, and the
    reload renumbered its controls, so the handle names nothing now. Look at the page again and use the control's
    current handle from that view."
  - The doc comment on `handle_not_in_packet` is updated.
- `press.ts` and `stable-handles.ts` are unchanged. `press.ts`'s `handleRefusal` is not on the run's path: 0063 and
  0067 came through `core.run_node`, then the plan resolver, then `web.handle.unknown`.
- Tests, each extending an existing file:
  - `plan-resolution/tests/target-packets.test.ts` (+2 tests):
    - A handle shown before a reload, whose control the reloaded view lists under another handle, resolves to
      `{ok:false, code:"unknown", renumberedByReload:true}`. This holds at its location and bare.
    - A handle never shown keeps `{ok:false, code:"unknown"}`.
    - Shown again, the mark clears. A later drop with no reload is not marked.
    - A control that left on reload is not marked, and the same renumbering with no reload is not marked.
  - `tests/tool-rejection-detail.test.ts` (+1 test):
    - The renumbered code gives `handle_not_in_packet`, the handle, and a `next` naming the reload, the renumbering
      and "current handle". It is stable on repeat.
    - The plain `web.handle.unknown` detail is byte-identical to today's (no `next`).

## Wiring still needed (in a forbidden file)

`domain/src/runtime/llm-evidence/plan-resolution/resolve-plan-node.ts` needs two changes:
- Add `"web.handle.renumbered_by_reload"` to `WEB_PLAN_HANDLE_ISSUE_CODES`, directly after `"web.handle.unknown"`.
  The existing coverage test already finds it mapped.
- In `resolveTarget`:
  `if (!resolution.ok) return resolution.renumberedByReload === true ? "web.handle.renumbered_by_reload" : TARGET_ISSUES[resolution.code];`

`next-page-slot.ts` can do the same for its `control` handle if wanted. After that:
- `node-run/run.ts` `handleRefusal` already passes the codes through `instead` into `rejectionDetail`, so the model sees
  the `next` sentence.
- `replay.ts` and `verify.ts` keep `resultReason: handle_not_in_packet`.
- An end-to-end test through `createWebAutomationLlmEvidenceRuntime` should be added with the wiring: look, a reload
  view with the control under a new handle, then `dom-click` with the old handle, expecting `detail.next`.

## Commands run and observed results

- `run-subset.mjs ... s45-f` on the two changed test files, then `node --test` on the two bundles, before the
  implementation: `# pass 14 # fail 2`.
  - Store test: `actual` lacked `renumberedByReload`.
  - Rejection test: `expected 'handle_not_in_packet', actual 'parameters_not_resolved'`.

  This is the fail-first result.
- After the implementation, the same tool on 12 files: both changed tests, plus every test pinning
  `handle_not_in_packet` (`detect-option`, `options`, `covered-press`, `shown-handle-past-cap`, `description`,
  `diagnostic`, `structure/detect`, `stable-handles`), plus `target-packets-look` and `resolve-plan-node`.
  `node --test` on the 12 bundles: `# tests 109 # pass 109 # fail 0`.
- `pnpm.cmd --filter @fluxiq-web-extension/domain check`: exit 0.
- `node scripts/structure-audit.mjs`: **exit 1**, with one violation, which is not mine:
  `apps/extension/src/content/actions/tests/extract-list.test.ts: 809 lines exceeds the 800-line limit`. That file is
  769 lines at HEAD and is being edited by another worker in this tree.
  - My files raise only advisory warnings: `tool-rejection.ts` 710 lines (686 before), `tool-rejection-detail.test.ts`
    435.

## Not verified

- The model-facing refusal end to end. The wiring above is not in place, so no runtime path emits the new code yet.
- That a live `web.browser.navigate` reset to the same URL records `navigation.type` `reload` on every browser. This
  rests on the debug's `ARRIVED reload` observation. No Lab, browser or provider run was made.
- Not run: the full domain test suite, or Core.

## Open questions or contradictions found

- The brief points at `press.ts`'s `handleRefusal`. The run's refusal came through the plan resolver
  (`instead: web.handle.unknown`), so the fix point is the resolver's code table, which is outside this brief's
  ownership.
- Core checks the reason vocabulary (above), so no new reason word was added. Per the brief, the sentence is in
  `detail.next`.
