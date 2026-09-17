# Tracked generated output under a branch-per-task workflow

Assessment date: 2026-09-17. Repository: `F:\!FluxIQWebExtension`, branch `dev`
(HEAD moved from `8c0f2a0` to `22307f4` mid-assessment; other agents were
committing concurrently). Nothing was committed, pushed, untracked, or left
modified by this assessment.

## Verdict and recommendation

**Untrack both paths and build on demand (option a).** The collision risk is
not marginal: 55 of the last 100 commits on `dev` touched generated output, a
single source edit fans out to as many as 68 generated files, and the five
`apps/extension/build/**/*.map` files are structurally unmergeable — each is a
7-line file whose 4th line is a single 438KB–995KB `sourcesContent` string, so
*any* rebuild on either branch rewrites that one line and git produces a
conflict hunk containing both copies in full (the merged `background/index.js.map`
came out at 2,091,852 bytes, nearly double the 1,174,151-byte original). Worse,
I proved these maps are **not reproducible across checkouts**: at one identical
commit with git-clean sources, three of the five maps built to different bytes
purely because `git checkout` had rewritten two source files with CRLF
(`core.autocrlf=true`, no `.gitattributes`) and esbuild embeds the on-disk bytes
verbatim into `sourcesContent`. Untracking costs nothing, because **nothing
reads the committed copies**: `apps/extension/build/` contains no `manifest.json`,
no icons and no HTML, so it is not loadable as an unpacked extension — browsers
and the Testing Lab load `apps/extension/dist/<target>/`, which is *already*
untracked and therefore already requires a build; CI runs `pnpm check`, `pnpm test`
and `pnpm build` itself; the Lab runs `test:e2e:build` on every run; and
`domain/.test-build/` is written and then imported inside a single
`node scripts/test-domain.mjs` process. The repository has already made exactly
this decision once, in `44c2b29` ("Stop tracking generated .script-build esbuild
bundle"), for exactly this reason. Both builds are byte-for-byte deterministic
when run twice on one machine, so regeneration is reliable. Supporting evidence:
211 of the 300 tracked `domain/.test-build/` files are dead output the current
build has never written, last committed 2026-08-01 — tracked generated data rots
silently and no one notices. **Complementary fix, recommended regardless of the
tracking decision:** add `.gitattributes` with `* text=auto eol=lf` so checkouts
stop rewriting source line endings, which is what makes builds differ between a
fresh clone and a working checkout today.

## 1. Which tracked paths are generated build output

Confirmed both, and found no others.

| Path | Tracked files | Bytes at HEAD | Notes |
| --- | --- | --- | --- |
| `apps/extension/build/` | 10 | 4,742,297 (4.52 MB) | 5 × `index.js` + 5 × `index.js.map` |
| `domain/.test-build/` | 300 | 6,564,700 (6.26 MB) | 89 `.mjs` (live) + 211 `.js` (**stale**) |
| **Total** | **310** | **11,306,997 (10.78 MB)** | 13% of the 2,385 tracked files |

`apps/extension/build/` file-by-file (bytes):

```
   439867  background/index.js        1174151  background/index.js.map
   415095  content/index.js           1227312  content/index.js.map
     4053  page-world/index.js          13889  page-world/index.js.map
   189704  popup/index.js              544261  popup/index.js.map
   189704  sidepanel/index.js          544261  sidepanel/index.js.map
```

(`popup` and `sidepanel` are byte-identical to each other — same bundle graph.)

Searches for other generated content found nothing further. Every tracked
`.map` file in the repository is one of the five above; there are no tracked
`*.min.*` files; and the only tracked `dist`/`build`-like directories are the
five entry subdirectories of `apps/extension/build/`. `apps/extension/dist/`,
`domain/dist/`, `domain/.script-build/` and all `.test-build-scratch/` and
`.lab-instances/` paths are correctly ignored.

### Finding: 211 of the 300 `domain/.test-build/` files are dead

All 211 `.js` files live under `domain/.test-build/!FluxIQ/…` — bundled copies
of **FluxIQ Core** source (`packages/fluxiq/src/…`, `packages/client-gateway-websocket/src/…`).
The current build emits only `.mjs`, under paths relative to `domain/src`, so it
never writes or deletes them (`test-domain.mjs` calls `mkdir(outdir)` but never
cleans it). They were last committed on 2026-08-01 by `08b2346`, and their
on-disk mtime is 2026-09-10 against 2026-09-17 12:51 for a freshly built `.mjs`.
That is 451,765 bytes (0.4 MB) of tracked output that no command regenerates and
no process reads — and it survived two full domain test runs during this
assessment untouched, leaving `.test-build` git-clean. There are also 89 tracked
`.mjs` against 84 current `src/**/tests/*.test.ts` entries, so 5 `.mjs` bundles
are orphans of deleted tests.

## 2. Which command produces each

**`apps/extension/build/`** — `pnpm --filter @fluxiq-web-extension/extension build`
→ `apps/extension/package.json` `"build": "tsc -p tsconfig.json --noEmit && node scripts/build-extension.mjs"`.
The `tsc` step emits nothing; `apps/extension/scripts/build-extension.mjs` is the
sole generator. Its `bundleExtension()` does `rm -rf build/` and then bundles the
five entries in `extensionEntries` through esbuild (`bundle: true`,
`platform: "browser"`, `target: ["chrome109","firefox109"]`, `sourcemap: true`,
`legalComments: "none"`; `format` is `esm` for background/popup/sidepanel and
`iife` for content/page-world). `build/` is then copied into
`dist/{chrome,firefox,e2e-chromium}/` and only there does it gain `manifest.json`,
`icons/` and the popup/sidepanel HTML and CSS. With
`FLUXIQ_LAB_EXTENSION_BUILD_ROOT` set (written only by `scripts/lab/lab-instance.mjs`)
both `build/` and `dist/` go to an ignored per-instance directory instead, so a
Lab run does not touch the tracked copy.

Reached indirectly by: `pnpm build` (root `pnpm -r build`), `pnpm --filter … test:e2e`
(via `test:e2e:build` → `pnpm build`), `pnpm lab` / `pnpm lab:interactive` /
`pnpm lab:campaign` (with an instance build root), and the `demo:*` scripts.

**`domain/.test-build/`** — `pnpm --filter @fluxiq-web-extension/domain test`
→ `"test": "node scripts/test-domain.mjs"`. That script discovers every
`domain/src/**/tests/*.test.ts` (84 today), bundles each as its own esbuild entry
(`outbase: src`, `outExtension: {".js": ".mjs"}`, `bundle: true`,
`platform: "node"`, `target: ["node22"]`, `format: "esm"`, `sourcemap: false`,
`external: ["fluxiq","fluxiq/*","@fluxiq/client-gateway-websocket","@fluxiq/client-gateway-websocket/*"]`),
then dynamically imports each bundle to run it. With `DOMAIN_TEST_BUILD_LABEL`
set, output goes to the ignored `domain/.test-build-scratch/<label>/`; **without
a label it writes the tracked `.test-build/`**, which is the documented
regeneration route (`docs/architecture/repository-layout.md` line 435 ff.).
Reached by `pnpm test` (root `pnpm -r test`).

## 3. Determinism — tested empirically

Both builds are **byte-for-byte deterministic across consecutive runs on one
machine**, and neither embeds a timestamp, a build id, or an absolute path.

```
# extension, two consecutive runs from a clean source tree
node scripts/build-extension.mjs   (exit 0)  -> sha256 of all 10 files
node scripts/build-extension.mjs   (exit 0)  -> sha256 of all 10 files
diff ext-hash1.txt ext-hash2.txt
  -> IDENTICAL: build is byte-for-byte reproducible across runs

# domain test build, two consecutive runs
node scripts/test-domain.mjs  (exit 0, "# fail 0", duration_ms 17250.748)
node scripts/test-domain.mjs  (exit 0)
diff dom-hash1.txt dom-hash2.txt
  -> IDENTICAL: all 300 files byte-for-byte reproducible
```

`domain/.test-build/` was git-clean after both runs, so the committed copy
exactly matches a fresh build. Sourcemap `sources` entries are relative only
(`"../../src/shared/constants.ts"`, `"../../../../domain/src/constants.ts"`);
grepping the maps for `F:` returned 0 occurrences.

### But: NOT reproducible across checkouts — CRLF leaks into `sourcesContent`

`core.autocrlf` is `true` (local config) and there is no `.gitattributes`
(`git check-attr -a` on a build file returns nothing). Blobs are stored LF and
esbuild writes LF, so this does not make `git status` spuriously dirty. It does
something worse. `git checkout -- <file>` writes the *source* back with CRLF,
while a file last written by a tool or editor keeps LF — both are git-clean,
because normalization maps them to the same blob:

```
apps/extension/src/shared/constants.ts        LF=34  CRLF=34  <-- CRLF (git checkout wrote it)
apps/extension/src/shared/browser.ts          LF=35  CRLF=35  <-- CRLF (git checkout wrote it)
apps/extension/src/background/…/gateway-session.ts  LF=313 CRLF=0  <-- pure LF
# all three git-clean: `git status --porcelain -- apps/extension/src` is empty
```

esbuild copies those on-disk bytes verbatim into the sourcemap's
`sourcesContent`. Rebuilding at the same commit, with git-clean sources, after
git had rewritten two of them:

```
diff -rq BASE apps/extension/build
  BASE/background/index.js.map and apps/extension/build/background/index.js.map differ
  BASE/popup/index.js.map      and apps/extension/build/popup/index.js.map      differ
  BASE/sidepanel/index.js.map  and apps/extension/build/sidepanel/index.js.map  differ
```

The `.js` files are unaffected (esbuild normalizes newlines in emitted code);
only the maps differ. The differing bytes, from the merge output below, are the
embedded source text — left side LF, right side CRLF:

```
"sourcesContent": ["export const DEFAULT_GATEWAY_URL = \"ws://127.0.0.1:4777/client\";\nexport  …
"sourcesContent": ["export const DEFAULT_GATEWAY_URL = \"ws://127.0.0.1:4777/client\";\r\nexport …
```

Consequence: a fresh clone and a working checkout of the same commit build
different `.map` bytes, so the tracked maps can never settle. Under
branch-per-task, every branch switch that causes git to rewrite a source file
re-churns the maps.

### Second determinism trap: dead code still churns the maps

Appending two unused exported constants to `constants.ts` produced **identical
`.js` output** (esbuild tree-shook them) but **different `.map` files** for
`background`, `popup` and `sidepanel`. A source change with zero effect on
shipped code still rewrites the sourcemaps.

## 4. Historical churn — last 100 commits on `dev`

```
git log --oneline -100 -- apps/extension/build              -> 37
git log --oneline -100 -- domain/.test-build                -> 43
git log --oneline -100 -- apps/extension/build domain/.test-build -> 55
```

**55 of the last 100 commits touch tracked generated output.** Of those 55, only
**3 were generated-only**; the other **52 were mixed** (generated output riding
along with source changes), which is the shape that makes conflicts unavoidable
— you cannot cherry-pick, revert, or rebase the source without dragging the
bundles.

The three generated-only commits:

```
4b7f415 2026-09-16 Regenerate the tracked domain test build
ccb6360 2026-09-15 Regenerate tracked extension and domain test build output
d268a1f 2026-09-13 Regenerate the domain test build after the Lab-proof fixes
```

### Fan-out: one source edit rewrites dozens of generated files

| Commit | `domain/src` files changed | `.test-build` files changed |
| --- | --- | --- |
| `0eb2f29` | 3 | **68** |
| `3ee5e1d` | 3 | **53** |
| `d9d23e3` | 12 | 44 |
| `c356174` | 12 | 43 |
| `5e583ef` | 7 | 26 |
| `4ef4806` | 8 | 25 |

Because every test bundle inlines the whole module graph it depends on, one
shared module reaches most of them — `domain/src/extraction/dataset-id.ts` is
inlined into **51 of the 89** live bundles. Two parallel branches that each touch
any shared domain module will both rewrite the same ~50 generated files.

### History cost

```
generated paths, all history: 1,059 blobs,  91,695,696 bytes (87.4 MB)
entire repository, all history: 5,656 blobs, 229,635,111 bytes (219.0 MB)
.git on disk: 49 MB
```

**40% of every byte ever committed to this repository is generated build
output**, from 19% of the blobs.

## 5. Merge behaviour — tested

A hook in this environment blocks `git commit` for workers, so I could not
create real throwaway branches with commits. Instead I drove git's own
three-way merge driver directly with `git merge-file`, which is the same xdiff
merge git uses for a text blob, on three real builds:

- **BASE** — fresh build of current `dev` sources.
- **A** — `constants.ts`: `HEARTBEAT_INTERVAL_MS` 20_000→25_000,
  `RECONNECT_MAX_DELAY_MS` 30_000→45_000 (live values used by
  `background/connection/gateway-session.ts`), then rebuilt.
- **B** — `browser.ts` `defaultSettings()`: `captureMutations` and
  `captureSnapshots` true→false, then rebuilt.

Two plausible parallel tasks touching different shared files. Files changed
versus BASE — A changed 4, B changed 6, overlapping on 4:

```
A: background/index.js, background/index.js.map, popup/index.js.map, sidepanel/index.js.map
B: background/index.js, background/index.js.map, popup/index.js{,.map}, sidepanel/index.js{,.map}
```

`git merge-file -p A BASE B` on the four overlapping files:

```
background/index.js       exit=0  conflict_hunks=0  merged_bytes=  440,651
background/index.js.map   exit=1  conflict_hunks=1  merged_bytes=2,091,852
popup/index.js.map        exit=1  conflict_hunks=1  merged_bytes=  989,810
sidepanel/index.js.map    exit=1  conflict_hunks=1  merged_bytes=  989,818
```

**The `.js` merged cleanly, and correctly.** I built the combined A+B source
state and compared: `cmp` reported the merged bundle byte-identical to the true
A+B rebuild. That is because esbuild output is readable multi-line code (4,275
lines, longest 435 bytes for `popup`; 9,300 lines for `content`) and the two
edits landed far apart. This is a *lucky* property, not a guaranteed one — a
change that alters module ordering or renames a hoisted binding would shift the
whole bundle, and a textual merge of two bundles has no way to be checked.

**Every `.map` conflicted, and the conflict is as ugly as it gets.** The maps
are 7 lines; line 4 is the entire `sourcesContent` JSON array on one line:

```
line 1:       1 bytes      {
line 2:      15 bytes        "version": 3
line 3:   8,454 bytes        "sources": [ … ]
line 4: 437,982 bytes        "sourcesContent": [ … ENTIRE SOURCE OF EVERY BUNDLED MODULE … ]
line 5: 104,630 bytes        "mappings": …
line 6:     601 bytes        "names": …
line 7:       1 bytes      }
```

(for `content/index.js.map` that line is 995,021 bytes). The conflict hunk is
therefore a single `<<<<<<<` / `=======` / `>>>>>>>` block containing two
438KB single-line strings:

```
4: <<<<<<< A/popup/index.js.map
5: 437,982 bytes      (ours)
6: =======
7: 438,052 bytes      (theirs)
8: >>>>>>> B/popup/index.js.map
```

It cannot be resolved by reading it, by diffing it, or by any editor's merge
UI — the only sane resolution is to discard both sides and rebuild. And because
of the CRLF finding in §3, two branches can conflict here even when neither
changed a single byte of source.

`domain/.test-build/` has `sourcemap: false`, so it has no maps and its `.mjs`
bundles are multi-line (543–3,651 lines in the samples measured) and will often
merge textually like the `.js` did. The problem there is not the per-file
conflict shape but the ~50-file fan-out per shared-module edit: two branches
touching the *same* domain module conflict in ~50 generated files at once.

**Branch cleanup:** none was needed. The hook rejected the entire Bash call
before `git switch -c` executed, so no throwaway branch was ever created.
Verified:

```
git branch --list
  * dev
    main
    probe/worktree-cost          <- pre-existing, another agent's worktree
    week1-core-production-build  <- pre-existing
git branch --list 'tmp-*'  -> 0
```

`dev`'s HEAD was never moved by this assessment, and the working tree was
restored byte-exactly from a session-start snapshot (`diff -rq` clean; the same
8 files are modified now as were modified at the start).

## 6. Options

First, **why are they tracked?** There is no recorded rationale anywhere. The
policy table in `docs/architecture/repository-layout.md` (lines 85–92) simply
asserts it — `apps/extension/build/` → "Yes | Intermediate bundles. Update by
running the extension build when sources change."; `domain/.test-build/` →
"Yes | Generated domain-test artifacts. Let the domain test/build workflow
update them." Neither says *why*, and no commit message, design note or ADR
explains it. Both entered history incidentally in early bulk commits
(`29be582 "First basic extension…"`, `08b2346 "Extension UI updates…"`) rather
than by a deliberate decision. `AGENTS.md` and `docs/architecture/testing-facility.md`
restate the table without adding a reason. The one decision the repository *has*
recorded on this subject goes the other way — `44c2b29`, which untracked
`domain/.script-build/` because 23 blobs totalling 487.8 MB across 17 commits had
grown `.git` to 294 MB and were breaking pushes.

**What would untracking break? Nothing I could find.**

- **Unpacked-extension loading: unaffected.** `apps/extension/build/` holds only
  10 JS/map files — no `manifest.json`, no `icons/`, no popup/sidepanel HTML or
  CSS. It is not a loadable extension. Chrome/Edge and Firefox load
  `apps/extension/dist/<target>/`, which is **already untracked** (`.gitignore`
  has `dist/`), so loading already requires a build today.
- **Testing Lab: unaffected.** `scripts/lab/run-lab.mjs` runs
  `pnpm --filter … test:e2e:build` (i.e. `pnpm build`) on every run, and
  `lab-instance.mjs` points the browser at
  `path.join(extensionBuildRoot, "dist", "e2e-chromium")` — a per-instance
  ignored directory. The Lab never reads the tracked copy.
- **CI: unaffected.** `.github/workflows/testing-facility.yml` runs
  `pnpm check`, `pnpm test`, `pnpm build`, then
  `pnpm --filter … test:e2e` (which rebuilds) and `pnpm lab matrix`. It builds
  everything it uses.
- **`pnpm check` / structure audit: unaffected.** `scripts/structure-audit/config.mjs`
  never mentions these paths and `.structure-baseline.json` has zero references
  to them. `domain/tsconfig.json` and `tsconfig.test.json` already `exclude`
  `.test-build`.
- **`domain/.test-build/`: unaffected.** Written and imported within one
  `node scripts/test-domain.mjs` process; nothing outside reads it.
- Only real loss: you can no longer inspect a shipped bundle from a checkout
  without building. Mitigated by the proven determinism in §3 — and the maps are
  not stable across checkouts anyway, so the tracked copy is not a trustworthy
  reference today.

| Option | What it costs / breaks |
| --- | --- |
| **(a) Untrack, build on demand** — *recommended* | Nothing found breaking (above). Needs `.gitignore` entries for `apps/extension/build/` and `domain/.test-build/`, a `git rm -r --cached` for the 310 files, and edits to the policy tables in `repository-layout.md` (lines 88, 91), `testing-facility.md` (line 1868) and `AGENTS.md` (line 221). History is unchanged, so the 87.4 MB already in the pack stays; this stops the growth, exactly as `44c2b29` did. Removes the 211 stale files as a side effect. |
| **(b) Keep tracked + `.gitattributes` merge strategy** | `-merge` / `binary` turns every one of the 55-in-100 overlapping commits into a "both modified, resolve by hand" stop, and `merge=ours` silently keeps a stale bundle that no longer matches the merged source — the worst outcome, because nothing detects it. A custom `merge=rebuild` driver would work but must be installed per clone (`.git/config`, not distributable), and CI/agents would need it too. Does not address the 40% history cost, the CRLF irreproducibility, or the stale files. |
| **(c) Keep tracked + regenerate after every merge** | Technically sound — determinism (§3) guarantees the regenerated bytes are right — but it is a written rule, not a mechanical check, and this repository's standard is to enforce structure with checks that fail the build. It also leaves every merge with a guaranteed conflict to clear first, keeps the 40% history cost, and the CRLF issue means even a faithful regeneration can differ from a teammate's. |
| **(d) Untrack `domain/.test-build/` only, keep `apps/extension/build/`** | Removes the worst fan-out (68 files from 3 sources) but keeps the structurally unmergeable `.map` files, which are the guaranteed-conflict component. Half a fix. |
| **(d′) Complementary, recommended either way: add `.gitattributes`** | `* text=auto eol=lf` stops `git checkout` from rewriting sources as CRLF, which is what makes builds differ between a fresh clone and a working checkout (§3). This is worth doing on its own merits — it also removes the constant `LF will be replaced by CRLF` warnings — and it is a prerequisite for (b) or (c) being trustworthy at all. Cost: one normalizing commit that touches line endings across the tree. |

### Recommended sequence

1. Add `.gitattributes` with `* text=auto eol=lf` and renormalize.
2. `git rm -r --cached apps/extension/build domain/.test-build`; add both to
   `.gitignore`.
3. Update the four documentation locations listed above so the policy tables say
   `No` with the reason recorded this time.
4. Leave history alone. (Rewriting it to reclaim the 87.4 MB requires
   `filter-repo`, which needs the user's explicit approval every time.)

## Commands run and observed results

| # | Command | Observed |
| --- | --- | --- |
| 1 | `git ls-files apps/extension/build \| wc -l` | `10` |
| 2 | `git ls-files domain/.test-build \| wc -l` | `300` (211 `.js`, 89 `.mjs`) |
| 3 | byte sums over HEAD blobs | 4,742,297 and 6,564,700 |
| 4 | `find domain/src -path '*/tests/*.test.ts' \| wc -l` | `84` (vs 89 tracked `.mjs`) |
| 5 | `git ls-files 'domain/.test-build/!FluxIQ*' \| wc -l` | `211` — all the `.js` files |
| 6 | `git log -1 -- 'domain/.test-build/!FluxIQ'` | `08b2346 2026-08-01` |
| 7 | `node scripts/build-extension.mjs` ×2 + sha256 compare | exit 0 both; **IDENTICAL** |
| 8 | `node scripts/test-domain.mjs` ×2 + sha256 compare | exit 0 both, `# fail 0`, `duration_ms 17250.748`; **IDENTICAL** across 300 files |
| 9 | `git config --get core.autocrlf` | `true`; `git check-attr -a` → no attributes |
| 10 | line-ending census of 3 git-clean sources | 2 CRLF, 1 pure LF |
| 11 | rebuild at same commit after checkout rewrote 2 sources | 3 of 5 `.map` files **differ**; `.js` unchanged |
| 12 | `git log --oneline -100 -- <paths> \| wc -l` | 37 / 43 / 55 |
| 13 | per-commit classification of those 55 | 3 generated-only, 52 mixed |
| 14 | `grep -rl dataset-id domain/.test-build --include=*.mjs \| wc -l` | `51` of 89 |
| 15 | `git merge-file -p A BASE B` on 4 overlapping files | `.js` exit 0 / 0 hunks; 3 × `.map` exit 1 / 1 hunk, merged files ~2× size |
| 16 | `cmp merged-background.js AB/background/index.js` | identical — the clean merge was also correct |
| 17 | blob accounting, generated paths vs all history | 1,059/87.4 MB vs 5,656/219.0 MB → **40%** |
| 18 | `find apps/extension/build -name manifest.json` | none — not a loadable extension |
| 19 | `git branch --list` / `git branch --list 'tmp-*'` | 3 pre-existing branches + `dev`; **0** `tmp-*` |
| 20 | `diff -rq snapshot/extension-build-ORIG apps/extension/build` | byte-exact; `git status` matches session start |

## Not verified

- No real `git merge` between two committed branches was executed — a hook
  blocks worker commits. `git merge-file` is the same three-way driver git
  applies to a text blob, so the conflict shape and exit status are faithful,
  but I did not observe git's own index/rename handling or how a large `.map`
  conflict behaves inside `git mergetool`.
- Cross-machine determinism was not tested. Determinism was proven for repeated
  runs on this machine, and no timestamps or absolute paths are embedded, but a
  different Node or esbuild version was not exercised. (esbuild is pinned at
  `^0.24.2` in both packages, resolved through the lockfile.)
- The `domain/.test-build/` `.mjs` files were not put through `git merge-file`;
  the fan-out figures come from git history and from grepping which bundles
  inline a shared module, not from a constructed merge.
- I did not verify that the 5 extra `.mjs` bundles correspond to specific deleted
  test files — only that 89 are tracked against 84 current entries.
- Whether untracking would disturb `packages/test-runner`'s
  `extensionBuildPath` in real use: the only reference found
  (`bench/tests/compatibility.test.ts`) is a fixture using a synthetic path, and
  Lab runs resolve the path from `lab-instance.mjs`, but I did not run a full
  Lab session to confirm.
- This assessment ran while other agents were committing to `dev` (HEAD moved
  `8c0f2a0` → `22307f4`) and several `fxlab` worktrees were present. Churn
  figures in §4 were computed against `8c0f2a0`.
- Per the machine's known faulty RAM, each determinism result rests on two
  consecutive clean runs; neither showed any anomaly, but a single contrary
  observation later should be re-run before being believed.

## Open questions or contradictions found

1. **No rationale exists for the tracking decision.** The documentation asserts
   `Tracked: Yes` in three places without a reason, and the only recorded
   decision on generated data (`44c2b29`) untracked it. If there is an unwritten
   reason — someone loading bundles without a toolchain, or reviewing bundle
   diffs — it is not in the repository and should be stated before (a) proceeds.
2. **211 tracked files are output no command produces.** Either
   `test-domain.mjs` should clean `outdir` before building (it currently only
   `mkdir`s), or these should be deleted. Under option (a) the question is moot.
   Note the fix is not free: cleaning `outdir` would also delete the 5 orphan
   `.mjs` bundles, which is correct, but it changes what a labelled scratch run
   leaves behind.
3. **Contradiction between the policy and reality.** `repository-layout.md`
   line 437 says "An unlabelled domain test run therefore rewrites tracked
   files", presenting that as the regeneration mechanism — but it means the
   ordinary `pnpm test` dirties the tree, which is precisely what makes parallel
   branch work collide. The document describes the hazard without naming it as
   one.
4. **`core.autocrlf=true` with no `.gitattributes` is a latent correctness
   issue beyond this question.** It makes builds depend on checkout history.
   This affects anything that embeds source text, not just sourcemaps.
