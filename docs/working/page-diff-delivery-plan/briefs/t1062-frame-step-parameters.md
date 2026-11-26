# Brief t1062: a saved Flow whose steps ran inside an iframe assembles and replays

**Goal.** Scripted run `run-mwxdk1el-9dcfa4be` (company-website-saturday-certificate, lane t1058, instance
`t1058-lab`, under `C:/Users/osrs_/FluxStuff/fxwork/t1058-scripted-contract-fixes/test-runs/instances/t1058-lab/attempts/`):
- Attempt 1 gave the right answer.
- Attempt 2 could not run the saved Flow. Core refused to assemble it with `bootstrap.unknown_parameter` on
  `browserFrameId` and `browserFrameUrlPath`, for every step that ran inside the booking widget's iframe (step 0038).

So no Flow with a step inside a frame can be saved and replayed. That hits any live site with an embedded widget,
form or checkout.

**Do, at the cause.**
1. Trace where `browserFrameId` and `browserFrameUrlPath` join a step's parameters: domain recording, the
   framework's draft from what ran (W3), or the extension. Find where Core's bootstrap checks a step's parameters
   against its node definition.
2. Decide where frame targeting belongs, and say why in the report:
   - Frame targeting is web-specific, so the expected owner is the domain. Its node definitions declare the frame
     parameters they accept, typed and optional, and Core's generic check stays strict.
   - If the frame belongs to a different part of a step (its target or scope rather than its parameters), move it
     there consistently.
   - Do not loosen Core's check to accept unknown parameters.
3. The frame must survive replay: a replayed step runs in the same frame, found again by its stable identity (the
   frame's URL path and the element's fingerprint), never by a stale frame id. If `browserFrameId` is run-scoped
   and cannot be stable across attempts, the saved Flow must not depend on it. Say how a frame is found again on a
   later attempt.
4. Keep the wire contract synchronized across shared types, background routing, domain mappings, node definitions,
   tests and architecture docs (AGENTS.md).

**Proof.**
- Provider-free tests that fail before the fix: a draft whose step ran in an iframe assembles, and a replay of it
  targets the same frame on a later attempt.
- Then the scripted run: `FLUXIQ_LAB_INSTANCE=t1062-lab node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run
  t1062-saturday -- pnpm lab attempt company-website --task company-website-saturday-certificate --authoring-mode
  answer-first --scripted-model --attempts 4`, headed. It must pass 4 of 4, with attempts 2 to 4 running the saved
  Flow and continuation held. Read its `attempt-report.txt`.
- The downstream must include t1058's script fixes. Merge `dev` into your downstream branch after t1058 merges, or
  merge branch `task/t1058-scripted-contract-fixes` into it for the run, and say which.

**Owned paths (Core-paired task).** Downstream: the domain node definitions, recording and parameter code the trace
leads to, the extension's frame targeting only if the trace requires it, and the tests beside each. Core: the
bootstrap parameter check or assembly code only if the trace shows Core is wrong, and the tests beside it. Plus the
architecture docs for frames.
**Must not touch.** Core `runtime/llm/**` (t1056) and `runtime/adaptation/recovery/**` (t1057); the scripted scripts
(t1058). No git, no paid runs, no `node -e`.

**Checks (heavy gate).**
- Downstream: `node scripts/test-domain.mjs <the folders you changed>` from `domain/`; domain check; the extension
  tests if extension files changed; audit; model-text.
- Core, if changed: `pnpm --filter fluxiq check`; vitest groups (parallel, real-sql) over the folders changed; Core
  audit; Core libraries build.

**Report.** `docs/working/page-diff-delivery-plan/reports/t1062.md`, ending with the return contract.
