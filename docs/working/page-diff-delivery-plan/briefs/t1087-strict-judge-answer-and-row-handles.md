# Brief t1087: a strict judge answer, and distinct handles for rows that share a label

**Goal.** Fix two judge defects from live kestrel run-mwz2jc4w. Together they cost two judge re-asks ($0.49).
Attempt 1 paid the same re-ask too. Neither fix may add a count, cap or wait.

**Read first.** `docs/working/page-diff-delivery-plan/reports/run-mwz2jc4w-kestrel.md`, sections "Q2", "K4" and "K5".

**K4. The answer cannot come back in the wrong shape.**
- At 0088, Sonnet sent `diagnosis` as a JSON string, with `answerRecords`, `explorationNeeded`, `patchNeeded`,
  `confidence` and `summary` beside it at the top level.
- It could, because `core_check_answer` is sent non-strict: the decision tools spend 23 of the 24 optional
  parameters strict mode allows.
- **The change.** Reshape the answer schema so it costs no optional parameters: every field required, absent ones
  nullable. Then send `core_check_answer` with `strict: true`.
  - Files: Core `packages/fluxiq/src/runtime/models/providers/anthropic/judge-answer-tool.ts` and
    `decision-tools-wire.ts`, and the DeepSeek wire if it shares the schema.
- **The parser.**
  - It still accepts an absent field as null, so scripted Lab judges and stored answers still parse. The Lab's
    scripted judge is not yours to change.
  - It never parses a stringified `diagnosis` back into an object.
- **Check the API limits** in the claude-api skill (`shared/` tool-use and strict docs): optional parameters, unions
  and nesting. Do not trust Core comments for them.
- **Proofs:**
  - over 0088's recorded tool list, the wire returns `core_check_answer` strict, within the limits;
  - 0087's and 0090's replies validate;
  - 0088's reply is refused.

**K5. Rows that share a label are cited apart.**
- Rows sharing a label share an id (`runtime/result-verification/request-rows/row/id.ts`).
- The judge cited a title two rows share, with "(ends …)" added, which matched no row.
- **The change.**
  - The id becomes the label plus its rank among equal labels, shown in the judge's copy.
  - `cited-yes/`'s citation rule says rows sharing a label are cited by that handle, or as written.
  - Keep the wording generic: it must never mirror a realistic scenario (AGENTS.md, "Model guidance never teaches to
    the test").
- **Proof:** the matcher over 0038's and 0087's `checked`. Today they give 1 and 2 refusals. By handle, each cites
  the right row.

**Owned.** Core (`C:/Users/osrs_/FluxStuff/fxwork/t1087/!FluxIQ`):
- `runtime/models/providers/**`;
- `runtime/result-verification/request-rows/**` and `cited-yes/**`;
- the judge answer's parse or contract files (name them in the report);
- their tests.

**Must not touch.**
- `result-verification/judge-evidence/**`, `unreadable-asks/**`, `verify.ts` and `flow-less/**` (t1084).
- `engine/**` and `domain/src/**` (t1083).
- `flow-authoring/**` and `answer-first/**` (t1085, t1088).
- `packages/test-runner/**`.

**Checks.** Put heavy commands through `node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run t1087-<label> -- <cmd>`.
- The tests beside the changed files: `node ../../scripts/vitest-groups.mjs --groups=parallel,real-sql <dirs>` from
  `packages/fluxiq`.
- The explorer and judge prompt snapshots, if the wording changed. Regenerate a snapshot only for the intended diff.
- `node scripts/structure-audit.mjs` (Core) and `node scripts/check/model-text.mjs` (downstream tree).

No `node -e`, no git, no live or paid runs.

**Report.** `docs/working/page-diff-delivery-plan/reports/t1087.md` in the downstream tree
(`C:/Users/osrs_/FluxStuff/fxwork/t1087/!FluxIQWebExtension`), ending with the return contract.
