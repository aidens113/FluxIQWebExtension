# t743-d1-build-memory: build-scoped site memory (domain side)

## Outcome

Done. A build's shown addresses and typed texts now belong to the build. A
later brief's fresh opening no longer forgets them, and briefs that run side by
side share one memory, both in the process and in the stored copy. Calls Core
frames `move: "core"` are not checked against the address rule. `places` on any
brief's opening call counts as shown. The `address_not_shown` alternatives now
cover addresses shown to any brief and say how to repeat a typed search.

## What changed and why

- `domain/src/runtime/llm-evidence/node-run/shown-addresses.ts`
  - Every brief of a build now uses one key: the build without its `callScope`
    (new private `shared`). This key is used for `restore`, for the in-process
    entry and for the write-through. So briefs of one build share one in-process
    memory and one stored value, `web.shown-addresses`, which no longer has a
    `:<callScope>` suffix.
  - The `opening` method is removed, so no opening forgets anything. A new
    `buildId` is a new key, so a new build starts empty. A call outside every
    build still has `callScope: undefined` and is keyed by project and Flow, as
    before.
  - The "What is not touched" paragraph is rewritten. It now covers the
    exemption for Core's own moves and a new paragraph, "What a build was shown
    belongs to the build". That paragraph gives the reason: on run
    `run-mvgvyaip-d856e135`, repair and reset briefs and Core's own looks were
    refused pages that brief-1 had searched for or stood on, and an address any
    brief of the build was shown is not one the model made up.
  - "What counts as shown" now lists Core's `places`.
  - `INSTEAD` now has three entries instead of two:
    1. The `dom-click` entry is unchanged.
    2. The navigate entry now reads "an address this build was shown -- a link's
       href, the location of a page any brief of this build was shown or stood
       on, a read's address, or the start location".
    3. A new entry: "a page a typed search reached is reached again by typing the
       search into the site's own search field and submitting it, never by
       writing the page's address".
    All three use generic wording.
- `node-run/build-state/build-key.ts`: `webNodeBuildOf` also returns
  `coreMove: boolean`, which is `scope.move === "core"`. It is false when there
  is no frame or when the frame belongs to another project or Flow. The header
  notes the new frame field.
- `node-run/arrival.ts`:
  - New `webNodeOpeningPlaces(call)`, built like `webNodeRepairedFlow`. It is
    read only when Core's frame marks the call as an opening. It strips `places`
    from the call and returns its string entries.
  - The header has a new paragraph, "And the build's places", and `places` is
    added to the list of keys read only on an opening.
- `node-run/run.ts`:
  - `places` is stripped after `repairs`. Each place is passed through
    `run.addresses.held(...)`, as repaired addresses are: it counts as shown, is
    not an arrival and is not a step.
  - The `run.addresses.opening(...)` call is removed.
  - `run.addresses.refuses` is skipped when `coreMove` is true. Nothing else
    changes for such a call: the cross-origin check, the permission gate and
    the rest still run.
  - On any later call, `places` stays on the value and is refused as
    `unexpected_input_keys`.
  - The file is still exactly 800 lines, which is the structure audit's
    `fileLines` limit.

### Tests

- `node-run/tests/shown-addresses.test.ts`:
  - `Frame` gains `buildId` and `move`. The `arrive` helper takes a frame, and a
    new `search` helper was added.
  - Three existing tests were changed for the new behaviour:
    - "Core's opening of a fresh round forgets..." became "a new build of the
      flow, under another build id, starts with nothing...".
    - "a repair opening still forgets the last build" now opens the next build
      as `build.two`.
    - In the scoped-repairs test, brief-7 of the same build is now admitted,
      and another build (`build.two`) is still not.
  - The INSTEAD assertion now expects 3 entries and checks the new wording.
  - New tests:
    - A second brief's fresh opening, then a navigation to brief-1's search page
      with brief-1's typed query, is admitted. The same search with other words
      is also admitted. A made-up address is still refused.
    - A reset brief's navigation to a page brief-1 stood on, reached from a
      read and linked from no page the reset brief saw, is admitted.
    - A host restarted mid-build admits, for brief-2, what brief-1 was shown
      and typed.
    - A navigation framed `move: "core"` to an address never shown runs. The
      same call unframed is refused and is not dispatched.
    - `places` on an opening, absolute or root-relative, is admitted. An edited
      query is refused. The opening ran without `places`.
    - `places` beside `repairs` on a repair's opening: both count.
    - `places` on a later navigation or look is refused as
      `invalid_input`/`unexpected_input_keys`, and counts nothing.
    - A unit test: briefs side by side share one in-process memory and one
      stored value `web.shown-addresses`, with no `:brief-1` key. A restored
      copy admits for another brief, and another `buildId` admits nothing.
- `node-run/build-state/tests/memory.test.ts`: the `webNodeBuildOf` deep-equals
  now include `coreMove`. Added assertions: `move: "core"` gives `true`, and a
  frame for another Flow gives `false`.

## Commands run and observed results

- `cd .../domain && DOMAIN_TEST_BUILD_LABEL=t743-d1 node scripts/test-domain.mjs node-run/tests node-run/build-state`
  printed `# tests 274`, `# pass 274`, `# fail 0`. I ran it twice. The second run
  listed the new tests by name, all `ok`: 1, 226-230, 238, 241-243 and 245.
- `DOMAIN_TEST_BUILD_LABEL=t743-d1 node scripts/test-domain.mjs llm-evidence/tests/`
  is a side check, because `tools.ts` destructures `webNodeBuildOf`. It printed
  `# tests 215`, `# pass 215`, `# fail 0`.

## Not verified

- No typecheck was run, as the brief requires. The test build uses esbuild,
  which strips types without checking them, so type errors would not show up in
  these runs. I checked the types by hand: the new `coreMove` field is additive,
  and `tools.ts:495` destructures `{ build, opening }` only.
- No structure audit and no full suite was run.
- No live run. That Core actually sends `move: "core"` and `places` is
  exercised only through the framing in these tests, not end to end with
  Core's wave 1.

## Open questions or contradictions found

- `domain/src/runtime/llm-evidence/tool-rejection.ts` (around line 243) still
  says `instead` for `address_not_shown` "names the two ways there". There are
  now three. I do not own that file, so I left it unchanged; the supervisor
  should update that comment.
- Stored copies written before this change under `web.shown-addresses:<callScope>`
  are no longer read, because the key now has no suffix. This only matters for
  a build that was already in flight when the host updates, and a lost copy can
  only cause more refusals, never fewer.
- The arrival, own-layers and held-literals memories are still per brief and
  are still forgotten by a fresh opening. The brief did not ask to change them.
