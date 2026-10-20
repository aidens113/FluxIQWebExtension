# t730-atlas-3: realistic scenario atlas (photo-social, social-network-feed, professional-network)

## Outcome
Done. Atlas below, read from source only (no browser, no build). Paths are relative to
`apps/scenario-lab/src/scenarios/<id>/`. Every page lives under `/scenarios/<id>/`. Class names in
all three are hashed per seed (never use them as locators). "unconfirmed" marks anything not proven
by reading code.

## What changed and why
Created this file only. It is the atlas the brief asked for.

## Commands run and observed results
Only reads (`cat -n`, `grep -n`) over the three scenario trees and `grep -rl` over
`apps/extension/e2e` and `apps/scenario-lab/e2e`. No checks were run, as the brief asked.

## Not verified
No live rendering. Timing values are the constants in source, not measured. Whether a locator is
unique on a rendered page is inferred from the markup, not observed.

## Open questions or contradictions found
- professional-network `manifest.ts:82` says "Next never leaves page 2", but `search/people-client.ts:81`
  loads `current + 1` and `current` only moves on a successful render (`:56`). Next looks broken only
  when the rate-limit check (`search/rate-limit.ts:14`) answers instead. Whether Next really is broken is unconfirmed.
- photo-social's "Create" panel offers "Select from computer" (`client/core-script.ts:134`), but it is a
  div with no file input. None of the three sites has a real file input or upload.

---

## 1. photo-social (Framelight)

id `photo-social`; startPath `/scenarios/photo-social/`; seed 238 (`scenario.ts:15-18`, `manifest.ts:83-88`).
The home feed is the start page (`route.ts:19-21`). Signed in as the viewer (`VIEWER` in data).

**Routes** (`route.ts:39-74` per file; `routePost` at `:78-92`)
- `/` home feed (stories, first 4 cards, rail, app banner) `pages/feed.ts:95-105`
- `feed?page=N` feed batch fragment; `explore/search?q=` account search fragment
- `explore/`, `reels/` discover grid `pages/elsewhere.ts:43`; `l/?u=` link shim "Leaving Framelight" `elsewhere.ts:21`
- `accounts/login/` login form; `verified/subscribe/` payment form; `direct/inbox/` inbox
- `direct/t/<thread|handle>/` conversation; `direct/t/<t>/messages?from=N` JSON new messages
- `p/<code>/` post page (`?fragment=1` modal fragment); `p/<code>/comments?offset=N`; `p/<code>/c/<id>/` permalink; `p/<code>/c/<id>/replies`
- `<handle>/`, `<handle>/reels/`, `<handle>/tagged/` profile; `<handle>/grid?offset=N[&tab=reels]` (204 at end, 401 session wall)
- `<viewer>/saved/`, `<viewer>/saved/all-posts/`, `<viewer>/saved/<slug>/[?added=N]`; `saltmarsh.goods/shop/<slug>/` product
- 404 "Sorry, this page isn't available." for `explore|accounts|legal|reels|direct|stories/*` unknowns, `followers/`, `following/`, `liked_by/` (`route.ts:57,73,83`; `elsewhere.ts:51`)

**Constructs**
- Text input: search panel `input[aria-label="Search input"]` (opens from nav "Search" div) `client/core-script.ts:120`; 350 ms debounce then fetch `:125`. Collection name `input[placeholder="Collection name"]` (maxlength 50) `client/post-script.ts:69`, `client/saved-script.ts:32`.
- Textarea: comment box `textarea[aria-label="Add a comment…"]` on feed cards and posts `pages/feed.ts:64`, `pages/article.ts:62`; Post div enables on input `post-script.ts:156-160`, then press shows toast "Couldn't post comment" `:150-152`.
- Native select / custom combobox: none.
- Checkbox: picker tiles `[role="dialog"] [role="checkbox"]:has(img[alt*="…"])`, named only by img alt `saved-script.ts:13`; native `input[type=checkbox]` Analytics/Advertising after consent "Manage options" (redesign mode only) `client/overlay-script.ts:121`.
- Radio: none.
- Password: `/accounts/login/` `input[name=password][type=password]`, every attempt refused `pages/elsewhere.ts:27`.
- Payment/sensitive: `/verified/subscribe/` `input[aria-label="Card number"][autocomplete=cc-number]` + "Pay €11.99" div `elsewhere.ts:39`. Username/email field `input[name=username]` `elsewhere.ts:27`.
- Email/tel: none (the login username field accepts phone or email, but its type is text).
- Contenteditable: DM box `[role="textbox"][contenteditable="true"][aria-label="Message…"]` `pages/direct.ts:52`; Enter sends (Shift+Enter does not) `client/direct-script.ts:48`.
- File input: none (see open questions).
- Disabled: `aria-disabled="true"` divs: comment Post `feed.ts:64`; Create `post-script.ts:69`; picker Done/Next `saved-script.ts:14,32`. DM Send is `hidden` until text `pages/direct.ts:53`, `direct-script.ts:19`.
- Duplicate labels: every nav item's name repeats its word (svg aria-label + text) `pages/shell.ts:49`; "Follow" appears in rail, suggested strip and profiles `feed.ts:39,85`; two "Like" per post page (post + each comment heart) `article.ts:26`, `pages/comments.ts:28`; lookalike studio accounts in suggestions `feed.ts:34,84`.
- Same-origin / cross-origin iframe: none.
- Shadow DOM: open shadow root in `<fl-dock>` (messages dock); collapse control `fl-dock [part="collapse-button"]` (unnamed icon) `client/overlay-script.ts:31,51`. Closed shadow: none.
- role=dialog: cookie dialog `[role=dialog][aria-modal=true]` over scrim `pages/overlays.ts:19-46`; notifications "Turn on Notifications" (Turn On / Not Now buttons, page inert) `overlay-script.ts:79-87`; save-to-collection dialog `post-script.ts:51-93`; grid modal `client/grid-script.ts:93`; unfollow confirm `core-script.ts:92`; Create post `core-script.ts:134`; "Action Blocked" `role=alertdialog` `direct-script.ts:27`; upsell (mode) `overlay-script.ts:90-106`.
- Native alert/confirm/prompt: none.
- Consent overlay: testids `cookie-policy-manage-dialog-decline-button` / `-accept-button` `pages/overlays.ts:41-42`; scrim takes every click until answered.
- Obstructing overlay: the dock expands over the bottom right and covers the bookmark, "Load more comments" and the modal Next at 1280x720 (`look/stylesheet.ts:7-11`). It appears at 300 ms and expands at +1500 ms (`overlay-script.ts:17-20,70-77`). The app banner is fixed at the bottom (`stylesheet.ts:98`, `shell.ts:99`). The toasts are `role=status` (`core-script.ts:52`).
- Delayed/lazy: notifications prompt 1200 ms after consent (home only) `overlay-script.ts:19,79`; upsell 1500 ms `:20`; feed batch +500 ms behind skeleton `client/feed-script.ts:13-15`; grid +400 ms behind skeletons `grid-script.ts:33-35`; comments batch +450 ms `post-script.ts:130`; replies +350 ms `:141`; DM reply after "is typing…" 1800 ms `direct-script.ts:11,38-41`.
- Infinite scroll: home feed, 4 cards/screen, loads within 600 px of bottom; ends "You're all caught up" `feed-script.ts:10-26`, `feed.ts:12`. Profile grid 12/screen, 300 px; asking again within 1500 ms throws "Please wait a few moments…", which only "Try again" (after 4 s) clears `grid-script.ts:18-19,28-30,60-70,73`. The third screen sits behind the 401 "Continue as …" wall `pages/profile.ts:40`, `pages/overlays.ts:54-63`.
- Pagination: "Load more comments" button (svg aria-label only), 12 per batch, ignores its first press per list `pages/comments.ts:10,34`, `post-script.ts:124-134`. No Next pager.
- Table/grid: CSS grid of post cells `a[href*="/p/"]` with img alt and a hover overlay of compact counts `profile.ts:23-30`. No HTML table.
- Long page / scroll container: comment thread `overflow-y:auto` inside the article `stylesheet.ts:80`; DM conversation `stylesheet.ts:106`; dialogs `max-height:80vh` `:90`.
- Keyboard: Enter/Space activate every `[role=button|link|checkbox]` div `core-script.ts:64-68`; Escape closes grid modal `grid-script.ts:117`; Enter sends DM. No arrow keys.
- Hover: grid cell overlay counts (`:hover` CSS) `stylesheet.ts:75`.
- New tab: `target="_blank"` on Open app `shell.ts:99`, Learn more (ads) `feed.ts:57`, profile link-in-bio `profile.ts:53`, Buy now `elsewhere.ts:33`, all via the `l/` shim.
- pushState: grid modal pushes `p/<code>/` and replaceState back on close `grid-script.ts:88,93,110-114`. Full navigation: Message `location.href` `core-script.ts:100`; saved picker `saved-script.ts:61`.
- Validation errors: duplicate collection name `role=alert` "You already have a collection with that name." `post-script.ts:80-84`, `saved-script.ts:40-44`.
- 404/retired: see routes.
- Honeypot: DM `input[name="subject"]` in off-screen label "Leave this field empty" `pages/direct.ts:50`, `stylesheet.ts:115`. If filled, the account is blocked for good (`state.ts:142`).
- Generated classes/ids: atomic hashes per seed `look/classes.ts:39-50`; ids `mount_0_0_xxx` `:53`.
- Drift: Save→Remove label flip; popover "Save to collection" self-removes after 8 s `post-script.ts:15,37`; "more" span removed on expand `:145-149`; comment load-more `li` replaced `:129-133`; consent node removed.
- Toggles: Like/Unlike svg label `post-script.ts:101-104`; Save/Remove; Follow/Following `core-script.ts:83-98`; replies View/Hide `post-script.ts:135-144`; carousel Next/Go back `article.ts:16`, `post-script.ts:116-123`.

**Variants** (`manifest.ts:130-142,176-185`; modes `types.ts:16`)
- `consent-redesign` (primary): `set-mode {mode:"consent-redesign"}`. The decline control loses its testid and becomes "Only allow essential cookies"; Accept stays first; "Manage options" is added `overlays.ts:23-34`.
- `verified-upsell` (giveaway-entries): `set-mode {mode:"verified-upsell"}`. "Get verified" dialog over posts; Subscribe navigates to `verified/subscribe/`.

**Control/API**: `mutate` ops `set-mode, consent, notifications, dock, session, upsell, save, collection-create, collection-toggle, collection-add, like, follow, send-message` (`state.ts:45-84`). Fragments as in the routes.

**Oracle**: `script[type=text/plain][data-testid=fl-relay-consent|fl-relay-collections|fl-relay-outbox|fl-relay-blocked]` (`relay.ts:4-9`, `shell.ts:59`), plus `photo-studio-account` JSON (`shell.ts:107`).
Workflows: primary `curate-glaze-ideas` (collections), `giveaway-entries`, `ask-price` (outbox `saltmarsh.goods 1`), `extend-studio-inspo`, `priya-tags`, `newest-likes`, `august-over-1300`, `kiln-notes`.

**Specs that open it**: none directly. `apps/extension/e2e/content/tests/evidence/tests/page-view-controls.spec.ts:33` lists it among its scenarios. Whether that spec opens it is unconfirmed.

---

## 2. social-network-feed (Circleway)

id `social-network-feed`; startPath `/scenarios/social-network-feed/`; seed 5101 (`scenario.ts:31-41`).
Signed in as Maya Lindqvist. The home page starts as 3 skeletons and no posts (`markup/home.ts:19-30`).

**Routes** (`route.ts:22-65`); anything else is a 404 "This content isn't available right now" (`markup/pages.ts:51-56`)
- `/` home feed (or the app interstitial in `app-install`) `home.ts:20`; `feed/?cursor=N` JSON batch `{html,next,caughtUp,texts}`
- `unit/<id>/` own-post markup; `groups/<slug>/` group page (`groups/feed/` → riverside); `groups/<slug>/<tab>/` same page; `groups/<slug>/pending/` pending box fragment
- `friends/`, `friends/<x>/` Friends home; `friends/requests/` all requests
- `posts/<id>/` post page (whole text); `people/<slug>/` profile; `pages/<slug>/` brand page
- `l/?u=` link shim; `app-store/`; `embed/<id>` video player (served with CSP `frame-ancestors`)

**Constructs**
- Text input: top search `input[type=search][placeholder="Search Circleway"]` (no label) `markup/shell.ts:87`. Poll options `input[aria-label="Option 1|2"]` `client/composer-script.ts:42`.
- Textarea: none (the editors are contenteditable).
- Native select / combobox: none.
- Checkbox: none.
- Radio: audience `[role=radio]` Public / Friends / Only me in the "Post audience" dialog (`aria-checked`) `composer-script.ts:104-116`.
- Password / payment: none.
- Email/tel: none.
- Contenteditable: composer `[role=textbox][contenteditable][aria-label="What's on your mind, Maya?"|"Write something..."|"Ask a question..."]` `composer-script.ts:37,44`; chat `[role=textbox][aria-label="Message"]` `client/shell-script.ts:153`.
- File input: none ("Photo/video" is a div with no file input) `home.ts:28`.
- Disabled: the composer Post `aria-disabled="true"` until text `composer-script.ts:44,51-55`; menu items `aria-disabled="true"` with a reason (Edit post / Edit audience / Move to archive on the boosted post) `client/unit-script.ts:72,99-102`; shim "Follow link" `span[aria-disabled=true]` `markup/standalone.ts:38`.
- Duplicate labels: "Friends" link twice (top bar `a[aria-label="Friends"]` and left rail text) `shell.ts:87,104`; every unit carries "Actions for this post", "Hide post", "Like" `markup/unit.ts:53,109`; two "Close" in the prompt and the chat (`aria-label=Close` vs "Close chat") `shell-script.ts:111,153`; "Add friend" in the carousel and on Friends home `unit.ts:162`, `markup/friends.ts:22`; "Not now" (notifications).
- Same-origin iframe: none.
- Cross-origin iframe: `iframe[title="ViewTube video player"][loading=lazy]`, with src on `context.alternateOrigin` + `embed/<id>` `unit.ts:91`, `home.ts:55`. The only video post is `p_5e1f38` (dev-patel) `content/units.ts:76`. Inside it: `[role=button][aria-label=Play]` and "Watch on ViewTube" `standalone.ts:47-49`.
- Shadow DOM: none.
- role=dialog: cookie dialog (no testids; "Decline optional cookies" / "Allow all cookies"; scrim z 90) `shell.ts:121-123`; "Turn on notifications?" (Not now / Turn on / Close) `shell-script.ts:135-146`; chat `role=dialog[aria-label="Chat with Elena Sokolova"]` `:152-169`; "Create post"/"Create poll" `composer-script.ts:44`; "Post audience" `:107`; "Move to your trash?" `unit-script.ts:117-127`; rate limit `role=alertdialog` "You're going too fast" `client/requests-script.ts:42`.
- Native alert/confirm/prompt: none.
- Consent overlay: server-rendered while `consent=pending` `shell.ts:53`; wired `shell-script.ts:119-129`.
- Obstructing overlay: chat fixed right 80px, 328x455 (`markup/stylesheet.ts:104`) over the feed's right strip; Minimise/Close chat `shell-script.ts:153-156`; app-install full-page promo `standalone.ts:14-21`.
- Delayed/lazy: first batch at 700 ms, later batches at 350 ms (`client/feed-script.ts:2`). Notifications prompt 3000 ms after the cookie answer, chat 2500 ms after that (`shell-script.ts:34,131-151`). Post first press spins 450 ms (`composer-script.ts:2`). Rate-limit countdown with a 250 ms tick (`requests-script.ts:45-53`).
- Infinite scroll: `[role=feed]`, 5 units/batch, loads when the sentinel is within 600 px (`feed-script.ts:5,61-65`). After the batch that finishes the new posts comes `h2` "You're all caught up", then "Suggested posts", then "No more posts to show right now" (`:47-54`). Units are `[role=article][aria-posinset=N][aria-setsize=-1]` (`unit.ts:46`).
- Pagination (Next control): none.
- Table/grid: none (friend cards are `[role=list] > [role=listitem]` `friends.ts:24,63`).
- Long page: the feed reaches caught-up after 30 units (15 in `quiet-feed`) (`types.ts:13-15`). The digest recording scrolls 14 times by 6000 (`manifest.ts:143`).
- Keyboard: `onPress` covers Enter/Space on every wired div `shell-script.ts:106-109`; Escape closes the post/share menu `unit-script.ts:89`.
- Hover: the timestamp `a[href*="/posts/"][aria-label]` shows a `role=tooltip` hover card with the full date `unit-script.ts:20-44`.
- New tab: `target=_blank` on link cards, ads and the right-rail ads, all via `l/` `unit.ts:89,119`, `shell.ts:110`.
- pushState: none. Full reload: app promo `location.reload()` `standalone.ts:19`.
- Validation errors: none (empty composer stays disabled).
- 404: see routes; a trashed post's page 404s `pages.ts:11-18`.
- Honeypot: composer `label` "Website" > `input[name="website"][tabindex=-1]`, off screen (`composer-script.ts:44`, `stylesheet.ts:96`). If filled, the post is counted as `spam` and the page looks the same (`state.ts:115,125`).
- Generated classes/ids: hashed classes; ids `:rN:` assigned on mount `shell-script.ts:67-90`; tracked hrefs carry `__cft__` tokens `markup/parts.ts:11-14`; "Sponsored" is written one letter per span with decoys `parts.ts:68-75`.
- Drift: "See more" replaces the message node with a new id (`unit-script.ts:141-154`). Confirm/Delete buttons are swapped for "Request accepted" + Message (`requests-script.ts:27-38`). A hidden post's children are replaced with "Hidden … Undo" (`unit-script.ts:128-134`). The pending box is refetched and replaced (`composer-script.ts:96-100`). Trash removes the article (`unit-script.ts:124`).
- Toggles: Like / Remove Like `aria-label` (`unit-script.ts:164-168`); comments count `aria-expanded` (`:182-190`); Add friend → "Request sent" (`:191-199`); stateful Post button (swallows its first press, `aria-busy` while spinning) (`composer-script.ts:65-77`). Also a stale Friends badge "4" (`content/requests.ts:32`) and a rate limit of 3 confirms per 15 s (`requests.ts:53`).
- Stable hooks: `testid:group-composer-prompt` (baseline group "Write something...") `markup/group.ts:45`; `testid:pending-posts` `group.ts:61`; `testid:build-marker` `shell.ts:104`; `testid:app-promo` `standalone.ts:16`.

**Variants** (`types.ts:20`; `manifest.ts:126-135,159-175`)
- `regrouped` (primary): `set-mode {mode:"regrouped"}`. The prompt and its testid are gone, replaced by Create post / Create poll / Create event `group.ts:44`.
- `quiet-feed` and `app-install` (feed-digest): `set-mode` with the same payload shape.

**Control/API**: mutate ops `set-mode, consent, notifications, chat, chat-message, app-promo, group-post, create-post, trash-post, hide-post, unhide-post, share-post, like, confirm-request, delete-request, add-friend, rate-limited` (`state.ts:44-106`).

**Oracle**: `testid:pending-posts` text (`group.ts:61-67`); `social-account-changes` JSON (`oracle/account-changes-subject.ts:2`, `oracle/account-changes.ts:20-35`); `social-friend-request-<id>` per request (`oracle/answers-subject.ts:8-10`); `social-request-audit-account` (`shell.ts:53`); `document` path; `build-marker`.
Workflows: primary `post-in-group`, `feed-digest`, `confirm-requests`, `move-open-day`, `audit-pending-requests`, `recent-group-posts`, `hide-suggested-posts`, `delete-stranger-requests`, `claim-found-key`.

**Specs that open it**:
- `apps/scenario-lab/e2e/social-network-feed.spec.ts`
- `apps/extension/e2e/content/tests/dialog-identity/tests/dialog-bound-identity.spec.ts`
- `apps/extension/e2e/content/tests/extraction/tests/social-read-completion.spec.ts`
- `apps/extension/e2e/content/tests/press-answers/tests/lasting-press-once.spec.ts`
- `apps/extension/e2e/content/tests/press-answers/tests/wake-press-post.spec.ts`
- `apps/extension/e2e/content/tests/safe-clearing/tests/social-feed-safe-clearing.spec.ts`
- `apps/extension/e2e/content/tests/evidence/tests/page-view-controls.spec.ts` (listed at `:33`; unconfirmed whether it opens it)

---

## 3. professional-network (Guildline)

id `professional-network`; startPath `/scenarios/professional-network/`; seed 4303 (`scenario.ts:15-25`).
Signed in as Rafaela Ionescu. The feed is the start page (`route.ts:20-22`). Ids are `emberNNN`, re-counted per page (`shell/ember-ids.ts:10-16`, `route.ts:13-17`).

**Routes** (`route.ts:32-61`; unknown paths return `undefined`, so the lab's own 404 applies — unconfirmed what that renders)
- `/` feed; `feed/fragment?offset=N` JSON; `search/results/all/?keywords=` mixed results; `search/results/people/?keywords&network=["S"]&geoUrn=[..]&currentCompany=[..]&page=N` people page
- `search/results/people/fragment?…` JSON (429 + Retry-After 5 when challenged) `route.ts:39-46`
- `mynetwork/`; `mynetwork/invitation-manager/` (received); `…/sent/[?invitationType=CONNECTION|ORGANIZATION|NEWSLETTER]`; `…/sent/fragment?invitationType&after=` JSON
- `ad/` ad document (iframed); `in/<slug>/` profile; simple pages `jobs/ messaging/ notifications/ premium/ premium/checkout/ app/ in/me/ settings/ signed-out/` `pages/simple-pages.ts:11-21`

**Constructs**
- Text input / combobox: global search `input[role=combobox][aria-label=Search]`; focus shows the Recent menu; Enter → `location.assign` to `search/results/all/` `shell/layout.ts:82-86`, `shell/client-script.ts:104-111`. Typeahead `input[placeholder="Add a location"|"Add a company"]`; after 300 ms, up to 5 `div` suggestions; a click prepends a checked checkbox `search/filter-bar.ts:64`, `search/people-client.ts:116-146`.
- Textarea: connection note `textarea[name=message][maxlength=300]` with a "0/300" counter `shell/dialogs.ts:46-47`, `client-script.ts:141`.
- Native select: none. Custom listbox: none (the pill dropdowns are divs).
- Checkbox: native `input[type=checkbox][name=network|geoUrn|currentCompany]` + `label[for]` 1st/2nd/3rd+, places, companies `filter-bar.ts:34-41`.
- Radio: none. Password: none.
- Payment: `premium/checkout/` `input[name=cardnumber][autocomplete=cc-number]`, `input[name=exp]` `simple-pages.ts:16`.
- Email: `a[href^="mailto:"]` in the Contact info dialog, first-degree only `pages/profile.ts:10,45`.
- Contenteditable: chat `[contenteditable][role=textbox]` + Send (sends a real message) `shell/overlays.ts:56`, `client-script.ts:88-97`.
- File input: none.
- Disabled: pager "Previous" `disabled` on page 1 `search/fragment.ts:33`.
- Duplicate labels: every filter checkbox label exists twice (dropdown + "All filters" dialog) `filter-bar.ts:43-50,77-85`; "Show results" in every dropdown (hence the spec's `>> visible=true`) `filter-bar.ts:69`, `manifest.ts:73`; "Manage" twice on My Network `network/my-network-page.ts:11-12,26`; per-row "Withdraw" / "Accept" / "Connect"; "Message" (card + profile); promoted profiles duplicate organic cards `search/results.ts:54-58`.
- Same-origin iframe: `iframe[title="Advertisement"]` src `ad/` in the news rail of most pages `shell/layout.ts:115`; its link targets `_top` `simple-pages.ts:36-38`.
- Cross-origin iframe: none.
- Shadow DOM: open shadow `gl-time-ago` ("Sent 3 weeks ago" exists only in the shadow) `client-script.ts:60-67`, `network/rows.ts:69`; declarative open shadow `gl-profile-section` Experience `pages/profile.ts:28-30`. Closed: none.
- role=dialog: withdraw `[role=dialog]` (baseline confirm `testid:withdraw-confirm` "Withdraw" beside Cancel) `shell/dialogs.ts:17-31`; connect "Add a note to your invitation?" (Add a note / Send without a note / Cancel / Send) `:39-52`; app prompt (unlabelled close + `div` "Not now", no role) `:59-67`; "All filters" `filter-bar.ts:83`; Contact info `profile.ts:44`; Premium upsell (mode) `search/people-page.ts:20-32`. Dialogs are toggled with `hidden`, not removed.
- Native alert/confirm/prompt: none.
- Consent overlay: fixed bottom banner, 96 px tall, z 1000, Accept / Reject buttons; blocks nothing but covers the pager and "Show more" `shell/overlays.ts:28-36`, `shell/styles.ts:60`.
- Obstructing overlay: app prompt scrim 2500 ms after load (feed, search pages) `client-script.ts:99-103`; conversation 336x400 fixed right 304px, 3500 ms in, "Close your conversation with Priya Nair" (vh text) `overlays.ts:50-57`, `client-script.ts:81`, `styles.ts:53`; messaging dock bottom right `styles.ts:48`.
- Delayed/lazy: people results +700 ms behind 5 skeletons, again on each page change `people-client.ts:43-59`, `people-page.ts:9-13`; feed sentinel +800 ms `pages/feed.ts:50-62`; first "Show more" never finishes, then after 1500 ms "Something went wrong. Retry"; Retry loads after 600 ms `network/manager-client.ts:47-62`.
- Infinite scroll: feed `IntersectionObserver` sentinel, 5/batch, ends "You're all caught up." `pages/feed.ts:30-65`.
- Pagination: numbered `section[aria-label="Search results"] li > button` + Previous/Next `.pager` buttons, 10/page `fragment.ts:27-35`, `results.ts:5`. Page 3+ repeats the previous page's last result `results.ts:59-60,70-73`. More than 3 fetches in 3 s gets the security check `div` "I'm not a robot" (no role), which retries itself after 5 s or 2 s after a click `rate-limit.ts:2-5`, `fragment.ts:50-62`, `people-client.ts:60-69`. Invitations: "Show more" button, 10/load `rows.ts:15`.
- Table/grid: none (results are `ul[role=list] > li[data-urn]`; promoted `li[data-ad-slot]`) `card.ts:63-69`.
- Long page / scroll container: dropdown list `max-height:260px;overflow:auto` `filter-bar.ts:68`; All filters body `max-height:60vh` `:84`.
- Keyboard: Enter on search submits (`client-script.ts:108-111`). Pills are `div[tabindex=0]` with click handlers only; keyboard activation is unconfirmed (none seen) (`filter-bar.ts:67`).
- Hover menus: none. Click menus: Me ▾ `client-script.ts:112`; profile More (Connect hidden here for Follow members) `profile.ts:39-40,59-60`.
- New tab: none found.
- pushState: people paging `history.pushState` + popstate `people-client.ts:47,97`. Full navigation: filter apply / Reset `location.assign` `:103-108,152`; Sent pills `manager-client.ts:23-25`.
- Validation errors: none (note maxlength only).
- 404/retired: see routes.
- Honeypot: connect dialog `.honeypot` `input[name=website][tabindex=-1]` with `label` "Website", `aria-hidden` wrapper `dialogs.ts:48`, `styles.ts:124`. If filled, the request is "sent" but not stored (`state.ts:101`).
- Generated classes/ids: per-seed classes; `ember` ids rotate per page and render.
- Drift: a withdrawn row fades and is removed, while the pill counts stay stale (`manager-client.ts:21,32`, `manager-page.ts:28-31`). Results innerHTML is replaced on every load (`people-client.ts:45,53`). Accept/Ignore rows are removed (`my-network-page.ts:45-46`).
- Toggles: Connect → Pending (Pending opens withdraw) (`people-client.ts:91-92`); Follow / Following (`:93`); dock body toggle (`client-script.ts:74-78`); chat minimise (`:83-87`).
- Name links: `a[href*="/in/"]` holds `span[aria-hidden]` name + vh "View X's profile" `card.ts:56`, `rows.ts:45-47`.

**Variants** (`types.ts:16`; `manifest.ts:148-156,174-183`)
- `redesigned-withdraw-dialog` (primary): `set-mode {mode:"redesigned-withdraw-dialog"}`. The confirm control loses its testid and becomes "Withdraw invitation" (first); "Keep invitation" withdraws nothing `dialogs.ts:21-25`.
- `premium-upsell` (people-search): `set-mode {mode:"premium-upsell"}`. Offer opens over the results once they load; close is an unlabelled icon or a `div` "No thanks"; "Start free trial" goes to checkout.

**Control/API**: mutate ops `set-mode, set-consent, dismiss-app-prompt, chat-bubble-seen, dismiss-upsell, withdraw-invitation, accept-invitation, ignore-invitation, send-invitation, send-message, search-hit, search-challenged` (`state.ts:33-84`). The results route self-mutates `search-hit` / `search-challenged` (`route.ts:43-45`).

**Oracle**: `script[type=application/json][data-testid=invitation-store]` = `{"received":[..],"sent":[..]}`, rewritten after every mutate `layout.ts:68`, `client-script.ts:46-51`, `store.ts:28-30`; `withdraw-confirm` exists; `document` path.
Workflows: primary `withdraw-month-old-requests`, `people-search` (23 people over 3 pages per the spec), `audit-stale-requests`, `netherlands-engineers`, `connect-kade-senior`, `accept-messaged-invitations`, `kade-lead-contact`. Weekly-limit notice shows while ≥20 pending connection requests are left `network/invitation-limit.ts:11,20-25`.

**Specs that open it**:
- `apps/extension/e2e/content/tests/extraction/tests/extract-list-continuation.spec.ts` (from `:133`)
- `apps/extension/e2e/content/tests/live-tasks/tests/professional-network-rotterdam-data-engineers.spec.ts`
- `apps/extension/e2e/content/tests/evidence/tests/page-view-controls.spec.ts` (listed at `:33`; unconfirmed whether it opens it)
