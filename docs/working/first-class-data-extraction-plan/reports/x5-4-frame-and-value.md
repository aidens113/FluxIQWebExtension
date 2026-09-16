# X5.4 — the frame the request cannot name, and the input nothing can reach

## Outcome

Done. Both gaps are decided and acted on in code, not only reported.

- **Gap 1 (frame).** The extraction request does **not** gain a frame member.
  Extraction already addresses a frame the way every other DOM verb does — on
  the action — and that address travels end to end today. What is top-frame-only
  is the *definition* lane, which lives in `background/extraction/`, a path this
  brief forbids. The contract now says so, a request that names a frame is
  refused rather than silently read against another document, and the fixture
  that promised the workflow no longer does.
- **Gap 2 (value input).** `web.user.value_extraction_defined` is removed, with
  its metadata and the candidate it proposed. `web.dom.extract` is now a
  dispatch-only output: a Flow may author it, no recording produces it.

## What changed and why

### Gap 1 — extraction addresses a frame on the action, never in the request

The Lab worker asked the right question in the wrong place. The chain already
exists, and I read every link of it:

| Link | File | What it carries |
| --- | --- | --- |
| recorded event | `client/gateway-mapping.ts:74-100` | `browserFrameId` on the payload |
| node parameters | `output-nodes/payloads.ts:42-48` (`withRecordedFrame`) | `browserFrameId` **and** `browserFrameUrlPath` on **every** `web.dom.*` output, `web.dom.extract_list` included |
| dispatched command | `client/gateway-action-parameters.ts:70-76` | lifted onto `action.frameId` / `action.frameUrlPath` |
| delivery | `runtime/action-runner.ts:207-236` | finds the frame by document path, checks it exists and is listening, and sends with `chrome.tabs.sendMessage(..., { frameId })` |
| the read | `content/extraction/list-reader.ts:83,92` | `document.querySelectorAll(item)` — the receiving frame's own document |

The content script is declared `all_frames: true` in all three manifests, so a
frame-addressed `web.dom.extract_list` is read by the script in that frame. One
extraction reads one document: the one it was delivered to. A `frame` inside the
request would be a second way to say what the command already says, read by
nothing — precisely the one-ended wiring the brief warned about, and precisely
what `gateway-action-parameters.ts:60-66` argues against for the parameter lift.

So the planned workflow is not blocked by the request contract. It is blocked by
the definition lane, in two places I must not edit:

- `background/extraction/confirm.ts:80-84` builds the command with a literal
  `frameId: 0`, for the user's Confirm **and** for the Lab's
  `fluxiq.test.defineExtraction`;
- `background/extraction/control.ts:95-98,160` takes a pick from
  `sender.frameId === 0` only.

Changes made:

- **`domain/src/actions/extraction/request.ts`** — the rule is written where the
  Lab worker looked for a frame member and found nothing: the request names no
  frame, a frame is the command's, a recorded extraction already replays into
  the frame it was recorded in, and what is top-frame-only is the definition
  lane.
- **`domain/src/actions/extraction/read-request.ts`** — a request carrying
  `frame`, `frameId`, `frameSelector` or `frameUrlPath` is now **refused whole**
  rather than copied around. This file's own principle is that a property sent
  but unreadable refuses the request, because dropping it makes the page read
  something other than what was asked for and report success; a dropped frame is
  exactly that. Frame `0` is refused too: it is the top frame, not an absent one,
  so naming it would still be naming a frame.
- **New `domain/src/actions/extraction/tests/frame-address.test.ts`** (4 rows) —
  a request with no frame reads; each frame key is refused; a recorded extraction
  in frame 4 carries `browserFrameId` and `browserFrameUrlPath` onto its node and
  reaches the dispatched command as `frameId` / `frameUrlPath` with the recorded
  request intact, and the frame's query string (`session=tok-123`) appears
  nowhere in the node; a top-frame extraction names no path and keeps frame `0`.
- **`apps/scenario-lab/src/scenarios/iframe-checkout/scenario.ts`** — the
  `extract-order-lines` workflow is removed, and the reason is written into the
  fixture. As authored it could only ever be served by the reference reader,
  which resolves `frame:` through Playwright's `frameLocator`
  (`scenario-steps/locate-target.ts:17`); its `expected` names no action at all,
  so it asserted nothing about FluxIQ. It would then fail the run as
  `fixture.invalid` the day `run-scenario.ts` passes the intent driver, because
  `extract-intent.ts` refuses a `frame:` target. The order-line markup stays in
  the frame, so the workflow is a paste away.
- **`.../iframe-checkout/tests/scenario.test.ts`** — the test that pinned the
  frame-qualified target now pins its absence and says what must change first, so
  re-adding the workflow without the background work fails a check.

### Gap 2 — the registration nothing could reach

**What I checked before deleting**, by grep over `domain/src`, `apps/*/src`,
`packages/`, `docs/` and `scripts/` (build output under `.test-build-scratch/`
ignored):

| Depends on it | Verdict |
| --- | --- |
| `io/input-model.ts` — the id, its `actionInputDefinitions` row, the mapping branch | the registration itself |
| `io/manifest-definitions.ts`, `io/web-automation-io.ts` | derive from that row; no separate mention |
| `web-panel-host.ts:117-120,145,197` | proposed a `web.dom.extract` Subflow candidate from it |
| `io/tests/input-model.test.ts`, `tests/web-panel-host.test.ts` | two tests asserting the mapping |
| `docs/architecture/{extension-client,web-capabilities}.md` | four places, including the input counts |
| anything in `apps/extension/src` | **nothing**: no file names the input id |
| any fixture, scenario, Flow or `.fluxiq` artifact | **nothing** |

Nothing outside the domain and its own docs depended on it, and nothing could
ever have produced the event: `control.ts:128` refuses a `value` pick at the
door, `control.ts:168` refuses one that arrives anyway, `confirm.ts:70` refuses a
`value` definition on the run path, and `content/picker/recorded-event.ts:44`
attaches no element target for one. So it named a capability the product does not
have, which is the mirror of the repository's rule that an unmapped input must
not become executable.

Changes made:

- **`domain/src/io/input-model.ts`** — `valueExtractionDefined` and its
  `actionInputDefinitions` row are gone, and a `data.extract` event whose
  definition is the `value` form now resolves to no input, so it stays passive
  evidence. The comment records why and what to put back.
- **`domain/src/web-panel-host.ts`** — the two-input set becomes the one input;
  `"web.dom.extract": "Extract value"` is dropped from the candidate labels; the
  candidate's doc no longer describes a value form that cannot arrive.
- **Tests** — `io/tests/input-model.test.ts` row 20a now maps to nothing,
  `web.dom.extract` moves into `dispatchOnlyOutputs` (which is cross-checked
  against `WEB_AUTOMATION_ACTION_TYPES`, so a re-added row fails the run), and
  three new assertions hold that the domain still *reads* a value definition, that
  it resolves to no input, and that the id is not registered.
  `tests/web-panel-host.test.ts` now asserts the value definition proposes
  nothing through Core.
- **Docs** — `web-capabilities.md` (Extract text row, the counts, the input
  table, the dispatch-only sentence), `extension-client.md` (two counts, the
  picker paragraph, the Defining An Extraction table, plus one paragraph stating
  the frame rule from gap 1) and `testing-facility.md` (the removed workflow row
  and why). Counts corrected: twelve recorded action inputs bound to eleven
  outputs.

**Deliberately kept**: the domain still reads a `form: "value"` definition
(`recorded-definition.ts`) and `output-nodes/payloads.ts:118-121` still maps one
to `web.dom.extract`'s `extract` parameter. Both are private mappers rather than
surface, the extension's recorded-event wire still types the value form
(`background/connection/gateway-payloads.ts:184`, `content/picker/*` — files this
brief forbids), and keeping them is what makes re-registering the input one row.
`payloads.ts:118-121` is now unreachable; deleting it is a one-line follow-up if
the supervisor wants zero dead branches.

## Commands run and observed results

Run one at a time, in the brief's order. Nothing was committed or pushed, and no
working document was edited.

`pnpm --filter @fluxiq-web-extension/extension check`:

```
> @fluxiq-web-extension/extension@0.1.0 check F:\!FluxIQWebExtension\apps\extension
> node scripts/check-extension.mjs
```

exit 0, no diagnostics printed.

`node scripts/test-extension.mjs` (run from `apps/extension`; the brief's path is
repo-relative and there is no such file at the root):

```
1..638
# tests 638 / # pass 638 / # fail 0 / # duration_ms 7154.7967
```

`node domain/scripts/test-domain.mjs`:

```
1..494
# tests 494 / # pass 494 / # fail 0 / # duration_ms 7014.2709
```

`node scripts/structure-audit.mjs`:

```
structure-audit: passed (56 warning(s), 17 baselined).
```

Same counts as the pre-change baseline X5.3 recorded, so no new finding.

Also run, because they cover files I changed:

- `pnpm --filter @fluxiq-web-extension/domain check` — exit 0, no diagnostics.
- `pnpm --filter @fluxiq-web-extension/scenario-lab check` — exit 0.
- `pnpm --filter @fluxiq-web-extension/scenario-lab test` — `# tests 225 / # pass
  225 / # fail 0`, including `ok 96 - the fixture declares no extraction
  workflow, because FluxIQ cannot be asked to read a child frame`.

The four new domain rows were observed individually:

```
ok 1 - a request is read when it names no frame
ok 2 - a request that names a frame is refused whole, rather than read against another document
ok 3 - a recorded extraction replays into the frame it was recorded in, with no frame in its request
ok 4 - a top-frame extraction names no path, and frame 0 survives as a frame
```

### Mutation probes (applied, observed, reverted)

| Mutation | Observed |
| --- | --- |
| the frame refusal in `read-request.ts` made unreachable (`false && ...`) | `not ok 2 - a request that names a frame is refused whole...`; 493 pass, 1 fail |
| the dead registration restored (`valueExtractionDefined` id + row) | `AssertionError [ERR_ASSERTION]: every output is recordable or dispatch-only`; the domain run exits 1 and `Web automation input model tests passed.` is never printed |
| a `value` definition made to resolve to the data input | **no test failed.** The narrowing is defence in depth, not the load-bearing rule: `hasExecutableParameters` already refuses a value definition for `web.dom.extract_list`, because `recordedListExtractionParameters` builds nothing from one. Reported rather than dressed up. |

No failure occurred in any suite except under a probe, so no lone rerun for a
load-related fault was needed.

## Not verified

- **No browser ran.** Nothing under `apps/extension/src/content/` or `e2e/`
  changed, so no content-harness spec was run. The frame chain in gap 1 is read
  from source, not observed: no `web.dom.extract_list` has ever been dispatched
  to a child frame in a browser, and `action-runner.ts`'s frame delivery is
  exercised by unit tests with a fake `chrome.tabs`, not by a real frame.
- **The Lab was not run.** I did not observe `extract-order-lines` passing before
  I removed it; that it would pass through the reference reader is read from
  `locate-target.ts:17` and `extract-records.ts`, which resolve a `frame:` target
  through Playwright.
- **`domain/dist` was not rebuilt**, for the reason X5.3 gave. The checks above
  are unaffected: `@fluxiq-web-extension/domain` and `/client` resolve to
  `domain/src`, not `dist`. Anything importing `@fluxiq-web-extension/domain/node`
  still sees a `dist` that carries the removed input.
- **Core was not consulted.** Removing an input changes the domain manifest Core
  receives. No Flow or policy can reference `web.user.value_extraction_defined`,
  because no event ever produced it, but I did not search the sibling Core
  checkout or any stored project for the string.
- **`domain/.test-build/` is rewritten** by running the domain tests. It is
  tracked by policy; that part of the diff is build output, not hand-edited.

## Open questions or contradictions found

1. **The exact change that would enable the iframe workflow**, all of it outside
   this brief. `confirmExtraction` takes an optional `frameUrlPath` and puts it on
   the command instead of pinning `frameId: 0`
   (`background/extraction/confirm.ts`); `defineForTest` reads it off the message
   (`background/extraction/control.ts`); the Lab's `extract-intent.ts` translates
   a `frame:<title>/<inner>` target into that path plus the inner CSS, and the
   driver sends it (`packages/test-runner/`). No frame **id** need cross:
   `action-runner.ts` already finds a frame by document path, which is what the
   Lab knows (`/scenarios/iframe-checkout/same-frame`). `recordDefinition` would
   also have to send its `data.extract` to that frame, so the recorded event
   carries the frame and a Flow built from it replays there. I made none of it.
2. **I removed another worker's fixture work.** `extract-order-lines` was built by
   the X5-E fixtures worker (`reports/x5e-fixtures-tables-feed.md:71-79`) and its
   description claims "The intent names the frame, which is the only way this read
   reaches them" — which is not true of the intent path as built. If the
   supervisor takes change (1), restoring the workflow and its test is a revert of
   two hunks.
3. **The plan still says the intent carries the frame.** `x3-x5-execution.md:936`
   and its open question 10 both assert frame extraction is reachable through the
   intent path in X5. It is not, and I did not edit the working document.
4. **Files outside my owned list that I edited**, because the registration does
   not live where the brief expected: `domain/src/io/input-model.ts`,
   `domain/src/io/tests/input-model.test.ts`, `domain/src/web-panel-host.ts`,
   `domain/src/tests/web-panel-host.test.ts`, and three files under
   `docs/architecture/`. None is on the forbidden list, and the tree was clean
   when I started, so no worker held them.
5. **Not mine, and in the tree**: `packages/test-contracts/src/bench-report.ts`
   and five files under `packages/test-runner/src/bench/` show as modified. They
   are the bench worker's in-flight changes; I touched nothing under `packages/`.
