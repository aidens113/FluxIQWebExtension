# t308 Final Root-Test Evidence Audit

Status: **GO to the final Core check.**

## Audited result

The supervisor's final Core root test completed with **exit 0** and no reported failing package,
file, or test. Preserve the runner's package-specific conventions in the ledger rather than
collapsing unlike summaries into one invented total:

| Root package | Observed result |
| --- | --- |
| contracts | 53/53 tests passed |
| gateway | 3/3 tests passed |
| `fluxiq` | 413 files passed; 3,994 tests passed; 1 test skipped |
| web | 246 files passed; 1,346 tests passed |

The command's zero exit status and failure-free package summaries close the final root-test gate.
They do not close the separate settled-tree Core check or provider-free dry-run gates.

## Ledger-safe wording

Use this exact root clause in t307's validation line:

```md
Core root test -> exit 0: contracts 53/53 and gateway 3/3 passed; `fluxiq` passed 413 files and
3,994 tests with 1 skip; web passed 246 files and 1,346 tests; duration not reported.
```

Do not replace this with an aggregate such as `5,396/5,396`: contracts/gateway did not report file
counts in the handed evidence, and the package summaries use different shapes. The one skipped
`fluxiq` test must remain visible.

Until Core check and the provider-free dry-run also pass, t307's **Partial** ledger block remains the
truthful choice. Its root placeholder can now be filled with the clause above; its check and dry-run
placeholders must remain explicitly pending.

## Evidence gaps

- Wall-clock duration was not included in the supervisor result; record `duration not reported`.
- The exact shell invocation text was not repeated in the handed result. Identify it as the final
  Core root test, not as a differently scoped command.
- Per-file pass lines for the three reconciled files were not included in the handed summary.
  Because the complete root command exited zero across `fluxiq` and web, there is no contradictory
  failure; however, do not claim separately observed per-file lines from this evidence alone.
- Contracts and gateway file counts and skip counts were not reported. Do not infer them.

These are reporting gaps, not failed tests, and none blocks the next serial gate.

## Decision

**GO to Core check.** The full root test gate is green on the final test tree. The next action is the
settled-tree Core check required by the run-3 serial procedure. If that check passes, continue to
final identity/freshness and provider-free readiness in their prescribed order. Do not create the
pending live debug or make a provider call from this result alone.

This evidence changes no live result: run 2 remains the latest accepted measurement and the
consecutive-pass streak remains 0.

## Scope

This audit read only the supervisor result and t307. It ran no test, check, build, dry-run, live,
provider, browser, or Lab command and changed no source, shared document, generated output, run
artifact, or live state. This report is the only file written.
