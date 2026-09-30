# t205 part 1: permission points on the five undeclared consequential tasks

## Outcome

Done. Ready to commit: `apps/scenario-lab/src/scenarios/social-network-feed/live-tasks.ts`,
`apps/scenario-lab/src/scenarios/company-website/live-tasks.ts`,
`apps/scenario-lab/src/scenarios/everything-store/live-tasks.ts`,
`apps/scenario-lab/src/scenarios/auction-marketplace/live-tasks.ts`,
`apps/scenario-lab/src/scenarios/local-classifieds/live-tasks.ts`,
`apps/scenario-lab/src/scenarios/tests/live-instructions.test.ts`,
`docs/working/language-driven-flow-loop-plan/reports/t205-lab-bookkeeping.md`;
validation: `pnpm --filter @fluxiq-web-extension/scenario-lab test` -> `# tests 620 / # pass 620 / # fail 0`.

## What changed and why

- `social-network-feed/live-tasks.ts`: `group-post`, `group-post-regrouped` and
  `group-post-regrouped-after-creation` declare `{ consequence: "send_or_publish", control: "Post" }`
  (shared constant `GROUP_POST_POINT`). The label is the composer dialog's primary button,
  `aria-label="Post"` / text `Post` (`client/composer-script.ts`); the dialog is the same in the
  baseline and `regrouped` designs (only the group-page prompt differs), and the manifest's goal
  presses `role:button:Post`. Doc comment updated.
- `company-website/live-tasks.ts`: `quote-request` and `quote-request-redesigned-after-creation`
  declare `{ consequence: "send_or_publish", control: "Send request" }` (`QUOTE_SEND_POINT`). The label
  is the drawer's submit button in the shipped design (`pages/quote-drawer.ts:50`). The redesigned row
  is `variantArmedAfterBuild`, so its build meets `Send request` too; only its playback meets
  `Get my free quote`. Removed the stale comment saying sending "needs no further permission".
- Follow-up (supervisor, same task): the three other undeclared consequential tasks. None has variant rows.
  - `everything-store-buy-kettle`: `move_money` at `Place your order` (`pages/checkout.ts:39`).
  - `auction-marketplace-place-bid`: `move_money` at `Confirm bid` (`pages/drawers.ts`; the drawer says
    "you commit to buy this item ... Bids cannot be retracted", so a bid binds money).
  - `local-classifieds-make-offer`: `send_or_publish` at `Send offer` (`client/listing-script.ts:85`).
    The dialog takes no payment and binds nothing; it says the seller "will see your offer in their
    Marketplace inbox", so the act is a message sent, not money moved.
- `tests/live-instructions.test.ts`:
  - the exact-map test of declared points gains the five rows;
  - new: every row sharing an instruction (scenario + instruction text) declares the same point as its
    first row, so a variant cannot be left without its base's point;
  - new: every realistic-site instruction family without a point must be listed in `ASKS_NOTHING`
    with a reason. There is no known-gap list: every realistic-site consequential task declares a point,
    and a new task that does neither fails the build.

No `--llm-permit`, no packages/test-runner or Core edits.

## Commands run and observed results

- `bash .../heavy.sh "t205 scenario-lab test" pnpm --filter @fluxiq-web-extension/scenario-lab test`
  (run twice; the second after the follow-up) -> exit 0; `# tests 620`, `# pass 620`, `# fail 0`; includes `ok 516 - every consequential task
  declares its permission point...`, `ok 517 - every row of an instruction declares the same permission
  point as its first row`, `ok 518 - every realistic-site task either declares its permission point or
  is recorded as asking nothing`.
- `bash .../heavy.sh "t205 scenario-lab check" pnpm --filter @fluxiq-web-extension/scenario-lab check`
  -> exit 0, no tsc errors (second run: `"reason":"inputs changed: apps/scenario-lab"`, `"ms":28047`).
- `bash .../heavy.sh "t205 structure audit" node scripts/structure-audit.mjs`
  -> `structure-audit: passed (132 warning(s), 120 baselined).`

## Not verified

- No Lab or browser run (per brief), so it is not shown that Core names the control `Post` /
  `Send request` in its ask; the Lab's match falls back to `unnamed` when Core names none.
- I did not run the new coverage test against the pre-change tree to watch it fail; by construction
  it would (the five rows would be undeclared and unlisted).
- All control labels were read from source (one shared dialog), not rendered.

## Open questions or contradictions found

- `social-network-feed-confirm-requests` is classed as asking nothing (confirming friend requests is
  not money, delete or send); the supervisor may disagree.
