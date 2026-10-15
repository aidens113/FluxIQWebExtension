# t609 trial-acts-name-their-items: the web state diff names a step's spot and the items it made

Worker report. Worktrees: downstream `fxwork/t609/!FluxIQWebExtension` and Core `fxwork/t609/!FluxIQ`, both on
`task/t609-trial-acts-name-their-items`. Nothing is committed. No live run, no Lab run, no provider call.

## Outcome

Done, against the brief's definition of done. Core t598 is now live on the web side:

- The web host runtime's `inspectStateDiff` writes `spot` and `items` on each step's diff.
- The whole-candidate gate carries `spot` and `created` on trial acts.
- A Core step that can make no lasting act (a wait) no longer satisfies a part's asked act.

One audit result needs the supervisor: Core's structure audit fails on one rule, `working-docs` (`docs/working/README.md`
is out of date). I touched no Core docs, so I believe the failure was already there on the branch base `ef68a8a6`. I did
not check that against the base. See Open questions, item 1.

## What changed and why

### Decision (brief item 2): list items only for lists present on both pages

I chose this rule over a per-line token. My reasons:

- **A per-line token cannot solve the re-add case.** A build-wide filter strips a re-add of an item that exploration
  added and then undid, because the item's token is the same both times. A per-line token does not change that:
  - an item named by its words gets the same words again;
  - an ordinal repeats.
  A per-line token also needs a Core-side filter in `landed-acts.ts`, which this brief does not own.
- **Vouching per step needs no memory across steps.** A re-add to a list on the page is a new item of that list,
  whatever an earlier step did. So Core's within-trial filter stays exactly as t598 left it.

What a "list" is (`domain/src/runtime/state-diff/places/snapshot.ts`):

- **Item.** A record: a row, a card, or a list line. Its token is `webControlSpotToken("item", record)`, the same token
  a declaration and `startState` use.
- **Container.** For each item, the nearest listed ancestor that also holds another item.
- **List.** That container (keyed by frame and selector) plus the *shape* of the way down to the item:
  - the tag and class of each wrapper in between;
  - the item's own tag and role, but not its class, so a line the site marks `is-new` stays one of the list's lines.
- **Why the shape.** Without it, a single pre-existing loan in a drawer that the step opened shares its nearest container
  (the page body) with a single "recently viewed" card. The drawer's lines would then read as created. The test for this
  case fails with the shape rule disabled; I checked.

When a list counts (`places/diff.ts`):

- The page before showed the same list with at least one item, and every one of those items is still in the list on the
  page after. Only then are the list's new items the step's.
- Everything else is left out of both `before` and `after`, so Core can count none of it as created. That covers three
  cases:
  - a revealed drawer;
  - a list that lost an item, or changed one in the same step. An unkeyed line's token is its words, so a quantity change
    reads as another item;
  - a list whose single unkeyed line had no name before. The extension names an unkeyed record only when it is one of
    several, so that line and a new one both gain names at once, and the pre-existing line would otherwise read as new.
- A move to another document vouches for no list, so `items` is omitted there. `spot` is still written.
- More than 2,000 items (Core's bound) writes none.

Cost of the rule, which is conservative on purpose:

- A list that goes from one item to two is not credited.
- An empty list's first item is not credited.
- Such an act is recorded with only its `spot`, as it is today. That is a miss, never a deletion of something that
  existed before the build.

### Downstream

- **`state-diff/places/`** is a new module, with its barrel exported through `state-diff/index.ts`. Its files:
  - `snapshot.ts`: a capture's lists, and the handles of its elements that sit in an item or a dialog.
  - `diff.ts`: `spot` (`webTargetSpot` of the element the node's selector addresses on the page before) and `items`.
  - `node-target.ts`: the node's selector and frame. A `web.output.*` node holds them in its own parameters; a
    `builtin.policy.action` holds them in `parameterValues.parameters`.
  - `key.ts`: the frame-and-selector key.
  - `memo.ts`: a bounded memory of the last 16 snapshots' places, keyed by `stateRef`.
- **`host-runtime.ts`.** The capture now sanitizes with bindings (the same packet as before) and keeps that capture's
  places in the memo. `inspectStateDiff` merges `spot` and `items` into the diff. The header gains a decision bullet.
  - **Why places live in a memo and not on the summary.** A summary is returned to a recovery model as
    `core.state_snapshot`, so it must carry neither selectors nor a page's worth of tokens.
  - The page reused from the previous step (t480) keeps its places, because it keeps its `stateRef`.
  - A ref the memo no longer holds, or one restored from a saved run, gets neither key.
- **`llm-evidence/index.ts`: one export line**, `webControlSpotToken, webTargetSpot` from `./control-spot`.
  - This file is outside the files the brief names.
  - I needed it because importing past the `llm-evidence` barrel is a ratcheted audit violation.
  - It touches none of t610's paths.
- **`docs/architecture/page-evidence.md`.** The host-runtime paragraph now names the two keys and the list rule.

### Core

- **`flow-bootstrap/candidate/trial-gate.ts`, `trialActs`.**
  - It now copies `spot` (item or dialog) and `created`, and the header gains a paragraph.
  - Every token is held to the declaration's opaque pattern (`/^[A-Za-z0-9:_-]{1,128}$/`).
  - A malformed spot entry drops only that entry. A `created` list with any malformed entry is dropped whole.
  - The act itself is always kept.
- **`flow-bootstrap/subflow-candidate/scoped-submission.ts`, `lastingOf`.**
  - It now ignores the `consequences` of any `builtin.*` node whose `automationStudioNodeSideEffectClass` is `none`.
    That is the same rule t598 applies in `landed-acts.ts`.
  - So a subflow whose only declared act sits on a wait is refused `subflow.lasting_act_missing`.
  - A recorded action (`builtin.policy.action`) or a database write still counts. The header gains a paragraph.
- **`runtime/host-runtime.ts`.** A doc comment on `inspectStateDiff` names both keys and what Core does with them. It
  also notes that the persisted trace withholds the whole diff.

### Tests

The examples come from sites that are none of the ten realistic scenarios: a library catalogue, a recipe box, and a
reading list.

- **`domain/src/runtime/state-diff/places/tests/places.test.ts`** has 7 cases:
  - an add to a visible list (spot, plus exactly one item created);
  - a drawer reveal of pre-existing loans (none created, and no spot for a control outside any item);
  - a single-loan drawer beside a lone card under the same container (none created);
  - a navigation (spot, and no items);
  - an add, a remove and a re-add (created both times, with the same token);
  - the changed-item, unnamed-single-line and `is-new` guards;
  - the memo's bound.
- **`domain/src/runtime/tests/host-runtime-places.test.ts`** has 2 cases, end to end through the boundary:
  - Both keys are written on a diff, and neither summary nor diff carries a selector or words.
  - The t480 reused page keeps its places, a document move omits `items`, and an unknown ref gets neither key.
- **Core `candidate/tests/trial-gate-reset.test.ts`** has 1 case.
  - The gate runs with a real ledger and no start hook. The trial's act carries spot and created; a malformed `created`
    is dropped while the act and its spot are kept.
  - The next test is refused until both acts are undone: act-1 on its created line (`on: "created"`, delete allowed),
    act-2 on its own card (`on: "own"`).
  - The third test is then admitted.
- **Core `subflow-candidate/tests/scoped-submission.test.ts`** has 1 case.
  - A wait declaring `create_new` alone is refused `subflow.lasting_act_missing`.
  - The same wait beside a click that declares the act is accepted.

## Commands run and observed results

Domain commands were run in `fxwork/t609/!FluxIQWebExtension/domain`. Core commands were run in
`fxwork/t609/!FluxIQ/packages/fluxiq`, with `R=src/programs/automation-studio/runtime`.

1. Domain typecheck of the sources, `npx tsc -p tsconfig.json --noEmit`:
   - The first run gave one error. `WebStateSnapshotPlaces` used `ReadonlyMap` where `webTargetSpot` needs a `Map`. I
     fixed the type.
   - It then printed no output.
2. Domain typecheck of the tests, `npx tsc -p tsconfig.test.json --noEmit`: no output.
3. `DOMAIN_TEST_BUILD_LABEL=t609 node scripts/test-domain.mjs runtime/tests/ runtime/state-diff/ runtime/llm-evidence/tests/ runtime/llm-evidence/control-spot/`:
   - Result: `# tests 337`, `# pass 337`, `# fail 0`.
   - The run covered 44 bundles: 14 in `runtime/tests`, 25+1 in `llm-evidence/tests`, 2 in `control-spot/tests`, and one
     each in `state-diff/tests` and `state-diff/places/tests`.
4. Proof that the shape rule matters. I temporarily keyed lists by container only and ran the places tests:
   - Result: `not ok 3 - a drawer with one loan, beside a single card ...`.
   - I restored the file and confirmed it with grep.
5. Core typecheck, `npx tsc --noEmit -p tsconfig.json`:
   - The first run gave 2 errors in my new test: `again.evidence` is typed as a `JsonValue`. I fixed it with a cast.
   - It then printed no output.
6. `npx vitest run $R/flow-bootstrap/site-reset $R/service/candidate-trial $R/flow-bootstrap/candidate $R/flow-bootstrap/subflow-candidate`:
   - Result: `Test Files 50 passed (50)`, `Tests 439 passed (439)`.
7. Proof that the trial-gate test depends on the fix. I temporarily removed the spot and created copy from `trialActs`:
   - Result: `AssertionError: expected [ Array(2) ] to deeply equal [ Array(2) ]`, `1 failed | 12 skipped`.
   - I restored the file from a backup and confirmed it with grep.
8. Proof that the `lastingOf` test depends on the fix. I temporarily restored the old `lastingOf`:
   - Result: `Error: expected a refusal`, `1 failed | 21 skipped`.
   - I restored the file and confirmed it.
9. Adjacent Core sets, `npx vitest run $R/service/project-build $R/project-agents $R/service/subflow-trial`:
   - Result: `Test Files 51 passed (51)`, `Tests 343 passed (343)`.
10. Downstream `node scripts/structure-audit.mjs`, run after the docs edit:
    - Result: `structure-audit: passed (194 warning(s), 639 baselined)`.
11. Core `node scripts/structure-audit.mjs`:
    - Result: `FAIL [working-docs] docs/working/README.md is out of date with the documents' header blocks`, and
      `1 violation(s) across 1 rule(s)`.
    - `git status` shows only my 5 source and test files changed, and no `docs/` file.
12. Line endings:
    - My Python-written and tool-written files came out CRLF, while untouched files in both worktrees are LF. I converted
      every file I touched to LF.
    - I then reran the new tests: domain `# tests 37 # pass 37`; Core `Tests 35 passed (35)` across `trial-gate-reset`
      and `scoped-submission`.

## Not verified

- **No live or Lab run, by the brief.** The extension's real `context.record` across a real mini-cart drawer is not
  exercised. Neither is a real class-attribute shape, nor whether a real node's `selector` equals the capture's selector
  for the same element. The `spot` key needs that match, and a mismatch gives no `spot`.
- **The full suites** (`pnpm check`, `pnpm test`, the whole Core vitest run), by the twice-a-day rule.
- **Whether recovery models see the tokens.** Recovery's `domainStateDiffSection` carries the diff whole, so a recovery
  model may now see `items` tokens: opaque 34-character digests, and only for lists both pages show. I did not measure
  the size this adds on a long list.
- **Whether Core's `working-docs` failure exists on the base commit** without my changes.

## Open questions or contradictions found

1. **Core's structure audit fails `working-docs`.** `docs/working/README.md` is out of date, and the fix is
   `pnpm structure:baseline`. It is a shared document, so I left it alone. It needs the supervisor before t609 merges in
   Core.
2. **One file outside the brief's list was edited.** `llm-evidence/index.ts` gained one export line
   (`webControlSpotToken`, `webTargetSpot`). Without it, `state-diff` would have to import past the `llm-evidence`
   barrel, which the import audit ratchets.
3. **Coverage gaps the rule accepts on purpose:**
   - A list going from one item to two, or an empty list's first item, is not credited.
   - A list that also reorders or pages (an item leaving) is not credited.
   - A site whose new line takes a position-dependent selector that shifts the container is not credited either.
   Each such act keeps only its `spot` and is named under `cannotUndo` as before. If live runs show this often, the next
   step is a domain-side "first item" rule that uses the extension's `item: {index, total}` list position.
4. **The memo holds 16 snapshots per host runtime.** A `core.state_diff` harness call between two older refs gets no
   `spot` and no `items`. That is the honest absence, but a reader should not take the missing keys to mean "nothing
   was made".
