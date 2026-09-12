# Report: w3-evidence

Worker: `w3-evidence`. Wave 3: Phase 1.4 steps 2 and 3 on the extension side —
the five absent evidence items, and the five partial ones, on the content
script's `DomSnapshot`.

## Outcome

**Done**, with one file in my Owns deliberately left unchanged and two seams the
brief did not cover.

Eleven new modules under `apps/extension/src/content/evidence/`, wired into
`captureSnapshot` through one call. Nineteen new content-harness specs (a table
of fourteen rows plus five interaction tests) pass on `modal-flows`,
`infinite-feed`, `product-catalog` and `intermediate-state`; eight new unit
tests cover the diff rule without a browser; extension `check` passes; the
structure audit is clean with every new file staged.

`apps/extension/src/runtime/result-mapping.ts` needed no change, and I made
none — see [The file I did not change](#the-file-i-did-not-change). I added a
test there proving why, because the reason it needs no change is a property that
could silently stop holding.

## What the snapshot now carries

`DomSnapshot.evidence` is one optional object. Collections that found nothing
are omitted, so a plain page costs almost nothing to describe.

| Field | Item (audit numbering) | What it says |
| --- | --- | --- |
| `elements` | 1, 11, 12 (`truncated`, totals) | `scanned`, `candidates`, `matched`, `returned`, `truncated`, `changed`, `recentlyInteracted` |
| `loading` | 14 | `documentState`, `busy`, `busyRegions[]`, `indicators[]`, `pendingNavigation` |
| `navigation` | 6 | `url`, `origin`, `path`, `referrer`, `type`, `redirects`, `historyLength`, `visibility` |
| `dialogs` | 7 | `open[]` (selector, role, modal, native, label, bounds), `modal`, `armPending`, `lastNative` |
| `overlays` | 15 | `tested`, `blockedCount`, `blockers[]` (selector, role, label, bounds, `blocks`, `blocked[]`) |
| `regions` | 8 | landmark `role`, `label`, `selector`, `bounds` |
| `repeating` | 9 | `containerSelector`, `signature`, `itemCount`, `representative`, `fields[]` |
| `forms` | 3 | `selector`, `label`, `action`, `method`, `controlCount`, `controls[]`, `submit` |

`DomElementDescriptor` gains two optional flags, `changed` and
`recentlyInteracted` (items 11 and 12), both set per capture.

Items 2, 4, 5, 10 and 13 were already present and are untouched. Item 16
(expected-state evidence) is `w3-domain-contracts`'s and `w3-host-runtime`'s.

## What changed and why

Eleven new files under `apps/extension/src/content/evidence/`, each answering
one question, plus a barrel:

- `dialogs.ts` — open `<dialog>`, `role="dialog"`, `role="alertdialog"` and
  `aria-modal="true"`, top-most first, with modality from `aria-modal` or
  `:modal`. A hidden dialog is not reported: the invite dialog of `modal-flows`
  is in the DOM from page load behind a `hidden` backdrop, and a reader that
  believed it was open would refuse every action on the page. The native half
  is what `action-runtime/dialog-control.ts` already calls "the snapshot's
  pending-dialog evidence": `armPending` from the arm attribute, `lastNative`
  from the observed attribute the page-world override writes.
  **`promptText` is projected out deliberately** — it is whatever a person typed
  into a `prompt`, and it must not leave the page.
- `overlays.ts` — the occlusion hit-test. Every existing visibility rule asks
  whether an element paints; none asks whether anything paints over it, so a
  consent banner leaves its victims looking perfectly actionable. The blocker
  reported is not the element `elementFromPoint` named but the outermost
  ancestor of it that still excludes the target, which is the thing a reader has
  to deal with — on `modal-flows` that is `consent-banner`, not the `<h2>` inside
  it.
- `loading.ts` — `readyState`, `aria-busy` regions, and indicators in three
  kinds. A live region whose text says it is loading is read **before** the
  class-name heuristic, so `infinite-feed`'s `role="status"` "Loading more
  posts..." is reported as a `status`, not as a `spinner` because its test id
  happens to contain the word.
- `regions.ts` — landmarks, with the same role rule `identity/context.ts` uses
  for `DomElementContext.landmark` (see the open questions: it is duplicated,
  not shared).
- `repeating.ts` — sibling-similarity clustering. The signature reduces a test
  id to its *shape* (`pagination-page-1` becomes `pagination-page-#`), so a page
  that numbers its rows is one template rather than N singletons; without that,
  `product-catalog`'s pagination would be invisible. Each run reports the test
  ids found inside its representative item, which is what aims
  `web.dom.extract_list`.
- `forms.ts` — grouped by `form.elements`, not by ancestry, so a control that
  claims its form through `form="id"` is grouped where it belongs. **No value
  ever appears**: only `hasValue` presence, plus a `sensitive` flag from the
  shared rule in `shared/sensitive-field.ts` so a reader knows not to ask.
- `navigation.ts` — the facts the page itself can state: URL split into origin
  and path, referrer, Navigation Timing `type` and `redirectCount`,
  `history.length`, `visibilityState`.
- `interactions.ts` — the runtime recency ledger. This is the half the audit's
  item 11 was missing: `event-elements.ts` is fed only by `dom-events.ts`, whose
  every listener returns early unless recording is on, so during a run the queue
  is empty. The ledger listens to the same six events in the capture phase with
  no recording gate, and **counts untrusted events too** — the automation's own
  clicks and input are exactly what "recently interacted" has to include,
  because they are what changed the page between two snapshots.
- `changes.ts` — the diff. Fingerprint is taken from the **descriptor**, not the
  element: the descriptor is what a consumer compares, so anything invisible to
  it is not a change anyone can observe, and keeping the rule off the DOM makes
  it testable in Node. Position comes from `documentBounds`, because with
  viewport bounds every element on the page would "change" on every scroll.
- `page.ts` — the composer, so `dom-snapshot.ts` gains one call rather than
  eight.
- `types.ts`, `index.ts`.

Changed:

- `content/dom-snapshot.ts` — `snapshotElements` now returns the descriptors
  paired with their elements plus the funnel counts, and `captureSnapshot` adds
  `evidence`. 174 → 195 lines.
- `content/types.ts` — widens `DomElementDescriptor` and `DomSnapshot`. See
  [the seams](#the-seams-the-brief-did-not-cover).
- `runtime/tests/result-mapping.test.ts` — one new test.
- New `content/evidence/tests/changes.test.ts` (8 tests) and
  `e2e/content/tests/evidence.spec.ts` (19 tests).

### Judgements worth knowing about

- **The evidence is one nested object, not eight top-level fields.** It keeps
  the widening of `DomSnapshot` to a single property, which is what let the
  extension-side type change stay inside my Owns, and it gives `w3-llm-packet`
  and `w3-state-identity` one thing to read.
- **`truncated` lives at `evidence.elements.truncated`, with the pre-filter
  totals beside it**, rather than as a second top-level flag. A bare boolean
  cannot distinguish a small page from a large one whose tail was dropped; the
  funnel (`scanned` → `candidates` → `matched` → `returned`) can.
- **A first capture marks nothing changed.** There is nothing to have changed
  from, and reporting every element as new on every page load would be noise
  that swamps the signal.
- **Descriptors that share a diff key are left undiffed** rather than diffed
  against each other. Only one fingerprint can be held per key, so whichever
  duplicate lost would read as changed on every capture from then on. In
  practice `describeElement` always sets `xpath`, so this is a guard, not a
  common path.
- **Every sweep is capped**: 40 hit-tests, 2,000 swept items for clustering, 20
  regions, 8 forms with 30 controls each, 8 loading indicators, 5 dialogs, 5
  blockers. `captureSnapshot` runs on every action result, so an uncapped sweep
  would be a per-action cost on every page.

## The file I did not change

`apps/extension/src/runtime/result-mapping.ts` is in my Owns and is unchanged,
because the evidence already reaches the gateway through it:
`gatewayActionResultFromBrowserResult` hands the whole snapshot to
`webAutomationActionResultPayload` (`domain/src/client/gateway-mapping.ts:142`,
`snapshot: result.snapshot`), which copies the object rather than rebuilding it,
and the same is true of `element`. Editing it to "carry" the evidence would have
been a change with no effect.

That property is load-bearing and invisible, so I pinned it: the new test *the
snapshot's page evidence and the descriptors' activity flags reach the gateway
payload* fails if either mapper ever starts copying field by field. If the
supervisor intended a specific change here that I have not found, the brief
should say which, because nothing in the code needs one.

## The seams the brief did not cover

Both are the shape the wave's binding rules warn about — ownership drawn around
a file rather than around the change. Neither leaves anything inert: the wire is
JSON and every hop passes the snapshot through whole, so the evidence reaches
the gateway and the state pipeline today. They are type- and rule-level.

1. **The widened types are declared in `content/types.ts`, not in
   `shared/protocol.ts`.** `DomSnapshot` and `DomElementDescriptor` are declared
   in `apps/extension/src/shared/protocol.ts`, which no Wave 3 brief owns, and
   that file's own header says the point of `content/types.ts` is to re-export
   rather than redeclare. So `content/types.ts` now intersects the protocol
   shapes with the new fields. It compiles and behaves correctly — the protocol
   already makes `BrowserActionResult` generic over both shapes "so the
   extension keeps its richer shapes" — but the richer shape now lives one file
   away from the base one, and `e2e/content/harness.ts` types `capture()` as the
   protocol shape, so my spec casts. **The three declarations should move into
   `shared/protocol.ts` beside the base shapes** once one brief owns both files;
   the comment in `content/types.ts` says so.
2. **The landmark role rule is duplicated.** `regions.ts` needs the same rule as
   the private `landmarkRole` in `content/identity/context.ts` (same role set,
   same tag map, same "a `<section>` or `<form>` needs an authored name"
   requirement). `content/identity/` is `w3-resolver`'s, so I could not export
   it. The two must agree or an element's `context.landmark` will name a region
   the region list does not contain. **`landmarkRole` should be exported from
   `content/identity/` and imported by `regions.ts`.** This is not the
   sensitivity-rule class of duplication — no security consequence — but it is
   the same failure mode.

A third gap is in a file nobody's brief owns:

3. **Merged multi-frame snapshots carry only the top frame's evidence.**
   `background/connection/dom-snapshot.ts captureMergedTabSnapshot` builds
   `{ ...topSnapshot, interactiveElements: mergedElements }`, so on the recording
   path a merged snapshot's `evidence` describes the top frame while its element
   list spans every frame, and `evidence.elements.returned` reads low against it.
   The action path is top-frame only unless a frame is addressed, where the two
   agree. This is the same "frame coverage differs by pipeline" defect the
   evidence audit recorded, now with one more field on it.
   `PageEvidence`'s doc comment states the limitation. Fixing it means merging
   the per-frame evidence in that file, which no Wave 3 brief owns —
   `w3-llm-packet` is asked to make frame coverage match the state pipeline and
   may collide with it.

## Commands run and observed results

`EXTENSION_TEST_BUILD_LABEL=w3-evidence` was set for every extension command.
Exit status was captured by redirecting to a file and echoing `$?`, never
through a pipe. No `pnpm build` and no `pnpm lab` command was run.

- `pnpm --filter @fluxiq-web-extension/extension check` → **exit 0**.
  `> tsc -p tsconfig.json --noEmit && tsc -p tsconfig.test.json`, no diagnostics.
- `pnpm --filter @fluxiq-web-extension/extension test:content -- evidence.spec.ts`
  → **exit 0**, `19 passed (4.4s)`. Every row named in the definition of done.
- `pnpm --filter @fluxiq-web-extension/extension test:content` (whole suite) →
  **exit 1**, `18 failed / 159 passed`. Re-run once: **the identical 18**. None
  is mine, and all 19 of my rows pass in both runs. The 18 are in files three
  other briefs are editing right now:
  - eleven (`check-assert` ×2, `click` ×3, `keyboard` ×4, `select` ×3 — counted
    as the rejection group) expect codes like `web.action.not_checkable`, and
    `content/action-runtime/results.ts:159` now emits
    `WEB_AUTOMATION_FAILURE_CODES.ACTION_REJECTED` for every rejection. That is
    `w3-failure-producers` mid-flight; I read the file to confirm rather than
    inferring it.
  - `upload-dialog` ×2, same cause.
  - `resolve-target` ×3 — `content/action-runtime/resolve-target.ts` is modified
    (`w3-resolver`).
  - `redaction` ×1 — `w3-redaction`.
- `pnpm --filter @fluxiq-web-extension/extension test` → **exit 1**,
  `# tests 143 / # pass 140 / # fail 3`. Re-run once: identical. The three are
  `content/actions/tests/value-redaction.test.ts` (`w3-redaction`) and
  `runtime/tests/action-runner.test.ts` ×2 (`w3-frame-plumbing`). My nine unit
  tests pass in both runs (`ok 75`–`ok 82`, `ok 134`). The test count rose from
  139 to 143 between two of my runs, which is the parallel wave landing tests.
- `node scripts/structure-audit.mjs` with a scratch `GIT_INDEX_FILE` (a copy of
  `.git/index` plus `git add -N` of `content/evidence/`,
  `e2e/content/tests/evidence.spec.ts` and this report; the real index was never
  written) → **exit 1**, one violation:
  `FAIL [working-docs] docs/working/README.md is out of date with the documents'
  header blocks`. It is not mine and not caused by my files: the same run
  without them reports it too, `docs/working/README.md` and the plan document
  are both already modified in the tree, and the rule reads only top-level
  `docs/working/*.md`. `pnpm structure:baseline` was not run. No finding names
  any file I created or changed, and the warning count is 27 with and without my
  files.
  Run against the real index — where `content/evidence/` is still untracked —
  the audit adds
  `FAIL [imports] apps/extension/src/runtime/tests/result-mapping.test.ts: 1
  import(s) reach into another directory's files`. That is the staging artefact
  the wave's binding rules describe: `../../content/evidence` is a directory
  import and passes as soon as the directory is tracked. **The supervisor must
  stage `content/evidence/` before running `pnpm check`.**

## Not verified

- **No live browser validation beyond the harness.** The content harness runs
  the real bundle in real Chromium on the real fixtures, but with no extension,
  no background worker and no frame routing. Nothing here is proven across
  extension contexts, in Firefox, or on a real site.
- **No `pnpm build`, no `pnpm check` at the repository root, no domain or
  test-runner command, no Lab run.** All the supervisor's, per the brief.
- **Per-capture cost was not measured.** `captureSnapshot` runs on every action
  result and now does seven more DOM passes. Each is capped (the numbers are
  above), and the 178-spec harness suite still finishes in about 25 s, but I did
  not measure the added milliseconds per capture, and there is no before-number
  to compare against.
- **`truncated: true` is not exercised.** None of the four fixtures produces
  more than the 2,000-element cap — `infinite-feed` tops out near 360 elements —
  so the spec asserts the funnel invariant and `truncated === (matched >
  returned) === false`. The flag flipping is proven only by construction. The
  byte-budget truncation proof at the packet level is `w3-llm-packet`'s.
- **The recording path was not exercised end to end.** I asserted the evidence
  survives the gateway mapping in a unit test and read the merge code, but no
  test drives content script → background worker → `StateSnapshot` with evidence
  on it. The merged-frame gap above is read from the code, not observed.
- **`armPending` is only ever observed false.** The page-world override consumes
  an arming on the dispatching call stack, so a `true` means the override is
  absent — a state the harness always installs its way out of. The spec asserts
  the false case only.
- **`:modal` is assumed available.** Native `<dialog>` modality falls back to
  `aria-modal` where `matches(":modal")` throws. No fixture uses a native
  `<dialog>`, so neither branch is covered by a spec; the ARIA path is.
- **The 18 harness failures and 3 unit failures are attributed, not proved
  mine-free by bisection.** I read `results.ts` to confirm the rejection-code
  change and checked `git status` for the other files; I did not revert anyone's
  work to prove a green baseline.

## Open questions or contradictions found

- **Should `armPending` exist at all?** As built it can only be true when the
  page-world override is missing, which the `web.dom.dialog` verb already
  reports as a capability failure. It is one boolean and it is honest, but if
  the plan meant "a native dialog is on screen right now", that is not
  observable from the isolated world — the override answers armed dialogs
  without opening them, and an unarmed one blocks the page's script so no
  snapshot can be taken while it stands. The supervisor should decide whether
  the field earns its place.
- **`interactions.ts` installs DOM listeners when the module loads**, guarded by
  `typeof document !== "undefined"`. That is a side effect on import, which
  `content/index.ts`'s header says behaviour should not have — but the ledger has
  to be listening before the first action runs, and `content/index.ts` and
  `dom-events.ts` are both outside my Owns, so I could not wire it from the
  entry point. If the supervisor prefers explicit wiring, it is a one-line
  `installInteractionTracking()` in `content/index.ts` and a two-line change
  here.
- **Two rules now decide "is this element hidden", and neither is shared.**
  `dom-snapshot.ts shouldIncludeSnapshotElement`, `dialogs.ts isShown` and
  `loading.ts isPainted` each apply their own combination of `hidden`,
  `aria-hidden`, `display`, `visibility`, `opacity` and a rect test, because each
  needs a slightly different answer. That is defensible but it is three
  near-identical rules in one directory; a shared `visibility.ts` in `content/`
  would be better, and `content/` is shared ground this wave.
- **The forms model reports only real `<form>` elements.** Controls owned by no
  form are left to `interactiveElements` — a group with no form has no identity
  to report it under. On `product-catalog` that means the in-stock checkbox,
  which sits in a `<fieldset>` outside the form, is absent from `forms` (the spec
  pins this). If the plan wanted every control grouped, an "unassociated" pseudo
  form is needed and the shape has to change.
