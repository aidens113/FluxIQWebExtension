# Report: w3-evidence-finish

Worker: `w3-evidence-finish`. The two gaps `w3-evidence-consumption` left in files
its brief did not grant it.

No captured or real secret value appears in this report or in any test I wrote.
The only attribute string quoted is the `autocomplete` token list itself, which
is page markup, not a value.

## Outcome

**Partial.** Task 2 is done, with all three of its conditions evidenced. **Task 1
is blocked**, and the same way its predecessor was: the change needs two files my
brief's `Must not touch` list forbids, and the producer half on its own is
provably inert. I measured that rather than argued it — see below — and did not
ship it.

- **Task 2 (the recording event carries the merged snapshot): done.** One merge
  per recorded event, counted. A single-frame page's event is byte-identical to
  today's. Nothing downstream reads the frame-local shape.
- **Task 1 (`autocomplete` on `FormControlEvidence`): blocked**, with the exact
  three-line fix and the two missing files named.

Extension `check` **exit 0**, extension `test` **exit 0, 203/203**, content
harness **exit 0 on rerun, 180 passed**, domain `check` **exit 0**, domain `test`
**exit 0, 245/245**, structure audit **exit 0** and byte-identical to a run
without my file.

## Task 1 — blocked, and the inertness is measured

### What the brief assumed, and what is actually there

The brief says `FormControlEvidence` is in
`apps/extension/src/content/evidence/forms.ts`. It is not: `forms.ts` imports it
from `apps/extension/src/content/evidence/types.ts:124`, and my brief says
`content/evidence/**` beyond `forms.ts` is not mine. The consumer that has to ask
the rule is `domain/src/recording/web-state/evidence/project.ts:257-258`, and
`domain/**` is not mine either.

So the field can be *emitted* from a file I own and *read* by no one.

### The proof that the producer half alone is inert

Rather than assert it, I ran the real projection
(`createWebAutomationStateFromSnapshot`, through the extension's own esbuild
against `@fluxiq-web-extension/domain/client`) over one form control three ways.
Verbatim output:

```
1 today, producer flag absent, no autocomplete on the wire:
    {"selector":"#card","controlType":"text","name":"card","label":"Card number","hasValue":true}
2 same control, producer flag absent, autocomplete carried:
    {"selector":"#card","controlType":"text","name":"card","label":"Card number","hasValue":true}
3 producer flag present (the only guard today):
    {"selector":"#card","controlType":"text","name":"card","label":"Card number","sensitive":true}
4 the shared rule asked with the attribute: true
5 the shared rule asked the way the projection asks it: false
```

Rows 1 and 2 are identical, which is the whole finding: **carrying the attribute
changes nothing until the projection asks with it.** Row 4 against row 5 is the
gap itself — the shared rule in `domain/src/sensitivity/` recognises the token
list, and the projection asks it with `{inputType: controlType, controlType}`
only, so it can never see one. Row 3 is what stands between a card field and the
model today: the producer's flag, alone, exactly as the brief describes.

I therefore edited nothing for Task 1. Shipping row 2 would have added a field to
every form control on every snapshot with no reader, which is the defect the
wave's binding rules tell workers to report instead of ship.

### The change, when someone owns all three files

Three edits, five lines. Each is written the way it is for a stated reason.

1. `apps/extension/src/content/evidence/types.ts`, in `FormControlEvidence`:

```ts
  /** The `autocomplete` attribute, verbatim, so a consumer can ask the shared rule itself. */
  autocomplete?: string | undefined;
```

2. `apps/extension/src/content/evidence/forms.ts`, in `describeControl`:

```ts
  const autocomplete = element.getAttribute("autocomplete")?.slice(0, 500);
  ...
  ...(autocomplete ? { autocomplete } : {}),
```

**Not `boundedText`.** That collapses and slices to 200 characters, and
truncating the input to a security predicate is a way past it — one of the three
defects `w3-sensitivity-consolidation` found in the LLM packet's copy. The 500
matches `describe-element.ts:97`, which is what every element descriptor's
`attributes.autocomplete` already travels under, so the two sides of the same
question stay consistent.

3. `domain/src/recording/web-state/evidence/project.ts`, in `formControl`:

```ts
  const autocomplete = typeof control?.autocomplete === "string" ? control.autocomplete : undefined;
  const sensitive = control?.sensitive === true || isSensitiveFieldSignature({ inputType: controlType, controlType, autocomplete });
```

**Not `text(control?.autocomplete)`** — same reason: `read.ts`'s `text()` slices
to 200. And the attribute is read for the decision only, never written into
state: it decides `sensitive` and `hasValue`, and adding it to the projected blob
would widen a persisted surface for nothing.

`input.ts` needs no change: it types `forms` as `unknown[]` and `formControl`
reads through `record()`, so the field is reachable without a declared shape.
The cross-frame merge needs no change either — `dom-snapshot.ts:219` spreads each
control (`{ ...control, selector: qualify(...) }`), so a new field survives the
merge on its own. I checked that specifically, because a merge that rebuilt
controls field by field would have been a fourth blocked file.

**The brief should have included `apps/extension/src/content/evidence/types.ts`
and `domain/src/recording/web-state/evidence/project.ts`.** With `forms.ts` that
is one worker's brief, and the proof belongs in
`apps/extension/src/background/tests/recording-evidence-pipeline.test.ts`, which
already drives the real merge into the real projection — plant a control with the
token list, no `sensitive` flag and `hasValue: true`, and assert `sensitive` is
`true` and `hasValue` gone.

## Task 2 — done: one merge, and the event carries it

### The change

`recording-evidence.ts` gains one public method and one optional argument:

```ts
export type CapturedEventSnapshot = { readonly snapshot: RecordingEventPayload["snapshot"] | undefined };

async captureEventSnapshot(payload, tabId?, frameId?): Promise<CapturedEventSnapshot> {
  if (this.deps.recordingState() !== "recording") return { snapshot: undefined };
  return { snapshot: await this.captureDomSnapshotForEvidence(payload, tabId, frameId) };
}

async sendRecordingEvidence(payload, tabId?, frameId?, captured?: CapturedEventSnapshot) {
  ...
  const snapshot = captured ? captured.snapshot : await this.captureDomSnapshotForEvidence(payload, tabId, frameId);
```

**The wrapper type is the load-bearing part.** Passing a bare
`snapshot | undefined` could not distinguish "the tab was read and came back with
nothing" from "nobody has read the tab yet", and the second would re-merge on
exactly the pages where the merge is most likely to be slow. Holding the object
is what says the capture already happened.

`connection.ts` `processRecordingEvent` runs the merge once and uses it twice:

```ts
const captured = await this.evidence.captureEventSnapshot(payload, tabId, frameId);
const recorded = captured.snapshot === undefined ? payload : { ...payload, snapshot: captured.snapshot };
await this.gateway.send("client.recording_event", gatewayRecordingEventFromPayload(recorded, tabId, frameId, this.activeRecordingId));
await this.evidence.sendRecordingEvidence(payload, tabId, frameId, captured);
```

`payload`, not `recorded`, still goes to `sendRecordingEvidence`: its no-snapshot
fallback puts `recordingEvidencePayload(payload)` in `latestEvidence`, and that
branch only runs when there was no merged snapshot to swap in anyway. Behaviour
there is unchanged.

The failure path is unchanged too. Every way the merge can fail — no tab id, an
unsupported page, an event that needs no state, a content script that cannot be
reached, a frame that times out — already returns `undefined` from
`captureDomSnapshotForEvidence`, and the event then goes out with the content
script's own snapshot exactly as it does today.

### Condition 1 — a single-frame page is unchanged. Holds, two ways.

- **Through the reporter**, as a committed test: *on a single-frame page the
  recorded event is byte-identical to the frame-local one* runs the real
  `captureEventSnapshot` and compares `JSON.stringify` of the two
  `gatewayRecordingEventFromPayload` results. Passes.
- **By size**, measured separately: the same event is **5,125 bytes both ways,
  delta 0**.

The pre-existing row `w3-evidence-consumption` left for this
(`recording-evidence-pipeline.test.ts`, *the merged snapshot builds a
byte-identical recording event*) also still passes, so the property is now pinned
at both the merge and the reporter.

### Condition 2 — no second merge. Holds, counted.

`apps/extension/src/background/connection/tests/recording-evidence.test.ts`, new,
five rows. A counting transport tallies `captureSnapshot` round trips while the
test runs *the exact two-call sequence `connection.ts` runs*.

| Case | round trips | row |
| --- | --- | --- |
| single frame, seeded at frame 0 | **1** | one recorded event costs one cross-frame merge, not two |
| three frames, seeded at frame 1 | **3** | same row |
| three frames, the old two-call shape | **6** | without the captured snapshot the reporter merges a second time |
| merge came back empty | **2, not 4** | a capture that came back with nothing is not tried again |

The third row is the counterfactual, kept deliberately: the regression is
invisible in any assertion about output, because both shapes send the same two
messages. Only the count shows it. The numbers for one merge match
`w3-evidence-consumption`'s measurements exactly (1 seeded, 3 for three frames).

### Condition 3 — nothing downstream depends on the frame-local shape. Holds.

Every structural reader of a recording event's `payload.snapshot`, found by
grep across both repositories:

- **`domain/src/recording/reducers.ts:44-47`** runs
  `createWebAutomationStateFromSnapshot(payload.snapshot)`. This is the reader
  the change is *for*: it moves from frame-local to tab-merged, which is the
  upgrade.
- **Core reads it structurally nowhere.** `interactiveElements` has **zero**
  occurrences in `F:\!FluxIQ`, and the only `.snapshot`-shaped read on a recording
  payload there is `payload.snapshotId` in
  `programs/automation-studio/runtime/service.ts:6225`. The snapshot is stored as
  opaque timeline JSON.
- **The test harnesses read a different snapshot.**
  `packages/test-runner/src/web-flow-exploration.ts:173-192` and
  `apps/extension/e2e/action.spec.ts:21` both read the result of a
  `web.dom.capture_snapshot` action sent with `topFrameOnly: true`, not a
  recording event.

The one behavioural difference, which `w3-evidence-consumption` predicted and I
confirmed: `browserFrameId` and `payload.element.selector` stay frame-local while
a merged snapshot qualifies a child frame's selectors `frame[<id>] >> ...`, so on
a child-frame event the target selector no longer appears verbatim in the event's
own element list. **This is not new — it is now consistent.** The `client.snapshot`
state message paired with every one of these events has carried the merged
snapshot since Phase 1.2, so the divergence already existed between the pair;
after this change both messages describe the page the same way. Nothing joins the
two today: `reducers.ts` writes `forms.<event.target.selector>` from the event
target and `elements.*` from the snapshot, and those keys were never matched
against each other.

### The cost that is inherent, stated plainly

A recorded event on a multi-frame page now carries the whole tab. Measured on a
synthetic checkout page (20 top-frame elements, 6 per child frame):

| Page | frame-local event | tab-merged event | delta |
| --- | --- | --- | --- |
| 1 frame | 5,125 B | 5,125 B | **0** |
| 2 frames | 2,780 B | 7,073 B | +4,293 B |
| 6 frames | 2,780 B | 14,866 B | +12,086 B |

This is the task, not a defect in the implementation: an event cannot describe
the page without carrying the page. It is zero on the single-frame pages that are
the overwhelming majority, and it appears only where the frame-local snapshot was
describing the wrong document. The same information already went out beside it in
the projected state; what is new is a second, raw, tab-wide copy on the event.
**If the supervisor judges that too much, the lever is here in `connection.ts`,
not in the reporter** — one line, sending `payload` unless the merge actually
spanned more than one frame.

One ordering change, for the record: the event is now sent *after* the merge
instead of before it, so it reaches Core later by roughly one content-script
round trip (each merge stage is bounded at `FRAME_SNAPSHOT_TIMEOUT_MS`, 150 ms).
Total work per event is unchanged — the evidence that follows already waited for
that merge — and the event still precedes its evidence on the wire.
`w3-evidence-consumption` listed this latency among the costs its one-merge shape
avoided; that is not quite right, and I want the correction on the record. The
merge must finish before the event can carry it. What the shape avoids is
*doubling*, not the wait.

## Commands run and observed results

`EXTENSION_TEST_BUILD_LABEL=w3-evidence-finish` and, where domain commands ran,
`DOMAIN_TEST_BUILD_LABEL=w3-evidence-finish`. Exit status captured by redirecting
to a file and echoing `$?`, never through a pipe. No `pnpm build`, no `pnpm lab`,
no `pnpm structure:baseline`, no git command that writes.

- `pnpm --filter @fluxiq-web-extension/extension check` → **exit 0**, no
  diagnostics. (Two earlier runs failed on other workers' files and are described
  under foreign failures.)
- `pnpm --filter @fluxiq-web-extension/extension test` → **exit 0**,
  `# tests 203 / # pass 203 / # fail 0`. My five rows are `ok 44`–`ok 48`.
- `pnpm exec playwright test -c e2e/playwright.content.config.ts --workers=4`
  (run from `apps/extension`, after `test:content` had built `test-contracts`)
  → **exit 1**, `180 passed`, one failure in `e2e/content/tests/scroll.spec.ts:129`
  (*untilStable: loads every post…*), a file I do not own and did not touch.
  Rerun of that spec alone → **exit 0**, `8 passed`. Transient under load, as the
  brief predicted.
  Note: `pnpm --filter … test:content -- --workers=4` does **not** work — pnpm
  forwards the literal `--` and Playwright reports `No tests found`. Run
  Playwright directly, as above. The harness ran before I reflowed one comment in
  `connection.ts`; that file is background code the content harness never loads,
  and `check` and `test` were both re-run after it.
- `pnpm --filter @fluxiq-web-extension/domain check` → **exit 0**.
- `pnpm --filter @fluxiq-web-extension/domain test` → **exit 0**,
  `# tests 245 / # pass 245 / # fail 0`. I changed no domain file; this is the
  check that Task 1's decision left the projection's inputs untouched.
- **My files alone**, type-checked while another worker's file was breaking the
  package: `tsc` over a scratch config listing `connection.ts`,
  `recording-evidence.ts` and both test files, plus their whole transitive import
  graph → **exit 0**. The scratch config lived in the ignored
  `.test-build-scratch/` and is deleted.
- Structure audit, `node scripts/structure-audit.mjs` through a scratch
  `GIT_INDEX_FILE` (a copy of `.git/index` plus `git add -N` of my new test) →
  **exit 0**, `passed (28 warning(s), 19 baselined)`. Run again against a pristine
  copy of the index with my file unstaged: the two outputs **diff to nothing —
  byte identical**. A final run with this report staged too → **exit 0,
  29 warnings**; I diffed the two warning sets and the entire difference is
  `content/action-runtime/resolve-target.ts` crossing the 400-line advisory at
  403 lines between the runs, which is `w3-resolver`'s file. No finding and no
  warning names anything of mine. The real index was never written.
- Two throwaway measurements (the Task 1 inertness proof and the Task 2 wire
  sizes) were bundled with the package's own esbuild into
  `apps/extension/.test-build-scratch/`, which is gitignored (`.gitignore:26`),
  and deleted afterwards.

**Three warnings name my area and none is mine.** `connection.ts: 747 lines`
(now 745 after I trimmed my comment), `FluxIQConnection has 39 methods` and
`background/connection/: 19 source files` are all pre-existing —
`git show HEAD:apps/extension/src/background/connection.ts | wc -l` is **738**,
already past the 400-line advisory, and the file is not in
`.structure-baseline.json`, whose hard limit is 800. I added **7 lines** to it and
**no method to its class**. `recording-evidence.ts` went 300 → 348 lines, still
under the advisory.

**Foreign failures, all in files another worker was editing, none fixed by me:**

1. First `check`: **14 errors** in `runtime/action-results.ts`,
   `runtime/action-runner.ts`, `content/action-runtime/results.ts` and
   `content/actions/assert.ts` — `AutomationStudioFailureRecord.code` not
   assignable to `WebAutomationFailureCode`. A later run had **3 errors** in
   `content/action-runtime/resolve-target.ts` (`TARGET_SCORE_FLOOR`,
   `scoreTargetCandidates` and `CandidateSelection` missing from the `identity`
   barrel — `w3-resolver` mid-edit, its `content/identity/score.ts` still
   untracked). The run after that was clean.
2. First full `test` run: **4 failures** in `content/actions/tests/assert.test.ts`
   (the `STATE_MISMATCH` rows). Green on the rerun.
3. The scroll spec above.

One failure in that first run *was* mine and is fixed: I had asserted the merged
element order as top-frame-first, and the merge puts the seeded frame first,
because the frame the event came from is the seed rather than one of the frames
the sweep reads. The test now pins that order with the reason written beside it.

## Not verified

- **No live browser validation.** No unpacked extension was loaded, and the frame
  snapshots in my tests are hand-written. What is proven is the joinery and its
  cost, not the browser behaviour those snapshots stand for. This change alters
  the recording wire payload for every executable recorded action on a
  multi-frame page, so a Lab or manual recording on a real iframed page is worth
  doing before it is called finished.
- **`processRecordingEvent` is reproduced, not executed.** `FluxIQConnection`
  builds its own transport from module-level `chrome` wiring in `./tabs`, so it
  cannot be constructed under the node test runner. My test runs the same two
  calls in the same order against a real `RecordingEvidenceReporter`; I read the
  method to confirm they match, and the diff is five lines. Nothing executes
  `FluxIQConnection` itself.
- **Core's side.** Nothing here observed a `client.recording_event` arriving at
  Core with a merged snapshot, or a recording replayed from one. Condition 3's
  Core half is a grep over `F:\!FluxIQ`, not a run.
- **The wire-size figures are synthetic.** They come from a fabricated page with
  20 top-frame and 6 per-frame elements, not from a measured real one.
- **`pnpm build`, root `pnpm check` and root `pnpm test`** were not run, per the
  wave's binding rules.

## Open questions or contradictions found

1. **Task 1 is still open and it is still the security one.** Two files, five
   lines, written out above. Until it lands, a card field marked
   `billing cc-number` is protected on the persisted-state path by the producer's
   flag alone — and rows 1 and 2 of my measurement show the domain cannot help,
   whatever the producer sends.
2. **The `autocomplete` a descriptor already carries is sliced to 500
   characters** (`describe-element.ts:97`), and `isSensitiveElementDescriptor`
   reads that sliced value. It is the same class of hazard as the 200-character
   truncation that let `billing cc-number` through, several orders of magnitude
   less likely to bite, and I did not change it — I do not own the file. Worth a
   decision rather than an inheritance: either the attribute is exempt from the
   display bound wherever the rule reads it, or the bound is acknowledged as part
   of the rule.
3. **`browserFrameId` and the event's snapshot now speak different dialects, on
   purpose.** Documented above and worth a line in the architecture docs when the
   wire contract is next written up: a child-frame event's `element.selector` is
   frame-local, and its snapshot's element list is frame-qualified.
4. **`connection.ts` is 745 of its 800-line hard limit** with 39 of 40 allowed
   methods on `FluxIQConnection`. Nothing here crossed either, but the next brief
   that adds a method to that class will fail the audit, and the file is the
   facade every recording change passes through.
5. **A wave rule cost two full gate runs to discover.**
   `pnpm --filter … test:content -- --workers=4` silently forwards the `--` to
   Playwright as a test-name filter and reports `No tests found` with exit 1,
   which reads like a broken harness. The wave's binding rules should say to run
   Playwright directly when passing flags.
