# t279 — Final t258 evidence audit

Status: **Complete report-only audit**

Audit basis: final t258 report `t258-grant-continuation-wiring.md`, the conclusions in t265–t278,
and only the commands/results stated in those reports. No gate was executed or independently
replayed by t279.

## Verdict

**GO on reported implementation closure; NO-GO on evidence completeness for live run 3.** T258's
final report now claims the correct final behavior and says the decisive regressions passed, with no
remaining product-source contradiction against the final t265–t278 conclusions. It does not,
however, satisfy t270's final evidence contract: the Core root test is absent, the separately
reported package-check filter does not name the package, the focused invocation is not enumerated
and is smaller than t270's required matrix, and no settled branch/HEAD/status identity is recorded.

This is an evidence deficiency, not a newly found implementation defect. Run 3 remains closed until
the supervisor executes and records the missing exact serial gates on the unchanged settled tree.

## t265–t278 reconciliation

| Prior finding | T258 final claim | Audit result |
| --- | --- | --- |
| t265: caller-selectable retention and escaped post-apply binding-read failure | Public generation always selects invocation-local `false`; only the private reauthor call selects `true`. Binding-read and continuation failures preserve `applied:true`, publish `replayReady:false`, and skip replay. | **Closed by reported source and tests.** |
| t266: safe no-hindsight live capture | T258 ran no live work and makes no contrary capture claim. | **No contradiction; procedure remains mandatory for run 3.** |
| t267: missing binding-read service-composition proof | T258 reports the full service case: applied persistence, closed marker, three calls/no fourth judge, sanitized detail, and zero grants. | **Closed by reported focused result.** |
| t268/t269: purpose-wide or ambient retention | T258 reports no purpose exception, `Set`, `AsyncLocalStorage`, or shared state; retention is a private lexical invocation argument. | **Closed by reported final source shape.** |
| t270: exact settled-tree gate manifest | T258 reports 135/135 focused, package/root checks, build, and diff check, but omits root test, exact matrix/command output, duration, and settled tree identity. | **Not closed.** |
| t271: public extend success and concurrent same-ID isolation regressions | T258 reports exact public explore/extend success revocation and deterministic paused-private/distinct-Flow same-ID public revocation, including terminal zero grants. | **Closed by reported focused result.** |
| t272: final source GO, validation pending | T258 reports the missing regressions and green check/build results. | **Source/test intent closed; complete validation evidence still pending for the reasons below.** |
| t273: execute final retention regressions | T258's 135/135 claim includes accounting, extend, and real reauthor composition. | **Reported passing, but exact command/path list and output are absent.** |
| t274/t275: structure violation/public helper exposure | T258 reports the helper moved under internal `service/flow-bootstrap-commands`; t278 independently reports structure and package surface GO. | **Closed.** T274's two additional collaborator/denied-key tests were explicitly coverage gaps rather than observed behavior blockers and remain outside this live gate. |
| t276: privacy/truthfulness | T258 reports binding-read and continuation failure privacy, exact durable applied state, and no replay. | **Closed by reported source/composition evidence.** |
| t277: arbitrary secret-bearing continuation regression design | T258 reports the designed coordinator regression now exists and passed in the focused set. | **Reported closed.** |
| t278: post-move public surface | Independent final review is GO. | **Closed.** |

## Evidence contradictions and omissions

### 1. Core root test is not reported

T270 requires the separate serial command `pnpm test` and its pass/fail count and duration. T258's
validation section reports a 10-file focused Vitest run, package check, root `pnpm check`, root
`pnpm build`, and `git diff --check`; it does not report `pnpm test`. Root check is not a substitute
for the repository test suite.

**Blocker:** run Core `pnpm test` on the settled tree and record total passed/failed/skipped and
duration.

### 2. The stated package-check filter does not identify the package

T258 reports:

```text
pnpm --filter @fluxiq/fluxiq check
```

The scoped package manifest names the package `fluxiq`, and Core's own build script filters it as
`--filter fluxiq`. Therefore the reported scoped command does not prove the required package check;
pnpm can complete an unmatched filter without running the intended script. T258's claimed root
`pnpm check` recursively includes workspace checks, so this does not itself establish a type error,
but it does leave the required direct package gate unproven.

**Blocker:** run and record `pnpm --filter fluxiq check` (or the repository's exact current
equivalent if the manifest is deliberately renamed first).

### 3. The focused evidence is not the required enumerated matrix

T258 states **135/135 across 10 files** and names ten subject areas, but gives neither the exact
command/path list nor duration. T270 requires one 15-file invocation including the generation
diagnostic/round-trip/provider-refusal tests, harness run, provider retry, grant continuation/hold/
lifecycle, reauthor unit, continuation coordinator, accounting/generation/extend, run outcome, and
real reauthor composition, augmented by later retention regressions. A 10-file summary cannot be
matched field-for-field to that list and does not report failed/skipped counts separately.

The product-critical regressions themselves are credibly claimed: binding-read failure, typed
continuation refusal, secret-bearing unknown continuation error, public extend success revocation,
and deterministic same-ID overlap are all named. The deficiency is integrated evidence breadth and
reproducibility.

**Blocker:** execute t270's final focused matrix once on the settled tree, adding the final t271/t277
test locations if not already included, and record the exact path list, passed/failed/skipped count,
duration, and exit status.

### 4. Settled-tree identity is absent

T258 says validation ran after the helper move on a “settled tree,” but it records no Core branch,
HEAD, `git status --short` inventory, downstream identity, or completion time. T270 explicitly
requires those facts because HEAD alone cannot identify a shared dirty tree and later edits would
invalidate the evidence. `git diff --check` proves formatting only; it is not a tree inventory.

**Blocker:** after all implementation workers stop editing, record branch, HEAD, and complete short
status for Core and downstream, then keep that tree unchanged through the serial gates and live
preflight.

### 5. Reported build and diff evidence is directionally sufficient but not copy-complete

T258 reports root `pnpm check`, root `pnpm build` including Next.js, and Core `git diff --check`
passed, with only line-ending warnings. It supplies no timestamps, durations, or exact output
summaries. These claims support the implementation handoff, but t270 still requires a final fresh
root build after the last Core edit and explicit output-freshness comparisons. If the settled-tree
inventory shows no later Core source/test mutation, the supervisor may use its own newly observed
serial check/build evidence; the prose-only t258 result is not enough to establish freshness.

## Exact remaining pre-live blockers

1. Freeze and identify the final Core/downstream tree after all source/test edits stop.
2. Run t270's exact integrated focused Core matrix and record command, paths, counts, duration, and
   exit status.
3. Run the correctly targeted `pnpm --filter fluxiq check`.
4. Run the missing Core root `pnpm test` and record full counts/duration.
5. Run/observe final Core root `pnpm check` and `pnpm build` on that same tree, then prove Core
   runtime and web output freshness as required by t263/t270.
6. Rebuild the downstream dependency closure, run downstream check, and prove every downstream
   output marker fresh.
7. Complete the one-Lab/process/lock gate and unchanged zero-provider dry run.
8. Create the no-hindsight pending debug before any provider call, repeat the one-Lab gate, and use
   t266's corrected stderr-suppressed, rename-before-inspect serial capture procedure.

Until items 1–8 are green and recorded, the live decision is **NO-GO**. T258 remains a valid
implementation-completion report, but it is not by itself the final release/live validation record.

No source, shared document, generated output, run artifact, provider/browser/Lab state, gate,
commit, or push was changed or executed. This downstream report is the only file written by t279.
