# Lane C r3 fix C: the Lists guidance covers written Flows, and one page is enough evidence

## Outcome

Done.

## What changed and why

The evidence is run `run-mv0pa79q-ef91811b`. In candidate mode the model read all five result pages before writing its Flow, used up its budget, and never submitted. The domain's Lists line only described the draft-mode recipe (`amend_draft repeat`). It never said how much paging the model needs to explore.

- `domain/src/runtime/llm-evidence/system-instructions/instructions.ts`
  - The paging sentence of the Lists line now reads:
    "Every page of a list is a loop the Flow states: read the list, then Next page on the same list, then repeat the read through Next page while it succeeds (most N for 'the first N pages'), each row kept once -- in a draft by amend_draft repeat, in a written Flow by its repeat lines. Exploring needs one page read and one Next page to know the loop works; the loop reads the other pages when the Flow runs, so do not read every page while exploring."
  - Draft builds keep the same meaning: `amend_draft repeat` is still named for drafts. The sentence names no scenario, site, product or task.
  - `version` goes from `web-5` to `web-6`, because the file requires a new version whenever the text changes.
  - The top comment has a new web-6 paragraph giving the reason and the run id. The size note is updated: the text is now 3,081 characters (previously 2,849) and the test limit is 3,200. Core's own limit is 4,000.
- `domain/src/runtime/llm-evidence/system-instructions/tests/instructions.test.ts`
  - The version is pinned to `web-6`.
  - The size limit goes from 3,000 to 3,200. The new text is 3,081 characters, so the old limit of 3,000 could not hold.
  - The web-5 test now pins the new loop wording.
  - A new web-6 test pins three things: "in a draft by amend_draft repeat, in a written Flow by its repeat lines"; the one-page-and-one-Next-page sentence; and "do not read every page while exploring".

## Commands run and observed results

- I searched the downstream tree (`domain/src`, `domain/scripts`, `apps`, `scripts`) and the Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t274/!FluxIQ` for the old Lists text and for `"web-5"`. The only hits were the two files I own; Core had none. Nothing else needed changing.
- `DOMAIN_TEST_BUILD_LABEL=lane-c-r3-fix-c node scripts/test-domain.mjs system-instructions/tests/instructions` (run in `domain/`): 14 tests, 14 passed, 0 failed.
- `pnpm --filter @fluxiq-web-extension/domain check` was refused by `scripts/check/core-build.mjs`. The guard reported that the compiled Core in the t274 worktree is 13 minutes older than its source (`packages/fluxiq/src/programs/automation-studio/runtime/conversations/commands/progress.ts` is newer than Core's dist). I did not rebuild Core because it is outside my brief.
- In place of that check I ran the same two typechecks directly: `npx tsc -p tsconfig.json --noEmit` (exit 0) and `npx tsc -p tsconfig.test.json --noEmit` (exit 0). Both ran against Core's stale compiled output, but this change uses no Core types.
- `node scripts/structure-audit.mjs` (from the repository root): "structure-audit: passed (184 warning(s), 646 baselined)", exit 0.

## Not verified

- The `domain check` gate itself did not pass, because the compiled Core is stale.
- No live run has checked whether the model now explores one page and then submits.

## Open questions or contradictions found

- Core's compiled output in the t274 worktree is behind its source. It needs a rebuild before the gated `domain check` and any live run.
- The wording "its repeat lines" is deliberately general. The brief describes written loops as `repeat while: <label>`, but I did not check Core's script-format text to confirm that exact keyword.
