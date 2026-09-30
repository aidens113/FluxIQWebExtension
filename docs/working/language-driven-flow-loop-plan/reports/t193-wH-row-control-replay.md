# t193-wH: replaying a row control and a label that carries state

Brief: t193-wH-replay-of-a-row-control-and-a-stateful-label. Evidence: live run
`run-munri5gr-94d7f8a0` (bigbox-retail), in
`test-runs/instances/t193-slot-2/run-munri5gr-94d7f8a0/`.

## Outcome

**Done.** Both defects are reproduced at DOM level (a hand-built shadow-root
store chooser, taken end to end through the domain's evidence runtime, Core's
target normalizer, the gateway mapping and `resolveTarget`) and fixed where the
fault is:

- **Step 8 (`set.store.millbrook`, `core.replay.failed`).** The created node's
  identity carried no `context.record`. It now carries the card's words. A
  strategy's count is also taken only inside the recorded record, so a card that
  is gone reads as not found, not as ambiguous.
- **Step 7 (`open.store.picker.2`, `core.replay.unreproducible`).** The recorded
  name "Pickup or delivery?Carden Falls Supercenter" is the reason the chip was
  not found. The chip is now found by the stable part of its name, and only when
  it is the one visible control in the recorded root that reads that way.

One limit is left open, and it is outside my paths: a record the page **keyed**
(`data-id` and the like) still travels no record on a created node. See Open
questions 1.

## What the run's steps carried, and why they replayed as they did

The bundle redacts targets, so the identities below are rebuilt from code. The
DOM rows prove them (`store-chooser-replay.test.ts`, first row).

**The packet handle and the identity.** `sanitize.ts` keeps each handle's
selector, record address and host chain in the binding. It publishes the
record's words on the packet element only as `within`, and only on look-alikes
(`look-alikes.ts`). `target-packets.ts:81` builds the identity with
`webPlanElementIdentity(element, selector, binding.shadowHosts?.get(...))`.
Before this change, `element-identity.ts` copied only tag, role, name, text,
selector, input type and `context.{formId, listPosition, shadowHosts}`. The
binding's `records` never reached it.

- **Step 7, the chip.** Selector `button`: the chip is the only button among the
  shadow root's top-level children, and `selectorFor` writes no position for it.
  Host chain `body > header > div > vr-fulfillment-picker`, `accessibleName`
  "Pickup or delivery?Carden Falls Supercenter", and no `visibleText`, because
  the packet does not repeat text that equals the name. No record.
- **Step 8, Millbrook's "Set as my store".** Selector
  `div > ul > li:nth-of-type(3) > button`, the same host chain, `accessibleName`
  "Set as my store". **No `context.record`**, even though the packet had shown
  the card's words as `within` so that the model could choose between the cards.

**Why step 8 was `failed`, not `unreproducible`.** Server-side, the store was
already Millbrook. The third card therefore holds `<span>Your store</span>` and
no button, so the positional selector matched nothing. The fingerprint strategy
had no `visibleText` to scan for, so it matched nothing either. Level 2 then
enumerated the button family in the root: the chip plus the other three stores'
identical buttons. The three tied, which gave `scoredAmbiguous`, which gives
TARGET_AMBIGUOUS. `replay.ts:211` treats only TARGET_NOT_FOUND as
`unreproducible`, so the step was `failed`.

Observed with the domain fix reverted: `actual: 'web.target.ambiguous'`, with
the flyout closed and with it open. For a recorded step, which does carry
`visibleText`, the same page reaches the three buttons one level earlier, as the
text strategy's count of three. That is TARGET_AMBIGUOUS again, even with the
record present, because the count ignored the record. Observed with the
resolver's count gate reverted: `actual: 'web.target.ambiguous'`.

**Why step 7 could not find the chip.** The cause is the recorded name. With
Millbrook chosen, the selector `button` found four buttons in the root. The
visibility gate kept only the chip, because the flyout was hidden. The veto then
refused the chip. Observed with the fix reverted: `refused button "Pickup or
delivery?Millbrook Crossing Su" scoring 0.36 with nothing the recording named
agreeing exactly`. The fingerprint strategy found the chip again and refused it
again. Level 2 answered `nothing matched; 4 control(s) of the same family are on
the page; best scored 0.36`. The only distinguishing signal the recording
carried was the name, and the name *is* the state. The 5.5 s is the extension's
recovery ladder on a TARGET_NOT_FOUND, as t174-w2 established.

## A fresh page (store back to Carden Falls), which is what playback meets

- **Step 7** finds the chip exactly, because the name agrees. This held before
  the fix as well.
- **Step 8** presses Millbrook's button. The positional selector lands in the
  third card, which is Millbrook's, and the name agrees. It is **not**
  ambiguous, and this also held before the fix. What the fix adds is protection
  when the cards move: with the cards reordered, the pre-fix identity pressed
  whichever store sat third. Observed with the domain fix reverted: the row
  resolved to a different button. It now presses Millbrook's.
- On a **second** playback, with Millbrook already chosen, the pre-fix step 7
  failed: the Flow broke on its second run because its first run had worked. It
  now passes. Step 8 then answers TARGET_NOT_FOUND, because Millbrook's card
  holds no button. See Open questions 2.

## What changed and why

- `domain/src/runtime/llm-evidence/plan-resolution/element-identity.ts`: the
  identity now carries `context.record = { text }`, taken from the packet
  element's `within` when the packet did not cut it (the same `uncut` rule as
  the name). That is the key a recorded node already carries.
  `output-nodes/targets` `elementRecord` passes it to the page unchanged.
- `apps/extension/src/content/action-runtime/resolve-target.ts`:
  - When a strategy matches several elements, only those in the recorded record
    are counted (`inRecordedRecord`). If every match is in another record, the
    strategy is a miss ("N matched, each in another record"). A lone match still
    goes to the veto's record refusal, as before.
  - When the veto refuses an exact strategy's lone answer by its score (not by
    its record), `stableNameMatch` asks for the stable-name reading. It accepts
    only if the reading passes `vetoCandidate`'s own two rules, and only if
    exactly one visible, enabled control of the recorded family in the recorded
    scope reads the same way. A truncated enumeration answers no.
- `apps/extension/src/content/identity/stable-name.ts` (new), exported from
  `identity/index.ts`: `stableNameReading`. The candidate must be named by its
  content, in two or more text runs. The recorded name must equal those runs
  with exactly one *whole* run replaced by something else. The kept part must
  hold at least 3 letters, and there must be exactly one such reading. Both the
  recording and the candidate are then described by the kept part, so Core's
  matcher can score them. The module decides nothing itself.
- Tests:
  - `domain/.../plan-resolution/tests/record-identity.test.ts` (3 rows): the card
    rides through the normalizer and the gateway mapping; the chip carries none;
    words the packet cut are not carried.
  - `apps/extension/src/content/action-runtime/tests/store-chooser-replay.test.ts`
    (15 rows, with subtests) and its support page
    `tests/store-chooser-page.ts`. The support page is a hand-built DOM with a
    small selector engine that throws on anything it cannot read.
  - `apps/extension/src/content/identity/tests/stable-name.test.ts` (10 rows):
    the reading's rules one at a time.

## Commands run and observed results

- Focused runs, bundled with esbuild into each package's ignored
  `.test-build-scratch/t193-wh-focus/` and run with `node --test`:
  - `record-identity.test.ts`: 3/3 pass. With `record: recordOf(element)`
    replaced by `undefined`: "Millbrook's Set as my store carries Millbrook's
    card" ✖, pass 2 fail 1.
  - `store-chooser-replay.test.ts`, final: pass 15 fail 0.
    - R1 (stable-name reading disabled): step-7 row ✖, with the not-found text
      quoted above.
    - R2 (count gate disabled): both subtests of "a recorded step, carrying the
      button's text, also reads the missing card as missing" ✖,
      `actual: 'web.target.ambiguous'`; pass 12 fail 3.
    - R3 (domain record reverted): 4 ✖. "what the draft kept" (record
      `undefined`); dry-run step 8, flyout closed and open,
      `actual: 'web.target.ambiguous'`; and the reordered cards (wrong element).
    - Uniqueness condition removed: the "two buttons … a tie" row ✖,
      `actual: undefined`.
    - Every file was restored after each reversion; `cmp` confirmed it.
  - `stable-name.test.ts`: 10/10 pass. One row of mine was wrong on the first
    run ("$4.99 each" keeps "each", which is four letters). I corrected the row;
    the rule did not change.
- `bash …/heavy.sh "t193-wH domain check" pnpm --filter @fluxiq-web-extension/domain check`:
  exit 0.
- `bash …/heavy.sh "t193-wH extension check" pnpm --filter @fluxiq-web-extension/extension check`:
  - First run: exit 1. Its tsc steps were not the failure; the bundle step was:
    `Could not resolve "fluxiq/automation-studio/nodes"`, because
    `dist/…/nodes/index.js` was absent from the shared Core worktree. Minutes
    later `dist/programs/automation-studio/nodes` existed, so another lane was
    rebuilding Core.
  - Rerun: exit 0.
  - tsc on its own (`tsconfig.json --noEmit`, `tsconfig.test.json`): exit 0.
    This was after I fixed one type error in my test.
- `DOMAIN_TEST_BUILD_LABEL=t193-wh bash …/heavy.sh "t193-wH domain suite" node scripts/test-domain.mjs`:
  exit 0, `# tests 942 # pass 942 # fail 0`, no `not ok`, no load failures.
- `EXTENSION_TEST_BUILD_LABEL=t193-wh bash …/heavy.sh "t193-wH extension suite" pnpm test`:
  - First run: 1350/1352. Two `landmark-role.test.ts` rows failed because
    my stub page's `document` leaked. Installing it twice in one test made the
    second restore put back the first stub. Fixed: the originals are captured
    once per test and restored idempotently. I also scoped the unit file's
    globals per row, because a top-level hook spans the whole process.
  - Rerun: exit 0, smoke test passed, `# tests 1352 # pass 1352 # fail 0`.
- `bash …/heavy.sh "t193-wH structure audit" node scripts/structure-audit.mjs`:
  `structure-audit: passed (125 warning(s), 120 baselined)`. The only touched
  file with a warning is `resolve-target.ts` at 778 lines, past the advisory
  400-line threshold. It was already past it (702) and is baselined.

## Not verified

- No browser, Lab or Playwright run, per the brief. The rows use a hand-built
  DOM, and real layout, `innerText` or computed styles could differ. For
  example, a real `boundedText(textContent)` for the chip reads without a space
  between the spans, and the stub does the same. Hidden-flyout visibility is
  modelled as a zero box.
- I did not read the extension's recovery ladder, so the 1.3 s of `failed`
  (ambiguous is not retried) versus 5.5 s of `unreproducible` (not-found is
  retried) is inferred from the timings and from t174-w2, not traced.
- Step 18 (`dismiss.dialog.18`, `failed`) and step 13 (`unreproducible` in dry
  run 2 only) were not investigated. Step 18's `failed` would still block
  completion in this run.
- I did not run the whole repository's `pnpm check`, `pnpm test` or `pnpm build`.

## What the dry-run gate should do with a state-setting step whose effect already holds (brief item 4; no Core edit)

After this change the dry-run page (Millbrook already chosen) replays step 7 as
`replayed`. Step 8 comes back **`unreproducible`**: TARGET_NOT_FOUND, because
Millbrook's card holds "Your store" and no button. That is the correct word:
the reset (`replay.ts` `resetPage`, a navigation) cannot undo a server-side
effect, and `replay.ts:211` maps exactly TARGET_NOT_FOUND to it. Because a
missing record no longer reads as ambiguous, the record gate now keeps
`unreproducible` from being a mask for another row's control.

What Core does today:

- `flow-draft/dry-run.ts:176-184`
  (`automationStudioFlowDraftReplayOutcomeBlocks`) blocks every `unreproducible`
  that is not yet in `asked`.
- `llm/node-tools/dry-run-gate.ts:65-95` adds a step to `asked` only after it
  has been fed back once.

So the build pays one full refusal round. The instruction text
(`dry-run.ts` `DRY_RUN_INSTRUCTION`) then offers the model `optional`,
`only_if`, "finish again with it kept", or dropping the step. In this run the
model amended after the refusal, and the next completion check failed
`bootstrap.instructed_act_missing` (core.log line 138), which is the cost of
steering the model toward editing a step it needed.

Recommendation, for t174/t195's lane to decide:

1. **Do not block on an `unreproducible` whose step declared a lasting effect**
   (a state-setting press). Carry it as "effect already held on replay; not
   re-proved", accept the draft if every later step replayed, and do not spend
   the `asked` round on it. The later steps are the proof that the state the
   step sets was in place, because they ran on it: step 9's search and the
   cart steps replayed.
2. **Do not push the model to make it `optional` or delete it.** A fresh
   session needs it: playback meets Carden Falls, and the fresh-page row shows
   step 8 pressing Millbrook's button there.
3. **Let the domain say which kind of "not found" it was, so this does not also
   wave through a real miss.** "The recorded record is present, but its control
   is gone" (the card is here and holds "Your store") is distinct from "the
   record is gone". The page can tell them apart from the recorded
   `context.record`. A distinct `resultReason` on the replay answer would let
   the gate accept only the first. This is not implemented: it needs a new
   failure detail through `action-failure/refusal.ts` and a gate rule, which
   are outside my paths.

## Open questions or contradictions found

1. **Keyed records travel no record on a created node.** `element-identity.ts`
   has only the packet element. The binding's `records` map, which holds the key
   *or* the words, is passed nowhere: `target-packets.ts:81` calls
   `webPlanElementIdentity(element, selector, binding.shadowHosts?.get(element.target))`.
   A row keyed by `data-id` publishes no `within`, so its created node is still
   replayed by position alone. The fix is one argument at that call site plus
   parsing the address in `element-identity.ts`, whose format is private to
   `elements.ts` (`recordAddress`, separator U+001F).
   - `target-packets.ts` is not in my Owns list, so I did not edit it.
   - `within` is also cut at 80 characters, whereas the extension's record text
     runs to 160. A card with longer words carries no record, fail-safe as
     before.
2. **Playback, as well as the dry run, meets the "effect already holds" case.**
   A Flow played a second time, with Millbrook already chosen, now finds the
   chip, then fails step 8 with TARGET_NOT_FOUND. The Flow needs an answer too,
   such as an `only_if` check that the chip names Millbrook. That is the
   model's to write, or Core's to route.
3. **`agreedIdentity` (`target-packets.ts`) compares `context` as a whole.** If
   the same bare handle appears on two remembered pages, with `within` on one
   and not the other, the whole context is dropped, `shadowHosts` included.
   Before, context held only stable fields. I found no case in this run, but a
   per-field agreement would be safer.
4. **Residual looseness of the stable-name reading, stated plainly.** A button
   whose varying run is an *identity* rather than a state is read the same way,
   when it is the only one of its reading left in the scope. An example is
   `<span>Delete</span><span>Project A</span>` with Project A gone and Project B
   in its place. The record gate covers such buttons inside rows. A flat
   toolbar of them is not covered.
