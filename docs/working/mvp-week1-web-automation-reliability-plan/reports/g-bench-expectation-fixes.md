# g-bench-expectation-fixes — H4 and H7 (test-runner)

Worker report, 2026-09-13, at `HEAD eb8bf99`. Brief: `briefs/finish-week1.md`,
twenty-fifth dispatch. Source finding: `reports/i-bench-triage.md` H4 and H7.

## Outcome

Done. Both fixes are in place, each with a unit test and mutation proofs. The
package gates and the structure audit pass. No Lab run was made; the brief
forbids one.

Re-verified at HEAD before editing: all five owned files were unmodified.
- **H4** was still open: `flow-lane/expectations.ts:9` read
  `entry.outcome ?? "succeeded"`.
- **H7** was still open: `bench/read-run-bundle.ts:80-83` kept the last `error`
  event, and `bench/run-bench.ts:174` used its message.

## What changed and why

### H4: an expected action with no `outcome` is judged on presence only

`packages/test-runner/src/flow-lane/expectations.ts`, `assertFlowActions`:
- An entry with no `outcome` matches any attempt of that action type, whatever
  its status.
- An entry that declares an `outcome` still has to match that status.
- When nothing matches, the message and details claim no outcome the entry did
  not declare. The message is now "The Flow did not produce a web.dom.click
  action; it produced ...", and `details.expectedOutcome` is absent.
- A declared outcome keeps the old message, including "with outcome
  `<outcome>`".

**Which manifest rows this changes.** Every other `expected.actions` entry in
`apps/scenario-lab/src/scenarios` declares an outcome. Only three do not, and
each is a negative variant that also declares `expected.failure`:
- W26 `no-context`, `ambiguous-targets/manifest.ts:35`, expects
  `target_ambiguous`;
- W15 `popup-blocked`, `multi-tab/manifest.ts:55`, expects
  `output_not_observed`;
- W24 `unannounced`, `intermediate-state/scenario.ts:59`, expects
  `output_not_observed`. It is ruled out of Week 1 (F3).

For these three rows, whether the click succeeded is now judged only by
`assertFlowFailure`, which checks Core's structured failure record. No
positive workflow is affected.

### H7: a bench row's failure message belongs to its failure category

**The runner's own rule** (`run-scenario.ts:374-463`, read only). Every time
`runScenario` sets its returned `failureCategory` and `failureMessage`, it also
writes an `error` event with that summary under the same
`details.failureCategory`:
- lines 380, 404, 429 and 463 write that event directly;
- line 435 writes it for a pair set without one (cleanup at lines 408 and 433).

Later `error` events can carry other categories. The redaction scan at line 446
writes under `security.redaction` but changes the returned category only when
the run had passed (line 444). A later failure can also replace the message
under the same category, as the clone post-run verification does at lines
402-404. So the event that belongs to the returned category is **the last
`error` event recorded under that category**.

**`packages/test-runner/src/bench/read-run-bundle.ts`:**
- `readRunBundle(runPath, failureCategory?)` takes the category the runner
  returned.
- `recordedFailure` is now the last `error` event whose
  `details.failureCategory` equals that category. With no category given, it is
  the last `error` event, as before.
- If a category was given and no event records it, there is no cause, and one
  problem is added: `events.ndjson: no error event records the run's failure
  category <category>`. Another category's message would be the wrong one, and
  without the problem the gap would be silent.
- The file still exports one value, so the structure audit's exported-values
  budget is unchanged.

**`packages/test-runner/src/bench/run-bench.ts`:** `runOnce` passes
`result.failureCategory` to `readRunBundle`. `run-scenario.ts` was not needed.

**Unchanged on purpose.** `RunBundleReading.errorSequence` is still the last
`error` event's sequence. `run-evaluation/single-run-evaluation.ts:89-96`
computes it the same way, and `run-evaluation/tests/bench-parity.test.ts` pins
that the bench and a single run agree. The brief asked about the message only.

### Tests

**`flow-lane/tests/expectations.test.ts`**, new test "an expected action with
no outcome is judged on its presence only, never as succeeded". It uses W15's
and W26's shape:
- `{ action: "web.dom.click" }` passes against a failed click;
- a declared `outcome: "succeeded"` still refuses that click;
- a missing click fails with the no-outcome message and no `expectedOutcome`;
- an empty attempt list reports "no attempts".

**`bench/tests/run-bench.test.ts`**, new test "a run's failure cause is the
message written under its failure category, not its last error event's". Three
runs, each with events and a returned category:
- **W18's Flow-lane shape:** extraction under `runtime.behavior`, then redaction
  under `security.redaction`. The cause is the extraction message.
- **Superseding message:** two `runtime.behavior` events, then redaction. The
  cause is the later `runtime.behavior` message.
- **No matching event:** the category is `process.startup` and only a redaction
  event exists. There is no cause, the new problem is present, and
  `failureCauses` reads `1 run — process.startup: no cause recorded`.
- **All runs:** the redaction message appears nowhere in `report.md`.

The file is now 381 lines, under the 400-line advisory threshold.

## Commands run and observed results

All test-runner builds went to the private `packages/test-runner/dist-gbef`,
which is at `dist`'s depth, from `packages/test-runner`. Exit codes were
captured through files.

- **First build:** `pnpm exec tsc -p tsconfig.json --outDir dist-gbef`, exit 0,
  no output.
- **Targeted tests:**
  `node --test dist-gbef/flow-lane/tests/expectations.test.js dist-gbef/bench/tests/run-bench.test.js`,
  exit 0: `# tests 15`, `# pass 15`, `# fail 0`.
- **Structure audit:** `node scripts/structure-audit.mjs`, from the repository
  root, exit 0, `structure-audit: passed (39 warning(s), 17 baselined).` No
  finding names any owned file. It ran again on the final source with the same
  result.
- **Mutation proofs.** The fixed files were backed up and hashed first, each
  mutation was rebuilt and tested, and each file was restored with `cp` and
  re-hashed.
  - **M1, H4.** `expectations.ts` went back to
    `const outcome = entry.outcome ?? "succeeded";`. Test 11 failed with
    `error: 'The Flow did not produce a web.dom.click action with outcome succeeded; it produced web.dom.type:succeeded, web.dom.click:failed'`.
    Restored hash `2706b77a…53f2f`, identical to the backup.
  - **M2, H7 reader.** It was built with M1, which touches a different file and
    test. The `read-run-bundle.ts` condition was reduced to
    `if (message !== "")`, the last error event. Test 9 failed with
    `Expected values to be strictly deep-equal`: all three rows got
    `'Redaction attestation found 13 file(s) holding a declared literal or left unread'`,
    against `'The Flow produced 0 extraction result(s), expected 1'`, the
    superseding clone message, and `null`. Restored hash `3206650e…a83ca5`,
    identical to the backup.
  - **M3, H7 wiring.** `run-bench.ts` called `readRunBundle(result.path)`
    without the category. Test 9 failed with the same deep-equal diff:
    `# tests 9`, `# pass 8`, `# fail 1`. Restored hash `335560c0…376d3`,
    identical to the backup.
- **Final state.** Build, full suite and check ran one after another, in the
  background:
  - `pnpm exec tsc -p tsconfig.json --outDir dist-gbef`, exit 0;
  - `node --test "dist-gbef/**/*.test.js"`, exit 0: `# tests 526`,
    `# pass 526`, `# fail 0`, `# cancelled 0`, `duration_ms 12344.819`;
  - `pnpm --filter @fluxiq-web-extension/test-runner check`, exit 0, with no
    `tsc` output.
- **Cleanup.** `cmp` confirmed all three sources are identical to the fixed
  backups. `dist-gbef` and the backups were deleted, and both absences were
  confirmed.
- **Diff.** `git diff --stat` for the owned files: 5 files, 115 insertions,
  19 deletions.

No parallel edit broke a compile during this work. Every result above is a
single observation, and none needed a rerun.

## Not verified

- **No Lab run**, as the brief requires. A Lab run must show:
  - **H4:** W15 `popup-blocked` and W26 `no-context` pass on the Flow lane,
    with Core reporting `output_not_observed` and `target_ambiguous` /
    `web.target.ambiguous`. The failed click must no longer produce
    `action.dispatch` "did not produce a web.dom.click action with outcome
    succeeded".
  - **H7:** in a week1 bench's `runs.json` and in `report.md`'s "Why the failed
    runs failed", W18 Flow-lane appears as `runtime.behavior` with the
    extraction message (or with whatever its first failure is once
    `g-flow-lane-expectations` has landed), not with the redaction message. A
    run whose only failure is the redaction scan still appears as
    `security.redaction` with the redaction message.
- Root `pnpm check`, `pnpm test`, `pnpm build` and the content harness were not
  run; the brief did not name them.
- The runner-side reasoning, that every returned category has an event written
  under it, comes from reading `run-scenario.ts` as it is at HEAD. Another
  worker is editing that file in this dispatch. If a new branch there sets the
  category without writing an event, the bench now reports a problem instead of
  borrowing another category's message.

## Open questions or contradictions found

1. **The `outcome` doc comment in test-contracts does not record the change.**
   `packages/test-contracts/src/scenario.ts:72-83` says nothing about what a
   missing `outcome` means. It was never documented as `succeeded`, but it is
   now "presence only", and a sentence there would make the contract explicit.
   I do not own that file.
2. **`errorSequence` still points at the last `error` event.** For W18's shape,
   the evaluation's `runner-verdict` invariant cites the redaction event's
   sequence while the cause is the extraction message. Pointing it at the
   matching event would change `single-run-evaluation.ts` and the parity test
   too, which are outside this brief.
3. **The new problem line appears for any bundle without a matching event.**
   `run-bench.test.ts`'s `fakeRunner` writes `error` events with no summary, so
   its failed W02 run now carries that problem. No existing assertion reads it,
   but anyone relying on an empty Problems column for such bundles will see it.
