# `bl-sharded-live-smoke` — interrupted two-cell live proof

## Outcome

Passed at clean downstream pin `d2b7e09bcc0b7e33c7661f4d81d2fefa1f3f001a`.
The real isolated `smoke` campaign used `--repeat 1 --shards 2 --jobs 2`, env
files disabled, and only the assigned F: run root. No fixture secret was needed
or inspected.

Logical campaign: `bench-mu1xyivt-4a498b30`.

Both children were directly observed at checkpoint generation 1 with an active
attempt and zero completions before interruption. Their active checkpoint times
were 3 ms apart. I then sent Ctrl-C to the owning Lab process. The supervisor
independently confirmed that the Lab Node processes stopped. The logical parent
and both child leases were subsequently reclaimed/released through the normal
resume path.

The exact-ID resume exited 0 and returned:

- status `passed`;
- 2 workflow/lane results;
- 2 evaluated runs, both passed;
- 0 skips;
- 1 not-executed recording-lane measurement and 2 recorded actions.

The two child attempts had measured run durations of 68,057 ms and 64,901 ms.
Their run intervals overlapped for 64,668 ms, so the two-job campaign achieved
real concurrent cell execution. The successful run start times were 233 ms
apart. The first resume command, including its normal labeled rebuild, completed
in approximately 17.3 seconds.

The interrupted attempts had already produced final bundles by the time resume
reconciled them: each child chain contains one active-attempt checkpoint and no
second active attempt. Resume authenticated those finalized bundles rather than
executing either scenario cell again.

## Integrity inspection

Bounded post-run inspection found:

- parent schema 0.3, `shard-parent`, saved `shardCount: 2`, saved `jobs: 2`;
- parent plan 2 cells; 3 contiguous valid checkpoints; zero ignored files;
- parent terminal state `finished`, no active attempt, exactly 2 completions;
- valid merge seal whose three parent projection digests match the current
  `runs.json`, `report.json`, and `report.md` bytes;
- two children, each with one plan cell, 4 contiguous valid checkpoints, zero
  ignored files, terminal `finished`, no active attempt, and one completion;
- both child terminal checkpoint digests and all six child projection digests
  match the seal;
- both immutable child evaluation hashes match their checkpoint receipts and
  both strict evaluation contracts parse with verdict `passed`;
- both parent evaluation copies have valid parent receipt hashes and are
  byte-identical to their authenticated child sources;
- aggregate report coverage is exactly 2 workflows, 2 evaluated, 2 passed,
  0 skipped;
- no parent or child lease, no `.staging-*` residue, and no interrupted staging
  directory remained.

An additional exact-environment idempotent resume exited 0 in approximately
18.7 seconds and returned the same logical ID and 2/2 passing aggregate.

## Reproducibility note

Campaign compatibility includes build artifact identity. Both creation and the
successful resumes used these non-secret labels:

- `FLUXIQ_LAB_INSTANCE=bl-sharded-live-smoke`
- `EXTENSION_TEST_BUILD_LABEL=bl-sharded-live-smoke`
- `DOMAIN_TEST_BUILD_LABEL=bl-sharded-live-smoke`

An independently attempted resume that omitted those labels correctly failed
compatibility because it selected a different default extension build artifact.
That fail-closed result did not modify the sealed campaign and is not a product
or recovery failure.

No code, generated/runtime artifact, commit, or push was added to the repository.
Only this report was written.
