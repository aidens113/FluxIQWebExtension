# t827 Phase 1 actionability contract and result readers

Status: Phase 1 complete; pure contract and Core reader source frozen after their named tests passed. No producer or consumer emission is included.

The exact public measurement is `{ actionable: true }` or `{ actionable: false, cause: "hidden" | "disabled" | "covered" }`. Absence remains unknown. It adds no effect, retry, transient or authority claim. The pure parser returns fresh minimal plain data; rejects extra own keys (including nonenumerable/symbol keys), nonplain objects and accessor schema fields; never reads a schema getter; and catches hostile reflection failures. Input data is not mutated.

The contracts automation-studio source and the pure `fluxiq/automation-studio/actionability` source reexport the same reader/type. Automation Studio's ordinary public entry reexports them. Public IO/runtime command result types gain only the optional measurement. Version/package-export/audit-entry updates remain lead-owned.

Structure inspection: LLM root, its `tests/`, `evidence-loop/` and its `tests/` each have 25 flat files. Reader/key/type additions fit their existing files; no extraction, baseline increase or new file in those directories is needed. New contracts actionability source uses three files plus one owning test; pure Core actionability entry has one file.

Validation: `pnpm.cmd --filter @fluxiq/contracts exec vitest run src/actionability/tests/parse-record.test.ts src/failure/tests/parse-record.test.ts src/failure/tests/control-record.test.ts --maxWorkers=2 --minWorkers=1` -> exit 0, 3 files / 45 tests passed (30 actionability, 15 legacy failure). No library build, typecheck, full suite, git, browser, model/provider or panel action was run.

Frozen contract paths, announced to the lead after the 45-test pass: `packages/contracts/src/actionability/{record,parse-record,index}.ts`, owning `tests/parse-record.test.ts`, `packages/contracts/src/automation-studio.ts`, `packages/fluxiq/src/io/index.ts`, `packages/fluxiq/src/runtime/contracts.ts`, `packages/fluxiq/src/programs/automation-studio/index.ts`, and its `runtime/actionability/index.ts`.

Core tool execution declares the optional field and recognizes it in the exact outer-key allowlist before any producer emits it. Its parsed result obtains only a strict descriptor-read copy; invalid data/accessors drop alone while evidence, actual effect, person-needed, failure and outputs retain their existing meaning. Existing unknown outer-key policy remains. Owning tests include legacy IO/runtime type fixtures, both measurement branches, all causes, preserved authority, hostile/accessor inputs, privacy, and actual evidence-loop call accounting. Actual-loop cases run both effectApplied values across all four valid measurements plus malformed private geometry/text; each calls the tool once, retains the actual code/evidence/effect accounting, and exposes no optional control in opaque model evidence or private marker in trace. Valid trace propagation is deliberately left available to Phase 2.

The lead released the dependency after independently observing the 45 contract tests, contracts check and contracts-only build. The worker then ran `pnpm.cmd exec vitest run src/programs/automation-studio/runtime/llm/tests/evidence-loop-tool-failure.test.ts --maxWorkers=2 --minWorkers=1` from Core `packages/fluxiq` -> exit 0, 1 file / 53 tests passed in 51.04s. No worker build/typecheck or stale compiled Core public-subpath test was run. Normal Vitest source aliases were not changed.

Final source freeze: `packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop/tool-execution.ts` (237 lines), `runtime/llm/evidence-loop-decision.ts` (775 lines), and existing `runtime/llm/tests/evidence-loop-tool-failure.test.ts` (567 lines), plus the previously frozen contract/public-type paths above. Existing 25-flat-file directories gain no new file; new contracts/pure-entry directories remain within the stated depth/file budgets. The lead owns final typechecks, actual built public-subpath/browser-purity validation, source-wide audit and independent acceptance.

No wire/client-gateway/receipt/failure-schema change, producer, transport, IO-policy, native/executor/history consumer, raw-dump sanitizer or retry-policy change was made. Raw dump sanitation and end-to-end propagation remain Phase 2 work, not acceptance claims here.

## Return contract

Outcome: Done
Changed: Core `packages/contracts/src/actionability/{record,parse-record,index}.ts`, owning `tests/parse-record.test.ts`, `packages/contracts/src/automation-studio.ts`; `packages/fluxiq/src/io/index.ts`, `src/runtime/contracts.ts`; Automation Studio `index.ts`, `runtime/actionability/index.ts`, `runtime/llm/evidence-loop/tool-execution.ts`, `runtime/llm/evidence-loop-decision.ts`, existing `runtime/llm/tests/evidence-loop-tool-failure.test.ts`; this private report.
Validation: `pnpm.cmd --filter @fluxiq/contracts exec vitest run src/actionability/tests/parse-record.test.ts src/failure/tests/parse-record.test.ts src/failure/tests/control-record.test.ts --maxWorkers=2 --minWorkers=1` -> 45 passed; `pnpm.cmd exec vitest run src/programs/automation-studio/runtime/llm/tests/evidence-loop-tool-failure.test.ts --maxWorkers=2 --minWorkers=1` (Core packages/fluxiq) -> 53 passed.
Not verified: Lead-owned Core types/build/audit, actual built pure public-subpath import/browser graph, producer-to-consumer propagation, raw dump sanitation, transport/persistence/live-browser compatibility. No full suite, provider/model call, panel operation or git action ran.
Report: `docs/working/framework-heavy-lifting-plan/reports/codex-1031/p8-actionability/contract.md`
Notes: Contracts/public result types and Core reader source are frozen; all 98 named tests passed.
Malformed optional actionability drops alone; effect/failure/person-needed/outputs and outer unknown-key policy remain authoritative.
Phase 2 emission/transport/history/privacy/persistence remain outside this worker's implementation.
