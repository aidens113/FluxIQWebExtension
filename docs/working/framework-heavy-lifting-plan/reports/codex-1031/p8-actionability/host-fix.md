# t827 host structural repair — source frozen

Outcome: Done for the bounded source repair; generated acceptance remains pending the lead SDK release.

Moved `domain/src/runtime/llm-evidence/node-run/found-at.ts` to `domain/src/runtime/llm-evidence/node-run/location/found-at.ts`. The old and new resolved absolute paths were confirmed inside this private task workspace before the move. The helper body and comments are unchanged; its type import now resolves through `../../sanitize`. Added `location/index.ts` and changed the existing `run.ts` import to `./location`. No old facade remains.

Unpacked only the reported multiple-statement bodies, preserving their statements and order, in these four files:

- `domain/src/actions/actionability/tests/property.test.ts`
- `domain/src/client/tests/browser-result-mapping.test.ts`
- `domain/src/io/tests/gateway-output-dispatcher.test.ts`
- `domain/src/runtime/llm-evidence/node-run/retries/tests/actionability.test.ts`

Direct source reads show 25 direct files in `node-run`, two files in its new `location` directory, and 792 lines in `run.ts`. No algorithm, control, raw payload, test assertion, baseline, limit, version, or export-map change was made.

Validation: `git diff --check -- domain/src/runtime/llm-evidence/node-run/found-at.ts domain/src/runtime/llm-evidence/node-run/run.ts domain/src/runtime/llm-evidence/node-run/location/found-at.ts domain/src/runtime/llm-evidence/node-run/location/index.ts domain/src/actions/actionability/tests/property.test.ts domain/src/client/tests/browser-result-mapping.test.ts domain/src/io/tests/gateway-output-dispatcher.test.ts domain/src/runtime/llm-evidence/node-run/retries/tests/actionability.test.ts` -> exit 0, no output. Source path/import/count reads only otherwise.

Not verified: narrow Domain tests/typecheck, structure audit, builds, SDK compatibility, runtime and browser behavior. No tests/types/build/audit, provider/API/browser/panel, agents, mutating git, secrets, or runtime-state operation was run. The lead owns the pending checks after SDK release.

Report: `docs/working/framework-heavy-lifting-plan/reports/codex-1031/p8-actionability/host-fix.md`

Notes: All owned source paths above plus `node-run/run.ts` and `node-run/location/{found-at,index}.ts` are now frozen; the former `node-run/found-at.ts` is absent. No other paths were edited except this owned report.
