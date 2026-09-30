# t195-w4 report: a list loop hands each pass's row to the steps it repeats (Core)

Tree: Core `C:/Users/osrs_/FluxStuff/fxwork/t195/!FluxIQ`, branch `task/t195-live-control-flow`. Nothing committed.
AS = `packages/fluxiq/src/programs/automation-studio`.

## Outcome

Done. The code, the tests and the docs paragraph are complete. All three brief checks pass: vitest,
tsc and the structure audit. Each new test was shown to fail without its change. One open defect
remains, outside this brief's files: a stale row leaks to steps after a loop. See Open questions 1.

## What changed and why

- `AS/runtime/flow-bootstrap/authoring/draft-routing.ts`: in `repeat()`, list branch only
  (`rows` defined), the For Each step gets one extra branch `branch("item", <member label>, "item")`
  for each body member whose definition declares an input with id `item`. The definition is found
  through a new `writtenDefinition()` helper that `listPort()` now also uses, so both match exactly
  the same way (`matchAuthoringDefinition(entry.written.node ?? entry.written.description, registry.list(resolution))`).
  New `takesRow()` checks the inputs. The check-loop branch is untouched, so it gets no `item` edges.
  The port name is a module constant `ROW_PORT = "item"`. Header comment updated.
- `AS/nodes/control-flow/for-each.ts`: the `item` output now declares `multiple: true`, so several
  body steps can take the row without `bootstrap.source_port_cardinality`.
- `AS/runtime/flow-bootstrap/authoring/assemble.ts` `targetPort()`: when no port is asked for, it now
  skips any input with `role: "data"`. A port asked for by name is still taken as written. For Each's
  `items` has no role (builtin `normalizePortRole` gives a target port a role only when it is `in`),
  so its behaviour is identical. The existing tests `records -> for-each:items` and
  `merge:success -> for-each:in` still pass.
- `AS/runtime/executor/node-inputs.ts` and `AS/runtime/native-node-runtime.ts`: not changed. The
  end-to-end test confirms the executor copies `values["<each>.item"]` into `inputs.item`, and that
  the native runtime passes it to an implementation that declares `item` and not to one that does not.
- Core `docs/architecture/automation-studio.md`: one paragraph after the `flowBootstrap.routing`
  paragraph (about line 509). No existing section described repeat/For Each, so this was the nearest place.

Tests:
- `AS/runtime/flow-bootstrap/authoring/tests/draft-routing.test.ts`: a new describe with 4 tests, on the
  real web fixture with `item` added to the named nodes:
  1. The list loop sends `for-each:item` only to the two clicks inside the span. It sends none to the
     wait, which declares no `item`, and none to the click after the loop. Each click keeps one `in`.
  2. That plan passes the validator with two `item` edges.
  3. The check loop gets no `item` edges.
  4. A graph run through the real `AutomationStudioNativeNodeRuntime` gives the click implementation
     `inputs.item` equal to each of the 3 rows in order, and gives the wait implementation no `item`.
- `AS/runtime/flow-bootstrap/authoring/tests/assemble.test.ts` (new): the `FAILURE_BRANCH` script with
  `wait_for_text` declaring `item` wires identically to the same script without it
  (`s2:failed>s4:in, s1:success>s2:in, s2:success>s3:in`), and no edge ends in `:item`.
- `AS/nodes/control-flow/tests/for-each.test.ts`: asserts `item` is the only `multiple` output.

## Commands run and observed results

To show each new test fails without its change, I reverted one source file at a time to HEAD, ran the
three test files, and restored the file. `git diff --stat` afterwards showed all three changes present.
- draft-routing.ts reverted: 2 failed, 24 passed. `expected [] to deeply equal [ 's3:item -> s4:item', …(1) ]`;
  `expected [ …(7) ] to include 'builtin.control.for-each:item -> web.…'`.
- for-each.ts reverted: 2 failed, 24 passed. `expected [] to deeply equal [ 'item' ]`;
  validator `expected [ { severity: 'error', …(3) } ] to deeply equal []`.
- assemble.ts reverted: 1 failed, 25 passed. `expected [ 's3:success>s4:item' ] to deeply equal []`.
  This is the bug the change prevents.

Brief validation, in `packages/fluxiq`:
- `npx vitest run --minWorkers=1 --maxWorkers=2 src/programs/automation-studio/runtime/flow-bootstrap/authoring/tests src/programs/automation-studio/nodes/control-flow/tests`
  -> `Test Files 9 passed (9)`, `Tests 88 passed (88)`.
- `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t195 w4 tsc" npx tsc --noEmit -p tsconfig.json`
  -> `[heavy] t195 w4 tsc holds b2`, no diagnostics, exit 0.
- `node scripts/structure-audit.mjs` (Core root) -> `structure-audit: passed (194 warning(s), 354 baselined)`,
  exit 0. The only warning that touches my files is the advisory `assemble.ts: 495 lines is past the 400-line
  advisory threshold`. That file was already over the threshold at 488 lines before this change.
  It also prints `1 baseline entries can be lowered`, which predates this change and was left alone.

Wider run, not required by the brief: the same vitest over `runtime/flow-bootstrap`, `runtime/executor`,
`runtime/tests/native-node-runtime.test.ts` and `runtime/tests/service-bootstrap`
-> `Tests 9 failed | 1098 passed (1107)`. All 9 failures are in `runtime/tests/service-bootstrap/tests/`:
- `rejections.test.ts`: 6 failures, each `expected { …(6) } to deeply equal { …(5) }` with an extra `"thrown.Error"`.
  With all three of my source files reverted to HEAD, the same 6 failed and 11 passed, so these are not
  caused by this change. The tree also holds other workers' uncommitted edits to `runtime/service.ts`,
  `flow-draft/entry.ts`, `llm/evidence-loop*` and the service-bootstrap tests.
- `accounting.test.ts`, `adaptation.test.ts` and `permission.test.ts`: 1 failure each, each at about
  15 s. Rerun alone (`--maxWorkers=2`) they gave `Tests 32 passed (32)` both with my changes and with
  them reverted, so those failures were timeouts under load.

Probe (a temporary file `t195w4-probe.test.ts`, deleted afterwards): the graph run with a `click #done`
after the loop gave the click implementations `[first, second, third, third]`. The 4th call is the
click after the loop. It has no `item` edge but still received the last row.

## Not verified

- The 6 `rejections.test.ts` failures were not diagnosed. They fail identically without this change.
- No Lab or browser run, as the brief requires. The w5 half is simulated by adding `item` to fixture definitions.

## Open questions or contradictions found

1. **A stale row leaks to steps after the loop.** The executor stores every output under
   `values["<node>.<port>"]` and also under the bare `values[<port>]` (`executor/graph-run.ts:479-480`).
   `collectNodeInputs` returns `{ ...values, ...wired }` (`node-inputs.ts:11`), and the native runtime
   passes any declared port found in that object (`native-node-runtime.ts:86`). So a node that declares
   `item` but has no `item` edge still receives the last row after a loop ends. Once w5 scopes the
   target to `inputs.item`, a step after the loop such as "click #done" would be scoped to the last row.
   I did not fix it. Any fix breaks `executor/tests/graph-run.test.ts:439-440`, which asserts the bare-key
   delivery. The clean fix also needs `node-execution.ts`: hand `nativeNodeExecutor` a `role: "data"`
   input only when an edge wires it. Both files are outside this brief.
2. `targetPort` now drops an unnamed edge rather than landing it on a data port. That is the same
   silent drop a node with no data input already gets when its `in` is taken, so the wiring is identical.
