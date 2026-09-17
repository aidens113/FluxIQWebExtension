# w2-audit-silent-reads-rule — worker report

Saved by the supervisor: the harness refused the worker's own write of this
file, and the worker returned the full report as text. This is that report,
with the per-file instance list replaced by a pointer to the two baselines,
which record the same list authoritatively.

## Outcome

Done. A new structure-audit rule, `failure-as-empty`, fails the build when
non-test source turns a caught failure into an empty or absent value.
Existing instances are recorded per file in both baselines and may only
shrink: **Core 132 instances in 66 files; this repository 77 instances in 59
files.** In both repositories `pnpm structure:test` passes (130/130),
`node scripts/structure-audit.mjs` passes, a throwaway `.catch(() => [])`
probe failed the audit and was removed, and the rule and its tests are
byte-identical. No source outside `scripts/` was changed and no instance was
fixed.

## What changed

| Repo | File | Change |
| --- | --- | --- |
| Core | `scripts/structure-audit/rules/failure-as-empty.mjs` | New rule, 359 lines |
| Core | `scripts/structure-audit/rules/tests/failure-as-empty.test.mjs` | New tests, 25 cases |
| Core | `.structure-baseline.json` | Adds only the `failure-as-empty` section (66 entries) |
| This repo | the same two rule files | Mirror, identical sha256 |
| This repo | `.structure-baseline.json` | Adds only the `failure-as-empty` section (59 entries) |

`scripts/structure-audit.mjs` discovers rules itself; neither `config.mjs`
changed.

## What the rule counts

It works on the TypeScript AST and skips test files and test roots.

- **Rejection handlers.** An inline `.catch(h)` or `.then(ok, h)` whose
  expression body is empty (`() => []`, `() => ({})`, `() => undefined`,
  `() => null`), whose block body returns an empty value, returns bare, or
  falls off the end, or whose body is a conditional with an empty branch not
  in the allowed form below.
- **Catch blocks.** Each `return []`, `return undefined`, `return null`,
  `return {}` inside a `catch`; a bare `return;` only when the enclosing
  function returns a real value elsewhere.
- **"Empty"** means `undefined`, `null`, `void x`, `[]`, `{}`, `""`, an object
  whose every property is empty, an empty `Map`/`Set`/`WeakMap`/`WeakSet`/
  `Array`, `Promise.resolve()` of nothing or an empty value, and a call to a
  function whose name starts with `empty`. `false` and `0` are not counted.
- **Finding.** One per file, keyed by path, `severity: "fail"`,
  `ratchet: true`, listing the lines and saying what to do: let it propagate,
  fail closed with an error naming what could not be read, or name the one
  expected failure and rethrow the rest.

## What the rule allows (each tested)

1. A named expected failure with everything else rethrown: the empty exit sits
   under an `if` that tests the caught error, or after one that tests and
   throws, and the block also throws or rejects. Recognised tests include a
   call passed the error, a method call on the error with an argument, an
   `instanceof` other than plain `Error`, and an equality comparison of a value
   read from the error, following aliases. `if (error)` does not count. All 13
   `ENOENT` guards in Core are recognised.
2. A `.catch` whose result is discarded.
3. A chain that only settles, where the success side yields nothing either
   (queue tails); without this, 10 Core queue tails were flagged.
4. A `.catch` handler that stores the error for later rethrow (excuses only
   falling off the end).
5. A handler passed by name.

Known gaps, stated in the rule header: an empty value bound to a name first;
one assigned inside a `catch` that falls through; a `continue` past a failed
item; the direction of a guard; and a non-empty fallback such as
`.catch(() => defaults)`.

## How the baselines were seeded

`pnpm structure:baseline` deliberately refuses to add entries for a new rule
(Core commit `4867c5c`). The worker did a one-time adoption through the
audit's own functions — load the baseline, refuse if the rule already has
entries, run only this rule, `planBaselineUpdate(..., ["failure-as-empty"])`
requiring 0 blocked, lowered and removed, `saveBaseline` — so both baseline
diffs are additions only. `pnpm structure:baseline` then reported "baseline
already current, not rewritten ... (0 lowered, 0 removed)" in both.

## Validation

- Rule tests: `# pass 25 # fail 0` (Core), before and after compaction.
- Mutation check, restored by `cmp`: named-failure form always refused -> 3
  failures; discarded results not recognised, settle-only chains not
  recognised, stored error ignored, `instanceof Error` accepted, bare `return`
  always counted, object of empties not empty -> 1 failure each.
- Measurement: Core first version 142 in 73 files; after the settle and
  stored-error exemptions 132 in 66 (exactly the 10 queue tails and
  `trusted-clients.ts:20` dropped). Extension 77 in 59.
- `pnpm structure:test` -> `# tests 130 # pass 130 # fail 0` in both.
- `node scripts/structure-audit.mjs` -> Core "passed (152 warning(s), 320
  baselined)"; extension "passed (60 warning(s), 76 baselined)"; exit 0.
- Probe `export async function probe(load) { return await load().catch(() => []); }`
  -> `FAIL [failure-as-empty] ... 1 caught failure is turned into an empty or
  absent value, at line 2`, exit 1, in both; removed; audit green again.
- Mirror: all 25 files under `scripts/structure-audit/` except `config.mjs`
  identical.

## Not verified

`pnpm check`, `pnpm test` and `pnpm build` were not run (the change touches
only `scripts/structure-audit/` and the baselines). The surrounding code was
read for only about 25 of the 209 recorded instances. No probe grew an
already-baselined file's count (covered by the existing `baseline.test.mjs`).

## Open questions

1. `pnpm structure:baseline` cannot adopt a new rule; recommended an explicit
   `--adopt <rule>` in Core's `baseline.mjs`, allowed only when the rule has no
   entries.
2. Two pre-existing instances sit in files other workers were editing: Core
   `AS/runtime/flow-bootstrap/generation-failure.ts` (`catch { return null; }`
   in `parseAutomationStudioFlowBootstrapGenerationError`) and
   `AS/storage/project/adaptation-store.ts` (`catch { return {}; }` in
   `object()`).
3. **Swallowed writes are not counted by design**: a discarded
   `.catch(() => undefined)` on a write or side effect. A variant counted 49 in
   23 Core files and 86 in 42 extension files, including `service.ts`'s
   `await this.uiCache.purgeProject(projectId).catch(() => undefined);`.
   Covering them needs a second ratcheted rule.
4. Some recorded findings are arguably fine and clear with a one-line rewrite
   (extension queue tails in `agent-orchestrator/src/audit.ts`,
   `test-runner/src/browser-evidence.ts`, `bench/durable-file.ts`; best-effort
   work in Core `secret-keys/runtime/seal-upgrades.ts` and
   `apps/web/.../project-revalidation.ts`). `service.ts`'s `flowScope` is a
   documented fail-closed choice but is still counted.
5. Many instances are HTTP-body and cache reads in `apps/web` and
   `packages/test-runner`; each is a per-file decision.
6. Core's `docs/architecture/code-structure.md` anti-patterns list should gain
   a `failure-as-empty` line, as `contract-spread` has.

The per-file instance list, with line numbers as of the run, is recorded in
each repository's `.structure-baseline.json` under `failure-as-empty`.
