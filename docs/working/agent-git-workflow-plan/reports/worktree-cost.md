# Worktree cost probe — measured

Measured 2026-09-17 on the development machine, Git Bash, from
`F:\!FluxIQWebExtension` (dev) and `F:\!FluxIQ` (dev). Every number below is a
wall-clock measurement of a command that actually ran; nothing is estimated.
All probe artifacts have been removed and the removal verified (section 7).

## 1. Measured timings

| # | Step | Where | Wall-clock | Result |
|---|---|---|---|---|
| 1 | `git worktree add` (isolated sample, warm cache) | ext | **1.060 s** | OK |
| 2 | `git worktree add --detach` (Core) | core | *not isolated* — see note | OK |
| 3 | `pnpm install --frozen-lockfile` | **ext probe** | **2.910 s** | OK |
| 4 | `pnpm check` (first attempt) | ext probe | **9.556 s** | **FAILED** — missing Core `dist/` |
| 5 | `pnpm install --frozen-lockfile` | **core probe** | **35.757 s** | OK (301 pkgs, 0 downloaded) |
| 6 | Core build: `contracts` + `fluxiq` + `client-gateway-websocket` | core probe | **12.813 s** | OK |
| 7 | `pnpm check` (second attempt, after Core build) | ext probe | **25.566 s** | **FAILED** — pre-existing error, not worktree-related |
| 8 | `pnpm build` | ext probe | **18.080 s** | **OK (exit 0)** |

**Cost to stand up a usable authoring worktree: ~52.6 s** (steps 1 + 3 + 5 + 6).
After that, `pnpm check` costs ~25.6 s and `pnpm build` ~18.1 s per run.

Notes on the timings:

- Step 2 was not timed separately: my first timing attempt used `/usr/bin/time`,
  which does not exist in this Git Bash, and `bc` is also absent, so the two
  initial `git worktree add` calls produced no number. I re-measured
  `git worktree add` in isolation afterwards (step 1: 1.060 s, and
  `git worktree remove` at 0.762 s) with the OS file cache already warm. A
  cold-cache `git worktree add` will be slower; I did not measure one.
- Step 6 was a genuinely cold build. `tsconfig.build.tsbuildinfo` is gitignored,
  so the fresh Core worktree had no incremental state, and the script begins
  with `tsc -b --clean` regardless.
- **No RAM-related impossible failure occurred.** No segfault, no exit
  3221225477, no dependency-internal corruption, no uniform timeouts. **No run
  needed a rerun**, and every failure reported here is a reproducible,
  explainable failure with real error text.

## 2. Exact commands

```bash
mkdir -p /f/fxwork/probe

# extension worktree, new throwaway branch off dev
cd /f/\!FluxIQWebExtension
git worktree add -b probe/worktree-cost 'F:/fxwork/probe/!FluxIQWebExtension' dev

# Core worktree, detached at Core dev head
cd /f/\!FluxIQ
git worktree add --detach 'F:/fxwork/probe/!FluxIQ' dev
```

The sibling layout constraint holds exactly as stated. After
`pnpm install --frozen-lockfile` in the extension worktree:

```
domain/node_modules/fluxiq -> /f/fxwork/probe/!FluxIQ/packages/fluxiq/
```

`link:../../!FluxIQ/packages/fluxiq` resolved from `<worktree>/domain` to the
sibling probe Core worktree, **not** to `F:\!FluxIQ`. The probe was genuinely
isolated from the main Core checkout.

## 3. Disk cost, and hardlinking from the shared store

`pnpm store path` is `F:\.pnpm-store\v3` (935 MB). There is no `.npmrc`;
`pnpm config get store-dir` is `undefined`, so this is pnpm's resolved default.

**pnpm hardlinked from the shared store. This is proven, not inferred:**

```
nlink=15 inode=281474992953318  /f/fxwork/probe/!FluxIQWebExtension/node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/package.json
nlink=15 inode=281474992953318  /f/!FluxIQWebExtension/node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/package.json
```

Same inode, 15 hard links. `du -shc` over both trees in one invocation
(which counts a hardlinked file only the first time it is seen) gives the
marginal cost:

| Tree | Apparent size (`du -sh` alone) | Marginal new blocks |
|---|---|---|
| ext probe `node_modules` | 49 M | **~455–502 KB** |
| core probe `node_modules` | 617 M | **~12 M** |
| Core `dist/` (freshly built, real bytes) | — | **~13.3 M** (`fluxiq` 13 M, `contracts` 276 K, `client-gateway-websocket` 71 K) |
| ext working files | ~34 M | ~34 M |
| core working files | ~21 M | ~21 M |

`du -sh /f/fxwork/probe` reported **733 M**, but that number is misleading:
almost all of it is hardlinks into the shared store. **The true marginal disk
cost of a worktree pair is roughly 80 MB**, dominated by the two source
checkouts and the freshly built Core `dist/`, not by `node_modules`.

## 4. Failures specific to being a worktree

### 4a. Missing Core build output — a real blocker (worktree-specific)

Core's `dist/` is gitignored and untracked:

```
$ git check-ignore -v packages/fluxiq/dist
.gitignore:3:dist	packages/fluxiq/dist
$ git ls-files packages/fluxiq/dist | wc -l
0
```

`packages/fluxiq/package.json` resolves every export to `./dist/*`. A fresh
Core worktree therefore has source but no types. `pnpm check` failed at 9.556 s
with exactly this:

```
packages/test-contracts check: src/failure-category.ts(22,8): error TS2307: Cannot find module '@fluxiq/contracts/automation-studio' or its corresponding type declarations.
packages/test-contracts check: Failed
F:\fxwork\probe\!FluxIQWebExtension\packages\test-contracts:
 ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL  @fluxiq-web-extension/test-contracts@0.1.0 check: `tsc -p tsconfig.json --noEmit`
Exit status 2
 ELIFECYCLE  Command failed with exit code 2.
```

pnpm bails on the first failure, so `domain` and `apps/extension` never ran on
that attempt. **Remediation cost is the 35.757 s Core install plus the 12.813 s
Core build (~48.6 s) — the single largest line item in standing up a worktree,
and it is easy to miss because it is work in the *other* repository.**

### 4b. Missing `.env.local` — real, but did not break check or build

`.env.local` (638 bytes, gitignored) exists in the main checkout and is
**absent** from a fresh worktree. It did **not** cause `pnpm check` or
`pnpm build` to fail. It is read by `scripts/lab/pair/provider-key.mjs`, so it
affects lab and live-campaign runs only. The repository's own tooling already
documents this exact worktree hazard, in
`scripts/lab/pair/instructions.mjs`:

```
`#   Export it in the shell that starts the campaign, or copy .env.local from the working checkout into ${extRoot}:`,
"#   git ignores that file, and with FLUXIQ_TEST_ENV_FILES=none the Lab takes only that one name from it.",
```

### 4c. Absolute paths and Windows path issues — none encountered

Nothing failed on absolute paths. The `link:` specifier is relative and
resolved correctly. The `!` in the directory names caused no trouble in Git
Bash. `pnpm build` emitted `LF will be replaced by CRLF` warnings for the ten
files under `apps/extension/build/`, which is cosmetic and also present in the
main checkout.

### 4d. NOT worktree-specific: the remaining `pnpm check` failure

After the Core build, `pnpm check` got through `domain`, `test-contracts`,
`test-matrix`, `scenario-lab`, `agent-orchestrator`, `test-evidence`,
`boundary-audit` and `real-site-policy`, then failed in `apps/extension`:

```
apps/extension check: src/shared/tests/present.test.ts(271,44): error TS2345: Argument of type '{ formId: undefined; ... }' is not assignable to parameter of type 'RequiredFields<DomElementContext> & OptionalFields<DomElementContext>'.
apps/extension check:   Property 'record' is missing in type '{ formId: undefined; ... }' but required in type 'OptionalFields<DomElementContext>'.
apps/extension check: src/shared/tests/present.test.ts(285,45): error TS2345: ...
apps/extension check: Failed
 ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL  @fluxiq-web-extension/extension@0.1.0 check: `node scripts/check-extension.mjs`
Exit status 1
```

This is **pre-existing on `dev`**, not caused by the worktree:

- `DomElementContext` is defined in `apps/extension/src/shared/protocol.ts`
  in *this* repository, not in Core — so stale/fresh Core `dist/` is irrelevant.
- Both Core checkouts were at the identical commit `1be6c9e`.
- Both implicated files hash identically between the main checkout and the
  probe: `protocol.ts` = `4816d36a`, `present.test.ts` = `f698eff8`.
- Both checkouts resolve the *same inode* for `typescript@5.9.3`.

**Caveat, stated plainly:** I did not execute `pnpm check` in the main checkout
to confirm the failure reproduces there, because the brief forbade touching
that working tree. The conclusion rests on identical source blobs and an
identical toolchain, which is strong but is an inference, not a measurement.

**Also worth flagging:** the main checkout's `dev` HEAD advanced from `8c0f2a0`
to `378d0c3` while this probe ran (concurrent supervisor commits). The probe
was branched from `8c0f2a0`. This does not affect any timing above, but it
means the probe was a commit or two behind by the end.

## 5. Does the build dirty tracked generated paths?

`git status --short` in the probe worktree was **completely clean before the
build** and **dirty after it**:

| Path | Tracked files | Dirtied by `pnpm build`? |
|---|---|---|
| `apps/extension/build/` | 10 | **YES — all 10 modified** |
| `domain/.test-build/` | 300 | **No — untouched** |

```
 M apps/extension/build/background/index.js
 M apps/extension/build/background/index.js.map
 M apps/extension/build/content/index.js
 M apps/extension/build/content/index.js.map
 M apps/extension/build/page-world/index.js
 M apps/extension/build/page-world/index.js.map
 M apps/extension/build/popup/index.js
 M apps/extension/build/popup/index.js.map
 M apps/extension/build/sidepanel/index.js
 M apps/extension/build/sidepanel/index.js.map
```

The diff is **substantive, not whitespace**: 9 files changed, 250 insertions,
58 deletions. That means the committed `apps/extension/build/` output is stale
relative to `dev` source. The main checkout showed 8 of these same files
modified at session start, which is the same staleness surfacing there.

**Consequence for any worktree workflow: a worktree goes dirty on 10 tracked
files the moment anyone runs `pnpm build`.** Note `page-world` appears in the
worktree's 10 but not in the main checkout's 8 — the main checkout's
`page-world` output happens to already match its rebuild.

`domain/.test-build/` is written by `domain/scripts/test-domain.mjs:19`
(`path.join(root, ".test-build")`), which runs under `pnpm test`, **not** under
`pnpm build`. I did not run `pnpm test` — it was outside the brief — so whether
`pnpm test` dirties those 300 tracked files is **read from the script, not
observed**.

## 6. A cleanup finding: `git worktree remove --force` does not work here

Both removals **failed**:

```
$ git -C '/f/!FluxIQWebExtension' worktree remove --force 'F:/fxwork/probe/!FluxIQWebExtension'
error: failed to delete 'F:/fxwork/probe/!FluxIQWebExtension': Directory not empty
```

```
$ git -C '/f/!FluxIQ' worktree remove --force 'F:/fxwork/probe/!FluxIQ'
error: failed to delete 'F:/fxwork/probe/!FluxIQ': Directory not empty
```

`--force` covers modified tracked files, but not ignored directories like
`node_modules`. Worse, the failed removal is **not atomic** — it had already
deleted part of the tree before aborting, leaving a half-removed worktree with
its `.git` file gone. The reliable sequence is:

```bash
rm -rf /f/fxwork/probe          # 3.585 s
git -C '/f/!FluxIQWebExtension' worktree prune
git -C '/f/!FluxIQ' worktree prune
```

**Any worktree automation must use `rm -rf` + `worktree prune`, not
`git worktree remove --force`.**

## 7. Cleanup verification

`F:/fxwork` is gone entirely (the empty parent was removed with `rmdir` after
the probe directory). Verification output:

```
$ git -C '/f/!FluxIQWebExtension' worktree list
F:/!FluxIQWebExtension        378d0c3 [dev]
F:/fxlab-147fdb4              147fdb4 (detached HEAD)
F:/fxlab/fxlab-09fd9c7-a      74f6aa0 (detached HEAD)
F:/fxlab/fxlab-16ff729        d639415 (detached HEAD)
F:/fxlab/fxlab-16ff729-b      74f6aa0 (detached HEAD)
F:/fxlab/fxlab-16ff729-step4  d639415 (detached HEAD)
F:/fxlab/fxlab-7263534        118aeb7 (detached HEAD)
F:/fxlab/fxlab-7263534-load   15974e7 (detached HEAD)
F:/fxlab/fxlab-prod-core      118aeb7 (detached HEAD)
F:/fxlab/lab-ext              79839f4 (detached HEAD)
F:/fxlab/verify-ext           ff12d6b (detached HEAD)

$ git -C '/f/!FluxIQ' worktree list
F:/!FluxIQ            1be6c9e [dev]
F:/fxlab/!FluxIQ      42bd90a (detached HEAD)
F:/fxlab/lab-core     8409ca2 (detached HEAD)
F:/fxlab/verify-core  25bea03 (detached HEAD)

$ test -d /f/fxwork ; echo $?   ->  F:/fxwork does not exist
```

Every remaining entry is a pre-existing `fxlab` worktree, byte-identical to the
listing taken before the probe began. No probe path remains in either
repository.

**Main working trees untouched.** `F:\!FluxIQ` is clean. `F:\!FluxIQWebExtension`
shows the same 8 modified `apps/extension/build/` files it had at session start
— I made no edit to either working tree (this report is the only file written).

### One thing I could not do

**The throwaway branch `probe/worktree-cost` still exists.** `git branch -D` is
blocked for workers by a permission hook:

```
Blocked "git branch -d": workers must not change git history or open pull requests.
```

I did not attempt to work around it (deleting the ref file by hand would be
circumvention). **The supervisor needs to run:**

```bash
git -C 'F:/!FluxIQWebExtension' branch -D probe/worktree-cost
```

The branch points at `8c0f2a0`, which is an ancestor of `dev`, so it holds no
unique commits and deleting it loses nothing.

## 8. What this means for a worktree-based agent workflow

1. **The dominant cost is Core, not this repository.** The extension worktree
   installs in **2.9 s**; the Core sibling costs **48.6 s** (install + build).
   Any worktree provisioning script must build Core's `contracts`, `fluxiq` and
   `client-gateway-websocket` or the extension cannot type-check at all.
2. **Disk is close to free** — roughly 80 MB marginal per pair, because pnpm
   hardlinks from `F:\.pnpm-store\v3`. The 733 MB apparent figure is not real
   consumption.
3. **`pnpm build` works in a worktree** (18.1 s, exit 0) and needs no secrets.
4. **A worktree cannot stay clean through a build** — 10 tracked files under
   `apps/extension/build/` are modified every time. Provisioning must either
   check those out again or accept a dirty tree.
5. **Copy `.env.local` in** if the worktree will run lab or live-campaign work.
6. **Never clean up with `git worktree remove --force`** — use `rm -rf` plus
   `git worktree prune`.
7. **`pnpm check` is currently red on `dev`** for a reason unrelated to
   worktrees (`apps/extension/src/shared/tests/present.test.ts`, missing
   `record` field). A provisioning script that gates on `pnpm check` passing
   would fail today on a correctly built worktree.

## 9. Not verified

- Cold-cache `git worktree add`; the 1.060 s sample was warm.
- The Core `git worktree add` was not timed separately.
- That `pnpm check` fails identically in the main checkout — inferred from
  identical file hashes and an identical toolchain, deliberately not executed.
- Whether `pnpm test` dirties `domain/.test-build/` — read from
  `domain/scripts/test-domain.mjs`, not run.
- `pnpm test`, `pnpm dev`, live browser behavior, and any lab or live-provider
  run in a worktree — all outside the brief.
- Whether a worktree can load the built extension in a real browser.
