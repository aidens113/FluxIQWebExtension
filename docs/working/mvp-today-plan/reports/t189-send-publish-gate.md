# t189 Send/publish gate

Status: Complete

## Result

Closed the release blocker identified by t186. Core's single consequence classifier now retains
`send_or_publish` alongside `move_money` and `delete`; `modify_existing` and `create_new` remain
ungated.

The permission mechanism itself was unchanged. A truthful send/publish declaration now follows
the existing high-risk path:

- instruction-derived authority permits the send or publish without a second grant;
- an explicit `send_or_publish` grant permits it when instruction derivation yields nothing;
- failed or absent instruction derivation raises a request and refuses before dispatch;
- without a run to ask from, it refuses with `requestId: null` and names
  `send_or_publish` as missing;
- mixed declarations filter out ordinary creation/editing and name only the missing high-risk
  classes, in Core's consequence order.

Delete and money/checkout assertions remain unchanged and passing.

## Files changed

Core:

- `packages/fluxiq/src/programs/automation-studio/runtime/action-permissions/destructive.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/action-permissions/tests/destructive.test.ts`

Downstream:

- `domain/src/runtime/llm-evidence/tests/press.test.ts`
- `domain/src/runtime/llm-evidence/tests/tool-rejection-detail.test.ts`
- This report.

The Core comments were reconciled with binding rule 2: send/publish is high-risk when unrelated
to the person's instruction, while the instruction itself remains authority when it explicitly
asks for that consequence.

## Validation

- Focused Core test:
  `pnpm --filter fluxiq exec vitest run src/programs/automation-studio/runtime/action-permissions/tests/destructive.test.ts`
  — 1 file passed, 14 tests passed.
- Core package build: `pnpm --filter fluxiq build` — passed. This refreshed the linked Core
  package output used by downstream compilation.
- Domain package suite with `DOMAIN_TEST_BUILD_LABEL=t189-send-publish` — 847 tests passed,
  0 failed.
- Direct downstream focused run of the freshly compiled `press.test.mjs` and
  `tool-rejection-detail.test.mjs` — 20 tests passed, 0 failed.
- `git diff --check` on all four owned source/test files — passed; Core emitted only its existing
  line-ending conversion warnings.

The first downstream package run was intentionally not accepted as evidence: it compiled against
the pre-change linked Core output and produced the two expected stale-classifier failures. After
the owned Core package build, the full domain suite and both focused files passed. No source fix
outside the four owned files was needed.

## Boundaries

- No shared working document, other source path, or existing report was edited.
- No browser, Lab run, provider call, real send/publish/delete/money action, commit, or push was
  performed.
