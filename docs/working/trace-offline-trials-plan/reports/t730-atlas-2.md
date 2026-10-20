# t730-atlas-2: atlas of job-board, local-classifieds, company-website

## Outcome

Done. This file is the atlas. Every locator was read from source in this worktree and is cited as
`file:line`. Paths are relative to `apps/scenario-lab/src/scenarios/<id>/` unless they start with
`apps/`. No browser or build was run, so timings and behaviour come from reading the code.

## What changed and why

Only this file was created. Other workers will use it to move content-script specs off synthetic
fixtures and onto these three realistic scenarios.

## Shared lab facts (all three scenarios)

- Page mutations: `POST /api/<scenarioId>/<operation>` with `Authorization: Bearer <runToken>`
  (`apps/scenario-lab/src/html.ts:34-42`, routed at `apps/scenario-lab/src/server.ts:78-87`).
- Control API: `GET /__control/health`, `GET /__control/final-state?scenario=<id>`, `POST /__control/reset` (`{}`),
  `POST /__control/seed` (`{seed}`), `POST /__control/arm` (`{scenarioId, variantId, workflowId?}`)
  (`apps/scenario-lab/src/control.ts:9-33`). Arming runs the variant's `set-mode`, which **resets the scenario's state**.
- A subpath the scenario's `route` returns `undefined` for is answered with JSON 404 `not_found` (`server.ts:96-97`).
- The cross-origin frame origin is `context.alternateOrigin`, the lab's second loopback port (`server.ts:61`).
- Each seed rebuilds every class name and generated id. Authored content does not change with the seed.

---

## 1. job-board (Rolefinch board + Talentloom ATS)

**id** `job-board` · **startPath** `/scenarios/job-board/` · **seed** 246 (`manifest.ts:74,78,79`; `scenario.ts:18-21`).

**Routes** (`route.ts:30-81`): `/` home (search form) `board/pages.ts:10-16` · `jobs?q&l&wp&sal&age&type&sort&limit&page`
results (counts toward rate limit) `route.ts:32-37`, params `catalog/search-query.ts:8-40` · `pane?jk=` job-pane fragment
`route.ts:38-43` · `viewjob?jk=` full job page `:44-47` · `myjobs` saved list `:48` · `pagead/clk?ad=` 302 to viewjob `:49-52`
· `rc/clk?jk=` "Leaving Rolefinch" interstitial, meta-refresh 2 s `:53-56`, `board/pages.ts:37-44` ·
`careers/<slug>/jobs/<REQ>` employer careers page `:57-58` · `careers/<slug>` open roles `:59-60` ·
`embed/job_app?for&token` (alt origin) `:66-72` · `embed/places?q` JSON `:73-75` · `embed/confirmation?app=` `:76-79`.

**Constructs**
- Text input: `input[name="q"]` (What) and `input[name="l"]` (Where). Their ids rotate with the seed. The form is a GET form, so Enter submits it (`board/results-page.ts:79-84`).
- Duplicate labels: "Find jobs" is both a header nav link (`board/shell.ts:63`) and the submit button (`board/results-page.ts:84`), so it needs `role:button:Find jobs`. Every card's heart is an identical label-less SVG `span` (`board/card.ts:33`, `board/shell.ts:89`), reached as `article[data-jk="<key>"] h2 + span` (`manifest.ts:21`). "Easily apply" is a span tag on cards (`card.ts:29`) and a button in the pane (`board/pane.ts:42`). "Sign in" appears in the header (`shell.ts:64`) and on the wall (`pane.ts:66`). Sponsored cards repeat organic titles (`card.ts:15-19`). The companies Halvard Systems and Halvard Labs are lookalikes (`expectations.ts:96-99`).
- Native select: `select[name="limit"]` (10/25/50). Changing it calls `location.assign` for full navigation (`results-page.ts:66`, `board/client-script.ts:205-206`). In the ATS frame: `select[name="phone_country"]` (aria-label Country, opens on +1), `select[name="sponsorship"]`, `select[name="notice"]`, `select[name="source"]` (`ats/embed-pages.ts:60,65,66,68`).
- Custom combobox/listbox: the ATS location lookup `input[name="location_text"]`. After a 300 ms debounce it fetches `places?q=` and renders `.tl-option` divs, which have no ARIA roles. A pick sets the hidden `location_id`; typed text is rejected. US "Bristol"s come first (`ats/embed-pages.ts:61`, `ats/form-script.ts:30-55`, `ats/places.ts:10-35`). The filter pills are buttons that open hidden menus of links ("Date posted", "Remote", "Salary", "Job type") (`results-page.ts:13-30,87-93`, `client-script.ts:177-185`).
- Checkbox: `input[name="talent_pool"]` is pre-checked and `input[name="privacy"]` is required (`ats/embed-pages.ts:69-70`). The consent "Manage choices" panel has checkboxes inside shadow DOM, one of them disabled (`board/widgets-script.ts:36`).
- Radio: no native radios. The work-rights question uses unlabelled `.tl-opt` "Yes"/"No" div pills that write `input[name="right_to_work"]` (`embed-pages.ts:64`, `form-script.ts:66-73`).
- Email/tel/sensitive: `input[type=email][name=email]`, `input[type=tel][name=phone]`, `input[name="salary_expectation"]` (`embed-pages.ts:58,60,67`). The job-alert modal has an unnamed `type=email` input (`client-script.ts:213`). There is no password field, no payment field and no contenteditable.
- File input: `input[type=file][name=resume]` is hidden. The "Attach" button calls `fileInput.click()`. The alternative is "Enter manually", which reveals `textarea[name="resume_text"]` (`embed-pages.ts:62`, `form-script.ts:57-64`).
- Textarea: `textarea[name="resume_text"]`, hidden until "Enter manually" is pressed (`embed-pages.ts:62`).
- Disabled control: the 429 page's "Try again in 5" button counts down and is then enabled (`board/pages.ts:28`, `client-script.ts:236-247`). The Shield's button reads "Please wait" for 3 s, then "I'm a person" (`form-script.ts:106-120`). Submit is disabled while sending (`form-script.ts:125`).
- Cross-origin iframe: `iframe[title="Talentloom job application"]` from the alt origin, with CSP `frame-ancestors http://127.0.0.1:*` (`ats/careers-page.ts:10,36`, `embed-pages.ts:9`). The recording addresses it as `frame:Talentloom job application/<inner>` (`manifest.ts:22`). There is no same-origin iframe.
- Open shadow DOM: `rf-consent` is the consent wall ("Accept all", "Reject non-essential", "Manage choices"→"Save my choices"). It removes itself once answered (`widgets-script.ts:18-51`). `rf-assistant` is the chat widget; its minimise control is `.fa-min`, an unlabelled en-dash (`widgets-script.ts:53-91`). There is no closed shadow root.
- Consent overlay: while `rf-consent` is up, the page drops every click, Enter/Space and submit made outside it (`client-script.ts:49-61`). The careers site has its own fixed bottom cookie bar ("Accept"/"Decline") that stays until answered (`careers-page.ts:54,66,76-80`).
- Obstructing overlays: a click on a control whose centre is covered is dropped (`client-script.ts:39-57`). Sources: the job-alert modal 4 s after a results page loads (no role, "No thanks", × close) (`client-script.ts:208-234`); the chat panel opening itself 6 s in, 380×min(74vh,560) px at bottom right, over the pane's apply link and heart (`widgets-script.ts:59-62,88`); the sign-in wall from the 4th pane until "Not now" (`route.ts:41`, `pane.ts:64-67`); the Talentloom Shield full-frame overlay, outside which clicks are dropped (`form-script.ts:26-28`).
- Role dialog/modal: none carry `role=dialog`. Toasts are `role=status` (`client-script.ts:66`). The ATS error line is `role=alert` (`embed-pages.ts:71`). There are no native alert/confirm/prompt calls.
- Delayed rendering: the pane skeleton shows for at least 700 ms (`client-script.ts:151`). The **second** pane opened on a page never loads: after 3 s it shows "This is taking longer than usual." with a Retry link (`client-script.ts:137-139,194`). The first save of each page load fails after 500 ms with "Couldn't save this job. Try again." (`client-script.ts:96-111`). Toasts last 4 s (`:73`). The fresh posting appears once results page 2 or later has been served (`route.ts:36`, `state.ts:66-69`).
- Pagination: the pager has numbered links, Previous and Next. **Next is broken past page 1**: it points at the current page (`results-page.ts:95-103`). The list shifts by one after page 2 because the fresh posting goes live (`results-page.ts:32-42`). Every 6th results page is a 429 with `retry-after: 5` (`route.ts:8,35`).
- Infinite scroll: none. Tables: none on the board. Results are `ol > li > article[data-jk]` (organic) or `article[data-ad]` (sponsored) (`card.ts:27-31`). The ATS receipt is `dl.tl-receipt` (`embed-pages.ts:93`).
- Scroll container: the job pane `aside` is sticky with `overflow:auto` (`board/styles.ts:51`). The chat log is `.fa-log{overflow:auto}` (`widgets-script.ts:65`). Long page: the careers iframe is 1760 px tall (`careers-page.ts:65`), and results run to 50 per page.
- Keyboard: Escape closes the job-alert modal (`client-script.ts:217-223`). Enter submits the search form (native) and the ATS form (`form-script.ts:159-167`). There are no arrow-key handlers.
- Hover menus: none; pill menus open on click. New tab: "Apply on company site" has `target=_blank` and goes to `rc/clk`, then the careers site (`pane.ts:41`). Recording step: `switchTab` (`manifest.ts:154`).
- pushState vs navigation: opening a pane does `history.replaceState` with `?vjk=` (`client-script.ts:133-135`). Filters, sort, pager and per-page cause full navigation. The ATS goes to `confirmation?app=` inside the frame (`form-script.ts:153`).
- Validation errors: `.tl-error` per row and a summary in `.tl-errors` ("Please fix N problems…") (`form-script.ts:75-105`).
- Redirect/retired: `pagead/clk` returns 302 (`route.ts:49-52`). A closed posting's pane shows `testid:posting-status` "No longer accepting applications" (`pane.ts:11,39`). A filled careers page reads "This position has been filled" (`careers-page.ts:37`). The closed embed reads "This job is no longer accepting applications" (`embed-pages.ts:80-82`). An unknown `jk` gets a 404.
- Honeypot: `input[name="confirm_email"]` in `.tl-hp`, off-screen, aria-hidden, tabindex -1 (`embed-pages.ts:28,59`). Filling it flags the application and gives no reference (`state.ts:102-107`).
- Generated names: classes come from `buildClassNames("rolefinch-<seed>")` (`board/classes.ts:26-28`). Element ids rotate (`classes.ts:31-35`). No control has a test id (`manifest.ts:11-19`).
- Drift/replacement: pane `innerHTML` is swapped on every load (`client-script.ts:132,151`). The consent host and alert backdrop remove themselves. Toasts are replaced.
- Toggles: the heart saves and, pressed again, unsaves. `hv2` is pre-saved, so it starts filled (`state.ts:13`). In `overflow-save` the heart follows the company, and save moves to the pane's "···" More menu (`card.ts:26`, `pane.ts:45-47`). The "Unsave job" heart on My jobs has `aria-label`, `role=button` (`board/my-jobs.ts:37`).

**Variants** (all `set-mode`): `overflow-save` on the primary workflow, payload `{mode:"overflow-save"}`: hearts follow companies (`manifest.ts:103-108`). `no-exact-matches` on remote-rust-roles, payload `{mode:"quiet-market"}`: one match remains (`:135-140`). `posting-closed` on apply-remote-rust-role, payload `{mode:"posting-closed"}`: m1 closed and three lookalikes shown (`:193-206`).

**Mutation ops** (`state.ts:47-93`): set-mode, consent{choice accepted|rejected}, careers-consent, dismiss-alert-offer, subscribe-alert{email}, minimise-chat, dismiss-wall, results-view, pane-view, save{key}, unsave{key}, follow/unfollow{company}, submit-application.

**Oracle subjects:** `saved-summary`, `saved-list` (`board/my-jobs.ts:40-41`, `expectations.ts:108-114`); `posting-status` (`pane.ts:39`); `application-reference` (`embed-pages.ts:93`); `job-closed-account` JSON script, `{saved,follows,alertSubscriptions,applicationCount}` (`board/shell.ts:68`, `qualification/facts.ts:19-21`, unchanged value `breadth/unchanged-account.ts:8`).

**Workflows:** save-halvard-week (primary), remote-rust-roles, apply-remote-rust-role, remove-closed-saved-jobs, remote-easy-apply, save-quillmark-remote, halvard-labs-office-jobs, halvard-careers-roles (`manifest.ts:92,111,143,208-212`).

**Specs that open it:** `apps/extension/e2e/content/tests/evidence/tests/controls.spec.ts:162`, `.../evidence/tests/icon-controls.spec.ts:39-42`,
`.../evidence/tests/page-view-controls.spec.ts:31-33,210` (loops over all ten), `.../evidence/tests/shadow-overlays.spec.ts:43`,
`.../extraction/tests/job-board-listing.spec.ts:59-175`, `.../extraction/tests/structure-detection.spec.ts:70-72`,
`.../shadow-roots/tests/shadow-root-controls.spec.ts:72-169`, `.../shadow-roots/tests/shadow-root-targets.spec.ts:64-108`,
`.../shadow-roots/tests/shadow-root-waits.spec.ts:23-103`. (`actionability-gate.spec.ts:21` and `pagination-stop.spec.ts:3` only mention it in comments. They open bigbox-retail, file-transfer and basic-form.)

---

## 2. local-classifieds (Kerbfind Marketplace, Kelford)

**id** `local-classifieds` · **startPath** `/scenarios/local-classifieds/` · **seed** 44 (`manifest.ts:74,78,79`; `root.ts:2`; `scenario.ts:21-24`).

**Routes** (`route.ts:23-59`): `/` front page "Today's picks" (`scenario.ts:28`) · `browse/` `:26` · `search/?query&minPrice&maxPrice&radius&itemCondition&daysSinceListed&sortBy&deliveryMethod&availability` `:27` (params `catalog/query.ts:35-54`) · `category/<slug>/` `:28-32` (slugs `catalog/categories.ts:4-15`) · `feed.json?surface&batch&...` `:33,67-87` · `item/<16 digits>/` listing page `:46` · `item/<id>/detail.json` `:38-41` · `item/<id>/receipt.json` `:42-45` · `saved/ inbox/ buying/ notifications/ selling/` `:12,48-49` · `people/?q=` `:50` · `ad/<id>/` advertiser shop `:51-55` · `map/<placeId>/` (alt origin) `:56-57`.

**Constructs**
- Search inputs, a lookalike pair: the top bar's `role:searchbox:Search Kerbfind` goes to the people search (`view/shell.ts:53`, `client/shell-script.ts:76-79`). The sidebar's `role:searchbox:Search Marketplace` searches listings on Enter (`shell.ts:68`, `shell-script.ts:80-86`).
- Text input: the price boxes `input[placeholder="Min"]` and `input[placeholder="Max"]` have no label. They apply on Enter or change; a bad value toasts "Enter a price in whole pounds." (`view/filters.ts:36`, `client/feed-script.ts:138-148`). The listing message box `role:textbox:Message` comes prefilled with "Hi, is this still available?" (`view/listing.ts:65-66`). The offer amount `role:textbox:Your offer` comes prefilled with the asking price (`client/listing-script.ts:78-79`).
- Textarea: "Add a message (optional)" in the offer dialog (`listing-script.ts:81-82`).
- Contenteditable: the chat reply box is `div[role=textbox][contenteditable][aria-label="Message"]`, so it shares the name "Message" with the listing message input (`client/chat-script.ts:31`).
- Native select: `role:combobox:Radius` inside the `kf-location` shadow root (`client/location-element.ts:36`). `role:combobox:Sort saved items` on saved/, with options recent/price_ascend/price_descend; it reorders rows in place (`view/saved.ts:43-48`, `client/saved-script.ts:13-18`).
- Custom combobox/listbox: Sort by is `div[role=combobox]` (labelled "Sort by"). Opening it inserts `div[role=listbox]` with `div[role=option]` children ("Suggested", "Price: lowest first", …) (`filters.ts:31-32`, `feed-script.ts:118-136`, `catalog/options.ts:12-18`).
- Checkbox: Item condition boxes `role:checkbox:New`, `Used – like new`, `Used – good`, `Used – fair` sit inside a folded panel (`filters.ts:19-20,38`).
- Radio: Date listed (All / Last 24 hours / Last 7 days / Last 30 days), Availability and Delivery method, also inside folded panels. Group names are generated ids (`filters.ts:21-22,39-41`).
- Folded toggles: `div[role=button][aria-expanded]` "Item condition", "Date listed", etc. Enter/Space work (`filters.ts:23-26`, `feed-script.ts:150-156`).
- Div buttons everywhere: `role=button` divs activate on click, Enter or Space (`shell-script.ts:29-32`).
- Sensitive: there is no password, card or email field. Making an offer is consequential: it sends money intent to a seller (`state.ts:100-110`). The honeypots are below.
- Disabled control: no `disabled` attribute anywhere (grep), so treat as unconfirmed/absent.
- Duplicate/ambiguous targets: the two search boxes above. "Message" appears three times (the action-row button `listing.ts:76`, the input label `:65`, the chat box). "More options" appears as `···` on the listing (`listing.ts:79`) and as "More options for <title>" on each saved row (`saved.ts:36`). Adverts use the same card component as listings (`view/card.ts:15-38`). One listing is sent twice across batches (`catalog/feed.ts:35-39`).
- Cross-origin iframe: `iframe[title="Map"]` with `loading=lazy`, from the alt origin, on the listing page (`listing.ts:87`, `route.ts:11,56-57`). Same-origin iframe: none. On arrival the front page has `iframe-count` 0 (`manifest.ts:18`).
- Open shadow DOM: `kf-location` holds a chip `role:button:Kelford · Within 20 mi`, a `role=dialog` "Change location", a readonly Location input, the Radius select, Cancel and Apply. **Apply swallows the first press after a change**; the second press applies. It fires a composed `radiuschange` event (`location-element.ts:17-75`). It appears on the results filters (`filters.ts:29`) and on the front page (`view/results.ts:18`). Closed shadow: none.
- Consent overlay: `role=dialog` "Allow the use of cookies…" with div buttons "Decline optional cookies" and "Allow all cookies" (`shell.ts:98-110`, `shell-script.ts:63-74`). In the `location-check` mode a second dialog follows, `testid:marketplace_location_prompt`, with "Yes, that's right" and "Change location" (`shell.ts:111-120`).
- Role dialog/modal: the notifications prompt "Turn on notifications?" ("Not now" / "Turn on") arrives notifyDelay (1600–3000 ms, by seed) after the page settles (`shell-script.ts:89-103`, `pages/document.ts:29`). The offer dialog "Make an offer" has `role:button:Close` (×), Cancel and "Send offer" (`listing-script.ts:71-113`). The chat dock is `role=dialog` (`chat-script.ts:24`). No native alert/confirm/prompt.
- Obstructing overlay: the chat from Alex Rowe opens chatDelay (900–1600 ms) after the page settles, on the first listing page of a session. It covers Make offer and the message box, and any click on it focuses its reply box. `role:button:Close chat` is named; minimise is an unnamed dash (`chat-script.ts:15-55`, `view/stylesheet.ts:132-133`, `document.ts:30`). The sticky action bar holds the message box and Make offer (`listing.ts:99-103`, `stylesheet.ts:112`). The sticky top bar and sidebar are at `stylesheet.ts:23,36`.
- Delayed/lazy: listing details arrive after detailDelay (500–1000 ms) behind an `aria-busy` skeleton, and nothing in the panel exists before then (`listing.ts:33`, `listing-script.ts:141-146`, `document.ts:31`). Feed batch latency is 250–500 ms (`document.ts:32`). Card images use `loading=lazy` (`card.ts:43`).
- Infinite scroll: batches of 6 load as `loadMore` comes within `innerHeight+300` (`catalog/feed.ts:7`, `feed-script.ts:95-101`). One batch per list fails once with "Couldn't load more listings." and a **span** "Try again" that is not a button (`route.ts:83-84`, `feed-script.ts:66-72`). After the last batch comes "Results outside your search" with more cards of the same kind and no end marker (`view/feed.ts:16-22`). The 4th new search within 10 s gets a `role=alert` "Checking your browser" cover; Continue shows after 1 s and it clears itself at 2.5 s (`limits.ts:17-19,27-31`, `feed-script.ts:73-94`).
- Pagination: none. Tables: none. Feed root: `section[aria-label="Collection of Marketplace items"]` (`view/results.ts:21`, `script/results.ts:6-12`). The count is stale and never recomputed (`results.ts:11-17`).
- Scroll containers: the sidebar (`stylesheet.ts:36`), the listing panel's inner div (`:93-94`) and the chat body (`:137`). Long page: the feed.
- Keyboard: Enter on search boxes and price boxes; Enter/Space on div buttons. No Escape or arrow-key handlers (grep).
- Hover menus: none. New tab: advert cards have `target=_blank` to `ad/<id>/` (`card.ts:34,37`), where "Buy now" is somebody else's checkout (`view/standalone.ts:9-21`).
- pushState vs navigation: every filter change does `history.pushState` and restarts the feed; popstate does a full reload (`feed-script.ts:103-114`). Searches and sidebar links are full navigations.
- Validation errors: the offer amount must be 1…2×price, else "Enter an amount between £1 and £N." in `role=alert` (`listing-script.ts:83,95-101`). Rate limit: contacting again within 8 s is refused with a "You're sending messages too quickly…" toast (`limits.ts:16`, `listing-script.ts:62-69`).
- Retired/404: a sold listing shows "This item has been sold." instead of the contact controls (`listing.ts:63`). An unknown item id or category gets a 404 (`route.ts:31,37`).
- Honeypots: `input[name="company"]` in the message box (`listing.ts:67`) and `input[name="website"]` in the offer dialog (`listing-script.ts:80`), both off-screen (`stylesheet.ts:131`). Filling either means the offer or message is accepted but not delivered (`state.ts:107,117`).
- Generated names: classes and ids come from `classifiedsClasses`/`classifiedsIds(seed)` (`view/classes.ts:35,61`). Shadow classes are seeded too (`document.ts:46,52`). The only control test id is `marketplace_pdp_save` (`listing.ts:37-41,54`).
- Drift/replacement: the feed grid is emptied on each filter change (`feed-script.ts:107`). The listing panel is replaced when details arrive. Apply in the shadow root is cloned and replaced (`location-element.ts:56`). The sort listbox is created and removed on each open and close.
- Toggles: Save is `div[role=button][aria-pressed]` "Save"/"Saved"; pressing it again unsaves (`listing.ts:54`, `listing-script.ts:42-55`). The sidebar `marketplace_saved_badge` stays stale after a save (`shell.ts:39-41,75`). In `moved-save`, the heart is `role:button:Add to saved items` and "Hide" sits where Save was (`listing.ts:23,52-54`). "See more" span-button on descriptions (`listing.ts:106-112`). Saved-row "···" opens `role=menu` "Remove from saved items" (`saved-script.ts:19-35`).

**Variants** (all `set-mode`): `list-layout` (bike-search): rows replace tiles, and the link wraps only the title (`manifest.ts:153-162`, `card.ts:44-46`). `location-check` (bike-search): the location dialog appears after consent (`manifest.ts:163-172`). `moved-save` (save-dining-tables): Save moves to the heart and Hide takes its place (`manifest.ts:200-209`). The primary offer workflow has no variant.

**Mutation ops** (`state.ts:45-78`): set-mode, consent{all|essential}, notifications{not-now|turn-on}, location-check{confirm|change}, chat{state}, save{listingId,saved}, hide{listingId}, send-offer{listingId,amount,note,website}, send-message{listingId,text,website}, pass-check, feed-request, batch-failed, view.

**Oracle subjects:** `marketplace_buying_count` (`shell.ts:73`), `marketplace_saved_badge` (`:75`), `marketplace_offer_receipt` (`listing.ts:59`), `marketplace_conversation` (`:61`), `marketplace_saved_total` (`saved.ts:42`), `marketplace_location_prompt`, `marketplace_pdp_save` (existence), `document` path and iframe-count (`manifest.ts:15-30`), and the JSON scripts `classifieds-sold-saves-account` and `classifieds-account-contacts` (`pages/document.ts:72-73`, `breadth/facts.ts:7`).

**Workflows:** offer-on-folding-bike (primary), bike-search, save-dining-tables, remove-sold-saves, furniture-nearby, test-ride-question, carbon-price-check, alex-budget-bikes (`manifest.ts:100,114,176,212-216`).

**Specs that open it:** `apps/scenario-lab/e2e/local-classifieds.spec.ts:135-304`,
`apps/extension/e2e/content/tests/live-tasks/tests/local-classifieds-bike-search.spec.ts:254-313`,
`.../evidence/tests/page-view-controls.spec.ts:31-33,210`, `.../shadow-roots/tests/shadow-root-targets.spec.ts:137-145` (radius select).

---

## 3. company-website (Kestrel Lane Heating & Plumbing + Slotwise widget)

**id** `company-website` · **startPath** `/scenarios/company-website/` · **seed** 4519 (`manifest.ts:178,182,183`; `scenario.ts:26-28`).

**Routes** (`route.ts:17-40`): `/` home with the quote drawer (`scenario.ts:32`, `pages/home.ts:19-45`) · `team` `:20` · `team/people?branch&offset` batch fragment (rate-limited) `:21` · `services` `:22` · `services/prices?basis=inc|ex` fragment `:23-26` · `branches` `:27` · `newsletter` `:28` · `directions?branch=` (records open-directions) `:29-33` · `book` `:34` · `booking-widget` (alt origin) `:35` · `booking/confirmed?ref=` `:36` · `quote/received?ref=` `:37`.

**Constructs**
- Text input, email and tel: the quote drawer's step 1 has `input[name="fullName"]` (Full name), `input[name="email"]` type=email, `input[name="phone"]` type=tel and `input[name="postcode"]`. Ids are generated `:rXXX:` (`pages/quote-drawer.ts:42-44,60-63`, `styles.ts:43-45`). Slotwise details (in frame): `input[name=fullName|email|phone|postcode]` (`client/widget-script.ts:67-70`). The newsletter modal has `input[name="newsletterEmail"]` (`client/shell-script.ts:64`). The newsletter page form has `input[name="email"]` (`pages/newsletter.ts:27`).
- Textarea: `textarea[name="details"]`, "Tell us about the job (optional)" (`quote-drawer.ts:74-75`).
- Custom listbox: the service picker is a faux select `div` "Choose a service" plus a list of `div[data-value]` options with no ARIA roles. Click, Enter or Space toggles it; the choice writes a hidden `input[name="service"]` (`quote-drawer.ts:69-73`, `client/quote-script.ts:55-66`). Native select: none.
- Radio: `input[name="contactBy"]` Phone/Email/"Text message", starting on Phone, inside `role=radiogroup` "How should we get back to you?" (`quote-drawer.ts:46,76`, `data/quote-options.ts:13`).
- Checkbox: `input[name="marketing"]` is pre-checked; `input[name="privacy"]` is required (`quote-drawer.ts:82-83`). The consent Customise panel has checkboxes, one disabled (`pages/shell.ts:152-156`).
- Payment/sensitive: the Slotwise pay step shows "Card: Visa ending 0000, saved on this device" and a "Confirm and pay £30.00" button. It takes a deposit, so it is consequential (`widget-script.ts:71-78`). There is no card number input, no password, no contenteditable and no file input (grep).
- Disabled controls: the drawer's Back is `disabled` on step 1 (`quote-drawer.ts:89`, `quote-script.ts:33`). Full Slotwise slots are `div[role=button][aria-disabled="true"]`, struck through; clicking one gives "That time is fully booked." (`widget-script.ts:59,117`).
- Duplicate labels: "Get a free quote" appears as the header button (`shell.ts:60`), the hero button (`home.ts:32`) and the services-page span (`services.ts:25`), plus the footer span "Request a quote" (`shell.ts:122`). The recording disambiguates with `header button:text-is(...)` (`manifest.ts:46`). "Continue" appears on the drawer and the winter notice ("Continue to site"). Two people are named James Whitlock, at different branches (`data/team.ts:43,47`). Leadership cards are repeated in the strip and the grid (`data/team.ts:24-30`, `pages/team.ts:20,26`). The hiring advert uses the person-card markup ("Could this be you?") (`data/team.ts:54`, `pages/person-card.ts:18`).
- Cross-origin iframe: `iframe[title="Slotwise booking"]` from the alt origin, with widget CSP `frame-ancestors` loopback (`pages/book.ts:17,21`, `pages/booking-widget.ts:9`). The recording uses `frame:Slotwise booking/` (`manifest.ts:121`). The widget posts `slotwise:booked` and the top page navigates to `booking/confirmed` (`book.ts:22-26`, `widget-script.ts:101`). A postMessage relay updates the account oracle (`shell.ts:77-96`, `booking-widget.ts:66-100`). Same-origin iframe: none (home page `iframe-count` 0, `manifest.ts:31`).
- Open shadow DOM: the consent banner is a **declarative** shadow root (`template shadowrootmode="open"`) on the host `[data-testid="cookie-consent"]`. It covers the viewport and holds `role=dialog` "Your privacy choices" with buttons Customise, "Reject non-essential" and "Accept all" (`shell.ts:135-163`, `shell-script.ts:31-48`). The chat widget is an imperative open shadow root on an anonymous fixed host div. Its greeting card appears at 1.8 s at bottom right, over consent's "Accept all" and the drawer's submit, and closes via `div[title="Close"]`; launcher `div[title="Chat"]`, panel input "Type a message" (`shell-script.ts:13,85-128`). Closed shadow: none.
- Role dialog/modal: the quote drawer `section[role=dialog][aria-modal]` "Get a free quote" closes with a × div (no name) or a scrim click (`quote-drawer.ts:51-54`, `quote-script.ts:23-28`). The newsletter modal `[aria-label="Newsletter"]` opens 4 s after consent, with "Subscribe", "No thanks, I will pay full price" (a span) and × (`shell-script.ts:11,50-83`). The winter notice `[data-testid="winter-notice"]` dialog has "Continue to site" (`shell.ts:165-172`). No native alert/confirm/prompt.
- Obstructing overlays: the consent host has `z-index:2147482000` (`shell.ts:139`), the chat greeting `z-index:2147483000` (`shell-script.ts:87`) and the header is sticky (`styles.ts:56`). Human check: after the submit is pressed, "Checking you are human…" spins for 2.2 s, then a "Confirm you are human" div must be clicked (`quote-script.ts:5,68-77`).
- Delayed/lazy: team grid batches of 8 load through an IntersectionObserver sentinel behind skeletons (held 450 ms), 3 automatically. Then a "Show more people" button **needs two presses**: the first only shows a spinner (`client/team-script.ts:5,26-70`, `data/team.ts:63,69`). The team endpoint returns 429 to a second request within 900 ms (`retry-after: 2`); the page waits and retries, showing a `role=status` line (`pages/team-batch.ts:8-28`, `team-script.ts:35-40`, `team.ts:31`). The price list loads after 700 ms behind skeletons (`client/services-script.ts:4,18-29`).
- Infinite scroll: yes, the team grid, which ends at "That is everyone." (`team-script.ts:51`). Pagination: none.
- Tables: the price list has one `table` per category accordion, with `thead` Service / What is included / Price and `th scope=row`. Partner rows carry a `span` "Sponsored" (`pages/services.ts:35-43`). The recording reads `column:Service`, `column:Price` (`manifest.ts:105,116`). Branch hours tables (`branches.ts:12-13`). The newsletter subscriptions table (`newsletter.ts:19-21`). Confirmations are `dl` with `dt`/`dd` testids (`booking-confirmed.ts:22-33`, `quote-received.ts:23-38`). The Slotwise calendar is a 7-column div grid (`widget-script.ts:51-66`).
- Long page / scroll containers: the team page needs scrolls of 4000 px (`manifest.ts:89-91`). The drawer body has `overflow:auto` (`styles.ts:120`). The faux-select list has `max-height:14rem; overflow:auto` (`styles.ts:133`).
- Keyboard: Enter/Space opens the faux select (`quote-script.ts:58`). The newsletter page form submits on Enter (native `submit` handler, `client/newsletter-script.ts:8-17`). No Escape or arrow handlers (grep).
- Hover menus: none (CSS `:hover` only, `styles.ts:135`). New tab: "Get directions" has `target=_blank` to `directions?branch=` (`branches.ts:13`).
- pushState vs navigation: no pushState. Quote-open controls on non-home pages go to `/#quote`, which opens the drawer (`shell.ts:108-114`, `quote-script.ts:28`). Quote submission does `location.href` to `quote/received` (`quote-script.ts:87`). The newsletter page reloads after each change.
- Validation errors: step 1 errors "Enter your full name", "Enter an email address like name@example.com", "Enter a UK phone number" (needs at least 10 digits) and "Enter a full postcode"; step 2 "Choose what you need"; step 3 "Tick the box so we can contact you…" (`quote-script.ts:39-51`). The newsletter page shows "Enter a valid email address." (`newsletter-script.ts:13`). The Slotwise per-step error shows in its `.error` div (`widget-script.ts:85-91`).
- Retired/404: `quote/received` with an unknown or no ref shows a generic "Thank you" (the spam-filter path) (`quote-received.ts:19-22`). A booking that cannot be found shows "We could not find that booking" (`booking-confirmed.ts:17-20`). An unknown subpath or a bad directions branch gets a 404 (`route.ts:31,38`).
- Honeypot: `input[name="companyWebsite"]` in an off-screen aria-hidden div (`quote-drawer.ts:64`, `styles.ts:80`). Filling it discards the quote (`state.ts:83`). An unverified submit is discarded too (`state.ts:84`).
- Generated names: classes come from `buildClassNames("kestrel:<build>:<seed>")` (`styles.ts:34-35`). Consent classes are hashed separately (`shell.ts:137`), as are chat classes (`shell.ts:37`) and widget classes (`booking-widget.ts:26`). Ids look like `:rXXX:` (`styles.ts:43-45`). The only control test id is `quote-submit` (`manifest.ts:15-18`, `quote-drawer.ts:50`).
- Drift/replacement: the Slotwise widget re-renders its whole root on every click (`widget-script.ts:79-83`). The VAT switch re-fetches and redraws every table (`services.ts:9-13`, `services-script.ts:44-49`). A chip choice empties the team grid and reloads it (`team-script.ts:71-81`). The drawer's step fieldsets hide and show.
- Toggles: the VAT switch divs `[data-basis]` "Homeowners (inc. VAT)" / "Landlords & business (ex. VAT)" (`services.ts:22`). Accordion buttons are `aria-expanded` (`services.ts:41`, `services-script.ts:30-43`). The team chips `[data-filter]` are divs with stale counts (`team.ts:21-22`, `data/team.ts:77`). "About <first name>" bio toggles (`person-card.ts:19`, `team-script.ts:82-87`).

**Variants** (all `set-mode`): `redesigned-quote-submit` (primary): `quote-submit` is gone; the real submit is the header button "Get my free quote", and "Save and finish later" (files a draft) stands where it was (`manifest.ts:202-211`, `quote-drawer.ts:47-50`, `quote-script.ts:90-100`). `winter-notice` (gas-engineers): the notice opens on every page (`manifest.ts:226-235`).

**Mutation ops** (`state.ts:33-69`): set-mode, set-consent{all|essential}, dismiss-newsletter, subscribe-newsletter{email}, unsubscribe-newsletter{email}, dismiss-chat-greeting, open-chat, dismiss-notice, record-team-batch, throttle-team-batch, save-quote-draft, submit-quote, book-slot (requires `payDeposit:true`, else refused, `state.ts:132`), open-directions.

**Oracle subjects:** `cookie-consent` (visible), `winter-notice`, `quote-submit` (exists), `quote-reference|service|contact|marketing|postcode|details` (`quote-received.ts:27-37`), `booking-reference|branch|service|date|time|engineer|deposit` (`booking-confirmed.ts:26-32`), `document` path/iframe-count (`manifest.ts:29-42,199`), and `company-review-account` JSON `{bookingCount,deposits,quoteCount,subscriberCount,discarded,drafts,refusedBookings}` (`shell.ts:68`, `booking-widget.ts:63`, `qualification/expected.ts:4`).

**Workflows:** quote-request-received (primary), gas-engineers, business-prices, book-service, review-service-without-booking, apprentices, newsletter-signup, saturday-certificate, heat-pump-quote (`manifest.ts:187,214,238,252,268-272`).

**Specs that open it:** `apps/extension/e2e/content/tests/activity-overlay/tests/activity-overlay.spec.ts:20`,
`.../evidence/tests/page-view-controls.spec.ts:31-33,210`, `.../own-layer/tests/company-website-layers.spec.ts:59-119`,
`.../own-layer/tests/widget-over-consent.spec.ts:27-31`, `.../reveal-by-scroll/tests/company-website-team-more.spec.ts:45-77`,
`.../shadow-roots/tests/shadow-root-targets.spec.ts:121-129`.

---

## Constructs none of the three offer

- Password field.
- Card-number input. The closest is Slotwise's saved-card pay step.
- Closed shadow root.
- Native `alert`/`confirm`/`prompt`.
- Hover-opened menus.
- Arrow-key handlers.
- Same-origin iframe.
- HTML `<select>` on company-website.
- File input outside the job-board ATS frame.
- Contenteditable outside the local-classifieds chat.

## Commands run and observed results

- `find <scenario> -type f | xargs wc -l` for each scenario listed 61, 78 and 63 source files.
- `cat -n` on manifests, routes, state, views, client scripts and pages, read in full. Line numbers above come from that output. For files I read together in one batch, I converted the combined numbering back to each file's own lines.
- `grep -rlE "job-board|local-classifieds|company-website" apps/extension/e2e apps/scenario-lab/e2e` returned 17 files. Grepping each for `openHarness(`/`goto(` showed that two of them (`actionability-gate.spec.ts`, `pagination-stop.spec.ts`) only mention these scenarios in comments.
- `grep` for password, contenteditable, file inputs, native dialogs, hover, closed shadow, ArrowDown, Escape and disabled across the three scenarios. Results are reflected under Constructs and in the "none of the three" list.
- No browser or build was run, as the brief required.

## Not verified

- Live timing and layout: whether the chat or greeting actually covers a given control at the default viewport, and the seed-specific delays (notify/chat/detail/latency) for seed 44.
- Exact accessible names as a browser computes them (for example the condition checkbox text including the leading space, and the en dash in "Used – like new").
- Where adverts, the repeated listing and the failing batch fall for a given query (seed-dependent, `catalog/feed.ts:25-43`).
- Breadth/qualification recording scripts beyond their ids and oracle subjects.

## Open questions or contradictions found

- local-classifieds `state.ts` names the honeypot payload `website`, but the listing message box's honeypot input is `name="company"`. The page sends its value as `website` (`listing-script.ts:130-131`). This is consistent in behaviour; only the DOM names differ, and a spec author should target the DOM name.
- job-board's alert offer and the job pane have no `role=dialog`, so dialog-detection specs need local-classifieds or company-website.
