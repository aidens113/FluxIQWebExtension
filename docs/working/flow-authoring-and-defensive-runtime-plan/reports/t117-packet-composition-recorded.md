# t117 — Record what each evidence packet was made of, in counts

## Outcome

Done. Worktree `F:\fxwork\t117-packet-composition-recorded`, branch
`task/t117-packet-composition-recorded`, two commits, head
`c239fda840d62698175e6279e6d87d71444cc7c2`. 37 files, +707/-81.
`pnpm task finish` was not run, as instructed.

## What changed and why

Live run `run-muexhp0k-73172f73` built a Flow that failed to click a
"Brightaisle Plus" filter its instruction named, and no artifact could say
whether the model had ever been shown that filter: `evaluation.json` held
`evidence.sanitizedPacketBytes` and `truncationCount`, and
`snapshots/live-llm.json` recorded `"perCallRecords": "not recorded"`. A byte
size says a packet weighed 4,071 bytes; it does not say whether the one control
the instruction named was among the forty elements inside it.

Each evidence packet now records its composition by relevance band, in counts:

1. **Capture.** `apps/extension/src/content/dom-snapshot.ts` already computes a
   coarse band per element (`snapshotElementBucket`; band 1 is
   `isPageStateControl` — the facets, price bands, sort orders and pagers). It
   now stamps that number on the descriptor as `snapshotBucket`. This is the
   only place the band is known, and a reader downstream cannot ask the page
   again once the capture has left it.
2. **Wire hygiene.** `apps/extension/src/shared/protocol.ts` declares
   `snapshotBucket` and adds it to `UnwiredElementField`, so it is excluded from
   `WireElementTarget` for the same reason as `repeatCount`: it is
   snapshot-scoped, and on a recorded event's target it would be a stale number
   the moment the page changed.
3. **Packet builder.** New `domain/src/runtime/llm-evidence/composition.ts` owns
   the band vocabulary and the counter. `sanitize.ts` publishes
   `composition: { included, dropped }` on `WebLlmPageEvidence`, keyed by the
   band number in decimal, with `unranked` for an element the capture did not
   rank so the two sides always add up to what the capture offered. `included`
   is recounted after every trim, so it describes the packet as sent.
   `dropped` is one number, not three: the element bound, the sanitizer's
   refusals (no selector, or a signature that says the control holds a secret)
   and the byte trim are different problems, but to the question this answers —
   was the model shown it — they are one answer.
4. **Out to a finished run.** The packet is what Core stores at
   `stateRefs.<point>.summary` (`domain/src/runtime/host-runtime.ts` builds it
   with `sanitizeWebLlmSnapshot`), so no Core change was needed.
   `packages/test-runner/src/flow-lane/persisted-flow-run.ts` lifts the
   composition into `PersistedEvidencePacket`,
   `run-evaluation/flow-lane-evidence-sizes.ts` into
   `RunEvidenceSizes.packetComposition`, and
   `run-evaluation/observed-run-evaluation.ts` copies it into the evaluation.
   Declared in `packages/test-contracts/src/evaluation.ts` and validated in
   `evaluation-validation.ts`, mirroring `sanitizedPacketBytes`: required, one
   entry per packet in the same order.

**Counts only.** Nothing that came off the page travels. A band key must match
`RUN_EVIDENCE_BAND_KEY_PATTERN` (`^(?:\d{1,4}|unranked)$`) and a value must be a
non-negative safe integer. Both Lab readers rebuild the histogram entry by entry
rather than copying it, and the contract rejects anything else, because the run
detail is untrusted JSON and this is the one field of a packet whose keys the
bundle's own code does not fix.

`null`, not `{}`, for a packet that stated no composition. "Not recorded" and
"the packet described nothing" are different answers, and collapsing them is the
mistake that made `run-muexhp0k-73172f73` unanswerable in the first place.

### The design change the tests forced

The first draft made `composition` non-droppable, on the argument that it
describes the trimming. The domain's starved-budget row
(`sanitize.test.ts`, "the parameters are paid for inside the budget") failed
with `elements: 0` where 1 was expected: the histogram's ~60 bytes were
displacing the packet's **last element**. That is the wrong trade — a model can
act on an element and cannot act on a count. `composition` is now last in
`DroppableEvidenceField`, after every page fact and after `repairParameters`,
one rung before the element itself. A packet that gave it up still says
`budgetTruncated`, so its silence reads as "the budget took it" rather than
"nobody counted". `limits.test.ts`'s trim-ladder row gained that rung
explicitly.

### Tests added

- `domain/src/runtime/llm-evidence/tests/composition.test.ts` (new): band
  reading and malformed-band handling; counting and ordering; a packet stating
  its own composition; the element bound cutting a filter rail band by band; the
  byte trim moving elements to the dropped side; a sanitizer refusal counted as
  dropped; and a row asserting the serialized histogram is exactly
  `{"included":{"1":1,"7":1},"dropped":{}}` for a page whose elements are named
  "Brightaisle Plus" and "Members save more".
- `packet-carries-no-selector.test.ts`: the leak test's allow-list now admits
  `composition`, `included`, `dropped` and band-shaped keys and nothing else,
  with two fixture elements given bands so both a numbered key and `unranked`
  are scanned.
- `limits.test.ts`, `sanitize.test.ts`: the trim ladder's new rung and the
  whole-packet expectations.
- `packages/test-runner/src/flow-lane/tests/persisted-flow-run.test.ts`: the
  existing leak row now carries a real composition on one packet and none on the
  other, plus a new row proving a malformed composition is rebuilt entry by
  entry or recorded as `null`.
- `packages/test-runner/src/run-evaluation/tests/flow-lane-evidence-sizes.test.ts`:
  composition travelling beside size, one entry per packet, and a malformed one
  unable to put page text in an evaluation.
- `packages/test-contracts/tests/evaluation-contracts.test.mjs`: eight new
  rejection rows (length mismatch both ways, not a list, a band that is page
  text, a fractional count, a negative count, a missing half, an extra property)
  and one acceptance row for a realistic recorded composition.
- `apps/extension/src/background/connection/tests/gateway-payloads.test.ts`: the
  `fullyDescribed` fixture now carries `snapshotBucket` and `repeatCount`, so
  the existing "carries every field the contract declares, and only those" row
  proves neither crosses the wire.

## Commands run and observed results

All run inside the worktree. No Lab, no Playwright, no browser.

| Command | Observed |
| --- | --- |
| `pnpm --filter @fluxiq-web-extension/extension exec tsc -p tsconfig.json --noEmit` | exit 0, no output |
| `pnpm --filter @fluxiq-web-extension/domain exec tsc -p tsconfig.json --noEmit` | exit 0, no output |
| `pnpm --filter @fluxiq-web-extension/test-runner exec tsc -p tsconfig.json --noEmit` | exit 0, no output |
| `node apps/extension/scripts/test-extension.mjs` | `# tests 746 # pass 746 # fail 0` |
| `node domain/scripts/test-domain.mjs` | `# tests 788 # pass 788 # fail 0` |
| `node --test "packages/test-contracts/tests/*.test.mjs"` | `# tests 126 # pass 126 # fail 0` |
| `pnpm --filter @fluxiq-web-extension/test-runner test` | `# tests 1341 # pass 1340 # fail 1` |
| `node scripts/structure-audit.mjs` | `structure-audit: passed (101 warning(s), 121 baselined)` |

Two things the runs caught and I fixed:

- The structure audit initially reported
  `FAIL [contract-spread] domain/src/runtime/llm-evidence/tests/composition.test.ts: 1 property spread into an object literal, at line 12`.
  The test helper built its fixture with `...(band === undefined ? {} : { snapshotBucket: band })`;
  it now writes the field by name. Re-run: passed.
- The test-runner suite first reported **69 failures**, every one of them
  `SyntaxError: The requested module '@fluxiq-web-extension/test-contracts' does not provide an export named 'RUN_EVIDENCE_BAND_KEY_PATTERN'`.
  Cause: `pnpm --filter test-runner test` runs its own `pnpm build` but resolves
  `@fluxiq-web-extension/test-contracts` to that package's **dist**, which it
  does not rebuild. `pnpm --filter @fluxiq-web-extension/test-contracts build`
  first, and the count dropped to 7, then to 1. **Anyone re-running this suite
  after a test-contracts change must build test-contracts first.**

### The one remaining failure is pre-existing

`not ok 638 - the call, token and cost numbers the Lab mirrors are Core's own`
(`packages/test-runner/src/live-llm/tests/live-llm-plan.test.ts`):

```
ENOENT: no such file or directory, open
'F:\fxwork\!FluxIQ\packages\fluxiq\src\programs\automation-studio\runtime\llm\execution-grants.ts'
```

The test reads a Core source file to mirror Core's own numbers; that file no
longer exists in the shared Core worktree (`ls` of that directory confirms it is
absent — the neighbouring `grant-capabilities.ts`, `run-budget.ts` and
`execution/` are there). This diff touches no Core file and nothing under
`live-llm/`. It is unrelated to this task and most likely already addressed on
`dev`, which is six commits ahead of this branch.

## Not verified

- **No live run.** A campaign was in flight in the main checkout, so no Lab,
  Playwright or browser run happened. The extension's actual stamping of
  `snapshotBucket` on a real page is therefore covered only by type-checking and
  by the wire-exclusion test. The end-to-end proof this change exists for is one
  live Flow-lane run whose `evaluation.json` shows a non-null
  `evidence.packetComposition` — that is the first thing to look at on the next
  live run, and it is the artifact that would have answered the original
  question about the Brightaisle Plus filter.
- Repository-level `pnpm check`, `pnpm test` and `pnpm build` were not run; only
  the package-level checks above.
- `apps/extension` has no Node-runnable test that drives `captureSnapshot()` —
  the runner has no DOM and `tests/stub-page.ts` provides no `document`,
  `getComputedStyle` or `getBoundingClientRect`. Content-script behaviour is the
  Playwright harness's (`test:content`), which I did not run.

## Open questions or contradictions found

1. **The brief named files that do not hold the contract.** It said to follow
   `packages/test-contracts/src/evidence.ts` + `evidence-validation.ts`. Those
   hold `EvidenceEvent` and `EvidencePolicy`, which are a different contract.
   `RunEvidenceSizes` — the one that holds `sanitizedPacketBytes` — lives in
   `evaluation.ts` and is validated in `evaluation-validation.ts`. I mirrored
   `sanitizedPacketBytes` where it actually is, which is what the brief asked
   for in substance.
2. **The ~40-element bound is not in `dom-snapshot.ts`.** The brief located it
   there; it is `WEB_LLM_EVIDENCE_BOUNDS.elements` in
   `domain/src/runtime/llm-evidence/limits.ts`, applied in `sanitize.ts`.
   `dom-snapshot.ts` has its own, much larger bound
   (`MAX_SNAPSHOT_CANDIDATES = 2,000`). The histogram is of the packet, not the
   capture, which is why the domain had to be involved at all.
3. **`git merge dev` is blocked for a worker.** The coordinator asked me to
   merge `dev` if my branch touched
   `apps/extension/src/content/extraction/detect-pagination.ts`. It does not, so
   nothing needed resolving — but the hook
   (`workers must not change git history`) refuses `git merge` regardless, so
   the branch is still six commits behind `dev` (`a552b6f`). The merge is the
   supervisor's at finish time.
4. **`packetComposition` is required, not optional.** I made it required so a
   new producer cannot silently forget it — which is precisely the failure mode
   this task exists to close. The cost is that every fixture had to be updated
   (17 files, mechanically). If the supervisor would rather it were optional,
   that is a one-line change in `evaluation-validation.ts` plus the type.
5. **The histogram costs bytes inside the packet's own budget**, roughly 40–70
   on a realistic page against a 6,000-byte exploration budget (about 1%). It is
   now the last thing dropped, so it never costs an element except at budgets far
   below anything the product uses. Worth re-checking against a real live packet.
