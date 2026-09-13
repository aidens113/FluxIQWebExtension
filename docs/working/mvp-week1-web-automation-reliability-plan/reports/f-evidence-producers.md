# Report: f-evidence-producers

Worker: `f-evidence-producers`, dispatched 2026-09-12 at `HEAD 99eca80` from
[finish-week1.md](../briefs/finish-week1.md).

## Outcome

**Done. Both items were already fixed at HEAD by commit `1b6f5df`; this session
proved that and changed one comment.**

- **No conditional spreads left in the second producer.** Nothing in
  `apps/extension/src/background/connection/dom-snapshot.ts` writes evidence
  through a conditional spread any more. Every evidence object is built with
  `present<T>()`, at lines 230, 232, 237, 241, 242, 250, 253, 260, 261, 265,
  270, 273, 346, 347, 356, 378 and 389. A search for `...(`, `: {})`,
  `boundsOrNone` and a local `const present` matches only the file's header
  comment at line 18, which quotes the old pattern.
- **No import past a barrel.** `dom-snapshot.ts:33` imports
  `../../shared/present`, not `../../content/evidence/present`. The path
  `apps/extension/src/content/evidence/present.ts` does not exist, and git has no
  history for it. `apps/extension/src/shared/` has no `index.ts`, so a direct
  import into it is allowed. This is **Remedy B** from `v-merge-safety`, the one
  it measured as better: a clean audit with an unchanged background bundle,
  against Remedy A's clean audit with a bundle 19,256 bytes larger. Commit
  `1b6f5df` added `shared/present.ts` and moved `dom-snapshot.ts` and all eight
  content producers onto it (`git show --name-status 1b6f5df`).
- **The structure audit has no `[imports]` failure and needs no baseline
  change.** Its two failures are both `[working-docs]` rows caused by the
  supervisor's uncommitted edit to the plan document (detail below).
- **Mutation proofs:** three, each failing inside `dom-snapshot.ts`, and every
  file restored or never touched.

## What changed and why

- `domain/src/page-evidence/types.ts`, lines 36-40. This is a comment edit only;
  the file keeps its length (288 lines at HEAD and after). The header named
  `apps/extension/src/content/evidence/present.ts` as the writer and spoke of
  "the producer", singular. That path no longer exists, and there are two
  producers, so the comment now names `apps/extension/src/shared/present.ts` and
  both producers. It was the only reference to the old path outside
  `docs/working/` (repository-wide search).
- No other owned file changed. At the end, `dom-snapshot.ts`,
  `tests/dom-snapshot.test.ts` and `content/evidence/index.ts` hash to the same
  SHA256 values they had before the session (`ECC32AD9…`, `1D6AB862…`,
  `D853F491…`). `content/evidence/index.ts` needs no `present` export, because
  nothing outside the directory imports `present` through it.

## Commands run and observed results

Every exit code below was captured by redirecting output to a file, not through
a pipe. `EXTENSION_TEST_BUILD_LABEL` and `DOMAIN_TEST_BUILD_LABEL` were set to
`f-evidence-producers`.

1. `node scripts/structure-audit.mjs` from the repository root, run after the
   comment edit: **exit 1, `structure-audit: 2 violation(s) across 1 rule(s)`**.
   Both are `[working-docs]`:
   - `docs/working/mvp-week1-web-automation-reliability-plan.md: 819 lines
     exceeds the 800-line compaction threshold`
   - `docs/working/README.md is out of date with the documents' header blocks`

   `git diff --stat` shows the plan document with 23 uncommitted added lines
   that are not mine. There is no `[imports]` row, and no row names any file I
   own except one advisory warning: `dom-snapshot.ts: 419 lines is past the
   400-line advisory threshold`. No new files were added, so no scratch
   `GIT_INDEX_FILE` was needed.
2. `pnpm check` in `apps/extension`: **exit 0**, 7 seconds.
3. `pnpm test` in `apps/extension`: **exit 0**, `Extension smoke test passed.`,
   then `# tests 294 # pass 294 # fail 0 # cancelled 0 # skipped 0`. All 15
   `dom-snapshot.test.ts` rows passed (`ok 28` to `ok 42`). The merge rows in
   other test files passed too: `ok 60`, `ok 75`, `ok 98` and `ok 101`. This
   ran while `f-connection-split`'s uncommitted edits to `active-recording.ts`,
   `connection/index.ts` and `server-command-channel.ts` were in the tree.
4. `pnpm check` in `domain`, run for the comment edit: **exit 0**, 5 seconds.

### Mutation proofs

Proofs 1 and 3 compile the **real** `dom-snapshot.ts` through a scratch tsconfig
in my scratchpad, so the shared contract file other workers compile is never
touched. The config extends `apps/extension/tsconfig.json` and redirects only
`@fluxiq-web-extension/domain`, which is the path the evidence types take:
`shared/protocol.ts:31` imports `../content/evidence`, and
`content/evidence/types.ts:51` imports `@fluxiq-web-extension/domain`. The
redirect points at a module that re-exports the real domain barrel and replaces
only `WebAutomationPageEvidence`.

- **Control:** the same redirect over the unchanged barrel. `tsc -p
  tsconfig.control.json`: **exit 0**, no output. The redirect itself introduces
  no errors.
- **Proof 1, contract key renamed (`regions` to `landmarks`):** **exit 2**.
  - `dom-snapshot.ts(259,5): error TS2353: Object literal may only specify known
    properties, and 'regions' does not exist in type
    'RequiredFields<WebAutomationPageEvidence> &
    OptionalFields<WebAutomationPageEvidence>'.`
  - `dom-snapshot.ts(366,5): error TS2353` (the same message, in
    `mergePageEvidence`)
  - `dom-snapshot.ts(259,23)` and `(338,75)`: `TS2339: Property 'regions' does
    not exist on type 'WebAutomationPageEvidence'`
  - `dom-snapshot.ts(259,37)`: `TS7006`
  - The content producer fails too: `content/evidence/page.ts(61,5): TS2353`.
  - `types.ts` hash before equals hash after: `True`.
- **Proof 2, write key renamed inside `dom-snapshot.ts`, in place.** This shows
  the write-side check fires with no matching read to catch it. I backed up the
  file byte for byte, changed `regions,` at line 366 to `landmarks: regions,`,
  ran `pnpm exec tsc -p tsconfig.json --noEmit`, then restored the backup in the
  same call.
  - Result: **exit 2**, `dom-snapshot.ts(366,5): error TS2353: Object literal
    may only specify known properties, and 'landmarks' does not exist in type
    'RequiredFields<WebAutomationPageEvidence> &
    OptionalFields<WebAutomationPageEvidence>'.`
  - Hash while mutated: `481C8999…`. Hash after restore: `ECC32AD9…`.
    Byte-identical to before: `True`. The file was mutated for one compile,
    about 7 seconds.
- **Proof 3, a ninth key added to the contract (`scrolling?: boolean |
  undefined`):** **exit 2**, run against the clean file (hash `ECC32AD9…`).
  - `dom-snapshot.ts(230,32): error TS2345 … Property 'scrolling' is missing …
    but required in type 'OptionalFields<WebAutomationPageEvidence>'`, in
    `frameEvidenceInTopFrameTerms`
  - `dom-snapshot.ts(346,32)`: the same, in `mergePageEvidence`
  - `content/evidence/page.ts(47,32)`: the same

## Not verified

- **Lab:** not run (no `pnpm lab` in this dispatch). A Lab run must show a
  recorded event on a multi-frame page, the Lab's two-frame fixture, whose
  evidence packet carries the child frame's items. That means dialogs, overlays,
  regions, repeating runs and forms, with selectors qualified
  `frame[<id>] >> …`, rects on the top frame's page, element totals summed
  across frames, and `navigation` and `loading.documentState` from the top
  frame.
- **Content harness:** not run; the brief did not name it for this item.
- **Bundle size:** `v-merge-safety`'s figures (224,870 bytes unchanged under
  Remedy B, +19,256 under Remedy A) were not re-measured, because `pnpm build`
  is barred.
- **Root `pnpm check` and `pnpm test`:** not run. Only the extension `check`
  and `test`, the domain `check` and the standalone audit ran. The domain
  `test` was not run; my only domain change is a comment.
- **Single observations:** each command above ran once. None failed
  unexpectedly, so nothing was rerun.

## Open questions or contradictions found

- **Stale Current State.** Open-work item 4 in the plan still lists "a second
  evidence producer keeps the conditional-spread hole (`v-producer-safety`); one
  merge-safety gate is a line outside its owner's files (`v-merge-safety`)".
  Both are settled at HEAD by `1b6f5df`, as shown above, and item 4 should say
  so.
- **Stale reports.** `v-merge-safety` "The one line I do not own" still
  describes the deep import into `content/evidence/present`. That report is
  historical and I did not edit it.
- **Baseline:** no `.structure-baseline.json` entry should change for this
  item, since none of my owned files has one.
- **Supervisor audit failures.** The two failing `[working-docs]` rows are the
  supervisor's to clear: compact the plan document, then regenerate
  `docs/working/README.md`.
