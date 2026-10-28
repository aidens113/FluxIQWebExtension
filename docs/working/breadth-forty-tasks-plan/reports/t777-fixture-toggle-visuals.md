# t777 fixture toggle visuals

## Outcome
Done for photo-social, the only site with the defect. Other sites audited, no change needed (list below).

## What changed and why
- photo-social/look/glyphs.ts: `glyph(..., on)`; a toggled heart is red (#ff3040) filled+stroked, other toggled glyphs (bookmark) filled currentColor.
- photo-social/pages/article.ts: heart and bookmark drawn `on` when the post is liked/saved at load (feed cards, article, modal share this); like count renders post.likes + 1 when liked.
- photo-social/client/post-script.ts: `setIconLabel` also sets path fill/stroke (after server confirms, as before); `moveLikeCount` moves the count by one on like/unlike. aria-label flip kept.
- Test: scenario.test.ts (markup on load); new apps/extension/e2e/content/tests/toggle-visuals/tests/photo-social-like-save-visuals.spec.ts (headed).

## Toggles found
- photo-social Like/Save: defect, fixed. Follow on profile/feed: text "Follow"/"Following" already, ok.
- social-network-feed Like: actionActive (blue) class on load and click, ok.
- job-board save heart: heartOn class on load and click; menu text Save/Unsave job, ok.
- auction-marketplace watch: path fill/stroke + aria-pressed, "Watching" text; seller follow "Seller saved", ok.
- local-classifieds save: aria-pressed + "Saved" text + pressed style, ok.
- crossborder-marketplace store follow: "Following" text, ok.
- professional-network Follow: was client-only (lost on reload). Now stored (round 2, below).
- everything-store / bigbox / company-website: no wishlist toggles found (cart only).

## Commands run
- `pnpm test:content -- e2e/content/tests/toggle-visuals --headed --workers=1` -> 1 passed (fill none -> rgb(255, 48, 64), server liked/saved, count +1, persisted on reload, unlike/unsave revert).
- Same with photo-social-thread-load-more and photo-social-unopened-replies specs -> 6 passed total.
- `pnpm build` in apps/scenario-lab, `node --test dist/scenarios/photo-social/tests/scenario.test.js` -> 13 pass, 0 fail (whole photo-social dir: 41 pass before final test fix).
- `node scripts/structure-audit.mjs` -> passed (227 warnings, 616 baselined).

## Not verified
Other photo-social headed specs (grid, dialog-dismissal etc.) not rerun; other scenarios' tests not run (untouched). Feed-card and grid-modal heart not exercised in a browser (same markup path). Collection-dialog "Saved to X" path sets Remove label through the same setIconLabel, not browser-tested.

## Open questions
Oracles: newest-likes waits on aria-label Unlike (kept). august-over-1300 reads the like count from the page; it never likes, so unchanged. A task that likes then reads a count would now see +1, as a real site does; none exists.

## Round 2 (lead's follow-up)
- professional-network: state gains `following: string[]` (member urns); mutation `follow-member {memberUrn, following}` (only a visible, non-1st-degree member whose own action is Follow); `search/card.ts` `cardAction` renders "Following" from state (cards and profile); `search/people-client.ts` and `pages/profile.ts` press Follow/Following through `GL.mutate('follow-member')` and flip the text once the server answers; the profile keeps Connect under More while Following. Files: types.ts, state.ts, search/card.ts, search/people-client.ts, pages/profile.ts, tests/scenario.test.ts.
- Oracle check: no task relies on follow state. Oracles read the invitation store (`invitationStoreText`) and extracted datasets; the word "follow" appears in task text only as "do not follow" or page/newsletter invitations. The new field is not in any oracle. Nothing to stop for.
- photo-social heart verified in browser on a feed card and in the grid modal (spec now has three cases: own page, feed card, modal). A reload on the modal shows the post page (modal address is the post's), so the case reopens it from the grid; red fill, Unlike, count, save persisted; unlike/unsave revert.
- New spec: toggle-visuals/tests/professional-network-follow.spec.ts (extension click on the profile's action row -> stored `following` and "Following" text -> reload both persist -> unfollow reverts). Note: the extension action takes CSS, so it presses `div[style*="margin-top:12px"] > button:first-child`; text is asserted by Playwright locator.
- Commands: `pnpm test:content -- e2e/content/tests/toggle-visuals <5 photo-social list-states specs> --headed --workers=1` -> 12 passed; after a lint-only edit `toggle-visuals` alone -> 4 passed. scenario-lab `pnpm build` then `node --test` over professional-network tests + qualification tests + photo-social tests -> 84 pass, 0 fail. `node scripts/structure-audit.mjs` -> passed (it first flagged a packed line in my spec, fixed).
- Not run: the `e2e/site-reset/` photo specs (photo-toggle, photo-dialog-*, photo-page-order-limit) use the installed-build harness (`test:e2e`), not `test:content`; they locate the heart by its aria-label, which is unchanged. Other professional-network headed specs elsewhere were not rerun.
