# Report: v-fingerprint-read

Worker: `v-fingerprint-read`. The consumer half of Wave 3's declared element
fingerprint.

## Outcome

**Done.** `resolve-target.ts` now reads `action.element`, the declared field,
and falls back to `action.options?.element` only when no declared field
arrived. Four new rows in `apps/extension/src/content/action-runtime/tests/
resolve-target.test.ts` hold both halves of that contract; the first one was
observed failing before the change and passing after, with both outputs quoted
below.

Extension `check` exit 0 with zero `error TS`, extension `test` exit 0 with
225 of 225 passing. The content harness has six failures, none of them in a
file I own and none reachable by this change — five belong to the concurrent
scorer/floor worker and one to the evidence worker; the evidence is in
[Commands run](#commands-run-and-observed-results). Structure audit exit 0.

**One thing the supervisor should know before integrating:** another worker is
editing `resolve-target.ts` at the same time as me, and the brief gave me that
file as sole owner. Details in
[Open questions](#open-questions-or-contradictions-found).

## What changed and why

### The gap, restated in one line

`gateway-mapping.ts` populated `action.element`, a domain test proved it agreed
with `options.element`, and no reader existed. So deleting the untyped
`options` blob — the tidy-up the declared field was added to enable — would
have taken every identity signal away from the resolver with `tsc` silent,
because no type describes `options.element` at all.

### The change

`apps/extension/src/content/action-runtime/resolve-target.ts`, in
`recordedTarget()`:

```ts
function recordedTarget(action: BrowserActionCommand): RecordedTarget | undefined {
  return describedElement(action.element) ?? describedElement(action.options?.element);
}

/** A wire value that is an element description: an object carrying at least one signal. */
function describedElement(value: unknown): RecordedTarget | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return Object.keys(value).length ? value as RecordedTarget : undefined;
}
```

Everything downstream of `recordedTarget()` is untouched: the same value feeds
the exact fingerprint strategy, the gate's tag agreement, the candidate family
of a `TARGET_NOT_FOUND`, and the recorded side of Core's scorer.

### Why this order, and why it is not a second order

`w3-domain-contract-gaps` measured the real dispatch path and established the
rule: **an adapted copy wins only when Core actually matched a candidate;
otherwise the original wins.** Core's `prepareElementTargetAction` rewrites
`parameters.target` on every policy dispatch, and its normalizer reads only the
parameters' own top-level keys — never inside `parameters.element` — so with no
runtime candidates the wire target is a lossy re-derivation of the same
recorded element. Measured there: 11 identity signals before Core's io-policy
step, 1 after.

The important point for this brief is **where that rule already lives**. It is
implemented in the domain, in `gateway-mapping.ts`
`elementFingerprintSources()`:

```ts
return adaptedTarget?.selectedCandidate !== undefined
  ? [target.element, target.fingerprint, parameters.element]
  : [parameters.element, target.element, target.fingerprint];
```

`action.element` is therefore *already* the winner of that comparison. The
resolver's consistent preference is not to re-derive the rule from
`selectedCandidate` — the content script cannot see it anyway, since
`parameters.target` is not lifted onto the command — but to take the
description the domain chose:

- **Core matched a candidate.** `action.element` is the adapted copy, and by
  the rule it wins. Preferring it is the rule.
- **Core matched nothing** (every dispatch today). `action.element` is
  `elementFingerprint(parameters.element)`, and `options.element` is
  `parameters.element` raw — the same element, so the preference is a no-op and
  cannot regress anything.

That is why the change is one line rather than a branch. Re-deriving the
comparison here would have been the second order the brief warned against: two
places to keep in step, and today they would disagree the moment the wire
starts carrying candidates.

### The one judgement call: an empty object is not an identity

`describedElement` treats `{}` as absent and falls through. Two reasons, and
neither is new policy:

1. It is the domain's own rule for the same value — `commandElementFingerprint`
   drops a fingerprint that normalizes to zero keys "because an input with no
   recognized signal … is not an identity".
2. Without it, a declared `{}` would shadow a populated `options.element` and
   blank the target. That is precisely the silent-regression shape this task
   exists to remove, so the third test row pins it.

Before this change `options.element = {}` produced an empty `RecordedTarget`,
which added a fruitless `element fingerprint` attempt to the miss list; now it
produces none. No spec asserts that miss (`resolve-target.spec.ts:115`, "every
strategy misses", passes), and no producer emits `{}`.

### The test, and why it is a pair

`apps/extension/src/content/action-runtime/tests/resolve-target.test.ts`, four
rows against a stubbed DOM (the extension's unit runner is Node):

| Row | Fails when |
| --- | --- |
| the declared element field is what resolves, not the untyped options blob | `recordedTarget()` stops reading `action.element` |
| the untyped options blob still resolves while it is the only description sent | the fallback is dropped while a caller still sends only `options` |
| a declared field with no identity in it falls back rather than blanking the target | `{}` starts shadowing a populated fallback |
| neither description leaves the resolver with no target at all | the no-target path stops failing cleanly |

The first two are each other's guard: together they say exactly when the
untyped path may be deleted. The declared and untyped descriptions name
*different* elements by selector, so which element comes back names which
description was read — the assertion cannot pass by accident.

One wrinkle worth recording, because it will bite the next test that stubs a
DOM here: the runner imports every test bundle into **one** Node process, so a
`document` left on the global leaks into later bundles.
`content/evidence/interactions.ts` installs listeners at load behind
`typeof document !== "undefined"`, and my first stub had no `addEventListener`,
which turned that guard into `TypeError: document.addEventListener is not a
function` in a later bundle — reported as "a resource generated asynchronous
activity after the test ended", nowhere near the file that caused it. The stub
now answers those methods and restores the previous global in `t.after`.

## Can the `options.element` fallback be removed?

**Not yet, and not by inspection alone.** Nothing in this change stops it from
being removed cleanly later; what is missing is proof that no producer relies
on it. Four things would have to be true:

1. **Every producer sends the declared field.** The gateway is not the only
   one. `apps/extension/e2e/content/harness.ts` builds commands by hand and
   sends `options: { element: … }` with no declared field — that is not a test
   detail to wave away, it is the harness the whole content suite runs on, so
   removing the fallback today turns most identity coverage red. Same shape for
   any hand-built or replayed command (`gateway-payloads.ts` replays stored
   results through the same mapping).
2. **The declared field is never poorer than the raw one.** It is normalized by
   `elementFingerprint`, which emits a fixed key set. I checked that set against
   every key the resolver and `score.ts` read — `selector`, `xpath`, `id`,
   `classNames`, `visibleText`, `tagName`, `name`, `attributes`, `role`,
   `implicitRole`, `testId`, `accessibleName`, `label` — and all thirteen
   survive. But `statePath`, viewport bounds and any future signal do **not**,
   so this has to be rechecked, not assumed, at removal time.
3. **A calibration path that reads the raw blob has been migrated.** The brief
   says a running worker's calibration work reads `options.element`; that has to
   land and move to the declared field first.
4. **A run proves it, not a compiler.** `tsc` cannot see this: `options` is a
   `JsonObject`. The proof is this test file's second row plus a green
   `test:content`, both after every producer has been changed.

The cheap way to make (1) true and provable: have the content harness send the
declared field, keep the second test row as the guard for anything that still
does not, and delete `options.element` only when a green harness run says
nothing reads it. Until then the fallback costs one `??`.

## Commands run and observed results

`EXTENSION_TEST_BUILD_LABEL=v-fingerprint-read` on every command. Exit status
captured by redirecting to a log and echoing `$?`, never through a pipe. No
`pnpm build`, no `pnpm lab`, no `pnpm structure:baseline`.

### The new test failing before the change, passing after

Before (`pnpm --filter @fluxiq-web-extension/extension test`, exit 1):

```text
not ok 96 - the declared element field is what resolves, not the untyped options blob
  error: |-
    the resolver must read action.element, the declared contract
      StubElement {
    +   id: 'save-recorded',
    -   id: 'save-adapted',
```

After, same command, exit 0:

```text
ok 96 - the declared element field is what resolves, not the untyped options blob
ok 97 - the untyped options blob still resolves while it is the only description sent
ok 98 - a declared field with no identity in it falls back rather than blanking the target
ok 99 - neither description leaves the resolver with no target at all
# tests 225
# pass 225
# fail 0
```

(The before run counted 143 tests and the after run 225: other workers added
tests to this tree between the two runs.)

### The gates

- `pnpm --filter @fluxiq-web-extension/extension check` — **exit 0**,
  `grep -c "error TS"` on the log: **0**.
- `pnpm --filter @fluxiq-web-extension/extension test` — **exit 0**,
  `# tests 225 / # pass 225 / # fail 0`.
- `pnpm --filter @fluxiq-web-extension/extension run test:content --workers=4`
  — **exit 1**, twice (rerun as the brief requires). Run 1: 184 passed, 5
  failed. Run 2: 183 passed, 6 failed.
- `node scripts/structure-audit.mjs` under a scratch `GIT_INDEX_FILE` (a copy of
  `.git/index` with the new test staged by `git add -N`; the real index was
  never written) — **exit 0**, `structure-audit: passed (30 warning(s), 19
  baselined)`. No warning names a file I own except the pre-existing
  `file-lines` advisory on `resolve-target.ts`, which was already past 400 lines
  before this change. It is not baselined, so nothing was grown that the
  baseline refuses.

### The harness failures are not this change

All six are in files I do not own, and none of the failing rows sends a
declared `element` field at all — every one goes through
`options: recordedElement(recorded)`, which is the fallback path this change
leaves byte-identical.

- **Five in `identity-resolution.spec.ts`**, the concurrent scorer/floor
  worker's spec. Four fail on `finalState().state` gaining a `"mode":
  "baseline"` key the spec does not expect — a harness/fixture change, nothing
  to do with target selection. The fifth is "the floor still refuses it", whose
  own comment reads "Lower the floor under 0.218 and this row starts
  succeeding": `TARGET_SCORE_FLOOR` in `content/identity/score.ts` is **`0`** as
  I write this and was **`0.35`** when I read the file at the start of this
  task, and `git status --porcelain` shows `score.ts`, `harness.ts` and
  `identity-resolution.spec.ts` all modified in the working tree. That is the
  calibration work in flight, mid-edit.
- **One in `evidence.spec.ts`** ("infinite-feed: forms are not invented where
  the page has none"), which appeared only in the second run — the evidence
  worker's tree, and not present in the first run of the same commit of my
  files.
- **The harness coverage of the file I changed is green in both runs**: every
  row of `resolve-target.spec.ts` (10 rows, including "every strategy misses"
  and the four fingerprint rows) and every row of `click.spec.ts` passed.

## Not verified

- **No live browser validation beyond the content harness**, and no `pnpm lab`
  — the brief forbids it. The harness is Chromium with the unpacked extension,
  so the resolver did run in a real page; what is unexercised is a command that
  actually carries the declared field end to end from a Flow, because no
  producer other than the gateway sends one and the harness does not.
- **The "Core matched a candidate" branch is untested end to end**, here and
  anywhere. Nothing populates `candidates` on the wire yet
  (`gateway-mapping.ts:178-181`), so `selectedCandidate` is never set and the
  adapted-copy-wins half of the rule has never executed in production. My change
  honours it by construction, since the domain decides it, but no test can prove
  that half until the wire carries candidates.
- **The `{}` behaviour change was checked against the specs, not against every
  caller.** I grepped the extension tree for readers of `options.element` (only
  `recordedTarget`) and ran the harness; I did not audit every hand-built
  command in `packages/`.
- **`pnpm build` and repository-wide `check`/`test` were not run** — the wave's
  binding rules reserve `build` for the supervisor, and nine other workers are
  editing this tree.
- **The final `check` and `test` were run against a tree another worker was
  editing.** See below; the numbers are honest for the moment they were taken.

## Open questions or contradictions found

1. **`resolve-target.ts` has two concurrent editors, and my brief says I am its
   sole owner.** When I first read the file it was 403 lines and
   `notFound(message, misses, nearbyCount)` took three arguments. It is now 452
   lines and `notFound(…, decided)` takes four, reporting `bestScore`,
   `confidence` and `runnerUpScore` on a `TARGET_NOT_FOUND`. That is the
   scorer/floor worker's near-miss diagnostics, in the file the brief granted to
   me. Both changes are present and coherent right now — theirs is in
   `notFound`, mine in `recordedTarget`, and they do not overlap — but the two
   of us are one whole-file write apart from silently losing one of them. Worth
   the supervisor confirming after both workers land that `recordedTarget()`
   still reads `action.element`; the first test row is the check.
2. **The removal of `options.element` needs the harness changed first, and that
   is not a resolver task.** `e2e/content/harness.ts` is the producer that keeps
   the fallback alive, and it belongs to whoever owns the harness. Whoever
   briefs the removal should brief the harness change in the same unit, or the
   removal will land red.
3. **`resolve-target.ts` is 452 lines against the 400-line advisory** and is now
   the second-largest file in the extension's content tree. It warns today and
   is not baselined, so nothing fails; but it has taken three separate feature
   changes this wave (Level 2 scoring, near-miss diagnostics, this one). The
   natural split is exact strategies / scored selection / failure records, and
   it should be its own task rather than a rider on the next change.
4. **`action.element` is typed but not validated anywhere.** The declared field
   arrives over a wire as JSON; `WebAutomationElementFingerprint` describes what
   the domain intends to send, and nothing checks that is what arrived. My
   `describedElement` does the object-shaped check the untyped path always had,
   which is the same guarantee as before, not a stronger one. If the wire is
   ever a trust boundary here, that is a separate decision.
