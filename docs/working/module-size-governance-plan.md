# Module Size Governance Plan

Status: Active
Status detail: Phases 1 and 2 complete here; both shipped oversized files decomposed; neither split is runtime-verified.
Created: 2026-09-10
Last updated: 2026-09-10
Owner: Senior supervisor agent
Scope: Applying the shared file and class size policy to this repository, and decomposing the files here that already exceed it.
Paired document: `F:\!FluxIQ\docs\working\module-size-governance-plan.md`
Related: [AGENTS.md](../../AGENTS.md), [agent working document protocol](./agent-working-doc-protocol.md)

The shared policy — thresholds, ratchet semantics, rationale, and the
CodeGraph assessment — is owned by the paired Core document. This document
covers only this repository's offenders and wiring, and does not restate the
policy.

---

## Current State

**Phases 1 and 2 are complete here.** All 74 co-located tests sit in a `tests/`
subfolder of the directory that owns their subject, and both shipped oversized
files have been decomposed. The `test-placement` rule reports zero findings,
and no class in this repository exceeds the method limit.

| File | Before | After |
| --- | --- | --- |
| `apps/extension/src/background/connection.ts` | 1,913 lines, 81 methods | 736 lines, 39 methods, 19 collaborators under `background/connection/` |
| `apps/extension/src/content/index.ts` | 1,188 lines | 25 lines, 15 sibling modules |
| `packages/test-runner/src/demo-workspace.ts` | 3,855 lines | untouched — test infrastructure, deliberately deferred |
| `packages/test-runner/src/demo-llm-create-ui.ts` | 837 lines | untouched, same reason |

`FluxIQConnection`'s public surface was verified identical by AST diff: 16
public methods before and after, none added or removed. The content script's
behaviour was verified by bundling the entry with the extension's own esbuild
settings and running it in a stubbed DOM that records every listener
registration and message reply in execution order; the before/after diff was
two lines, both the `MutationObserver` construction moving earlier within the
load phase, with every `addEventListener` target/type/capture/position, the
`onMessage` listener position, and every reply body identical. All 185 string
literals under `content/` are unchanged, so no message name, action type,
instance key or selector moved.

**Neither split is runtime-verified.** Nothing was loaded in a browser: no
reconnect, pairing, recording, action execution or tab handling was exercised,
and the Playwright suite was not run. For shipped browser code that gap is the
honest headline, not a footnote.

**Enforcement.** `scripts/structure-audit.mjs` and its rule tree are mirrored
from Core byte for byte — change them there first — with this repository's own
`config.mjs` (which additionally forbids `domain/src` importing
`apps/extension/src`) and its own `.structure-baseline.json`. `pnpm check`
runs `pnpm structure:test` first, then the audit, then `pnpm -r check`, so the
rules are validated before they judge the repository.

**Three rule changes landed during this work, all mirrored from Core.**

- The `imports` rule now exempts a module reaching the files of a directory it
  lives inside. Every relocation phase manufactured violations of this rule by
  construction — a test moved into `tests/`, a file moved into a
  prefix-derived subdirectory, a collaborator extracted into `service/` — and
  the only alternatives were widening public barrels so internals could reach
  their own siblings, or freezing counts the phases themselves inflated.
  Reaching into a *sibling* subdirectory is still counted.
- `maxPathSegments` rose from 8 to 9, and the prefix rule no longer demands a
  directory that would breach the depth limit. The two rules could previously
  deadlock: flat, the prefix rule demanded `<dir>/<prefix>/`; nested, the
  depth rule rejected it and did not ratchet, so neither state could pass.
- `structure:test` runs first in `pnpm check`. The rule tests existed but
  gated nothing, so the auditor itself was unguarded.

**Audit, this repository:** 2 files over 800 lines, both `test-runner` test
infrastructure; 0 classes over the method limit, down from 1; 0 co-located
tests, down from 74; `packages/test-runner/src` 101 → 50 direct source files.

**Known pre-existing defects, not caused by this work.**

- `packages/test-runner/src/tests/demo-llm-creation.test.ts` asserts
  `maxCallsPerRun: 1` against a config that returns `2`. A genuine stale
  expectation.
- 18 further `test-runner` failures are a cwd artifact, not defects: the tests
  pass `process.cwd()` as `repositoryRoot`, and `pnpm --filter` sets cwd to
  the package directory. From the repository root the same 266 tests give 265
  pass / 1 fail.
- `domain/src/runtime/tests/*.test.ts` (3 files) are compiled and run by
  nothing.
- **`apps/extension` has no unit test runner at all.** Its `test` script is a
  file-existence check, and there are zero `*.test.ts` under
  `apps/extension/src`. This is why neither shipped-file split added tests:
  they would compile and never run, reproducing the dead-test defect above.
  Adding a runner is the prerequisite for testing any future extension work.

**Next steps**

1. Add a unit test runner to `apps/extension`, then cover the `connection/`
   collaborators — especially the reconnection and session-lifecycle seam,
   which MVP Week 4's reliability hardening will edit.
2. Manual browser validation of both splits before relying on them.
3. `demo-workspace.ts` (3,855) and `demo-llm-create-ui.ts` (837) remain. Note
   that `packages/test-runner/src/tests/demo-llm-prepare.test.ts` reads
   `demo-workspace.ts` and `demo-llm-blank-workspace.ts` as **text**, so that
   split will break it at runtime with no compile error.

**Blockers:** none.
---

## Local Notes

**`connection.ts` is the one to watch.** At 1,913 lines it owns, per the
architecture description in `AGENTS.md`, the WebSocket session, tab routing,
recording state, and storage. That is four responsibilities, and the
repository's own modularity rule asks that they be separable. It is also
directly in the path of MVP Week 4's reliability hardening work — extension
reconnect, runtime reconnect, tab closure, network failure. If that hardening
requires substantial edits inside it, splitting the reconnection and session
lifecycle out at that point is justified on its own terms rather than as a
refactor for its own sake.

**`demo-workspace.ts` should not be exempt merely for being test code**, but
its 3,855 lines are the least urgent problem in either repository. Baseline
it and let the ratchet stop it growing.

**Existing tooling to reuse.** This repository already has
`packages/boundary-audit` with a `pnpm boundary:audit` entry point. If a
size audit becomes a second standalone script, that is two audit tools with
separate invocations. Worth considering whether the size check belongs inside
the existing audit package instead of alongside it.

---

## Worker Briefs

Four briefs were dispatched here during 2026-09-10 — two for the Phase 1
test relocation and two for the shipped oversized files — partitioned by
package. They have been compacted away: each report in
`docs/working/module-size-governance-plan/reports/` carries its task,
evidence and findings, and the ledger below records what was accepted.

## Work Ledger

### 2026-09-10 — Plan authored

- Agent: supervisor
- Changed: this document and its Core pair.
- Why: Core reached a 12,482-line class while an instruction forbidding it
  was in force; this repository needs the same mechanical guard before it
  drifts the same way.
- Validation: `wc -l` over all tracked `.ts`, `.tsx`, `.mjs`, and `.js`
  files excluding `node_modules` and build outputs -> 287 source files, four
  over 800 lines, one over 2,000. Plan only, so no code check applies.
- Outcome: Accepted
- Follow-up: Implement the shared ratchet in Core, then wire it here.

### 2026-09-10 — Audit adopted and wired into pnpm check

- Agent: supervisor
- Changed: `scripts/structure-audit.mjs` and `scripts/structure-audit/`
  (mirrored from Core), `scripts/structure-audit/config.mjs` (this
  repository's boundaries), `.structure-baseline.json`, `package.json`
  (`check`, `structure:check`, `structure:baseline`), `AGENTS.md`,
  `docs/working/README.md` (now generated).
- Why: AGENTS.md stated budgets here that nothing enforced.
- Validation: `node scripts/structure-audit.mjs --rule imports --json` ->
  zero non-ratcheted findings, so the domain→extension boundary holds
  today; `pnpm structure:check` exit 0 after `--update`; `pnpm -r check`
  run alongside.
- Outcome: Accepted
- Follow-up: Phase 1 tests relocation.

---

### 2026-09-10 — Phase 1 tests relocation

- Agent: supervisor, with workers `ext-test-runner` and `ext-rest`
- Changed: 74 test files moved into `tests/` subfolders — 51 in
  `packages/test-runner/src`, 23 across scenario-lab, domain, and six
  packages. `packages/{agent-orchestrator,test-contracts,test-evidence}/test`
  renamed to `tests` with their `package.json` globs. Four Playwright specs
  lifted from `apps/extension/e2e/specs` into `e2e/` with `testDir` changed,
  because the rule requires tests directly inside a `tests` or `e2e`
  directory and widening this repository's `testRootDirNames` to accept
  `specs` would have diverged the one config file allowed to differ from
  Core. Also `domain/tsconfig.json`, `domain/scripts/test-domain.mjs`,
  `packages/test-runner/package.json` (test glob quoted),
  `scripts/structure-audit/rules/imports.mjs` plus its new test (both
  mirrored from Core), root `package.json` `check`, `.structure-baseline.json`.
- Why: Core's Migration Plan Phase 1. Halving the file count in dense
  directories before any code is split, and removing the 74 co-located tests
  the audit had frozen.
- Validation: `pnpm check` -> `structure-audit: passed (16 warnings, 40
  baselined)`, every package typechecks, exit 0. `pnpm build` -> exit 0, with
  51 compiled tests all under `dist/tests/` and zero left at the pre-move
  depth. `pnpm -r --filter '!@fluxiq-web-extension/test-runner' test` ->
  exit 0, 97 tests, 0 failures. `pnpm test` -> fails only in `test-runner`,
  19 failures identical in count and name to before the move; 18 are a cwd
  artifact of `pnpm --filter` (from the repository root the same 266 tests
  give 265 pass / 1 fail) and the 19th is a stale config assertion in
  `demo-llm-creation.test.ts`. `node scripts/structure-audit.mjs --rule
  test-placement --json` -> zero findings, down from 13 directories / 74
  files. Baseline diff audited key by key: 14 removed, 1 added, 0 raised;
  the single addition is `directory-files` on the new
  `packages/test-runner/src/tests` (51).
- Outcome: Accepted
- Follow-up: `connection.ts` split; carry `test-runner`'s tests with the
  `demo-` prefix split rather than treating `src/tests` as a separate
  problem.

### 2026-09-10 — Phase 2: both shipped oversized files decomposed

- Agent: supervisor, with workers `ext-connection` and `ext-content`
- Changed: `apps/extension/src/background/connection.ts` from 1,913 lines and
  81 methods to 736 and 39, with 19 collaborators under
  `background/connection/`; `apps/extension/src/content/index.ts` from 1,188
  lines to 25, with 15 sibling modules. Also the four enforcement-rule changes
  and their tests, mirrored byte for byte from Core, and root `package.json`
  so `check` runs `structure:test` first.
- Why: these were the only two shipped files in this repository over the
  800-line limit, and `FluxIQConnection` was its only class over the method
  limit. `connection.ts` also sits directly in the path of MVP Week 4's
  reliability hardening, so the reconnection and session-lifecycle seam was
  worth creating before that work rather than during it.
- Validation: `pnpm --filter @fluxiq-web-extension/extension check` -> exit 0;
  `build` -> exit 0; smoke test passes. `pnpm -r --filter '!...test-runner'
  test` -> exit 0, 97 tests across seven packages, zero failures.
  `test-runner` -> 266 tests, 247 pass, 19 fail, identical in count and name
  to before. `pnpm structure:test` -> 29 passing. Audit passes with baselined
  findings down from 40 to 21. Public surface verified independently by AST
  diff: `FluxIQConnection` has 16 public methods before and after, none added
  or removed. The content script was verified by bundling its entry with the
  extension's own esbuild settings and running it in a stubbed DOM recording
  every listener registration and message reply in order; the diff was two
  lines, both the `MutationObserver` construction moving earlier within the
  load phase, and all 185 string literals under `content/` are unchanged, so
  no message name, action type, instance key or selector moved.
- Outcome: Accepted, with a stated gap
- Follow-up: **neither split is runtime-verified.** Nothing was loaded in a
  browser: no reconnect, pairing, recording, action execution or tab handling
  was exercised, and the Playwright suite was not run. For shipped browser
  code that is the honest headline. `apps/extension` also has no unit test
  runner at all — its `test` script is a file-existence check and there are
  zero `*.test.ts` under `src` — which is why neither worker added tests:
  they would have compiled and never run, reproducing the dead-test defect
  already recorded for `domain/src/runtime/tests/`. Adding a runner is the
  prerequisite for covering the new `connection/` collaborators.

## Open Questions

- **Should the size check live in `packages/boundary-audit` or as a separate
  script?** Reusing the existing audit package avoids a second tool, but
  couples a generic size rule to a repository-specific boundary tool that
  has no counterpart in Core. Owner: senior supervisor agent.
