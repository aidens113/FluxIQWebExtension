# Report: v-truncation

Worker: `v-truncation`. Reconciling the `truncated` flags that three Wave 3
workers independently added to one evidence path.

## Outcome

**Done.** There are now five caps on the evidence path and every one of them is
separately readable. No flag anywhere summarises more than one cap while still
being called `truncated`. Nothing that was reported before has stopped being
reported. Domain `check` and `test` exit 0 (262/262), extension `check` and
`test` exit 0 (220/220), the state-path ratchet is green, and the structure
audit passes with no warning or violation naming any file I touched.

A fourth and a fifth `truncated` did turn up, exactly where the brief guessed:
the evidence projection into web state writes `{ count, truncated, items }` on
every collection, and `domain/src/runtime/reusable-evidence.ts` has one on its
prompt projection. Both are folded into the scheme below rather than left as
separate conventions — the first by rule and by test, the second by
classification only, since I do not own that file and it is not on this path.

## The shape I chose, and why

**Qualified names**, not one nested structure, with the bare name kept as a
summary wherever a summary is genuinely useful.

The rule, stated once in
`domain/src/recording/web-state/evidence/input.ts` and pointed at from every
other site:

> A bare `truncated` is legal only *inside* the structure whose own cap set it,
> beside that structure's counts, where the structure names the limit. Anywhere
> a flag would summarise more than one cap it is named for the cap instead, and
> the summary keeps the bare name so a consumer asking only "did I get
> everything" still has one question to ask.

Four reasons for names over nesting, in the order they decided it:

1. **Two of the three flags live in Core's flat state namespace.** A state path
   is compared, declared and labelled individually. A nested structure there is
   a JSON blob, and this projection's own rule (`project.ts`, the
   `dialogs.openCount` comment) is that a collection blob is `comparable:
   false`, because two captures of one page differ in every rect. Nesting would
   therefore have made "the element list got truncated" impossible for Core's
   transition comparison to assert — it would have destroyed the signal for the
   consumer that most needs it, in the name of tidying its name.
2. **The flags are set in three processes at three times.** The content script
   sets one, the background worker folds it across frames, the domain
   projection sets another, and the packet builder sets two more. A single
   nested structure would have to be threaded and merged across all of them —
   including `background/connection/dom-snapshot.ts`, which no brief owns.
   Named booleans let each stage own exactly its own field and write nothing
   else.
3. **The usual question and the actionable question are different questions.**
   Most consumers only want "is this less than the page". A few want to know
   what to do about it, and the four remedies have nothing in common. Keeping
   the summary *and* naming each cap answers both in one read; either shape
   alone answers only one.
4. **Cost.** No producer rename, no foreign file, no e2e spec edit, and the
   two-sided state-path change is three declaration lines in a file I own.

I deliberately did **not** introduce a shared string vocabulary constant. The
five limits fire in `apps/extension/src/content/`, `domain/src/recording/` and
`domain/src/runtime/`, and there is no module all three may import: putting it
in `recording/` would make `runtime/` depend on `recording/`, which is
backwards — the packet is a sibling consumer of page evidence, not a downstream
of recording state. So the *table* is declared once and each site carries its
own limit's meaning inline, which is what a reader actually lands on.

## What a consumer now reads

The table lives in `domain/src/recording/web-state/evidence/input.ts`. Reproduced:

| Limit | Flag naming it | What is missing | Remedy |
| --- | --- | --- | --- |
| The browser capture's element cap | `captureTruncated` | Elements never left the page | Capture less of the page: one frame, one region |
| The state projection's element cap (`MAX_STATE_ELEMENTS`) | `stateTruncated` | Eligible elements absent from `elements.*` | Raise the cap, or narrow what is recorded |
| A per-collection cap in the projection | that collection's own `truncated`, beside its `count` | Items of one evidence collection | Read `count` for the true total |
| The packet's element bound | `elementsTruncated` | The ranked tail the model never saw | Narrow the page, then re-ask |
| The packet's byte budget | `budgetTruncated` | Elements and page facts removed to fit | Re-ask with a larger budget |

### Each limit, hit

**1. The browser's capture cap.** A 4,000-node page; the content script matched
812 candidates and carried 400.

```
snapshot.evidence.elements  { scanned: 4200, candidates: 900, matched: 812, returned: 400, truncated: true }
web state                   elements.count 400, elements.captured 400,
                            elements.captureTruncated true, elements.stateTruncated false,
                            elements.truncated true,
                            evidence.elements.matched 812, evidence.elements.returned 400
packet                      elementTotal 812, elements[40], truncated true, captureTruncated true
```

A reader sees `captureTruncated` and knows a bigger packet budget will not help:
the missing elements never left the browser.

**2. The state projection's cap.** 1,600 eligible elements arrive, `MAX_STATE_ELEMENTS`
is 1,500, and the capture itself reported nothing.

```
web state   elements.count 1600, elements.captured 1500,
            elements.stateTruncated true, elements.captureTruncated false, elements.truncated true
```

Raising `MAX_STATE_ELEMENTS` fixes this one and would have done nothing for the
first. Pinned by `web-state/tests/snapshot.test.ts`, "a page past the element
cap says so".

**3. A collection cap.** A page with 30 landmark regions; `MAX_REGIONS` is 20.

```
web state   evidence.regions { count: 30, truncated: true, items: [ …20 ] }
            elements.truncated false, elements.captureTruncated false, elements.stateTruncated false
```

The bare name is right here — it sits inside the one collection whose cap set
it, next to that collection's `count`, so it can only mean that cap. Pinned by
"a collection cap is its own limit and does not colour the element summary",
which is the assertion that the element summary is *not* affected.

**4. The packet's element bound.** 41 elements offered, bound is 40.

```
packet   elements[40], elementsTruncated true, truncated true
         (captureTruncated and budgetTruncated absent)
```

**5. The packet's byte budget.** The failure path, gated by Core at 3,000 bytes.

```
packet   budgetTruncated true, truncated true
         (captureTruncated and elementsTruncated absent)
```

All three packet limits, and all three firing together, are pinned by
`llm-evidence/tests/limits.test.ts`: "names which limit truncated the packet,
one row per limit" and "all three limits can fire at once, and each stays
separately readable". The trim ladder's self-calibrating rung test now also
asserts `budgetTruncated` at every rung.

## What changed and why

### Domain state (`domain/src/recording/`)

- `web-state/snapshot.ts` wrote `elements.truncated` as
  `selection.truncated || pageEvidenceTruncatedElements(evidence)` — the one
  place in the tree where two caps with two different remedies were ORed into a
  flag a consumer could not act on. It now writes
  `elements.captureTruncated` and `elements.stateTruncated` as their own
  comparable boolean paths, and keeps `elements.truncated` as their union,
  documented as a summary that never claims to say which cap bit.
- `web-state/element/selection.ts` reserves the two new keys in
  `WEB_AUTOMATION_ELEMENT_SUMMARY_STATE_IDS`. Without this a page shipping
  `data-testid="stateTruncated"` would be filed at `elements.stateTruncated`
  and overwrite the flag with a JSON blob — the same defect the list already
  existed to prevent for `count`.
- `domain.ts` declares both new paths and relabels the summary
  ("Element list incomplete", "Browser capture dropped elements", "State cap
  dropped elements"). This is the two-sided half: the ratchet asserts every
  produced path is declared and every declared path produced, and both new
  paths are produced on every snapshot, so an undeclared one would have failed.
- `web-state/evidence/project.ts` header now states why the per-collection
  `{ count, truncated, items }` is the same convention rather than a fourth
  one, and the `evidence.elements.truncated` line says why the same fact is
  also written outside the `evidence.` prefix.
- `web-state/evidence/input.ts` carries the canonical table.

### The sanitized packet (`domain/src/runtime/llm-evidence/`)

- `sanitize.ts`: `WebLlmPageEvidence` gains `captureTruncated`,
  `elementsTruncated` and `budgetTruncated`, each present only when it fired,
  so a whole packet pays nothing for them and a truncated one pays about 25
  bytes per limit — affordable even against Core's 3,000-byte failure gate.
  `truncated` keeps its exact previous truth value plus the capture fix below.
  The trim ladder sets `truncated` and `budgetTruncated` together, before the
  size is re-measured, so their bytes are inside the budget rather than pushing
  the packet over after the last check. Neither is droppable; they describe the
  trimming.
- `page-evidence.ts`: **`capturedTruncated` was reading a field no producer
  writes.** It read a bare top-level `snapshot.truncated`; the Phase 1.4
  content script reports its funnel at `evidence.elements.truncated`. Against
  the real capture the limit was dead — a page whose tail had already been
  dropped in the browser reached the model as `truncated: false`. It now reads
  the nested funnel as well as the legacy top-level flag. `evidenceElementTotal`
  had the same misalignment and now falls back to `evidence.elements.matched`
  (not `scanned`, which counts every node the sweep walked); it is the number
  half of the same fact, so `captureTruncated: true` no longer arrives with no
  number saying how much was lost.

### The producer (`apps/extension/src/content/evidence/`, `shared/protocol.ts`)

Comments only. `SnapshotElementTotals.truncated` keeps its name — see the
residual below — and its docstring now says it means this cap and only this
cap, that it is read downstream as `captureTruncated`, and what the remedy is.
`protocol.ts`, which is the wire seam a consumer outside `content/` reads,
carries the same three sentences and a pointer to the table.

### Tests

Five new rows and several tightened ones:

- `web-state/tests/evidence.test.ts`: "the browser's cap is reported as its own
  limit, not folded into one flag" (rewritten from the old roll-up assertion),
  "both caps firing at once are still two readable facts, and the summary is
  their union", "a collection cap is its own limit and does not colour the
  element summary". The "nothing the evidence writes lands in the element
  namespace" row now derives its allowed set from
  `WEB_AUTOMATION_ELEMENT_SUMMARY_STATE_IDS` instead of restating it, so a
  future summary path added without reserving its key fails here.
- `web-state/tests/snapshot.test.ts`: the element-cap row now asserts
  `stateTruncated true` / `captureTruncated false`, which is what makes it a
  test of *which* limit rather than of *whether*.
- `llm-evidence/tests/limits.test.ts`: the two new per-limit rows above, plus
  `budgetTruncated` in the trim-ladder shape at every rung.
- `llm-evidence/tests/page-evidence.test.ts`: "reads the capture's own funnel,
  not only a bare top-level flag", which would have failed before this change.

## Commands run and observed results

`EXTENSION_TEST_BUILD_LABEL=v-truncation` and
`DOMAIN_TEST_BUILD_LABEL=v-truncation` were set on every package command. Exit
status was captured by redirecting to a file and echoing `$?`, never through a
pipe. No `pnpm build`, no `pnpm lab`, no `pnpm structure:baseline`.

- `pnpm --filter @fluxiq-web-extension/domain check` → **exit 0**, no
  diagnostics. Run three times across the change; 0 each time.
- `pnpm --filter @fluxiq-web-extension/domain test` → **exit 0**,
  `# tests 262 # pass 262 # fail 0`. The intermediate run after the state
  change was `# tests 257 # pass 256 # fail 1`, the single failure being my own
  "nothing the evidence writes lands in the element namespace" row, which
  hard-coded the three old summary paths; fixed by deriving it from the
  reserved list.
- Ratchet rows observed green by name in that output:
  `ok 59 - every state path a producer writes is declared` and
  `ok 60 - every declared state path is written by a producer`.
- New rows observed green by name: `ok 101`, `ok 102`, `ok 103`, `ok 111`,
  `ok 176`, `ok 177`, `ok 185` (the seven listed under Tests above).
- `pnpm --filter @fluxiq-web-extension/extension check` → first run **exit 2**,
  two `TS1128` syntax errors in `e2e/content/tests/identity-resolution.spec.ts`
  — a file I do not own, mid-edit by another worker. Re-run per the wave rule:
  **exit 0**, no diagnostics. Final run after the last edit: **exit 0**.
- `pnpm --filter @fluxiq-web-extension/extension test` → **exit 0**,
  `# tests 220 # pass 220 # fail 0`. Run twice, identical.
- `node scripts/structure-audit.mjs` with a scratch `GIT_INDEX_FILE` (a copy of
  `.git/index` with `apps/extension/src` and `domain/src` added) → **exit 0**,
  `structure-audit: passed (30 warning(s), 19 baselined)`. Run twice, the
  second after the final edit. `grep -cE "web-state|llm-evidence|content/evidence|recording/domain\.ts|shared/protocol"`
  over the audit output returns **0**: no warning and no violation names any
  file I touched, and none of them is in `.structure-baseline.json`, so the
  no-growth rule does not apply to them.
- `git diff --stat` over my paths: 13 files, +286 / −38, all inside Owns.

## Not verified

- **No live browser validation, and no `pnpm test:content`.** My content-side
  changes are comments only (`content/evidence/types.ts`, `shared/protocol.ts`),
  so the harness exercises nothing I changed, and two workers were mid-edit in
  `e2e/` throughout — one of them left a syntax error that failed extension
  `check` on my first run. A harness run would have reported their tree, not
  mine. The brief's definition of done does not name it.
- **No `pnpm build`.** The supervisor's, per the wave rules.
- **The packet flags against a real Core failure diagnosis.** The existing
  "a failure packet passes Core's failure-evidence gate whole" row round-trips
  the packet through `sanitizeAutomationStudioLlmFailureEvidence` and still
  passes with the new fields present, so Core's parser does not reject them.
  Whether anything *upstream* in Core would rather see them is untested — no
  Core consumer reads them yet.
- **The capture-limit fix is proven against a constructed funnel, not a page.**
  I asserted `sanitizeWebLlmSnapshot` reads `evidence.elements.truncated`, but
  no test in this repository drives a real content-script capture into the
  packet builder. `apps/extension/src/background/tests/recording-evidence-pipeline.test.ts`
  is the joinery test for the *state* half; the packet half has no equivalent.
- **`elements.count` semantics.** Untouched by me, and note for the examples
  above that it is the length of what *arrived*, not the page total, whenever
  the browser's cap already fired. The page total in that case is only at
  `evidence.elements.matched`. That is pre-existing and is the open question
  already logged about `elements.count` changing meaning.

## Open questions or contradictions found

- **I did not rename the producer's `SnapshotElementTotals.truncated`, and the
  brief's Owns is why.** It is the leaf that everything else derives from, and
  renaming it to `captureTruncated` would have needed four files outside my
  Owns — `background/connection/dom-snapshot.ts:295`,
  `background/connection/tests/dom-snapshot.test.ts` (lines 41, 177, 182, 184),
  `background/tests/recording-evidence-pipeline.test.ts` (41, 66, 149),
  `runtime/tests/result-mapping.test.ts:186` — plus
  `e2e/content/tests/evidence.spec.ts` (59, 66, 67), which the brief forbids me
  to edit. It is the only field of the five still spelled bare, and it is legal
  under the rule (it sits inside its own funnel, beside `matched` and
  `returned`, and can only mean that cap), so I judged the rule better served
  by stating it than by a rename that would have left `check` red in files I
  cannot fix. If the supervisor wants it renamed on a still tree, the exact
  edits are: `content/evidence/types.ts` field `truncated:` → `captureTruncated:`;
  `content/evidence/page.ts` line `truncated: counts.matched > entries.length,`
  → `captureTruncated: counts.matched > entries.length,`;
  `background/connection/dom-snapshot.ts:295`
  `truncated: contributions.some((evidence) => evidence.elements.truncated),`
  → `captureTruncated: contributions.some((evidence) => evidence.elements.captureTruncated),`;
  and the same key in the four test/spec fixtures listed above. The domain side
  needs no edit — `evidence/input.ts` and `llm-evidence/page-evidence.ts` read
  the wire defensively and would both need the new key added beside the old, or
  the old dropped deliberately.
- **The state-path ratchet is only as strong as its fixture, and its fixture
  has no evidence.** `recording/tests/domain.test.ts` builds its snapshot
  without an `evidence` field, so the roughly thirty `evidence.*` paths the
  projection writes are produced by nobody in that test and declared by nobody
  in `domain.ts`. Both ratchet directions pass vacuously for the whole evidence
  namespace. Adding evidence to the fixture would immediately fail the
  "every produced path is declared" half until `domain.ts` gains those thirty
  declarations — which is the work, and it is exactly the class of gap the
  ratchet was built to catch. I did not do it: it is a large unbriefed
  declaration change in a file three workers have already edited this wave.
  Worth a named task.
- **The packet reads five page-evidence fields at the wrong path, not just the
  one I fixed.** `webLlmPageContext` reads `snapshot.loading`,
  `snapshot.navigation`, `snapshot.dialogs`, `snapshot.blockingOverlay` and
  `snapshot.pendingNativeDialog` at the top level. The Phase 1.4 producer emits
  `evidence.loading`, `evidence.navigation`, `evidence.dialogs.open[]`,
  `evidence.overlays.blockers[]` and `evidence.dialogs.armPending` — different
  paths *and* different shapes. Every one of those packet fields is therefore
  dead against the real capture, the same way `capturedTruncated` was, and the
  tests do not catch it because they construct snapshots in the shape the
  packet expects rather than in the shape the producer emits. I fixed only the
  truncation reader, because that is my brief; the other five are a single
  coherent follow-up and they are the difference between the model seeing a
  modal dialog in front of the page and not. `w3-llm-packet`'s report table
  lists these as "the names the packet reads", which reads as a contract but is
  in fact a guess at one — no test crosses the two sides.
- **Two more `truncated` flags exist off this path, and both are legal under the
  rule as leaves.** `domain/src/runtime/reusable-evidence.ts:43` on the prompt
  projection (its own item and byte caps, beside `facts` and `byteCount`) and
  `packages/test-runner/src/web-flow-exploration.ts:51` on an exploration
  result (its own page cap). Neither summarises more than one cap and neither
  is on the recording/packet evidence path.
  `content/action-runtime/list-extraction.ts:33` is a third, on extracted
  records — a different axis entirely (pagination of a `web.dom.extract_list`
  result), and its e2e rows assert the word in prose. I touched none of them;
  they are named here so the next reader does not count them as strays.
- **No end-to-end spec asserts a name I changed.** I grepped `apps/extension/e2e`,
  `packages/` and `apps/scenario-lab`: the only evidence-path assertion is
  `e2e/content/tests/evidence.spec.ts:59-67`, which destructures
  `evidence.elements.{scanned,candidates,matched,returned,truncated}` — all
  unchanged. So there is no spec replacement text to hand back.
</content>
</invoke>
