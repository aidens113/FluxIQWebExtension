# t733: content runtime fixes (identity capture cost, group-sensitive marker, in-place settle)

Lead report and running log for task t733 (branch `task/t733-identity-capture-cost`).

## Plan (2026-10-19)

Three units, partitioned by file, run in parallel by three workers, tests first.

1. **Identity capture cost** (worker-high). Owns `apps/extension/src/content/identity/**` except
   `accessible-name.ts`. Cause (t730-c3 CPU profile): `control-row.ts` `soleAncestors` runs up to
   three times per snapshot element (`recordIdentity` -> `controlRow`, `recordSubject` -> `controlRow`
   and `soleAncestors`), each a walk of up to 2,000 nodes with `accessibleNameFor` on every same-kind
   node; on 6,000 uniquely named links no twin exists, so every walk spends its whole budget.
   Fix: inside a capture scope (`withSelectorMemo`, the pattern `lead-statements.ts` uses), one
   per-root index of alike groups (kind + name, names computed once per kind) and memoised
   `soleAncestors`; a control alone in its group skips the walk, its budget outcome derived exactly
   from subtree sizes; a control with alikes walks with set membership instead of name computation.
   `nearestTitle`/`rowTitleElement` memoised per capture as well. Outside a scope the walk is
   unchanged. Answers identical in and out of a scope (equivalence test); a work-count test fails
   on the regression.
2. **Group-sensitive marker on the wire** (worker). Owns `shared/dom-element.ts`,
   `content/identity/accessible-name.ts`, `content/describe-element.ts` (one line, needed to set the
   marker; noted as outside the listed paths), `domain/src/sensitivity/descriptor.ts`, their tests.
   The change t732 open question 2 and 3 specified.
3. **In-place settle waits for busy regions** (worker-high). Owns
   `content/action-runtime/in-place-effect.ts`, `content/evidence/loading.ts` (plus a focused
   busy-region module if one export per file requires it), their tests. `watchInPlaceEffect` holds a
   content answer while an `aria-busy` region it saw change is still busy, within its window.

Headed validation (lead, serialized): the realistic-site specs that pin these defects
(large-page-resolution rows 1-2, click.spec.ts in-place row) exist only on t730's branch, with the
job-board and everything-store modes they arm. They are run read-only against this lane's change in a
throwaway detached worktree of t730's HEAD with this lane's diff applied, so no other tree and no
e2e or scenario-lab file here is edited. Capture time of the 6,000-anchor company-website page is
measured there before and after.

## Log

### 2026-10-19: unit 1, identity capture cost (worker-high, verified by the lead)

- What changed: `identity/control-row.ts` became `identity/control-row/` (`control-row.ts`, `sole-ancestors.ts`,
  `captured-alike.ts`, `control-kind.ts`, `row-bounds.ts`, barrel, `tests/captured-alike.test.ts`); new
  `identity/scoped-memo.ts` (per-capture table keyed by the selector memo, as `lead-statements.ts` keeps one);
  `record.ts` memoises `rowTitleElement` and `recordText` per scope. Inside a capture scope each root is indexed
  once (kind, then names once per kind); a control with no reachable alike takes the walk's outcome from
  descendant counts (`descendants(p_i) - descendants(control) - (i+1) > 2000` is the budget cut, exactly the
  walk's); a control with reachable alikes walks with Set membership instead of naming nodes; the climb is
  kept per control for `controlRow`, `recordSubject` and `repeatedRowOf`. Outside a scope nothing changes.
  Detail: `t733-u1-capture-cost.md`.
- Lead review: read `sole-ancestors.ts`, `captured-alike.ts`, `scoped-memo.ts` and the `record.ts` diff; the
  derivation matches the walk (ancestors and the control's own subtree are never visited by it; budget tested
  before each visit).
- Test first (worker): cost test failed on the old code, "108256 attributes reads after 2 links; at most 96448
  allowed"; equivalence tests compare in-scope and out-of-scope answers.

### 2026-10-19: unit 2, group-sensitive marker on the wire (worker, plus a lead edit)

- What changed: `DomElementDescriptor.sensitive?: true` (`shared/dom-element.ts`); `describe-element.ts` sets
  it when `isWithinSensitiveControl(element)`; `domain/src/sensitivity/descriptor.ts` reads `sensitive === true`
  as `dataSensitive: "true"`; `accessible-name.ts` `buttonValueName` asks `isWithinSensitiveControl`. Detail:
  `t733-u2-sensitive-marker.md`.
- Outside the listed paths, by the lead: the worker stopped because the field broke
  `background/connection/gateway-payloads.ts` (`present<WireElementTarget>` requires every key). Without it the
  marker would be dropped before Core stores the target, which the domain's fingerprint and recording readers
  judge. Added `sensitive: element.sensitive` to `elementTarget`, `"sensitive"` to `WIRE_ELEMENT_FIELDS`, and a
  row "a control sensitive through its group sends the marker and no contents". Not lane S's
  `background/connection.ts`; flagged for the supervisor.
- Test first (lead): `EXTENSION_TEST_BUILD_LABEL=t733lead node scripts/test-extension.mjs
  src/background/connection/tests/gateway-payloads.test.ts` -> `# tests 21 # pass 19 # fail 2` (the two new
  assertions), after the edit `# tests 21 # pass 21 # fail 0`.

### 2026-10-19: unit 3, in-place settle waits for busy regions (worker-high, verified by the lead)

- What changed: `in-place-effect.ts` collects elements outside the link whose `aria-busy` changed, or that
  arrived carrying it, and holds the content answer while one is connected and busy, until the deadline, where
  today's answer stands. The busy rule moved to `evidence/busy-region.ts` (`isBusyRegion`) and `painted.ts`
  (`isPainted`), used by `loading.ts` too; `loadingEvidence` output unchanged. Detail: `t733-u3-in-place-busy.md`.
- Test first (worker): 12 of 16 before (4 hold tests failed, "answered after 0 ms, before the rows landed").

### 2026-10-19: lead verification of all three units

- `EXTENSION_TEST_BUILD_LABEL=t733lead node scripts/test-extension.mjs src/content/identity
  src/content/action-runtime/tests/in-place-effect.test.ts src/content/evidence/tests
  src/content/tests/describe-element.test.ts src/shared/tests src/background/connection/tests` ->
  `# tests 553 # pass 553 # fail 0`.
- `DOMAIN_TEST_BUILD_LABEL=t733lead node scripts/test-domain.mjs sensitivity/tests element-fingerprint` ->
  `# tests 43 # pass 43 # fail 0`.
- `tsc --noEmit` extension `tsconfig.json` exit 0, `tsconfig.test.json` exit 0; domain `tsconfig.json` exit 0,
  `tsconfig.test.json` exit 0.
- `node scripts/structure-audit.mjs` -> `structure-audit: passed (212 warning(s), 625 baselined).`

### 2026-10-19: headed BEFORE baseline (worker, `t733-v0-baseline.md`)

Throwaway detached worktree `C:/Users/osrs_/FluxStuff/fxwork/t733-validate` at t730's HEAD 50500e8a (dev plus
t730's realistic-only specs and the scenario modes they arm). large-page-resolution rows 1-2 failed at the 30 s
timeout, row 3 passed; click.spec in-place row 1 of 5 passed (the four failures at click.spec.ts:524, aria-busy
"true"); bare capture of company-website with 0 / 1,000 / 6,000 filler anchors: 226 ms / 28,401 ms / 303,764 ms.

### 2026-10-19: headed AFTER run (lead)

This lane's diff (apps and domain, exported through a temporary index so this tree's index is untouched) applied
with `git apply` to the validation worktree; it applied cleanly on t730's HEAD. From
`C:/Users/osrs_/FluxStuff/fxwork/t733-validate`, Chromium content harness, headed, no LLM calls:

- `pnpm --filter @fluxiq-web-extension/extension test:content -- large-page-resolution.spec.ts zz-capture-cost.spec.ts
  --headed --workers=1 --trace=off --timeout=1200000 --output=<tmp>/after-large` -> `6 passed (2.6m)`:
  large-page-resolution row 1 12.7 s, row 2 9.0 s (both inside their 30 s budget; before: timeouts), row 3 5.6 s.
  Probe: `T733_PROBE anchors=0 elapsed=131ms`, `anchors=1000 elapsed=861ms`, `anchors=6000 elapsed=3917ms`
  (before: 226 ms, 28,401 ms, 303,764 ms; the 2026-09-12 spec figure was about 4 s for 5,000 elements).
- `pnpm --filter @fluxiq-web-extension/extension test:content -- content/tests/click.spec.ts -g "in-place filters"
  --repeat-each=5 --headed --workers=1 --trace=off --output=<tmp>/after-click` -> `5 passed (1.0m)` (before: 1 of 5).

The validation worktree is kept (detached, untracked probe `apps/extension/e2e/content/tests/zz-capture-cost.spec.ts`,
the lane diff applied) so the supervisor can re-run it; remove it by deleting its `node_modules` then
`git worktree remove C:/Users/osrs_/FluxStuff/fxwork/t733-validate`.

UNIT READY: apps/extension/src/content/identity/control-row.ts (moved), apps/extension/src/content/identity/control-row/**, apps/extension/src/content/identity/scoped-memo.ts, apps/extension/src/content/identity/record.ts, apps/extension/src/content/identity/index.ts, apps/extension/src/content/identity/own-run.ts, apps/extension/src/content/identity/tests/capture-scope-cost.test.ts, apps/extension/src/content/identity/tests/capture-scope-equivalence.test.ts

UNIT READY: apps/extension/src/shared/dom-element.ts, apps/extension/src/content/describe-element.ts, apps/extension/src/content/tests/describe-element.test.ts, apps/extension/src/content/identity/accessible-name.ts, apps/extension/src/content/identity/tests/accessible-name.test.ts, apps/extension/src/background/connection/gateway-payloads.ts, apps/extension/src/background/connection/tests/gateway-payloads.test.ts, domain/src/sensitivity/descriptor.ts, domain/src/sensitivity/tests/descriptor.test.ts

UNIT READY: apps/extension/src/content/action-runtime/in-place-effect.ts, apps/extension/src/content/action-runtime/tests/in-place-effect.test.ts, apps/extension/src/content/evidence/loading.ts, apps/extension/src/content/evidence/busy-region.ts, apps/extension/src/content/evidence/painted.ts, apps/extension/src/content/evidence/index.ts, apps/extension/src/content/evidence/tests/busy-region.test.ts

## Not verified / open

- Firefox build and the real extension (side panel, service worker) were not exercised; content harness only.
- One probe sample per size. Groups whose alike controls a walk can reach (e.g. thousands of links sharing one
  name) still walk up to 2,000 Set lookups each; `t733-u1-capture-cost.md` sketches deriving those exactly too.
- Closed in unit 4 (below): the sensitive-values.md marker section and runtime-status.ts honouring the marker
  (t732 open questions 6 and 4).
- The lane diff staged a `git mv` in this tree's index (worker 1); nothing is committed.

### 2026-10-19: unit 4, the two open items (supervisor request, lead)

- `background/connection/runtime-status.ts`: its own descriptor adapter over the rule (type, autocomplete,
  data-sensitive only) is gone; `confirmedValue` asks the domain's `isSensitiveElementDescriptor`, the reader the
  gateway projection asks, so the group marker, names and labels count there too. Unused `DomElementDescriptor`
  import dropped.
- Test first: two rows added to `tests/runtime-status.test.ts` `sensitiveFields` (a field with `sensitive: true`;
  a text input labelled "Security code"). `EXTENSION_TEST_BUILD_LABEL=t733lead node scripts/test-extension.mjs
  src/background/connection/tests/runtime-status.test.ts` -> `not ok 10 - a sensitive field's value never leaves
  in a type or select confirmation`, `# tests 20 # pass 19 # fail 1`. After the change,
  `... src/background/connection/tests` -> `# tests 254 # pass 254 # fail 0`.
- `docs/architecture/sensitive-values.md`: "The group marker on the wire" under One Rule (what sets it, who reads
  it, that the gateway projection carries it onto the target Core stores, why not an attribute); the descriptor
  adapter bullet and the runtime-confirmations bullet updated.
- Extension `tsc -p tsconfig.json --noEmit` exit 0, `-p tsconfig.test.json --noEmit` exit 0;
  `node scripts/structure-audit.mjs` -> `structure-audit: passed (212 warning(s), 625 baselined).`

UNIT READY: apps/extension/src/background/connection/runtime-status.ts, apps/extension/src/background/connection/tests/runtime-status.test.ts, docs/architecture/sensitive-values.md
