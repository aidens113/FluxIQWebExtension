# t748-u1-dialog-view: a candidate's step stands where the step before it left the page

## Outcome

Done. A Flow that opens an item's dialog with a press and then presses a handle last shown on
the item's standalone page at the same address now resolves to the dialog's control. The saved step carries the
dialog's context, and its identity is the one exploration's first press in the dialog found. A Flow that navigates to
the item's address still resolves the same handle to the standalone page's control. That step keeps the words the page
showed last, never the words an undo press there found. Nothing else changes: the page store is untouched, and the new
rule applies only to candidate submissions (`view_history`), only to a control inside a dialog, and only where the
pages name a different control or none.

## Why t743's d5 broke photo-dialog-destination (mechanism)

d5 kept the dialog view and the standalone page as two views, and keyed the acted identity by handle plus address
(`actedKey`), keeping the first act at each address. In the spec, the build first likes the post inside the dialog,
which is `act-2` at the dialog's address. It then loads the post's own page, where the Like control shows "Unlike"
because the build liked it, and presses it under `undoes`. Stable handles give both controls one handle. The undo was
therefore the first act at the standalone address, and d5 recorded the control's identity there as "Unlike": the state
the build's own Like had left. The Flow's step names that handle after a navigation to the post's own page. It resolves
to the standalone control, so d5 lent it the "Unlike" identity. The trial pressed the right element (the selector was
right), but the step was saved as "Unlike".

At HEAD, `acted` keeps only the handle's first act (the Like in the dialog). It lends that identity only at the address
that act named. So the standalone control kept the identity its views agree on, with the newest view lending its words
("Like"). The lead's summary said "a press in the dialog view overrode the view shown last". The actual override was by
the undo press on the standalone page, the first act at that address. I reproduced it: with d5's `target-packets.ts`
swapped in, the new test "loads the dish's own page" fails with `expected: 'Save'`, `actual: 'Saved'`.

What I kept from d5:
- the generic recipe-site fixture;
- the idea of a dialog view keyed by location plus the set of dialog names;
- `shownIn` naming that view.

What I dropped:
- replacing the per-location page store with views, which changed every resolution path;
- keeping the acted identity per address.

## What changed and why

The design follows the step before. Core resolves a candidate plan node by node, in plan order, awaiting each node
(`plan-parameter-resolution.ts`: page facts first, then each Subflow's nodes). It passes no node key and no previous
node. So the domain tracks where the plan stands across those calls.

- `domain/src/runtime/llm-evidence/plan-resolution/step-views/views.ts` (new, `createWebLlmStepViews`). Per Flow it
  keeps three things:
  - **Dialog views.** These are keyed by location plus the sorted dialog names. Each holds only the controls inside a
    dialog, from the newest capture, merged with the store's `acrossView`. A look cut short only adds controls. At most
    8 views are kept.
  - **Where each exploration press led.** This is the dialog view of the page the press left, or none. At most 4096
    entries are kept.
  - **The view the candidate step being resolved stands in.** Any capture, any exploration act, and any resolution
    outside a candidate submission reset it.
- `step-views/move.ts` (new, `webPlanStepMove`) says how one step moves where the next one stands:
  - a `web.dom.click` naming a handle is `{press}`;
  - observe actions and in-place acts (type, clear, select, scroll, check, upload) are `stays`;
  - everything else is `moves`: navigation, keypress, next page, tab, browser dialog, download, a page fact, a non-web
    node, or a click with no handle.
- `step-views/index.ts`: the barrel.
- `target-packets.ts`, 704 to 764 lines:
  - It has a new `followed(scope, move)` method, and a new FlowPages field `steps`.
  - `remember` and `rememberLook` feed `steps.captured` with the capture number the view history now returns.
  - `acted` records where every press led before its first-act-only early return. The acted identity rule is unchanged.
  - `acting`, `resolveOn` and a resolution outside `view_history` reset the standing view.
  - Under `view_history`, `inStandingView` swaps in the standing dialog view's control for the handle. It does so only
    when that control sits in a dialog, is not shared, and the pages resolve to another address or fail. `shownIn` is
    that view. `actedAs` then lends the dialog press's identity because the address matches.
  - `resolveFromHistory` no longer overwrites a `shownIn` that is already set.
  - The header has a new section, which also records why d5's per-address acted identity was not kept.
- `view-history.ts`: `record` returns the capture's number. It used to return `void`.
- `resolve-plan-node.ts`, 792 to 799 lines: `resolveWebPlanNode` wraps the old body (now `resolveNodeOnce`). Under
  `view_history` it calls `targets.followed(input, webPlanStepMove(actingStep(...)))` after every node, refused nodes
  included. This file is now 1 line under the 800-line limit.
- `tests/dialog-identity.test.ts`: four tests added on a recipe site. They are here rather than in a new file because
  `plan-resolution/` and its `tests/` were both at the audit's 25-file limit. Each Flow is resolved node by node through
  `resolveWebPlanNodeParameters` with `handleReach: "view_history"`.
  1. **(a)** Navigate to the cook's page, press card `t2`, press `t4`. The step resolves to the dialog's Save, with
     `context: {dialog}` and the name "Save" (as the press found it, not "Saved"), and `handleViews` points to view 3,
     the dialog's newest capture.
  2. **(b), the d5 regression.** Navigate to the dish's address, press `t4`. The step resolves to the own page's Save,
     with no dialog and the name "Save" (the view shown last), not the undo's "Saved".
  3. A capture step between the card and the Save keeps the dialog. A keypress, or an exploration capture between plan
     resolutions, starts again and resolves to the own page.
  4. Without a step before it, a candidate, `resolve` and `resolveOn` all resolve to the own page, as before.
- `docs/architecture/build-loop.md`: the t743 known-limit paragraph is rewritten to describe the new behaviour and the
  limit that remains.

## Commands run and observed results

- **Tests first, against HEAD.** I copied my versions of `target-packets.ts`, `resolve-plan-node.ts` and
  `view-history.ts` to the scratchpad (`u1-mine-*.ts`). I wrote the HEAD versions in place with `git show HEAD:...`,
  ran the tests, and copied mine back. `git status` afterwards showed only my edits. Command:
  `DOMAIN_TEST_BUILD_LABEL=t748-u1 node scripts/test-domain.mjs plan-resolution/tests/dialog-identity`. Result:
  `not ok 5` (a) with `expected: 'body > div:nth-of-type(2) > article > section > div:nth-of-type(1)'` and
  `actual: 'main > article > section > div:nth-of-type(1)'`, and `not ok 7` failing the same way. Tests 6 and 8 pass on
  HEAD, as expected, since they guard behaviour that was kept. `# pass 6`, `# fail 2`.
- **d5 regression reproduced.** I applied the d5 patch to `target-packets.ts` only, ran the same tests (then in their
  first file, `step-views.test.ts`), and restored the file. Result: (a) failed, and (b) failed with
  `expected: 'Save'`, `actual: 'Saved'`.
- `cd domain && DOMAIN_TEST_BUILD_LABEL=t748-u1 node scripts/test-domain.mjs plan-resolution/tests node-run/tests`:
  `# tests 444`, `# pass 444`, `# fail 0`, `# cancelled 0`. HEAD has 440.
- `npx tsc -p tsconfig.json --noEmit`: exit 0. `npx tsc -p tsconfig.test.json --noEmit`: exit 0.
- `node scripts/structure-audit.mjs` at D root: `structure-audit: passed (218 warning(s), 618 baselined).` My files
  appear only in the advisory file-lines warnings: `resolve-plan-node.ts` at 799 (the audit ran at 800, before a
  one-line trim) and `target-packets.ts` at 764. A first run failed `directory-files` (27 and 26 files against a limit
  of 25), which is why the new code moved to `step-views/` and the tests into `dialog-identity.test.ts`.
- `cd apps/extension && node scripts/build-extension.mjs`: `chrome: verified 22 files`, `firefox: verified 22 files`,
  `e2e-chromium: verified 22 files`.
- Headed Playwright run of photo-dialog-destination and photo-toggle:
  `node --no-experimental-strip-types node_modules/@playwright/test/cli.js test -c e2e/playwright.config.ts e2e/site-reset/tests/photo-dialog-destination.spec.ts e2e/site-reset/tests/photo-toggle.spec.ts --workers=1 --reporter=list --output <scratch>/t748-u1-e2e-1`
  - Overall: `ok 1 ... photo-dialog-destination.spec.ts ... (1.2m)`, `ok 2 ... photo-toggle.spec.ts ... (1.3m)`,
    `2 passed (4.8m)`, exit 0.
  - photo-dialog-destination's diagnostic shows tests `["yes","candidate.trial_reset_required","yes"]` and ending
    `proposed`.
  - Its `reset-photo-dialog.json` gives `{"cell":"t116","like":"t593","ownLike":"t593"}`. The dialog's Like and the
    own page's Like do share one handle, which is the aliasing the mechanism above depends on.
  - The log and output are in the scratchpad at `t748/t748-u1-e2e-1.log` and `t748/t748-u1-e2e-1/`.

## Not verified

- No live Lab run and no replay of rerun round 4's photo builder. Neither spec writes the Flow that opens the dialog
  and then presses the handle last shown on the standalone page. photo-dialog-destination deliberately writes its Flow
  on the own page, and photo-toggle submits before leaving the dialog. So the fixed path is proven by unit tests only,
  and these specs prove that existing behaviour holds.
- No whole-package domain suite (narrow checks only, per the brief).

## Open questions or contradictions found

- **A plan's start is not signalled.** Core does not say where a plan begins. A plan's first step can press a handle
  shown both in a dialog and on the standalone page, with no navigation and no page fact before it. If that plan is
  resolved straight after another plan, with no capture, exploration act or non-candidate resolution between them, it
  follows on from the earlier plan's last step. An extended Flow's inherited nodes are also invisible: Core skips
  inherited nodes that declare nothing and name no handle, so an inherited navigation does not reset the standing view.
  Both need a dialog-aliased handle to matter. A Core field such as a plan-start marker or the previous node on the
  resolution input would close both. That is outside this lane.
- **Branching Flows.** Plan order is used as step order. In a Flow whose nodes branch, the node listed before a press
  may not be the step that runs before it. The rule still applies only to a control inside the dialog the listed
  predecessor's press opened.
- **The lead's description.** The lead's wording of the d5 failure ("a press in the dialog view overrode the view shown
  last") does not match the reproduced mechanism, which was the undo press at the standalone address. See above.
- `stable-handles.ts` was not changed. Per-document handles would not have fixed (a) on their own: the builder named the
  handle it saw last, on the standalone page.
