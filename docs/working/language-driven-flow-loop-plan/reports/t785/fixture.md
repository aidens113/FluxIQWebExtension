# t785 fixture: social-network-feed layout (rework)

## Outcome
Done.

## Cause (corrected)
Broken at 1280, after paging the feed to its end. The feed's `column` and `feed` elements were `display:grid` with an implicit auto track, which sizes to the min-content of the widest loaded unit. Loaded units went into the right container (client/ untouched); some unit content is wide, so the track grew to about 1164px, ignoring max-width 590px. That caused the sideways scroll (scrollWidth 1501 vs 1263), pushed the left nav off-screen and let the sticky right rail paint over the cards. My first fix only looked at the first screen at 860 and missed this.

## Change (layout CSS only, no DOM change)
markup/stylesheet.ts: `column` and `feed` get `grid-template-columns:minmax(0,1fr)` (the fix); `center` gets min-width:0; `layout` gets max-width:100vw; `narrowRules()` media queries kept (rails 240px under 1100px, right rail under the feed under 960px, smaller top bar under 760px).

## Spec
e2e/social-network-feed.spec.ts: layout tests at 1280, 860, 720 now decline the cookie dialog, scroll until "No more posts to show right now." is visible, then assert scrollWidth <= clientWidth, left nav visible and unclipped, rail inside the viewport, and no rail/nav overlap with feed cards. Before the fix all three failed (1280: scrollWidth 1501 > 1263; 860 and 720: 1403). After: all pass.

## Screenshots (headed, end of feed, in test-runs/t785-fixture/)
before/home-1280.png, home-860.png, home-720.png (state before the minmax fix; the narrow rules were already present for 860 and 720); after/home-1280.png, home-860.png, home-720.png.

## Commands
- playwright social-network-feed.spec.ts --headed (full) -> 16 passed.
- tsc -p tsconfig.json and tsconfig.e2e.json --noEmit -> clean.
- node --test dist/scenarios/social-network-feed/tests/*.test.js (after scenario-lab:build) -> 44 pass, 0 fail (oracle and qualification included).
- node scripts/structure-audit.mjs -> passed.
