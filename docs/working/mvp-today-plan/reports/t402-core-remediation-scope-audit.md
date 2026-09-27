# t402 — Core remediation scope audit

## Verdict

**GO.** The current Core remediation surface is confined to the expected seven
include paths: one ownership-correct moved test destination, three test-only
timeout files, two generated framework-reference mirrors, and the assigned
authored architecture document. This surface introduces no production source,
package/configuration, global-timeout, worker-pool, file-parallelism, or other
concurrency change.

The two other modified Core architecture documents,
`docs/architecture/automation-studio.md` and
`docs/architecture/package-boundaries.md`, are inherited t170 coherent-unit
changes. They are outside this remediation audit and are not accidental
remediation additions.

No Core or downstream implementation was edited. I ran no test, build,
provider, live, panel, browser, Lab, staging, commit, or push operation. This
report is the only write.

## Exact Core files to include

1. `docs/architecture/automation-studio/llm-flow-bootstrap.md`
2. `docs/reference/framework-reference.md`
3. `packages/fluxiq/docs/reference/framework-reference.md`
4. `packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop/tests/progress.test.ts`
5. `packages/fluxiq/src/programs/automation-studio/runtime/tests/service-adaptation/tests/llm-grants.test.ts`
6. `packages/fluxiq/src/programs/automation-studio/runtime/tests/service-flows/tests/canonical-persistence.test.ts`
7. `packages/fluxiq/src/programs/automation-studio/runtime/tests/service-flows/tests/scale-pages.test.ts`

There is no old-path deletion to include. The pre-move
`packages/fluxiq/src/programs/automation-studio/runtime/llm/tests/evidence-loop-progress.test.ts`
was untracked, is now absent, and has no tracked index entry.

## Scope findings

- The three timeout-file diffs contain exactly the three new local `60_000`
  `it()` timeouts identified by t395 and re-reviewed by t400. The scale-file
  opening comment is updated consistently. No Vitest config, hook timeout,
  global test timeout, worker count, pool, or parallelism setting is changed.
- `llm-grants.test.ts` also contains inherited functional test expectation and
  naming changes already identified by t400. They are test code, not an
  additional remediation production/config/concurrency change.
- The assigned architecture document is authored documentation and describes
  the current intended Flow-bootstrap/evidence-loop behavior. Its wider
  coherent-unit edits are not executable configuration or production code.
- The scoped path set contains only Markdown and `*.test.ts` files. No package
  manifest, Vitest configuration, structure baseline, or production `*.ts`
  file is part of this remediation include set.

## Generated-reference verification

The two generated references are byte-identical. Each has SHA-256
`17398DC099098C03619C70F5A8174AF611C5296F0EBABD43583E3965CCC44C7E`, and
each working-tree diff is 321 added / 196 removed lines, exactly matching
t394's owning-generator report. Both outputs are expected because Core's
`pnpm docs:reference` generator declares and writes the root reference and its
package mirror together. T394 also records a green `pnpm docs:check`; I did not
rerun it under this read-only/no-test-build brief.

## Move verification

- Old path: absent and untracked.
- New path: present, untracked, with the ownership-correct name
  `runtime/llm/evidence-loop/tests/progress.test.ts`.
- The current file has exactly one `../../index.ts` import. Reconstructing the
  old relative import (`../index.ts`) in memory yields SHA-256
  `0D9F7307A0E77F2878FD7663A60380EF37D31B1EA296326FC2A3254C10AA25B4`,
  exactly t393's captured pre-move source hash. The rename therefore changes
  only the required import depth.
- Repository search found no reference to the old test path.
- The destination has no tracked index entry, consistent with t393's record
  that the source was untracked before the move; there is no hidden tracked
  collision or duplicate deletion.

## Verification limits

This is a read-only scope and content audit of the seven named Core paths,
using t393/t394/t395/t400 as the prior evidence. I did not reassess the full
dirty Core tree, the inherited t170 implementation, or the semantic correctness
of generated declarations beyond mirror identity and the recorded generator
delta. Closure still depends on the supervisor's required serial Core gates and
final staging review.
