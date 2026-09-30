# t193-wE: look-alike "Set as my store" buttons in a shadow list

## Outcome

Done. The cause was not the scroll window and not the shadow root. The capture
folded the three identical buttons into one example, and the packet then gave
that example no card words. Both are fixed at the lines that own them. One
test in each package reproduces the flyout, and each test was run once with
the fix reverted and failed.

## What changed and why

### Findings (task 1)

The run bundle (`test-runs/instances/t193-slot-2/run-munpjclw-52592f43`) does
not contain the packets. A grep for `Set as my store`, `"repeats"` and
`"within"` over `snapshots/` and `events.ndjson` found nothing, because the
evidence policy keeps page text out. So the packet contents were established
by reproduction, using a Node stub DOM of the flyout
(`apps/extension/src/content/tests/repeat-exemplars.test.ts`). A pre-fix probe
of `repeatExemplars` and `recordIdentity` printed the following.

- Home store (Carden Falls Supercenter) chosen: the Carden Falls Neighborhood
  Market button was `exemplarOf: 3`. The Millbrook Crossing Supercenter and
  Millbrook Crossing Neighborhood Market buttons were `follower: true`.
- After switching to Neighborhood Market: the Carden Falls Supercenter button
  was `exemplarOf: 3`. Both Millbrook buttons were followers.

These are exactly the two wrong stores the model pressed, in the same order.
- `dom-snapshot.ts` `snapshotElements` sorts on `follower` before any other
  key, so followers rank after every distinct element. The domain `sanitize.ts`
  takes the first 40. Only the example reaches the packet, carrying
  `repeats: 3`. (This part is from reading the code; no browser was run.)
- `look-alikes.ts` published `within` only between two or more look-alikes
  that are both in the packet. A lone example therefore carried no words and
  read as "the" Set-as-my-store button.
- There was a second defect, found by the new domain test. Even when all three
  buttons are listed, each one carries `item: {index 2|3|4, total 4}` (from
  `listPosition`). That makes their descriptions differ, so none of them was
  given `within`. "Item 3 of 4" does not name a store.
- Shadow root: `record.ts` walks `parentElement`. The `<li>` card is inside the
  same shadow root as the button, so the walk never needs to leave the root. The
  probe returned each button's card text, for example `{"text":"Millbrook
  Crossing Supercenter88 Ferris Rd, Millbrook · 9.8 miOpen 24 hours"}`.
  `shadowHostChain` already carries the host.
- Overflow window: `shouldIncludeSnapshotElement` filters on `[hidden]`,
  `aria-hidden`, `visualDocumentBounds` (an unclipped `getBoundingClientRect`),
  visibility, display and opacity. Nothing clips to an `overflow:auto`
  ancestor, so a button scrolled out of the list's 320px window is still
  captured. `action-runtime/scroll-element-into-view.ts` calls `scrollIntoView`,
  which also scrolls nested containers. (From reading the code only.)

### Fixes (task 2)

- `apps/extension/src/content/repeat-exemplars.ts`: a run of controls with at
  most `MAX_LISTED_CHOICES = 5` members is no longer folded. There is no search
  or filter that narrows four stores, and listing them costs at most four
  handles. Text, image and wrapper runs still fold, and so do control runs
  above 5 (the scheduler's 280 rows, the 10-row narrowed queue that
  `repeat-exemplars.spec.ts` expects folded, product grids). The module header
  records the reasoning and the run id.
- `domain/src/runtime/llm-evidence/look-alikes.ts`:
  - `dialog` and `within` are decided on `placeFreeDescription`, which is the
    description without `item` and `cell`. A list position no longer stops a
    card's words from being published. `alike` is still decided on the full
    description.
  - An element carrying `repeats` that has no look-alike in the packet (a
    folded example) is given its `within`. `within` is already bounded to 80
    characters and is the field the packet already uses for a row's words, so
    no new field was added.
- `domain/src/runtime/llm-evidence/elements.ts`: the doc comment on `within`
  now covers the example case. There is no code change.

### Tests (task 3)

- `apps/extension/src/content/tests/repeat-exemplars.test.ts` (new): the
  flyout in both store states. Every button is neither a follower nor an
  example, and each one's `recordIdentity` text starts with its own store
  name. The card run still folds (count 4), and a 6-card grid still folds.
- `domain/.../tests/look-alikes.test.ts`, new test "a 'Set as my store' says
  which store it sets ...": with all three listed, each carries `item` and a
  `within` naming its store. When folded, the lone example carries
  `repeats: 3` and `within` (its card words cut to 80 characters). No two
  elements read alike.
- `domain/.../tests/packet-carries-no-selector.test.ts` (existing, changed):
  its "Dismiss note" example (`repeatCount: 3`, record text) now gains
  `within`. `within` was added to `ALLOWED_ELEMENT_KEYS`. The record key and
  key attribute are still asserted absent. The row's words are asserted to
  appear exactly once, as that element's `within`. **This relaxes a stated
  invariant** ("the row's words ... may not reach the packet"), so the
  supervisor should review it. `within` was already how record words reached
  the packet for listed look-alikes.

## Commands run and observed results

- Focused runner (a scratch esbuild-and-`node --test` script, written to
  `.test-build-scratch/t193-we-focus`, since removed):
  - Extension test before the fix: `not ok 1 ... the button for Carden Falls
    Neighborhood Market is made one example of a run ... 3 !== undefined`.
  - After the fix: `# pass 1 # fail 0`.
- Reverting both source files from `git show HEAD:` and re-running:
  - Domain: `not ok 11 ... 'target.1 does not name Carden Falls Neighborhood
    Market: undefined'`.
  - Extension: `not ok 1 ... 3 !== undefined`.
  - Reverting each domain half on its own (the lone-example step, then
    place-free grouping) also gave `# fail 1` each time.
  - Files restored; `git diff --stat` then showed the fixed versions.
- `npx tsc -p tsconfig.json --noEmit` (domain), `npx tsc -p tsconfig.test.json
  --noEmit` (domain) and `npx tsc -p tsconfig.json --noEmit` (extension): all
  exit 0.
- `EXTENSION_TEST_BUILD_LABEL=t193-we bash .../heavy.sh "t193-wE extension
  suite" pnpm test` -> exit 0, `# tests 1219 # pass 1219 # fail 0`.
- `DOMAIN_TEST_BUILD_LABEL=t193-we bash .../heavy.sh "t193-wE domain suite"
  pnpm test` -> exit 0, `# tests 909 # pass 909 # fail 0`. The log shows `ok
  676 - a 'Set as my store' says which store it sets ...` and `ok 682 - no
  selector from a realistic page survives into the packet`.
- `node scripts/structure-audit.mjs` -> `structure-audit: passed (124
  warning(s), 120 baselined)`. None of the warnings is in a file I touched.

## Not verified

- No browser, Playwright or Lab run (the brief forbade them). Not checked
  live:
  - that the three buttons land in the first 40 of the real bigbox ranking. I
    expect bucket 1 through the sticky header's front layer.
  - the overflow-window inclusion and the `scrollIntoView` press.
- `e2e/content/tests/repeat-exemplars.spec.ts` was not run. Its assertions use
  runs of 280 and 10, which are above the new bound.
- The effect of unfolding short control runs on packet budgets on the other
  nine scenarios has not been measured. Where a control run of 5 or fewer was
  folded, it is now listed whole, and more rows now carry `within`.

## Open questions or contradictions found

- The brief's hypotheses (the scroll window, crossing the shadow root) were not
  the cause. The cause was folding in `repeat-exemplars.ts` plus the missing
  `within` rules in `look-alikes.ts`.
- `record.ts` joins text nodes without a separator, which gives
  "Carden Falls Neighborhood Market212 W Mill St". The store name is still
  first, so `within` names it. Adding a space between block elements would
  change the `record.text` of existing recordings, which `agreesWithRecordedRecord`
  compares exactly and fails closed on, so I left it alone. It needs a
  migration decision.
- A record the page gave a key to (`data-*-id`) carries no text, so a folded
  example keyed that way still gets no `within`.
- The threshold of 5 is a judgement call, not a measurement.

## Task 4: the press post-condition (recommendation only, nothing changed)

A `dom-click` result is the after-packet merged with `WebNodeOutcome`
(`domain/.../node-run/run.ts`):

- `ok: true`, `node`, `status: "succeeded"`;
- `pageChanged`: whether the whole sanitized packet differs, so `true` here;
- `pageUnreadable`;
- `control`: the pressed element's `name ?? text` only (`observedControl`),
  which is "Set as my store" and carries no card;
- `read`: reading nodes only;
- `inFlow`.

The result code is `web.action.succeeded`. The button reloads the page
(`client/shell-script.ts`: `mutate('set-store')` then `location.reload()`).
The first capture of the new document marks no element `changed`
(`evidence/changes.ts`). The only signal left was the chip's accessible name in
the after-packet ("Pickup or delivery? Carden Falls Neighborhood Market"). The
model could have compared that with the instruction, but nothing pointed it at
the chip.

Recommendations:

1. Have `observedControl` also return the pressed element's published
   `within`, so the outcome says "Set as my store" in Carden Falls
   Neighborhood Market. That text is already bounded and already published.
2. Carry across a reload which handles' names changed: compare the pre-press
   packet's names by stable handle with the post-press ones, and publish the
   changed handles as a closed list, not as text.
3. Only after 1 and 2: consider a prompt rule in Core's evidence loop that
   "succeeded" means pressed, not that the goal was reached.
