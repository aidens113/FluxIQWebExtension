# W2: a notice-only first press is pressed once more in the same command (t898)

## Outcome

Done, apart from the optional Lab confirmation. The Lab refused to start because the t898 Core sibling's compiled build is stale (see Commands).

A first press that the page answers with nothing but its own notice, such as company-website's "Loading more people…", is now pressed once more inside the same command. It gets the same single extra press, the same aim and the same watch windows as a first press that settled exactly as it was (t896). The immediate `web.action.page_reported_failure` on the first press is gone. If a notice comes again on the second press, or the page again settles exactly as before, the command still ends as `web.action.page_reported_failure`, `certainNoEffect`, with the notice named in `actual`.

## Step 1: is the notice-only press certainly nothing? Yes

Line numbers refer to the t898 worktree as it was before my change, unless marked "now".

`first.noticeOnly` is set only by `press()` (`click.ts:555`, now `:579`): `noticeOnly: looked === "announced"`. Three conditions must all hold first:

- **The watch saw only a change in the section.** `looked` is computed only when `lookAgain && changedOnly && !refused && !sighting` (`click.ts:549-554`). `changedOnly` means the ignored-press watch saw exactly one sign, `"change"`, inside the control or its section. A request, navigation or focus sign makes `changedOnly` false, so the press is never looked at again and never pressed again.
- **This is the command's first press.** `lookAgain` is `extra === 0` (`click.ts:384`), so `noticeOnly` is never true for a press made after a layer was closed.
- **The settled look answered `"announced"`** (`action-runtime/ignored-press/settled-look.ts:202`). It does so only when all of these hold:
  - `!answered`. A request, navigation or focus move at any point during the look sets `answered` (`:132-138`). So does any mutation outside the section other than a change inside or of a notice region, or of the extension's own UI host (`:139-145`). So does a new open shadow root (`:168-171`).
  - `same`. The section is quiet, and its markup, its shadow roots' markup and every field's value, checked state and selected index are identical to before the press (`:200-201`, `sectionState` `:224-238`). Only notice regions are left out. A flipped toggle (`aria-pressed`, `checked`), a changed control, an opened dialog or a navigation all fail this test or the one above.
  - `announced()`. A notice region (`role="alert"`, `role="status"`, `aria-live="assertive"`; `live-region.ts:170-179`) now holds non-empty words it did not hold before (`:174-180`).
- **The domain marks the code certain.** `domain/src/runtime/failure/codes.ts:371`: `"web.action.page_reported_failure": { ..., retryable: true, effect: "unacted", certainNoEffect: true }`. That is the same certainty as `web.action.no_effect` (`:369`), which t896 already presses again in-command.

So nothing the page did shows that the act landed: no navigation began, the target and its section are unchanged, no dialog opened (that is a change outside the section), no toggle flipped, and nothing on the page changed apart from notice regions. Core already presses this press again under t743 and t528. Pressing it inside the command is the same press, made earlier.

**What remains (a pre-existing limit, not a new one).** A page could record a success with no request and no DOM change outside notice regions, for example a localStorage write announced only in a `role="status"` region. The look cannot tell that apart, because the notice's words are never read (header, t743). Today such a press already fails `certainNoEffect`, and Core presses it again. This change does not widen that limit; it moves the second press from Core into the command.

## What changed and why

`apps/extension/src/content/actions/click.ts`:
- **`pressInPlace`.** I removed the early `PAGE_REPORTED_FAILURE` return for a notice-only first press. It is now `const settled = first.settledUnchanged || first.noticeOnly;` (now `:410`). From there the existing t896 path runs unchanged:
  - `pressAgain([], extra)`;
  - `measure()`: covered gives the covered refusal plus `noteExtraPress`, and disabled or gone counts as answered;
  - `noteExtraPress`;
  - the second press at `aimAgain(target, now)` above humanness 0, or at the gate's point at 0, with `lookAgain = true`.
- **`afterSettled`** (now `:465`) takes `noticeFirst`. After a notice-only first press:
  - a second press answered with a notice again fails `PAGE_REPORTED_FAILURE` (`NOTICE_TWICE`);
  - a second press that settled exactly as before, on any control (`settledAsBefore`), fails `PAGE_REPORTED_FAILURE` (`NOTICE_THEN_SETTLED`). This covers a page that rewrites the same words, which the look does not count as new. Without this case, a non-command control would have passed;
  - a second press with no sign at all fails as not observed (uncertain), as t896 does;
  - a second press that was answered passes, and `actual` says the first press brought only a notice.
  - The non-notice t896 branch is unchanged.
- **`PressOutcome.settledAsBefore`** is `looked === true` on any control. It is read only after a notice-first press. `settledUnchanged` is unchanged.
- **Phrases and header.** I added the closed phrases `PRESSED_AFTER_NOTICE`, `NOTICE_TWICE`, `NOTICE_THEN_SETTLED` and `IGNORED_THAT_PRESS`, and the old silent phrase is now built from these. I removed `NOTICE_ONLY` and `noticeOnlyValidation`, which nothing else used. I rewrote the header paragraph on notices and the `afterSettled` doc.
- **Humanness is untouched.** The H3 aim (`aimPress` and `aimAgain`) and the H4 misclick (`misclickBefore`, first press only) take the same code path as before. At level 0 no point is drawn.

Tests, in `apps/extension/src/content/actions/tests/click/tests/`:
- **New: `notice-first-press.test.ts`** (8 rows):
  - notice, then a request: success, two presses, one extra press;
  - notice, then a lasting change: success;
  - notice twice, on a button and on a plain control: the full `page_reported_failure` record, `certainNoEffect`, two presses;
  - notice, then settled as before, on both control kinds: `page_reported_failure`;
  - notice, then silent: not observed, uncertain;
  - a first press with a request, navigation, focus move or lasting change: pressed once, no extra press;
  - notice, then covered: covered refusal, extra press counted;
  - a first press ignored outright: unchanged.
- **`settled-look.test.ts`.** Two rows asserted the reversed t743 behaviour, a failure at once after one press. They now assert two presses and success, on a command control and on a plain control. The "disabled/hidden after the notice passes" row now also asserts that the press was made only once.
- **`humanness.test.ts`.** Added a `settled` option and one row: notice-first is pressed again at the gate's point at level 0, and aimed again inside the box at level 80, the same for the same command id.

## Commands run and observed results

- `cd apps/extension && EXTENSION_TEST_BUILD_LABEL=t898-press node scripts/test-extension.mjs content/actions/tests content/action-runtime/humanness`: exit 0, `# tests 286`, `# pass 286`, `# fail 0`. I ran it twice; the second run followed the red check below.
- Red check: I swapped in `git show HEAD:apps/extension/src/content/actions/click.ts`, ran `... test-extension.mjs content/actions/tests/click`, then restored the file and confirmed it with `cmp`. Result: exit 1, `# pass 84`, `# fail 9`. The 9 failures were exactly the rows for the new behaviour: 6 in `notice-first-press`, 2 in `settled-look` and 1 in humanness. The "never pressed again" and "ignored outright" rows pass on both versions.
- `node scripts/structure-audit.mjs` (repo root): `structure-audit: passed (247 warning(s), 552 baselined).`, exit 0.
- `tsc -p tsconfig.json --noEmit` and `tsc -p tsconfig.test.json --noEmit` (apps/extension): exit 2. The only errors are in `src/panel/chat/transport/ports/results/read-task-outcome.ts(3,44)`, `(12,163)` and `tests/read-task-outcome.test.ts(28,3)`: `AutomationStudioTaskReplayDeviation` and `replay` are missing from `fluxiq/automation`. These come from the stale Core build below. None are in files I touched.
- `heavy-slot.mjs run t898-press --priority -- pnpm lab attempt company-website --task company-website-apprentices --authoring-mode answer-first --scripted-model --attempts 2`: it took slot-2, then the Lab refused with "FluxIQ Core's build at ...\fxwork\t898\!FluxIQ is not what its source says ... (inputs changed: package.json, packages/fluxiq)". The suggested fix is `pnpm --filter fluxiq build` in that Core worktree. I did not rebuild Core or set `FLUXIQ_LAB_ALLOW_STALE_CORE`, because Core is outside this brief and another worker's source is in flight there. No provider was called.

## Not verified

- The live and Lab confirmation that the replay's "Show more people" click no longer fails first. There is no run id, because the Lab refused on the stale Core build.
- Browser e2e specs, which were not run and are outside the brief. Two of them assert the old behaviour and will need changing by their owner:
  - `apps/extension/e2e/content/tests/reveal-by-scroll/tests/company-website-team-more.spec.ts:71-89` expects the first command to fail `web.action.page_reported_failure`. It should now succeed and load more in one command.
  - `apps/extension/e2e/site-reset/tests/job-failed-save.spec.ts:24-31`: its header describes the Core retry. Its click counts ("two clicks for one call") may still hold, but I have not checked.
- `docs/architecture/extension-client.md`, around line 1481 per E1's trace, still describes the immediate failure. I did not edit it because it is not mine.
- The not_shown retries E1 also found, which are the second root cause, are untouched, so the S9 rule's `step_retried` may still fire on most replays.

## Open questions or contradictions found

- The brief says "existing click tests pass unchanged". Two `settled-look.test.ts` rows asserted the exact behaviour this brief reverses, a notice-only first press failing at once. I changed those two rows. Every other existing row passes unchanged.
- Notice-first followed by a silent second press now ends as not observed (uncertain), not as `page_reported_failure`. That matches t896's rule that a silent press is not certain, because the watch does not look outside the section. It does differ from today's ending for a page whose button stays dead without rewriting anything. The supervisor should confirm that Core's handling of not observed is acceptable there.
