# Report: v-check-hazard

Worker: `v-check-hazard`. Replace the root-`check` domain build that fixed the
fresh-clone `TS7016` but made a verification command rewrite a shared build
artifact.

## Outcome

**Done.** Root `pnpm check` no longer builds anything. The requirement it was
serving — `packages/test-runner` cannot typecheck without `domain/dist` — is now
declared by the package that has it, as a guard that builds the domain **only
when `domain/dist` is absent**. Both proofs the brief asked for are captured:
root `pnpm check` exits 0 on a tree with `domain/dist` deleted outright, and a
check run over a present `dist` leaves all 235 files byte-for-byte identical.

The supervisor's preferred remedy — a `paths` mapping from
`packages/test-runner` to the domain source — **does not work**, and I have the
compiler output rather than an argument. `w3-domain-packaging`'s reasoning was
right, and its refusal to let a gate mutate `dist` was right too.

## What changed and why

Three files, all owned. `packages/test-runner/tsconfig.json` and
`domain/package.json` are untouched — no additional export condition was needed.

### 1. `package.json` (root) — the build comes out of `check`

```
-"check": "… && pnpm --filter @fluxiq-web-extension/domain build && pnpm -r check"
+"check": "pnpm structure:test && node scripts/structure-audit.mjs && pnpm -r check"
```

Back to the form it had before commit `11d2ed3`. The root verification command
now runs no build of any kind.

### 2. `packages/test-runner/package.json` — the guard, where the need lives

```json
"domain:dist": "node -e \"…existsSync('../../domain/dist/index.d.ts')…\" || pnpm --filter @fluxiq-web-extension/domain build",
"build": "pnpm domain:dist && tsc -p tsconfig.json",
"check": "pnpm domain:dist && tsc -p tsconfig.json --noEmit",
```

If `domain/dist/index.d.ts` exists, the probe exits 0 and nothing happens. If it
does not, the probe prints one line saying what it is about to do and why, and
the domain builds once.

**Why this closes the hazard rather than moving it.** The mutation and the
hazard are mutually exclusive states. The concrete danger the supervisor named —
a `pnpm check` overlapping a Lab run rewriting the `dist` that run is loading —
requires a `dist` to exist; every Lab entry point builds one before it starts
(`pnpm lab` and `pnpm lab:interactive` both run
`pnpm --filter @fluxiq-web-extension/test-runner... build`, and the `...` pulls
the domain in). So a check overlapping a Lab run always finds a `dist` and always
leaves it alone. When the guard does fire there is, by construction, no `dist` for
anything to be reading.

It also closes a second hazard the brief did not name: under the old script, ten
concurrent workers running `pnpm check` in this wave each ran
`clean-dist && tsc && rewrite-specifiers` **in the same directory**. One process
deleting 234 emitted files while another's `tsc` writes into the same tree is a
race with no lock in front of it. The guard makes all ten no-ops.

**Why the guard sits in the package and not at the root.** The dependency on
`domain/dist` is `packages/test-runner`'s, not the workspace's. Putting it there
means `pnpm --filter @fluxiq-web-extension/test-runner check` also works on a
fresh clone, which it did **not** under the root-level fix — a worker running
just its own filtered gate would still have hit `TS7016`. Guarding `build` as
well as `check` extends the same property to `pnpm test`, whose test-runner leg
imports `@fluxiq-web-extension/domain/node` as a **value** at module scope and so
needs the built output at runtime, not merely its declarations.

### 3. `docs/architecture/repository-layout.md`

The existing paragraph — "A `./node` consumer needs `domain/dist` to exist, so
the root `pnpm check` builds the domain before running the recursive checks" —
was made false by this change and is replaced. The new text states the guard, the
reason the ordering is deliberate, and the two consequences an operator must
know: that `pnpm check` proves `domain/dist` **exists** and not that it is
**current**, and that deleting `domain/dist` by hand also destroys the panel-host
bundle, which the domain build does not regenerate.

## The option I was asked to evaluate, and why it fails

A `paths` mapping in `packages/test-runner/tsconfig.json` pointing
`@fluxiq-web-extension/domain/node` at `../../domain/src/index.ts`. Applied and
compiled; exit 2, 30 lines of diagnostics:

| Code | Count | What |
| --- | --- | --- |
| `TS2835` | 13 | `domain/src/index.ts`: "Relative import paths need explicit file extensions … Did you mean './constants.js'?" |
| `TS2834` | 4 | Same, for the directory barrels (`./output-nodes`, `./runtime`, …) |
| `TS2305` | 6 | Every symbol the test runner imports is now "not an exported member" — the barrel's re-exports never resolved |
| `TS6059` | 1 | `domain/src/index.ts` is not under `rootDir` |
| `TS7006` | 2 | Downstream `any` from the failed imports |

TypeScript names the mechanism itself, in the `TS6059` detail:

> File is ECMAScript module because 'F:/!FluxIQWebExtension/domain/package.json'
> has field "type" with value "module"

That is the whole story, and it is why no consumer-side configuration can rescue
it. A file's module format is decided by the nearest `package.json` `type`, not
by who imported it. `domain` is `"type": "module"`, so a `NodeNext` program
reading `domain/src` applies ESM rules to that file's own specifiers, and all 329
of them are extensionless. The supervisor's premise — "the `.d.ts` files are
generated from that same source, so pointing the type checker at the source is
the same source of truth, earlier" — is *semantically* true and *mechanically*
unreachable. It is exactly the 16 × `TS2835` `w3-domain-packaging` documented,
and the failure is at the very first file, so the 13 above are the barrel only,
not the depth of the problem.

I probed the obvious rescue too, so the rejection is evidence and not instinct:
`module: Preserve` + `moduleResolution: Bundler` in the consumer. The `TS2835`
wall does disappear — and is replaced by **74 × `TS6059`**, because Bundler
resolution successfully drags the entire domain source tree into the test
runner's program, where every file violates `rootDir`. Removing `rootDir` to
satisfy it would make `tsc` compute a common root across both packages and emit
to `dist/packages/test-runner/src/…` and `dist/domain/src/…`, breaking the
package's `exports` (`./dist/index.js`), its `bin` (`./dist/cli.js`) and its test
glob (`dist/**/*.test.js`) at once — and compiling a second copy of the domain
into the test runner's output. It also swaps a package that emits and runs real
Node ESM onto bundler resolution, which stops enforcing the extension discipline
that makes that output loadable. Worse in every direction.

### The other shapes, and why not

- **`prepare`/`postinstall` on the domain.** Would work for a genuine fresh clone
  (`pnpm install` runs workspace lifecycle scripts) and never touches `dist` at
  check time. Rejected because it fails the brief's own acceptance test — delete
  `domain/dist`, run `pnpm check` — since no install intervenes. It also makes
  every `pnpm install` pay for a full domain compile.
- **Assert `dist` exists with an actionable message instead of building.**
  Rejected: the fresh clone then exits non-zero, which is the regression this
  work is guarding. It is the same failure with better prose.
- **`import type` from a path that needs no build.** Rejected on the facts:
  `WEB_LLM_EVIDENCE_RESULT_CODES` and `WEB_LLM_EVIDENCE_TOOL_IDS` are arrays read
  at runtime to build `Set`s. There is no type-only formulation, and writing one
  would restate the vocabulary that `w3-domain-packaging` existed to delete.
- **Keep the supervisor's fix and sequence around it.** Rejected because the
  guard is strictly better on every axis the fix was chosen for and costs nothing
  the fix did not already cost. Sequencing would have had to hold across ten
  concurrent workers and a Lab run by convention alone.
- **Codemod `domain/src` to explicit `.js` specifiers.** The actual durable fix,
  and `w3-domain-packaging` said so. `moduleResolution: "Bundler"` accepts
  explicit extensions — `packages/test-contracts` is written that way today and is
  consumed from source by this very `NodeNext` package without a build. After it,
  `./node` takes its types from source, and both the build-ordering problem and
  the staleness residual below disappear together. Out of my ownership
  (`domain/src/**`), 329 specifiers across 95 files, and impossible during a
  parallel wave. Recorded in the documentation as the thing that retires this
  guard.

## What this trades away

`pnpm check` no longer guarantees `domain/dist` is **current**, only that it
exists. If someone changes an export in `domain/src` and runs only `pnpm check`,
the test runner's typecheck reads yesterday's declarations and can pass against a
shape that no longer exists.

I judged this the lesser hazard, and the bound is narrow:

- The domain's own `check` reads **source**, and runs before the test runner's in
  pnpm's topological order, so any error inside `domain/src` still surfaces on
  every run. Only the test runner's *use* of the domain's surface can drift.
- `pnpm build` rebuilds it, and the supervisor runs that at integration.
- Every Lab and demo entry point rebuilds it before running.

Against that, always-rebuilding buys currency at the price of a gate that
destroys and re-emits 234 files under a live reader, with no lock. The staleness
window is bounded by the next build; the mutation window is bounded by nothing.
It is documented in `repository-layout.md` rather than left in this report,
per the brief.

## Commands run and observed results

Every exit status captured by redirecting to a file and echoing `$?`, never
through a pipe. `EXTENSION_TEST_BUILD_LABEL=v-check-hazard` and
`DOMAIN_TEST_BUILD_LABEL=v-check-hazard` set throughout. No root `pnpm build`, no
`pnpm lab`, no `pnpm structure:baseline`.

`domain/dist` fingerprint = file count + newest mtime + SHA-256 over the sorted
`(path, size, mtimeMs)` list of every file, from a scratchpad script. Nothing was
written into the repository to measure it.

| # | Command / state | Exit | Observed |
| --- | --- | --- | --- |
| 1 | `tsc -p tsconfig.json --noEmit` in `packages/test-runner`, with `paths` → `domain/src/index.ts` | 2 | 13 × `TS2835`, 4 × `TS2834`, 6 × `TS2305`, 1 × `TS6059`, 2 × `TS7006`. The option is dead. |
| 2 | Same, with `module: Preserve` + `moduleResolution: Bundler` | 2 | 74 × `TS6059`, 332 lines. The rescue is worse than the wall. |
| 3 | `git status --short packages/test-runner/tsconfig.json` after restoring | — | Empty. The probe file is back to its committed bytes. |
| 4 | `pnpm --filter … test-runner domain:dist`, `dist` present | 0 | No output beyond the script echo. Fingerprint before and after identical (`dc8959f5…`, 235 files). |
| 5 | `pnpm --filter … test-runner check`, `dist` present | 0 | No diagnostics. |
| 6 | `pnpm --filter … test-runner test` | 0 | `# tests 395 / # pass 395 / # fail 0`. Fingerprint unchanged. |
| 7 | **`pnpm check` (root), `dist` present** | **0** | `structure-audit: passed (29 warning(s), 19 baselined)`; `domain check: Done` before `packages/test-runner check: Done`, so topological order is intact. **Fingerprint identical before and after: 235 files, `newest_mtime=2026-09-12T18:12:08.946Z`, `dc8959f5f10d…f3f0`.** |
| 8 | `rm -rf domain/dist`; fingerprint | — | `ABSENT domain/dist: ENOENT`. |
| 9 | `pnpm check` (root), `dist` **deleted** — first attempt | 2 | Failed in `domain check` at `src/runtime/adapter.ts(111,76): TS2304: Cannot find name 'secretSafeDispatchPayload'` — a parallel worker mid-write, in a file I do not own. My guard was never reached. |
| 10 | `pnpm --filter … test-runner check`, `dist` **absent** | 0 | The guard fired and said so: `[test-runner] domain/dist is absent: building @fluxiq-web-extension/domain once …`, then `clean-dist: removed 0 emitted file(s)`, `rewrite-dist-specifiers: 340 specifier(s) in 104 file(s)`, then a clean typecheck. |
| 11 | **`rm -rf domain/dist`, then `pnpm check` (root)** | **0** | The definition-of-done proof. `structure-audit: passed (29 warning(s), 19 baselined)`; every package `Done`; `packages/test-runner check` shows the guard firing and building the domain once. |
| 12 | Restore `dist/host/web-panel-host.mjs` from the pre-test backup | 0 | `cmp` identical to the backup, 103,230 bytes. The domain build had **not** regenerated it, as predicted. `dist` back to 235 files. |
| 13 | `pnpm check` (root) — second attempt at the closing gate | 2 | `domain check: src/runtime/tests/adapter.test.ts(411,51): TS2322`. **Fingerprint identical across the run anyway.** |
| 14 | `pnpm check` (root) — rerun per the wave rule | 2 | Same error, now at **line 412**: the line number moved between runs, so the file was being written while I compiled. `ls --time-style=full-iso` put its mtime 25 s before the run; `git status` shows it modified and it is not one of mine. **Fingerprint identical across this run too.** |
| 15 | `pnpm --filter … test-runner check` and `test` | 0, 0 | `# tests 395 / # pass 395 / # fail 0`. Fingerprint unchanged. |
| 16 | **`pnpm check` (root), third attempt** | **0** | The parallel worker finished. `structure-audit: passed (30 warning(s), 19 baselined)`. **Fingerprint identical before and after: 235 files, `e2e1958eef5d…d8cf`.** |
| 17 | `git status --short` on the five paths in my Owns | — | Three modified: `package.json`, `packages/test-runner/package.json`, `docs/architecture/repository-layout.md`. `packages/test-runner/tsconfig.json` and `domain/package.json` clean. |

The two acceptance conditions, stated plainly:

- **Fresh clone.** Row 11 — `domain/dist` removed entirely, root `pnpm check`
  **exit 0**.
- **No mutation.** Rows 7, 13, 14 and 16 — four separate root `pnpm check` runs
  over a present `dist`, each with an identical 235-file fingerprint on both
  sides, including the same newest mtime. Nothing was written, not even a
  same-content rewrite.

## Not verified

- **No live browser validation, no `pnpm build`, no `pnpm lab`, no `pnpm test` at
  the root.** The claim that a Lab run always finds a `dist` is read from the
  `lab` and `lab:interactive` scripts in the root `package.json`
  (`pnpm --filter @fluxiq-web-extension/test-runner... build`, whose `...`
  includes dependencies), not observed by running one. The Lab is serialized and
  not mine.
- **The guard's shell form is proven on this machine only** — Windows, pnpm
  9.15.0, Node 22.11.0. `A || B` and the `node -e` quoting behave identically in
  `cmd.exe` and POSIX `sh`, and it was exercised through pnpm in both the
  fires-and-builds and the no-op path, but no CI or POSIX run confirms it.
- **A genuinely fresh clone was never taken.** I deleted `domain/dist` in place,
  as the brief specified. `node_modules` and every other package's build output
  were present, so this proves the `domain/dist` regression and not clone-from-zero
  in general.
- **The concurrency argument is reasoned, not raced.** I did not run a Lab and a
  `pnpm check` simultaneously to observe the old breakage or the new safety. The
  argument rests on the guard's precondition (`dist` absent) being the negation
  of the hazard's (`dist` in use), which is structural.
- **Two simultaneous checks on a dist-less tree would both build.** Unprobed, and
  unlikely — it needs a fresh clone plus concurrency — but the guard has no lock.
  Strictly better than the old script, which raced on *every* run.
- **Staleness is documented, not detected.** Nothing warns when
  `domain/dist` is older than `domain/src`. I considered an mtime comparison and
  rejected it: a fatal one would have broken every domain worker in this wave, and
  a non-fatal one is a line nobody reads. It is a real gap, and the codemod
  retires it properly.
- **Root `pnpm check` failed three times before passing**, twice on
  `domain/src/runtime/tests/adapter.test.ts` and once on
  `domain/src/runtime/adapter.ts`. I attributed both to a parallel worker from the
  moving line number, the file mtime and `git status`. I did not stash the tree to
  prove it independently.

## Open questions or contradictions found

1. **The supervisor's fix and the guard were solving the same problem at
   different altitudes, and the root was the wrong one.** Under the root-level
   build, `pnpm --filter @fluxiq-web-extension/test-runner check` — the exact
   command that package's own definition of done names, and the one a worker with
   a narrow brief would run — still failed on a tree without `domain/dist`. The
   root script made the *workspace* gate pass while leaving the *package* gate
   broken. Worth remembering when a fix is placed: the requirement belongs to the
   package that has it.
2. **`w3-domain-packaging` open question 1 is now closed, and it chose correctly
   between its own three options.** It listed the root-`build` remedy first and
   declined the `domain check`-emits remedy on the grounds that "a gate should not
   mutate a shared build output". That principle applies with equal force to the
   root-`build` remedy it listed, which is what was then adopted. The reasoning
   was right and the conclusion was drawn one line too narrowly.
3. **Open question 2 of that report — the `domain/src` codemod — is the only
   thing that retires this guard, and it is now blocking two residuals rather
   than one.** It needs a worker owning `domain/src/**` alone, outside a parallel
   wave. It is now referenced from `repository-layout.md` so it does not live only
   in a report.
4. **`rm -rf domain/dist` destroys the panel-host bundle and nothing in the
   default gates puts it back.** `dist/host/web-panel-host.mjs` is built only by
   `host:build`; the domain build's clean step preserves it but never creates it.
   I hit this while producing the fresh-clone proof and restored it from a
   backup — a fresh clone would simply not have one until `pnpm dev`,
   `pnpm fluxiq:host:build` or `pnpm lab:interactive` runs. Now documented, since
   the fresh-clone proof is a procedure someone will repeat.
5. **`domain/dist` is untracked build output that four separate commands assume
   exists.** The guard makes one of them self-healing. `pnpm test` at the root is
   self-healing only through the test runner's own `build` leg; the domain's
   `test` script builds into `.test-build`, not `dist`, so nothing else in the
   default gates refreshes it. That is the shape of the staleness residual, and
   it predates this change.
