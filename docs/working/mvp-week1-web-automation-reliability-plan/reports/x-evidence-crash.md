# x-evidence-crash — the evidence serialiser that mistook sharing for a cycle

Worker `x-evidence-crash`, 2026-09-12. `EXTENSION_TEST_BUILD_LABEL` and
`DOMAIN_TEST_BUILD_LABEL` both set to `x-evidence-crash` (lowercase) on every
command. No `pnpm lab` command, no `pnpm build`. Every exit status captured by
redirect into a `.status` file, never through a pipe.

---

## Outcome

**Done.** `L-replay`'s Defect 2 is fixed at its cause, proved both ways, and the
historical damage is counted.

The file is `packages/test-evidence/src/redaction.ts` — confirmed by reproducing
the crash against the built package, not by name. The other `redaction.ts`,
`domain/src/sensitivity/redaction.ts`, has no walker and no `seen` set; it is
two exported constants about withheld comparisons and is untouched.

**The count, first, because it is the part that reaches beyond this bug:**

> **Not one Flow-lane run that reported a structured failure has ever produced a
> `snapshots/flow-lane.json`.** All 33 surviving `flow-lane.json` files in the
> retained history carry `status: "succeeded"` and zero structured failures. The
> recorded Flow-lane failure history is not merely unreliable — for structured
> failures it is **empty**, and has been for the whole retained window.

Four runs are directly identifiable as destroyed by this bug. They are half of
every run in the retained history filed as `unknown`.

---

## The defect

`redactStructured` guarded its walk with a `WeakSet` named `seen` that was added
to and **never unwound**:

```ts
if (seen.has(current)) throw new RedactionFailure("Circular structured evidence cannot be safely serialized");
seen.add(current);
```

A visited set answers "have I ever touched this object?". A cycle check must
answer "am I inside this object right now?". The two differ on any **shared
child** — an ordinary DAG — and evidence payloads are full of them.

`flow-lane.json` is precisely that shape, and it is not incidental:

- `packages/test-runner/src/flow-lane/persisted-flow-run.ts:70` sets the
  run-level failure to *the same object* as the first failing action's failure:
  `const failure = actions.map((action) => action.failure).find(...) ?? null;`
- `packages/test-runner/src/run-scenario.ts:317` writes both into one payload:
  `failure: evidence.run.failure` **and**
  `actions: ...(action.failure ? { failure: action.failure } : {})`.

So the run-level `failure` and the action's `failure` are one object written at
two positions. The second visit threw. A Flow whose actions all succeeded has
`failure: null` at both positions, no repetition, and wrote fine — which is why
this was invisible for as long as things were passing, and fired only when
something interesting happened.

---

## Reproduction — before, quoted

`scratchpad/repro.mjs` builds the `flow-lane.json` payload with the run-level and
action-level `failure` as one object, run against the **unmodified** built
package:

```
payload has a cycle? false
REPEATED-REFERENCE: CRASH -> RedactionFailure: Circular structured evidence cannot be safely serialized
TRUE-CYCLE: threw -> RedactionFailure: Circular structured evidence cannot be safely serialized
```

The first line is the whole argument: `JSON.stringify` accepts the payload, so
there is no cycle. The redactor rejected it anyway.

## Reproduction — after, same script unchanged

```
payload has a cycle? false
REPEATED-REFERENCE: PASS
  run failure code   : web.target.not_found
  action failure code: web.target.not_found
TRUE-CYCLE: handled -> {"level":"run","detail":{"parent":"[CIRCULAR]"}}
```

Both failure records survive with their real code, and the genuine cycle
terminates with its back-edge substituted rather than throwing or looping.

### Through the real writer, not just the function

`scratchpad/end-to-end.mjs` drives `EvidenceBundle.writeStructured`, the exact
call `run-scenario.ts` makes, with a configured secret and a denied key planted
inside the shared failure record:

```
flow-lane.json WAS WRITTEN
  run-level failure category   : target_not_found
  action-level failure category: target_not_found
  secret redacted at run level   : session [REDACTED]
  secret redacted at action level: session [REDACTED]
  denied key at run level        : [REDACTED]
  denied key at action level     : [REDACTED]
  raw file contains 'pairing-abc123'? false
  raw file contains 'hunter2'?        false
```

I deliberately did **not** re-break the shared `dist/` to capture a "before" of
this one: Lab instances consume that output, and momentarily publishing the
broken build to disturb a concurrent run was not worth a screenshot of a crash
already quoted above.

---

## The fix

Track the **current path**, unwound in a `finally`, and substitute the one edge
that closes a cycle:

```ts
const ancestors = new Set<object>();
...
if (ancestors.has(current)) return CIRCULAR_REFERENCE_MARKER;
ancestors.add(current);
try {
  ...
} finally {
  ancestors.delete(current);
}
```

**Why substitute rather than throw on a true cycle.** The brief required a real
cycle to be handled, not crash and not loop. The ancestor a back-edge points at
is already being walked and redacted at its own position, so replacing the edge
with a constant marker withholds strictly more than it lets through, guarantees
termination, and leaves the producer's bug visible in the bundle instead of
destroying the bundle. Throwing would have kept a narrower version of the exact
disease being cured: evidence lost at the moment it mattered.

---

## Do not weaken the redaction — how that was verified

The cycle check and the redaction never shared state, which is what made this
safe to separate. `denied`, `redactText`, `assertNoSensitiveText` and the
denylist are byte-for-byte unchanged; only the `seen`/`ancestors` set moved. Two
properties needed proving beyond that, and both were proved by differential
testing against the original implementation transcribed verbatim.

**1. The domain the original accepted is unchanged.** 20,000 randomised acyclic
trees x 6 option sets (default denylist, custom denylists, custom replacements,
configured secrets), comparing the original walk with the shipped one:

```
compared=120000 skipped_because_original_threw=0 diverged=0
DIFFERENTIAL: IDENTICAL on every input the original accepted
```

**2. The newly-accepted domain redacts exactly as copying would.** This is the
one that matters. For each generated input containing a shared subtree, a
reference-distinct **deep clone** was built — structurally identical, therefore
a tree the original accepts — and the fixed implementation on the *shared* input
was required to equal the original implementation on the *clone*:

```
cases=11632 of which the original threw on the shared form=11069 diverged=0
SHARED-VS-COPIES: IDENTICAL -- sharing redacts exactly as copying does
```

11,069 cases the original refused outright, and in every one sharing now
produces precisely what copying produced. Nothing passes through a shared
reference that would have been withheld from a copy.

Three further guards, in the committed tests rather than the scratchpad:

- Every occurrence of a shared object is redacted **independently**. There is no
  memo cache; a cache returning a once-redacted or unredacted result is the
  obvious wrong fix here and the test asserts against it directly.
- The cycle marker is a module constant. No input value reaches it.
- A denied key and a configured secret planted *inside* a cycle are still
  redacted at the position that is actually walked, and
  `assertNoSensitiveText(JSON.stringify(result))` is asserted over the output.

Redaction behaviour on cycles is not loosened either: the `password` inside a
self-referencing object still comes out `[REDACTED]`.

---

## How many past runs were misreported as `unknown`

Searched all of `test-runs/` — 29,297 files, 3.8 GB, 160 run bundles spanning
2026-09-09 to 2026-09-12.

**Four runs, and they are exactly half of every `unknown` in the history.**

| Run | Scenario / variant | Recorded | Actually |
| --- | --- | --- | --- |
| `run-mtz3sh3j-44db4ef1` | ambiguous-targets / form-context | `unknown` | refused `web.target.ambiguous`, both candidates 0.37 |
| `run-mtz3v24x-c65ffe5b` | identity-drift / reworded-aria | `unknown` | a Flow ran and failed structurally |
| `run-mtz41r86-da19f1d6` | identity-drift / reworded-aria | `unknown` | refused `web.target.not_found` at 0.197 / confidence 0.173 |
| `run-mtz44t9p-1c6fb661` | identity-drift / reworded-aria | `unknown` | the rerun of the above, identical |

All four show the identical signature: `verdict: "failed"`,
`firstFailure.summary: "Circular structured evidence cannot be safely
serialized"`, and **no `snapshots/flow-lane.json`**.

Eight distinct runs in the retained history carry `failureCategory: "unknown"`.
The other four (`run-mtz3zand`, `run-mtz3zbpj`, `run-mtz3zc4m`, `run-mtz3zcot`)
are **not** this bug — they are `lane: "recording"`, `actions: []`, 98–822 ms,
dead before anything ran. Attributing them here would have been wrong.

**A correction to `L-replay`.** Its table lists run 6 (`run-mtz3v24x`) as
`recording.contract`. Its bundle says otherwise: that run crashed on evidence
serialisation too. The bug claimed four of that session's runs, not three.

### It is worse than "reported as unknown"

The evaluation record for `run-mtz41r86-da19f1d6` — the run whose real,
well-classified refusal `L-replay` recovered from a Core store copy — reads:

```
failureCategory: "unknown"
automationFailureReported: { "category": "ambiguous_or_unknown" }
flowCreated: null
oracleVerdict: "passed"   reportedVerdict: "failed"
actions: web.browser.navigate, web.dom.type, web.dom.type, web.dom.click
```

All four affected runs report `ambiguous_or_unknown`. That is **a legitimate
enum member, not an error sentinel**. A precise `target_not_found` was not just
lost — it was overwritten with a plausible-looking category that a downstream
reader has no way to distinguish from a genuine measurement. And `flowCreated:
null` sits directly beside four executed actions, so the record contradicts
itself.

### Whether this contaminated any measurement this week

- **No published bench aggregate contains these four runs.** Checked every
  `runs.json` and bench report under `test-runs/`; none references them. No
  bench number needs retracting on their account.
- **But the broader finding does bear on measurement.** Of 33 surviving
  `flow-lane.json` files, the histogram is `{"succeeded": 33}` and the count
  with any structured failure is `0`. That is not a healthy pass rate — it is
  the survivorship signature of this bug. **Any statement of the form "the Flow
  lane's failures classify as X" drawn from run bundles this week was computed
  over a population from which every structured failure had been deleted.** The
  negative variants the week was built around have never once recorded their own
  outcome.

---

## Commands run and observed results

| Command | Exit | Observed |
| --- | --- | --- |
| `node scratchpad/repro.mjs` (pre-fix build) | 0 | `REPEATED-REFERENCE: CRASH -> RedactionFailure: Circular structured evidence cannot be safely serialized` |
| `pnpm --filter @fluxiq-web-extension/test-evidence exec tsc -p tsconfig.json` | 0 | no output |
| `node scratchpad/repro.mjs` (post-fix, script unchanged) | 0 | `REPEATED-REFERENCE: PASS`; `TRUE-CYCLE: handled -> {"level":"run","detail":{"parent":"[CIRCULAR]"}}` |
| `node scratchpad/end-to-end.mjs` | 0 | `flow-lane.json WAS WRITTEN`, both failures intact, secret and denied key redacted at both positions |
| `node scratchpad/differential.mjs` | 0 | `compared=120000 ... diverged=0` |
| `node scratchpad/differential-shared.mjs` | 0 | `cases=11632 ... diverged=0` |
| `pnpm --filter @fluxiq-web-extension/test-evidence check` | 0 | `tsc -p tsconfig.json --noEmit`, no diagnostics |
| `pnpm --filter @fluxiq-web-extension/test-evidence test` | 0 | `# tests 16  # pass 16  # fail 0` (run twice, identical) |
| `node scripts/structure-audit.mjs` | 0 | `structure-audit: passed (31 warning(s), 17 baselined)` |
| `pnpm --filter @fluxiq-web-extension/test-runner check` | 0 | clean; the downstream consumer still typechecks |

The two rewritten/added tests, by name, from the passing run:

```
ok 2 - substitutes the back-edge of a true cycle instead of destroying the evidence
ok 3 - redacts a repeated object reference at every occurrence rather than calling it a cycle
ok 4 - fails closed for unverified visual captures
```

The structure audit also printed `structure-audit: 3 baseline entries can be
lowered`. Those are other workers' in-flight improvements, not mine; I did not
run `pnpm structure:baseline`, since rewriting that shared file mid-session
would collide with them.

The crash was deterministic — it reproduced on demand, not intermittently — so
the faulty-RAM rerun rule did not apply. The suite was nonetheless run twice
with identical results.

---

## What changed

- `packages/test-evidence/src/redaction.ts` — path-based cycle detection with a
  `finally` unwind; new exported `CIRCULAR_REFERENCE_MARKER`; a comment
  recording why a repeated reference is not a cycle and naming the two call
  sites that produce the shape, so this is not re-tightened by someone reading
  the guard as a safety feature.
- `packages/test-evidence/tests/evidence.test.mjs` — the old
  `assert.throws(() => redactStructured(circular), RedactionFailure)` replaced
  by cycle-handling assertions (self-reference, chained cycle, cycle through an
  array); a new test for the `flow-lane.json` repeated-reference shape asserting
  redaction at **every** occurrence, plus sibling and multi-depth reuse to prove
  the path set unwinds.

Tests went into the package's existing `tests/evidence.test.mjs` rather than a
new `src/tests/redaction.test.ts`: that file is where this package's existing
redaction tests live, and the package's `test` script is
`node --test tests/*.test.mjs`, so a `src/tests/` file would compile into
`dist/tests/` and never run without also editing `package.json`.

Nothing else. `packages/test-runner/src/flow-lane/**` and `run-scenario.ts` are
under concurrent edit by other workers (`git status` shows six modified and
three untracked files there) — I read them and wrote nothing.
`domain/src/sensitivity/**` and `apps/extension/**` untouched. No commit.

---

## Not verified

- **No live Lab run.** The brief forbade `pnpm lab`, so the fix is proved
  through the real `EvidenceBundle.writeStructured` path with the real payload
  shape, not through a browser. **The next Flow-lane run against a negative
  variant is the confirmation**, and it should be treated as the acceptance test
  for this fix: it should now produce `snapshots/flow-lane.json` with a real
  `failureCategory` instead of `unknown`.
- **`packages/test-runner`'s own test suite was not run.** Its `test` script is
  `pnpm build && node --test "dist/**/*.test.js"`, and the build the brief
  forbade is the first half of it. I ran its `check` instead (exit 0). I changed
  no file in that package.
- **`pnpm check` / `pnpm test` at the root were not run** — the root `check`
  invokes `pnpm lab:test`, and other workers' in-flight edits were breaking the
  workspace build repeatedly during this session (`L-replay`'s Defect 3).
- **The four affected runs were not re-run** to observe the corrected
  classification; that needs the Lab.
- The historical count is a floor bounded by retention: 160 bundles from
  2026-09-09 onward. Anything pruned before that is uncountable. Within the
  retained window the count is exact.

## For the supervisor

1. **One stale sentence in authored documentation, which I did not edit because
   another worker holds the file.** `docs/architecture/testing-facility.md:822`
   lists "circular data" among the things that "fail closed". That is no longer
   true — circular data now has its back-edge substituted so the surrounding
   evidence survives. Suggested replacement for the clause: *"…configured secret
   literals, bearer patterns, and unverified visual/binary artifacts fail
   closed; a circular reference has its back-edge replaced by `[CIRCULAR]` so
   the rest of the evidence still reaches disk."*
2. **`L-replay`'s run table needs one correction**: run 6 (`run-mtz3v24x`) was
   an evidence-serialisation crash, not `recording.contract`.
3. **Consider whether any Flow-lane conclusion drawn this week rests on run
   bundles.** Every structured failure was deleted from that population before
   anyone read it, and the surviving 33 are 100% `succeeded` for that reason.
4. **`persisted-flow-run.ts:70` aliasing the run-level failure to the action's
   failure object is legitimate and now serialises correctly.** It does not need
   changing, and cloning it there would only mask the next occurrence of this
   shape somewhere else.
