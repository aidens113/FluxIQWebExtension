# t174-w26: a press on a handle the model was just shown is refused `handle_not_in_packet`

## Outcome

Done. The cause is found at line level and fixed in the domain. Two run-level tests reproduce the live
refusal (`handle_not_in_packet`, `target.39`) against HEAD and pass after the fix. The full domain
suite passes, 987/987.

## Cause

This is not an element cap defect: no cap or ranking was changed. The cap is only why the second look
differed. The defect is that a look the model is never shown replaced the packet the model was shown.

1. `domain/src/runtime/llm-evidence/node-run/run.ts:259` (HEAD). Before resolving handles, every
   acting node call captures the page (`current = await currentPage(...)`) and then calls
   `run.shown(current)`. That look is never returned to the model: a success returns the look after
   the action, and a refusal returns no page or a newly captured one.
2. `domain/src/runtime/llm-evidence/tools.ts:259-262`. `shown` calls
   `targetPackets.remember(scope, snapshot)`.
3. `domain/src/runtime/llm-evidence/plan-resolution/target-packets.ts:75-88` (HEAD). `remember`
   builds the page's handle map only from that capture's elements, then does
   `flow.pages.delete(location); flow.pages.set(location, targets)`. This replaces the page's whole
   map.
4. The sanitizer describes at most `WEB_LLM_EVIDENCE_BOUNDS.elements` (40) controls
   (`sanitize.ts`, loop `if (elements.length >= ...) break`). If a control appears above the filter,
   the look ends one element earlier. The shown handle then drops out of the store, and
   `resolveWebPlanNode` returns `web.handle.unknown`. That maps to `handle_not_in_packet`
   (`tool-rejection.ts:505`), and the refusal detail matches the dump exactly: instead
   `["web.handle.unknown","web.handle.unknown:target",...]`.

Stable handles (`stable-handles.ts`) give each handle one address for the whole Flow. So remembering
the look before acting never refreshed a handle's selector. Its only possible effect on shown
handles was to forget them.

## Evidence (dump `build-2026-09-30T19-13-53-677Z-12744.jsonl`)

- nav5 (`dom-click target.51`, succeeded) returned `elementTotal: 293` with 40 elements and
  `truncated: true`. The last two elements were `{"target":"target.87","tag":"div","text":"Voltbay","landmark":"complementary"}`
  and `target.88` "OK". Its routeState controls end `... Qinport | Voltbay | OK`, and the state
  digest is `web-state.v1:10440:a3ba75b6`.
- nav7 (`dom-click target.87`) was refused `handle_not_in_packet`. Its before-state digest is
  `web-state.v1:10417:482dc37`, and its routeState controls add `Not now | Allow` (a notice) after
  `Accept all` and end at `... Hubsmith | Lumora | Qinport`. The look before acting therefore
  described two more controls ahead of the filter, and the cap of 40 cut Voltbay and OK. That look
  replaced nav5's packet in the store.
- nav16 to nav17 has the same shape: nav16's packet showed target.87 and nav17's look before
  acting did not reach it.

## Fix

- `plan-resolution/target-packets.ts`: new `rememberLook(scope, binding)`, for a look the model is
  not shown. If the look described the whole page (`evidence.truncated` false), it replaces the
  page's handles as `remember` does, because a missing control really has left the page. If the look
  was cut short (by elements, capture or budget), its handles are merged into the page's handles and
  none is forgotten. The shared bookkeeping is factored into `targetsOf` and `keep`, and `remember`
  is unchanged in behaviour.
- `node-run/context.ts`: `WebNodeRun.looked`.
- `tools.ts`: the `looked` callback calls `targetPackets.rememberLook` and `addresses.saw`, as
  before. It no longer sets `returnedEvidence`, so a detection binds handles only through a packet
  that was actually shown.
- `node-run/run.ts`: the look before acting goes to `run.looked(current)`. The `address_not_shown`
  refusal returns `current` to the model, so that path now calls `run.shown(current)`.
- `node-run/observed-control.ts` (new, moved out of run.ts): the control name and kind used for
  permission wording and the outcome's `control`. When the look before acting does not describe the
  handle, it falls back to the resolved `element` identity, so the Voltbay press still reports
  `control: "Voltbay"`. The move also keeps run.ts under the 800-line limit (782 lines).
- `tests/tool-rejection-detail.test.ts`: comment only, updated to name `run.looked` and the
  complete-look rule.

## Tests (failing before the fix, passing after)

- `domain/src/runtime/llm-evidence/node-run/tests/shown-handle-past-cap.test.ts`
  1. The packet shown ends at Voltbay (40 of 47), then a notice appears, then the press on Voltbay
     succeeds, clicks its selector, and reports `control: "Voltbay"`.
  2. The live nav5 to nav7 sequence: a press returns a packet that shows Voltbay, and the next
     press's look before acting (notice up) does not reach it. The press on Voltbay succeeds.
  - Against HEAD sources (a scratch copy of `src` with the four HEAD files restored), both failed
    with `{"code":"target_unobserved","detail":{"reason":"handle_not_in_packet","target":"target.39",...}}`,
    the live refusal. After the fix both pass.
- `domain/src/runtime/llm-evidence/plan-resolution/tests/target-packets-look.test.ts` (store
  level, stable numbering): a cut-short look keeps the shown `target.40` (`#voltbay`) and adds the
  notice's `target.41`, and a complete look replaces (`target.2` becomes `unknown`). Against HEAD
  this cannot run, because `rememberLook` does not exist there.
- A first fix that stopped remembering the look before acting altogether broke 10 existing tests.
  They rely on that look making controls pressable without a prior free look (tools.test.ts
  "presses any observed control...", page-refusal, person-needed, tool-rejection-detail). The
  additive-when-cut-short design keeps all of them passing unchanged.

## Commands run and observed results

- `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t174 w26 domain" pnpm --filter @fluxiq-web-extension/domain test`
  exited 0. Summed over files: tests 987, pass 987, fail 0.
- `pnpm --filter @fluxiq-web-extension/domain check` exited 0, with 0 `error TS`.
- `node scripts/structure-audit.mjs` reported 1 violation:
  `[working-docs] docs/working/README.md is out of date with the documents' header blocks`. My diff
  touches nothing under `docs/working/` except this report, so the violation is not from this
  change. An earlier intermediate state of run.ts had tripped `[file-lines]` at 808; that is fixed
  (782).
- Targeted iteration: a scratch esbuild runner bundled and ran single test files
  (`scratchpad/w26-one.mjs`, output under the ignored `domain/.test-build-scratch/t174-w26-one`).

## Not verified

- No live or Lab run (the brief forbids it). Whether the next crossborder run presses the Voltbay
  filter is not proven.
- The extension suite was not run, because no extension file changed.
- `apps/extension/src/content/**` capture and the scenario filter markup were not inspected. The
  dump showed that the capture gave target.87 a selector (nav5's packet bound it), so the capture was
  not the cause.

## Open questions or contradictions found

- There is a separate, older gap: a bare handle issued on page A still resolves while the call acts
  on page B (the resolver searches every remembered page). A step in tool-rejection-detail's
  "moved" case was refused only because the page's handles had been dropped first. That is
  unchanged here, and worth its own brief.
- `node-run/replay.ts:321-322` registers its capture with `run.shown` even when the packet is too
  large to return. This is the same class of defect in a narrow case, and it is not changed here.
- `docs/working/README.md` is stale per the structure audit and needs a supervisor
  `pnpm structure:baseline`.
