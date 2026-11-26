# Brief t1058: the scripted models read any view group, use legal keys and stop at a refusal; a bad field key is named

**Goal.** Scripted round 2 (2026-11-26) failed two company-website tasks. Both causes are in the scripted models, and
are proven in `C:/Users/osrs_/FluxStuff/!FluxIQWebExtension/docs/working/page-diff-delivery-plan/reports/scripted-round-2-diagnosis.md`.
Read that report first.
1. **apprentices.** `scripted-model/scripts/company-website-apprentices.ts:45` accepts a read's rows only under the
   exact group name `"holder:read"`. Since Core t1048, a read that names its list key is held as
   `holder:read:<digest>` (Core `runtime/llm/decision-context/current-view.ts`). The script missed its rows and
   repeated a detection until its last request. Its unit test missed this because the read fixture has no `listKey`.
2. **saturday-certificate.** `company-website-saturday-certificate.ts:66` names a read column `"group heading"`. A field
   key must match `/^[A-Za-z0-9_-]{1,100}$/` (domain `actions/extraction/field-key.ts:14`), so all three reads were
   refused (`web.handle.malformed:extractList.fields.2`). The script then went on blind, because `callsMade` counts a
   refused call as done.

**Do.**
1. Add one helper in `scripted-model/scripts/evidence.ts` that resolves a `core.view_reference` (any group name)
   against the request's current view and returns the held payload. Use it in apprentices and in every script that
   reads a held group. No script may compare a group name literally.
   - Give the apprentices test's read fixture a `listKey` and a `url`, so the test exercises the t1048 naming.
2. saturday-certificate: use the key `group_heading`. The processing declaration's `"group heading"` still binds,
   because Core's binding treats `_` and spaces alike; prove it in the test. Update the tests that pin the old key.
3. In every scripted model (apprentices, saturday, professional-network and any other with a `made` or `callsMade`
   set), only a call whose result was not refused counts as done. A refusal stops the script at the step that
   failed, with the refusal's words in its error, so a broken script fails where it broke. Add a test for this in
   the shared helper.
4. Product, domain: when a read's field key is not legal, the refusal names the key and the allowed characters. Use a
   distinct code such as `web.handle.field_key_invalid` beside the existing malformed-handle code, so a model can fix
   the name in one step. Use generic words: never a scenario's site, column or task. Find where the key is checked
   (`domain/src/runtime/llm-evidence/plan-resolution/extraction/columns.ts:201`, `actions/extraction/field-key.ts`)
   and add tests beside them.

**Proof.**
- Unit tests for all four, each failing before its fix.
- Then two scripted Lab runs in this worktree, headed, through the heavy gate, each with `--attempts 4`. Use
  `FLUXIQ_LAB_INSTANCE=t1058-lab` with `pnpm lab attempt company-website --task <task> --authoring-mode answer-first
  --scripted-model --attempts 4`, for `company-website-apprentices` and `company-website-saturday-certificate`.
  Both must pass 4 of 4 with the right answer, and attempts 2 to 4 must run the saved Flow with continuation held.
  Read each `attempt-report.txt`.

**Owned paths.** `packages/test-runner/src/attempt-lane/scripted-model/scripts/**` and its tests;
`domain/src/actions/extraction/field-key.ts`, `domain/src/runtime/llm-evidence/plan-resolution/extraction/columns.ts`
and the tests beside them; `docs/architecture/` lines on the field-key refusal, if any.
**Must not touch.** Core, `apps/extension/`, the Lab control code. No git, no paid runs, no `node -e`.

**Checks.**
- `node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run t1058-runner -- pnpm --filter @fluxiq-web-extension/test-runner test` -> 0 failures.
- `node domain/scripts/test-domain.mjs llm-evidence actions`, run from `domain/` -> 0 failures.
- `pnpm --filter @fluxiq-web-extension/domain check`; `pnpm --filter @fluxiq-web-extension/test-runner check`.
- `node scripts/structure-audit.mjs`; `node scripts/check/model-text.mjs`.

Work in `C:/Users/osrs_/FluxStuff/fxwork/t1058-scripted-contract-fixes`. The shared Core is current (0.54.27).
**Report.** `docs/working/page-diff-delivery-plan/reports/t1058.md`, ending with the return contract.
