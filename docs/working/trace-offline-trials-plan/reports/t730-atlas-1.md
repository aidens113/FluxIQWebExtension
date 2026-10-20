# t730-atlas-1: Realistic scenario atlas, part 1

Covers everything-store, crossborder-marketplace, bigbox-retail and auction-marketplace.

## Outcome

Done. This is the atlas itself. I built it by reading the source, without running a browser or a build.

## What changed and why

I created this file and changed nothing else. Content-script spec retargeting needs a map of which constructs each realistic site actually offers, where they are, and how they behave.

## Commands run and observed results

The only commands were read-only `find`, `cat -n` and `grep` over `apps/scenario-lab/src/**` and `apps/extension/e2e/**`, plus Read on the scenario files. No tests ran because the brief asked for none.

## Not verified

- Nothing was exercised live: timings, overlap and layout are as the source states them.
- I did not open the in-scenario tests' bodies. I only listed the files that import a browser harness.
- Where a line says "unconfirmed", I did not find it in the files I read.

## Open questions or contradictions found

- No scenario of the four has `contenteditable`, a closed shadow root, a native `alert`, `confirm` or `prompt`, a `pushState` navigation, or an unhidden file input. Specs that need these cannot be served by these four sites.
- Everything-store's only iframe is same-origin. Cross-origin (second loopback origin) frames exist only in bigbox-retail (card form) and auction-marketplace (seller description).
- `shadow-root-in-place.spec.ts` and `extract-list-continuation.spec.ts` mention bigbox only in comments. They open no page on it.

---

## Shared lab facts (all four)

File and line citations are relative to `apps/scenario-lab/src/`.

- **Two origins.** The lab starts a second loopback server and passes its origin to pages as `RenderContext.alternateOrigin` (`server.ts:77-87`, `types.ts:90-94`).
- **Page mutations.** Pages call `mutate(op, payload)`, which sends `POST /api/<scenarioId>/<op>` with a bearer run token (`html.ts:30-42`, `server.ts:123-131`).
- **Control endpoints.** All need `Authorization: Bearer <runToken>` (`control.ts:6-38`):
  - `GET /__control/health`
  - `GET /__control/final-state?scenario=<id>` returns the oracle snapshot `{state, variant, provenance}`.
  - `POST /__control/reset` with body `{}`
  - `POST /__control/seed` with body `{seed}`
  - `POST /__control/arm` with body `{scenarioId, variantId, workflowId?}`. A workflow-level variant needs its `workflowId` (`state-store.ts:37`).
- **Unknown routes** return `undefined`, which the server turns into a 404 JSON `{"error":"not_found"}` (`server.ts:142-143`).

---

## 1. everything-store ("Brightaisle")

**Identity.** id `everything-store`; startPath `/scenarios/everything-store/`; seed `241` (`scenarios/everything-store/scenario.ts:21-24`). All further paths in this section are relative to `scenarios/everything-store/`. The seed renames every class and every `:rXXXXX:` id (`style/classes.ts:35`, `style/element-ids.ts:18-21`).

**Routes** (`route.ts:62-87`, `catalog/store-paths.ts:12-24`). Base is `/scenarios/everything-store`.

| Path | Page |
| --- | --- |
| `/` | Home: hero carousel and 4 tiles |
| `/s?k=&i=&rh=plus,stars-4,price-*,brand-*&low=&high=&s=&page=` | Results page, 16 per page (`catalog/results-page.ts:5-6`) |
| `/s/more?...` | Lazy results fragment |
| `/<slug>/dp/B0XXXXXXXX`, or bare `/dp/<sku>` | Product page. Kettles: `B0D7KX2M4P`, `B0D7KX9MBL`, `B0D7KXS4G7`, `B0D7KX1B10`, `B0D7KX1M10`, `B0D7KX1S10` (unavailable) (`catalog/kettles/tidewell-kettles.ts:8-13`) |
| `/cart` | Cart page |
| `/cart?part=main`, `/cart/summary` | Cart fragments |
| `/checkout` | Checkout |
| `/checkout/payment-frame` | Payment frame |
| `/thankyou?orderId=` | Order confirmation |
| `/sspa/click?adId=&url=` | 302 redirect to the advertised product |
| `/img/<sku>.svg` | Product image |

Defences on `/s`, in the order applied (`route.ts:35-51`):
1. A filled honeypot gets the robot check.
2. More than 5 results pages in 8 s gets a 429 with `Retry-After`. Three refusals flag the session (`state/throttle.ts:11-14`).
3. The session's first search gets the soft check at the same URL.
4. Otherwise, the results.

While the robot check is active, every page is replaced by it (`route.ts:75`).

**Constructs** (locator, then behaviour):

*Inputs*
- **Text inputs**
  - Header search box: `label "Search Brightaisle"`, `input[name=k]`, placeholder "Search Brightaisle" (`pages/header.ts:37`). Typing 2 or more characters opens the suggestion list.
  - Price range: label "Minimum price" / "Maximum price", `name=low`/`high` (`pages/results/filter-rail.ts:39-40`).
  - ZIP code in the Deliver-to popover (`client/shell-script.ts:190`).
  - Captcha "Type characters" (`pages/challenges/robot-check.ts:29`).
  - Chat input inside the shadow root (`client/shell-script.ts:125`).
- **Textarea:** none.
- **Native selects**
  - Department: label "Search in", `select[name=i]` (`pages/header.ts:35`).
  - Sort: label "Sort by:" (`pages/results/search.ts:33`). Navigates on change (`client/search-script.ts:94`).
  - Product page "Quantity:": 1-10, or capped at the low-stock count (`pages/buy-box.ts:7-10,39`).
- **Custom listbox:** search suggestions, `role=listbox` "Search suggestions" with `role=option` items (`pages/header.ts:39`). They are chosen on `mousedown`, which submits the form (`client/shell-script.ts:152-166`).
- **Checkboxes**
  - Protection plan on kettle pages (`pages/buy-box.ts:32`).
  - Cart line: aria-label "Select <title>" (`pages/cart/main.ts:30`). Toggling sends `select-line` and re-renders.
  - Gift card and Plus trial on checkout (`pages/checkout.ts:49,53`). Both send a mutation and reload the page; Plus trial starts ticked.
  - Consent preferences, where "Essential" is checked and disabled (`pages/shell.ts:29`).
  - Cart "This order contains a gift": no handler (`pages/cart/page.ts:27`).
  - Filter rail fakes: links with an `aria-hidden` box, not real checkboxes (`pages/results/filter-rail.ts:16-20`).
- **Radios**
  - Checkout `name=address`: hidden until "Change" is clicked (`pages/checkout.ts:33,45`).
  - Checkout `name=delivery`: change triggers a reload (`pages/checkout.ts:37`).
  - `name=payment` inside the frame (`pages/payment-frame.ts:13`).
- **Password field:** none.
- **Sensitive fields:** saved payment methods only, no card entry (`pages/payment-frame.ts:13`). The captcha answer.
- **Email:** newsletter `input[type=email]`, label "Get deals in your inbox" (`pages/shell.ts:44`). **Tel:** none.
- **Contenteditable:** none.
- **File input:** a hidden `input[type=file]` inside a label in the "Search with an image" dialog. It exists only under `redesigned-header` (`client/shell-script.ts:171-181`).

*States and ambiguity*
- **Disabled controls**
  - Soft-check button: disabled for 1500 ms (`pages/challenges/soft-check.ts:18`, `client/timings.ts:241`).
  - A card's "Add to cart" after it is clicked (`client/search-script.ts:47`).
  - Both "Place your order" buttons after a click (`client/checkout-script.ts:43`).
  - Pager Previous/Next become `aria-disabled` spans (`pages/results/pagination.ts:21,25`).
- **Duplicate labels**
  - "Go" is both the header submit (`aria-label="Go"`, `data-testid=nav-search-submit`, `pages/header.ts:33`) and the price-range submit (`pages/results/filter-rail.ts:41`).
  - "Place your order" appears twice (`pages/checkout.ts:39,54,56`).
  - "Add to cart" is on every simple card (`pages/results/result-card.ts:77`).
  - "Delete" appears in both active and saved cart lines (`pages/cart/main.ts:37,54`).
  - "Deliver to" is in the header and in the buy box (`pages/header.ts:59`, `pages/buy-box.ts:37`).
  - Under `redesigned-header`, the input and the button are both named "Search Brightaisle" (`pages/header.ts:32,37`).

*Frames and shadow DOM*
- **Same-origin iframe:** `iframe[title="Payment methods"]`, hidden until "Change" under "Paying with" is clicked (`pages/checkout.ts:48`). Choosing a method posts `payment-changed`, and checkout reloads (`pages/payment-frame.ts:16-21`, `client/checkout-script.ts:27-29`).
- **Cross-origin iframe:** none.
- **Open shadow DOM:** support chat on `div[data-chat-host]`. Inside it, the bubble "Chat with Brightaisle Assistant" and a panel `role=dialog` "Brightaisle Assistant" (`client/shell-script.ts:111-125`). **Closed shadow DOM:** none.

*Overlays and timing*
- **role=dialog / modals**
  - Notifications prompt, `aria-modal`, "Never miss a deal" (`client/shell-script.ts:93-109`). Opens at 4000 ms; the page root goes `inert` until answered.
  - Deal wheel, `data-testid=deal-wheel`, under `deal-wheel` mode (`client/search-script.ts:96-119`). Opens at 1500 ms; its decline is a `<p>`.
  - Offers side panel "All buying options", hidden (`pages/product.ts:59`).
  - "Added to cart" side sheet (`client/product-script.ts:31-50`).
  - Camera and voice dialogs (`client/shell-script.ts:171-181`).
- **Native alert/confirm/prompt:** none.
- **Consent banner:** region "Cookie preferences", fixed to the bottom with z-index 50 (`pages/shell.ts:24-31`, `style/stylesheet.ts:50`). Buttons: `[data-consent=accept|decline|customize]`.
- **Obstructing overlays**
  - App banner, prepended at 2000 ms. It pushes the page down 64 px, and its close is a `div[title=Close]` (`client/shell-script.ts:80-91`).
  - Chat panel auto-opens over the buy box at 5000 ms on product pages (`client/shell-script.ts:145`).
  - Side sheet and side panel are fixed right with z-index 70 (`style/stylesheet.ts:132`).
- **Delayed rendering** (`client/timings.ts:231-244`)
  - Results show 8 skeleton cards (`[data-component=search-result]`, `aria-busy`) until 700 ms (`pages/results/search.ts:35-40`).
  - Product controls are inert until 1200 ms; early clicks are lost (`client/product-script.ts:102`).
  - Add-to-cart spinner: 400 ms.
  - Images are lazy (`client/search-script.ts:25-35`).
- **Infinite scroll:** a sentinel after result 12 fetches `/s/more` 600 ms after a scroll brings it within 200 px. Without a scroll it never loads (`client/search-script.ts:59-79`, `pages/results/results-markup.ts:31-33`).
- **Pagination:** `nav[aria-label=pagination]` with "Next" `aria-label="Go to next page, page N"`. Bug: on page 2, Next links back to page 2 (`pages/results/pagination.ts:16-36`). "wireless earbuds" has 70 results, 5 pages (`scenario.ts:8-11`).
- **Tables:** product page "Product information" `<table>` (`pages/product.ts:101`). No grid.
- **Long pages:** the product page stacks bundles, sponsored carousel, specs and reviews, ending in "Sign in" (`pages/product.ts:99-107`). Every page ends with the footer newsletter.
- **Scroll containers:** carousel tracks are `overflow-x:auto` (`style/stylesheet.ts:98`). Side panels and the chat log scroll.

*Interaction and navigation*
- **Keyboard:** Enter submits the GET search form natively (`pages/header.ts:34`). Escape hides suggestions (`client/shell-script.ts:168`). No arrow-key handling found.
- **Hover menus:** none found.
- **New tab:** sponsored and carousel cards use `target=_blank` through `/sspa/click` (`pages/results/result-card.ts:64`). Cart "Compare with similar items" calls `window.open` (`client/cart-script.ts:63`).
- **Navigation:** always full navigation, with no `pushState`. `/sspa/click` answers 302 (`route.ts:84-86`).
- **Validation errors**
  - Cart "Proceed to checkout" with nothing selected shows "Select at least one item..." (`pages/cart/page.ts:29`, `client/cart-script.ts:75-79`).
  - A wrong captcha shows `data-testid=robot-check-error` (`pages/challenges/robot-check.ts:21`).
  - An invalid newsletter email is silently ignored (`state/guard-ops.ts:58`).
- **404 / redirect / retired**
  - Unknown path: 404.
  - "We couldn't find that order." (`pages/confirmation.ts:16-18`).
  - Checkout with no session: "Your checkout session has ended" (`pages/checkout.ts:24-29`).
  - 429 page, `data-testid=rate-limited` (`pages/challenges/throttled.ts:8`).
  - Unavailable kettle: "Currently unavailable." (`pages/buy-box.ts:23-25`).
- **Honeypots**
  - Off-screen `input[name=field-keywords]` before the search box. Filling it serves the robot check (`pages/header.ts:36`, `route.ts:36-37`).
  - Newsletter `name=website`, which flags the session (`pages/shell.ts:44`, `state/guard-ops.ts:56-57`).
- **Generated / volatile:** all classes are hashes, and ids look like `:rxxxxx:`. They need `CSS.escape`.
- **Removed or replaced elements (drift)**
  - The template replaces the skeletons, and the sentinel replaces itself.
  - The cart root is re-rendered with `innerHTML` after every change (`client/cart-script.ts:24-27`).
  - "Save for later" fails its first request and keeps its spinner. "Try again" appears at 4000 ms (`client/cart-script.ts:34-48`).
  - The header badge `data-testid=cart-count` goes stale: it adds 1 per add whatever the quantity (`client/shell-script.ts:207-210`).
  - The hero rotates every 5 s (`pages/home.ts:33-35`).
- **Toggles:** chat bubble `aria-expanded`; "Select all items" / "Deselect all items" (`pages/cart/main.ts:61`); "Add to List" becomes "Added to Shopping List" (`client/product-script.ts:100`).

**Challenges.**
- Soft check, `data-testid=soft-check`: passes on a click after 1.5 s, or on its own at 8 s.
- Robot check, `data-testid=robot-check`: the text is drawn on a canvas, so only a person can pass it (`client/robot-script.ts`).

**Variants.** All arm with `set-mode` and reset the account (`state/mutate.ts:22-25`):

| Workflow | variantId | Payload | Effect |
| --- | --- | --- | --- |
| `add-to-cart` | `redesigned-header` | `{mode:"redesigned-header"}` | Submit loses its test id, is renamed "Search Brightaisle" and moves; voice and camera buttons are added (`workflows/add-to-cart.ts:97-104`) |
| `first-page-earbuds` | `deal-wheel` | `{mode:"deal-wheel"}` | Wheel opens over the first results page |
| `first-page-earbuds` | `robot-check` | `{mode:"robot-check"}` | Every page is the robot check (`workflows/first-page.ts:85-106`) |

**API operations** (`POST /api/everything-store/<op>`):
- Guard: `consent`, `dismiss-nudge`, `chat`, `search-request`, `throttled`, `pass-soft-check`, `solve-robot-check`, `new-robot-image`, `subscribe`.
- Cart: `add-to-cart`, `add-bundle`, `set-quantity`, `delete-line`, `save-for-later`, `move-to-cart`, `select-line`, `select-all`.
- Checkout: `start-checkout`, `set-address`, `set-payment`, `set-gift-card`, `set-delivery`, `set-plus-trial`, `place-order`.
- Mode: `set-mode`.

Sources: `state/cart-ops.ts`, `state/checkout-ops.ts`, `state/guard-ops.ts`.

**Final-state oracle.** `StoreState` (`state/types.ts:76-91`) holds mode, consent, nudges, guard (softCheck, searchLoads, throttled, flagged, robot, saveGlitch), cart, saved, checkout, orders, newsletter and activity. The initial cart is L2 phone case `B0RDGAU8PM` and L1 batteries `B0BAAA48CT`; saved holds `B0TWGOOSE9` and `B0BAMFC24P` (`state/create.ts:17-24`).

Page facts:
- JSON `data-testid=everything-saved-cloths-account` and `everything-checkout-session` (`pages/shell.ts:57-58`).
- Test ids `cart-count`, `result-count`, `cart-subtotal`, `saved-heading`, `order-status`, `order-ship-to`, `order-delivery`, `order-line-N`, `order-payment`, `order-total`, `plus-trial`, `orders-today` (`pages/confirmation.ts:21-29`).

**Specs that open it.** All under `apps/extension/e2e/`:
- `content/tests/`:
  - `actionability/tests/actionability-gate.spec.ts`
  - `created-identity/tests/site-reset-subject.spec.ts`
  - `dialog-dismissal.spec.ts`
  - `dialog-refusal.spec.ts`
  - `evidence/tests/controls.spec.ts`
  - `evidence/tests/page-view-controls.spec.ts`
  - `extraction/tests/{cart-column-labels,everything-store-cart-names,everything-store-cart,everything-store-extraction,everything-store-next-page,item-conditions,list-completeness,record-output-schema}.spec.ts`
  - `facts/tests/deal-wheel-facts.spec.ts`
  - `press-answers/tests/press-answers.spec.ts`
  - `selectors/tests/volatile-selector-replay.spec.ts`
- `lease/tests/stale-holder.spec.ts`
- `runtime/tests/navigate.spec.ts`
- `site-reset/tests/installed-project.spec.ts`

In-scenario browser tests: `scenarios/everything-store/tests/{honest-paths,naive-paths,breadth-paths}.test.ts`, which use `tests/browser-kit.ts`.

---

## 2. crossborder-marketplace ("Farbazaar")

**Identity.** id `crossborder-marketplace`; startPath `/scenarios/crossborder-marketplace/`; seed `7342` (`scenarios/crossborder-marketplace/manifest/answers.ts:7`, `manifest/manifest.ts:42-48`). All further paths in this section are relative to `scenarios/crossborder-marketplace/`. The shopper is in region DE (EUR, written `10,00 €`).

**Routes** (`route.ts:28-63`, `markup/links.ts:4-28`). Root is `/scenarios/crossborder-marketplace/`.

| Path | Page |
| --- | --- |
| `` (root) | Home: category menu, hero, SuperDeals, "More to love" feed |
| `search?q=&shipFrom=CN,ES,PL,CZ&freeShipping=y&minStar=4&minPrice=&maxPrice=&sort=&page=` | Results, 20 per page with ads at positions 1, 8, 15 (`catalog/results.ts:29-31`). Only hub queries match (`catalog/results.ts:71-74`) |
| `search/cards?...` | Fragment |
| `item/<13 digits>` | Product. Official hub: `1005008123450` (`catalog/listings.ts:21`) |
| `item/<id>/description` | Framed document |
| `cart` | Cart |
| `checkout` | Checkout |
| `checkout/payment` | Framed payment picker |
| `order/<16 digits>` | Order page (paid orders only) |
| `flyouts` | JSON fragment |
| `feed?page=2..4` | Feed page |
| `img/<name>.svg` | Image |

Every third results page since the last check is replaced by the verify page, served at the same URL (`route.ts:31-34`).

**Constructs**

*Inputs*
- **Text inputs**
  - Header search `input[name=q]`, placeholder "Autumn Mega Sale: up to 70% off", id rotates on every load (`markup/shell.ts:87`). The magnifier is a `div` (`markup/shell.ts:88`, `client/shell-script.ts:59-60`).
  - Quantity `input` text, inputmode numeric (`markup/item.ts:60`).
  - Sidebar Min/Max price, unlabelled, plus a div "OK" (`markup/search.ts:100`).
  - "Go to page" input (`markup/search.ts:121`).
  - Chat message input (`markup/overlays.ts:59`).
- **Textarea:** "Note to seller (optional)", maxlength 512, one per store panel (`markup/checkout.ts:67`).
- **Native selects**
  - Header category `select[name=cat]`, unlabelled (`markup/shell.ts:86`).
  - Checkout shipping select per store: change sends a mutation and reloads (`markup/checkout.ts:65`, `client/checkout-script.ts:21-24`).
  - Region `<select>` inside the `fb-region` shadow root (`client/shell-script.ts:158-161`).
- **Custom pickers**
  - Colour swatches: `div[title=<colour>]` (`markup/item.ts:57`).
  - Specification and Ships From: `div` chips (`markup/item.ts:58-59`).
  - Clicking a chosen option clears it. A sold-out combination refuses the click with "This combination is sold out." (`client/item-script.ts:98-108`).
  - Filters and sort tabs are `div`s that navigate (`markup/search.ts:95,106`, `client/search-script.ts:63-78`).
- **Checkbox / radio:** no native ones.
  - Fake filter boxes (`markup/search.ts:95`).
  - Cart round tick `div` (`markup/cart.ts:21`).
  - Fake payment radios in the frame (`markup/payment-frame.ts:16`).
- **Password:** none. **Sensitive data:** saved cards in the frame (Visa •••• 4417; expired Mastercard •••• 9021) (`markup/payment-frame.ts:21-24`). Address and phone are printed (`markup/checkout.ts:34`).
- **Email / tel / contenteditable / file:** none.

*States and ambiguity*
- **Disabled**
  - Pager "‹ Previous" on page 1 and "Next ›" on the last page are div `pagerDisabled` (`markup/search.ts:117,120`).
  - Struck-through sold-out options (`client/item-script.ts:74`).
  - Payment rows 2-4 refuse with a message (`client/payment-script.ts:9-12`).
- **Duplicate labels**
  - Every result card has two links (image and title) to the same item (`markup/cards.ts:24-25`).
  - Chat "Minimize chat" titles appear on the pill and on the panel (`markup/overlays.ts:58-59`).
  - Buy bar: "Buy now" and "Add to cart" (`markup/item.ts:45-47`).
  - The "More from <store>" grid repeats the card structure (`markup/item.ts:71`).
  - Ads are identical cards plus an "Ad" tag (`markup/cards.ts:28`).

*Frames and shadow DOM*
- **Same-origin iframes**
  - `iframe[title="Item description"]`: specification `<table>` and warehouse note (`markup/item.ts:69`, `markup/item-frame.ts:23-31`).
  - `iframe[title="Payment methods"]`, which posts `fb-payment` (`markup/checkout.ts:36`, `client/payment-script.ts:17`).
- **Cross-origin iframe:** none.
- **Open shadow DOM**
  - `fb-region`: "Ship to ..." text, a select, and a div "Save" that reloads (`client/shell-script.ts:152-170`).
  - `fb-store-coupon`: div "Get coupons". The first claim always fails with "Network busy, please try again"; the second succeeds (`client/item-script.ts:174-204`).
- **Closed shadow DOM:** none.

*Overlays and timing*
- **Dialogs / modals:** none carries `role=dialog` (`markup/overlays.ts:15-19`).
  - Welcome-coupons modal with scrim at 2000 ms: close "×", "Collect all", "No thanks" (`markup/overlays.ts:39-49`, `client/shell-script.ts:77-90`).
  - Notification card at 3500 ms on search and item pages (`client/shell-script.ts:92-98`).
  - Flash-deal modal: close `div[title=Close]` "×", plus "Grab the deal", which navigates away (`markup/overlays.ts:64-71`, `client/shell-script.ts:126-148`).
- **Native alert/confirm/prompt:** none.
- **Consent banner:** fixed bottom, z-index 70, min-height 150 (`styles/stylesheet.ts:51`). Div buttons "Manage choices" (becomes "Confirm my choices"), "Reject non-essential" and "Accept all" (`markup/overlays.ts:32-37`, `client/shell-script.ts:63-75`).
- **Obstructing overlays:** the buy bar is fixed bottom with z-index 50 (`styles/stylesheet.ts:150`). At 1000 ms the chat pill is stamped over it, fixed bottom-right with z-index 65 (`styles/stylesheet.ts:61`, `client/shell-script.ts:100-122`). The consent banner also covers it.
- **Delayed rendering**
  - Results are skeletons. The first 10 cards come from a template at 600 ms; the rest are fetched when scrolled to, plus 400 ms (`client/search-script.ts:46-61`).
  - Add to cart: 700 ms spinner. Coupon: 800 ms. Place order: 1500 ms. Verify: 2000 ms.
- **Infinite scroll:** home "More to love", 10 per page over 4 pages (`markup/home.ts:12-13`, `client/home-script.ts:37-63`). The second feed request answers 429 with `retry-after: 3`. The spinner stays, and a "Retry" span appears after 3 s (`route.ts:65-72`).
- **Pagination:** "‹ Previous" and numbers are links. "Next ›" is a div whose handler throws, so it does nothing. "Go to page" input plus a "Go" span (`markup/search.ts:114-122`, `client/search-script.ts:80-95`). Unnarrowed Best Match repeats listings on pages 2-3 (`catalog/results.ts:63`).
- **Tables:** only in the description frame.
- **Long pages:** item page with reviews and a more-from-store grid; home feed.
- **Scroll containers:** unconfirmed.

*Interaction and navigation*
- **Keyboard:** Enter in the search box submits natively (`client/shell-script.ts:58`). No Escape or arrow-key handlers found.
- **Hover menus:** account and mini-cart flyouts are CSS `:hover` (`styles/stylesheet.ts:32-33`). They are refreshed in place from `/flyouts` (`client/shell-script.ts:47-54`).
- **New tab:** every result card link is `target=_blank` (`markup/cards.ts:24-25`).
- **Navigation:** full loads; region save, verify and cart changes reload. No `pushState`.
- **Validation errors** in `.errorTip`: "Please select a Color/Specification/Ships From.", "Please enter a quantity.", "Only N pieces available.", "You have reached the purchase limit for this item." (`client/item-script.ts:123-147`). Checkout: "Please select a payment method." (`client/checkout-script.ts:48`). Cart: toast "Select at least one item to check out."
- **404 / retired:** unknown items 404; order pages exist only for paid orders (`route.ts:53`). "Your checkout session has expired" (`markup/checkout.ts:24-27`). Empty query: "Sorry, we couldn't find any results" (`markup/search.ts:124-126`).
- **Honeypot:** `input[name=fax_number]` in an off-screen `.trap` (`markup/checkout.ts:68`). Filling it holds the order as `review` and shows "Your order is being reviewed" (`state/mutate.ts:147`, `client/checkout-script.ts:64-66`).
- **Generated / volatile:** class hashes per seed and per mode build (`styles/classes.ts`). Ids rotate on every page view (`markup/shell.ts:40-47`). Footer `data-testid=build-marker` (`markup/shell.ts:103`).
- **Drift:** skeletons are replaced; flyouts are replaced by `outerHTML`; the cart badge is stale (`markup/flyouts.ts:7-14`); overlays are stamped from templates.
- **Toggles:** store card "Follow" / "Following" span (`client/item-script.ts:163-171`); coupon "Collected"; chat pill / panel / minimised states.

**Variants.** All arm with `set-mode`. A payload may add `interruption {page, visit, dismiss, delayMs}` (`state/interruption.ts:21-47`).

| variantId | Workflow | Payload | Effect |
| --- | --- | --- | --- |
| `basket-redesign` | top level | `{mode:"basket-redesign"}` | "Add to basket" replaces "Add to cart", loses `data-testid=add-to-cart`, and "Buy now" takes its place |
| `flash-deal` | top level | `{mode:"flash-deal"}` | Promotion opens at 1.5 s on item pages |
| `flash-deal-on-arrival` | top level | `{mode:"baseline", interruption:{page:"home",visit:1,dismiss:"closes"}}` | Promotion stands over the home page on arrival |
| `flash-deal-second-item` | top level | interruption `{page:"item",visit:2,...}` | Promotion stands over the second item page |
| `flash-deal-stuck` | top level | interruption `{page:"item",visit:1,dismiss:"inert"}` | Close does nothing; expects `web.action.blocked_by_dialog` |
| `list-layout` | `spain-hubs` | `{mode:"list-layout"}` | Results become wide rows |

Sources: `manifest/manifest.ts:63-134`, `manifest/interruptions.ts:8-15`.

**API operations:** `set-mode`, `page-view`, `beacon`, `consent`, `welcome`, `notifications`, `chat`, `flash-deal`, `interruption`, `region`, `claim-coupon`, `follow-store`, `add-to-cart`, `cart-quantity`, `cart-remove`, `buy-now`, `checkout-cart`, `checkout-shipping`, `choose-payment`, `place-order`, `search-load`, `search-challenge`, `verify-human`, `feed-request` (`state/mutate.ts:38-140`).

**Oracle.** `MarketState` (`state/types.ts:45-87`) holds mode, views, region, consent, welcome, notifications, chat, flashDeal, interruption, coupons, following (starts as hubsmith, mirafone, qinport; `state/create.ts:4`), cart (starts empty), search, feed, checkout, orders and activity.

Facts by test id: `mini-cart-count` ("Cart (N)"), `mini-cart-line`, `store-coupons`, `orders-summary`, `followed-stores`, JSON `coupon-only-account`, `build-marker`, `add-to-cart` (`manifest/facts.ts:15-31`, `markup/flyouts.ts:19-63`).

**Specs that open it.** All under `apps/extension/e2e/`:
- `content/tests/`:
  - `check-chosen-option/tests/check-chosen-option.spec.ts`
  - `created-identity/tests/fingerprint-after-change.spec.ts`
  - `dialog-dismissal.spec.ts`
  - `evidence/tests/controls.spec.ts`
  - `evidence/tests/page-view-controls.spec.ts`
  - `extraction/tests/crossborder-next-page-person.spec.ts`
  - `live-tasks/tests/crossborder-marketplace-spain-hubs.spec.ts`
  - `press-answers/tests/press-answers.spec.ts`
  - `text-sighting/tests/text-sighting.spec.ts`
  - `type-over-value/tests/type-over-value.spec.ts`
- `runtime/tests/opened-tab.spec.ts`

In-scenario browser tests: `scenarios/crossborder-marketplace/tests/{browser-paths,breadth-paths}.test.ts`, which use `tests/browser-harness.ts`.

---

## 3. bigbox-retail ("ValueRidge")

**Identity.** id `bigbox-retail`; startPath `/scenarios/bigbox-retail/`; seed `239` (`scenarios/bigbox-retail/scenario.ts:18-21`). All further paths in this section are relative to `scenarios/bigbox-retail/`. Store-local time is fixed at Monday 21 Sep 2026, 10:05 (`types.ts:3-8`). The home store is `2291`, Carden Falls Supercenter (`catalog/stores.ts:10,17`).

**Routes** (`route.ts:32-63`).

| Path | Page |
| --- | --- |
| `/` | Home: rotating hero and two quick-add rails |
| `search?q=&facet=group:value\|\|...&sort=&page=` | Results, 12 per page (`search/run-search.ts:10`) |
| `ip/<slug>/<9 digits>?variant=<sku>` | Product, e.g. `ip/valueridge-essentials-select-a-size-paper-towels/418830127` |
| `cart` | Cart. Also clears a Buy now item |
| `checkout` | Sign-in wall, or guest checkout |
| `checkout/slots` | Fragment. The first request answers 429 with Retry-After 2 |
| `checkout/payment-frame` | Card frame, with a CSP |
| `mini-cart` | Fragment |
| `weekly-ad` | Weekly ad |
| `order/<7>-<5>` | Order confirmation |
| `seller/<slug>` | Seller page |
| `img/<id>.svg` | Image |

Facet groups: `dept`, `fulfillment_method`, `fulfillment_speed`, `retailer_type`, `brand`, `customer_rating`, `special_offers` (`search/facet-groups.ts:27-42`). Sorts: `best_match`, `price_low`, `price_high`, `best_seller`, `rating_high` (`search/sort-options.ts:9-13`).

**Constructs**

*Inputs*
- **Text inputs**
  - Header `input[type=search][name=q]`, aria-label "Search" (`shell/shell.ts:50`).
  - Guest contact: First name, Last name, Email address (type email), Phone number (type tel), labels pointing at generated ids (`pages/checkout-page.ts:32-33`).
  - Sign-in wall: "Email address" and "Password" (`pages/checkout-page.ts:17-18`).
  - Promo "Email address" (`client/shell-script.ts:70`).
  - Chat input in the shadow root (`shell/support-chat.ts:21`).
- **Textarea:** none.
- **Native selects**
  - "Sort by" `select[name=sort]`: navigates (`pages/search-page.ts:35,48-49`).
  - Cart "Qty" select 1-12 per line: change sends `update-qty` and reloads (`pages/cart-page.ts:19-22,62`).
- **Custom pickers**
  - Size swatches: `div[tabindex=0]`, e.g. "12 Double Rolls" (`pages/product-page.ts:55`).
  - Fulfilment options Pickup / Delivery / Shipping: `div[tabindex=0]`. An unavailable one ignores clicks (`pages/product-page.ts:56`, `client/product-script.ts:67-69`).
  - Quantity stepper spans "−" / "+", 1-12 (`pages/product-page.ts:70`).
- **Checkboxes:** facet options are native `input[type=checkbox][value="group:value"]` in labelled fieldsets. Change navigates (`pages/results-sidebar.ts:12`, `pages/search-page.ts:43-47`).
- **Radios:** `input[name=payment]`, values `card` / `pickup`. "Pay at pickup" hides the card frame (`pages/checkout-page.ts:35-37`, `client/checkout-script.ts:43`).
- **Password:** sign-in wall `type=password`. "Continue" always answers "We couldn't find an account..." (`pages/checkout-page.ts:18`, `state/checkout-operations.ts:13`).
- **Payment / card field:** a cross-origin frame with Card number (`autocomplete=cc-number`), Expiration, and Security code. It runs a Luhn check and posts `vr-card-token` `tok_<last4>card` to `'*'` (`pages/payment-frame-page.ts:12-26`).
- **Email / tel:** listed above. **Contenteditable / file:** none.

*States and ambiguity*
- **Disabled**
  - Full pickup slots are disabled buttons "<time> Full" (`pages/pickup-slots-fragment.ts:13`).
  - Add buttons while their mutation is in flight; Place order after a click.
  - Picker "Set as my store" becomes "Updating…" and disabled (`client/shell-script.ts:106`).
- **Duplicate labels**
  - "Set as my store" on every non-current store card (3 of 4) (`shell/store-picker.ts:13`).
  - "+ Add" on every single-size tile and rail item (`listing/tile.ts:24`).
  - Bare "×" closes on the promo, picker, chat card, chat panel and added panel.
  - "Remove" in both cart and saved lines (`pages/cart-page.ts:21-22`).
  - "Continue" vs "Continue without an account" (`pages/checkout-page.ts:19-20`).

*Frames and shadow DOM*
- **Same-origin iframe:** none.
- **Cross-origin iframe:** `iframe[title="Secure card entry"]`, src `${alternateOrigin}/scenarios/bigbox-retail/checkout/payment-frame`, with CSP `frame-ancestors http://127.0.0.1:*` (`pages/checkout-page.ts:36`, `pages/payment-frame-page.ts:4`, `route.ts:51`).
- **Open shadow DOM:** declarative (`<template shadowrootmode="open">`).
  - `vr-fulfillment-picker`: chip "Pickup or delivery? <store>", flyout, Pickup/Delivery tabs, and a list with `max-height:320px; overflow:auto` (`shell/store-picker.ts:14-29`, `client/shell-script.ts:92-113`).
  - `vr-assist`: pill "Chat with us", card "Hi, I'm Val...", panel (`shell/support-chat.ts:10-22`).
- **Closed shadow DOM:** none.

*Overlays and timing*
- **role=dialog / modals**
  - Consent `role=dialog aria-modal`, "Your privacy choices", over a click-eating scrim. Buttons "Accept all", "Reject all", and "Manage choices" (which only changes its own text) (`shell/consent-dialog.ts:7-17`, `client/shell-script.ts:84-91`).
  - Email-offer card over a scrim, 2200 ms after consent is answered. No role, and the close is a "×" div (`client/shell-script.ts:17,61-83`).
  - "✓ Added to cart" aside over a scrim, until closed (`client/product-script.ts:76-91`).
- **Native alert/confirm/prompt:** none.
- **Consent:** the dialog above.
- **Obstructing overlays**
  - Chat pill is fixed bottom-right. On the cart page it sits at `bottom:12px`, over the checkout bar's button (`shell/support-chat.ts:12`, `shell/shell.ts:58`).
  - On product pages the chat card opens at 3000 ms over the pinned "Add to cart" bar (`client/shell-script.ts:18,134-137`).
  - The checkout bar and the add-to-cart bar are fixed.
- **Delayed rendering**
  - Buy box shows "Checking availability…" for 700 ms (`client/product-script.ts:18,47`).
  - Cart shows "Loading your cart…" for 500 ms (`pages/cart-page.ts:51,58`).
  - Reviews load at 900 ms; "See more reviews" adds 3 more after 600 ms (`client/product-script.ts:110-120`).
  - Lazy images with `rootMargin` 120 px.
- **Infinite scroll:** none.
- **Pagination:** `nav[aria-label=Pagination]` with "Previous page" / "Next page" arrows. Next drops the filters and sort (`pages/results-pagination.ts:12-21`).
- **Tables:** product specs `<table>` with `th scope=row` (`pages/product-page.ts:73`).
- **Long pages:** product page with about, specs, reviews and a similar-items rail; results page plus a "Popular in your area" rail.
- **Scroll containers:** the picker list and the chat log.

*Interaction and navigation*
- **Keyboard:** the robot check accepts a Space or Enter hold (`pages/robot-check-page.ts:37-38`). Search submits natively. Swatches have `tabindex=0` but click handlers only.
- **Hover menus:** the mini cart opens on `mouseenter` of the cart link (`data-testid=mini-cart`, hidden) and closes 250 ms after leave (`client/shell-script.ts:55-60`, `shell/shell.ts:53`).
- **New tab:** department bar "Weekly Ad" (`shell/shell.ts:44`); product "Sold and shipped by <seller>" (`pages/product-page.ts:66`).
- **Navigation:** choosing a swatch uses `history.replaceState` with `?variant=` and no reload (`client/product-script.ts:65`). Everything else is a full load or reload.
- **Validation errors:** `role=alert` banner text taken from `CHECKOUT_ERRORS` (`pages/checkout-page.ts:15,29`, `state/checkout-operations.ts:6-14`), covering contact, slot, card, empty cart and flagged. Frame: "Check your card details." Add failure: toast "We could not add this item...".
- **404 / retired:** unknown paths, orders and sellers 404. Results with no matches show "We couldn't find results for ..." (`pages/search-page.ts:39-40`).
- **Honeypots**
  - Promo `name=website` "Leave this field empty", counted in `flaggedSignups` (`client/shell-script.ts:71`, `state/mutate-state.ts:44-48`).
  - Checkout `name=company_website` "Company website", which refuses the order with "Error VR-417" (`pages/checkout-page.ts:34`, `state/checkout-operations.ts:31`).
- **Generated / volatile:** class hashes per build and seed (`theme/theme.ts:45-47`); ids `vr…` per seed (`theme/element-id.ts:7-10`). The footer prints the build (`shell/shell.ts:57`). `redesigned-buy-box` is a new build and renames every class.
- **Drift / quirks**
  - The first press of any add button after a load only "wakes" the page and adds nothing (`client/shell-script.ts:150-152`, `client/product-script.ts:93`).
  - The mini cart is redrawn after changes, but the header badge goes stale.
  - The hero rotates every 4 s (`pages/home-page.ts:35-38`).
- **Toggles:** picker tabs (`pickerTabOn`); fulfilment-option on/off classes; chat card, pill and panel.

**Robot check.** It replaces the third results document since reset. "Press & Hold" for 2 s, or wait 8 s, and the page reloads onto the results (`state/robot-check.ts:4-8`, `pages/robot-check-page.ts:18-41`).

**Variants**

| variantId | Workflow | Arm | Effect |
| --- | --- | --- | --- |
| `redesigned-buy-box` | primary | `set-mode {mode:"redesigned-buy-box"}` | `data-testid=atc` is gone; "Add to cart" moves into the buy box and "Buy now" takes the bar (`manifest/primary-workflow.ts:59-63`) |
| `store-remembered` | primary | `remember-pickup-store`, no payload | Fresh state with the pickup store already chosen (`manifest/store-remembered-variant.ts:13-15`) |
| `list-layout` | `pickup-towels` | `set-mode {mode:"list-layout"}` | Results become `ol` rows with an "Ad" pill (`manifest/pickup-towels-workflow.ts:81-83`) |

**API operations:** `set-mode`, `remember-pickup-store`, `consent`, `dismiss-promo`, `newsletter-signup`, `dismiss-chat-card`, `set-store`, `add-to-cart`, `buy-now`, `clear-express`, `update-qty`, `remove-line`, `save-for-later`, `move-to-cart`, `search-view`, `clear-robot-check`, `slots-fetch`, `start-guest-checkout`, `sign-in`, `place-order` (`state/mutate-state.ts:33-83`).

**Oracle.** `BigboxState` (`types.ts:216-240`) holds mode, consent, promo, flaggedSignups, chatCard, storeId, cart, saved, robot, slotFetches, checkout, checkoutError, express, orders, flaggedOrders and activity. The initial cart is one pickup line: `418832007`, sku `5530601` (`state/initial-state.ts:17`).

Facts by test id: `mini-cart`, `mini-cart-store`, `mini-cart-summary`, `mini-cart-saved`, per-line test ids (`shell/mini-cart.ts:13-16`), JSON `bigbox-soap-account` (`shell/shell.ts:55`), `atc`.

**Specs that open it.** All under `apps/extension/e2e/content/tests/`:
- `actionability/tests/actionability-gate.spec.ts`
- `created-identity/tests/row-bound-control.spec.ts`
- `evidence/tests/{clipped-controls,controls,page-view-controls,page-view-words,pinned-bars}.spec.ts`
- `extraction/tests/item-conditions.spec.ts`
- `press-answers/tests/{press-answers,wake-press-cover}.spec.ts`
- `run-opened/tests/bigbox-store-picker-kept.spec.ts`

In-scenario browser tests: `scenarios/bigbox-retail/tests/{browser-paths,breadth-browser-paths}.test.ts`, which use `tests/browser-harness.ts`.

---

## 4. auction-marketplace ("Hammerline")

**Identity.** id `auction-marketplace`; startPath `/scenarios/auction-marketplace/`; seed `4040` (`scenarios/auction-marketplace/scenario.ts:23-24`). All further paths in this section are relative to `scenarios/auction-marketplace/`. The fixed clock is Mon 21 Sep 2026, 14:00 BST (`catalog/clock.ts:11`). The person is "Sam".

**Routes** (`route.ts:41-71`, `paths.ts:30-43`).

| Path | Page |
| --- | --- |
| `` (root) | Home: "Pick up where you left off" hero (Kestrel 35S `226152268412`), saved search, tiles, strips |
| `sch/i.html?_nkw=&LH_Auction=1\|LH_BIN=1&LH_ItemCondition=3000\|2500\|7000&Model=&Type=&_udlo=&_udhi=&_sop=12\|1\|10\|15&_pgn=&_ipg=24\|48\|96` | Results (`catalog/filters.ts:4-75`). The fourth results view gets a 302 to `splashui/challenge?ru=<results>` |
| `itm/<12 digits>` | Listing. Bid target: `226152268190` (`catalog/cameras.ts:26`) |
| `desc/<id>` | Seller description, served on the second origin |
| `img/<id>/<n>.svg` | Photo |
| `bfl/viewbids/<id>` | Bid history |
| `sspa/click?id=` | 302 to the listing |
| `str/<seller>` | Seller shop |
| `mye/watchlist` | Watchlist |
| `fragments/header`, `fragments/similar/<id>` | Fragments |

An ended listing returns 404 (`route.ts:20-23`).

**Constructs**

*Inputs*
- **Text inputs**
  - Search `input[name=_nkw]`, aria-label "Search for anything" (`pages/shell.ts:60`).
  - "Your max bid" `input[name=maxbid]` (`pages/drawers.ts:29`).
  - Price range "Minimum Value in £" / "Maximum Value in £", `name=_udlo` / `_udhi`. The submit is `div[title="Submit price range"]`, and Enter does not submit because the form has two text inputs and no submit button (`pages/rail.ts:47-57`, `client/results-script.ts:11-13,66-67`).
  - Chat "Message Hal" (`pages/shell.ts:98`).
- **Textarea:** none.
- **Native selects**
  - Category `select[name=_sacat]`, aria-label "Select a category for search" (`pages/shell.ts:61`).
  - "Items per page": navigates on change (`pages/results.ts:58-59`, `client/results-script.ts:69-70`).
- **Custom combobox / listbox**
  - Variation picker: `role=button aria-haspopup=listbox` "- Select -" with `role=option` divs (`pages/item.ts:34-36`, `client/item-script.ts:37-55`). Only on the half-case listing `226149930885` (`catalog/accessories.ts:18`).
  - Sort: `button aria-haspopup=menu` "Sort: Best Match" opens `role=menu` with `role=menuitem` links. The first press is ignored (`pages/results.ts:38-42`, `client/results-script.ts:40-51`).
- **Checkboxes**
  - Rail filters are links with `role=checkbox` and `aria-checked` (`pages/rail.ts:11-13`).
  - Consent "Manage choices" reveals native checkboxes; "Strictly necessary" is disabled (`pages/shell.ts:89`).
- **Radios:** survey rating `name=hl-survey-rating`, 1-5, under `feedback-survey` (`pages/overlays.ts:29`).
- **Password:** none. **Sensitive:** the buy drawer names the saved card ending 4417 (`pages/drawers.ts:58`). The bid is a money commitment.
- **Email / tel / contenteditable / file:** none.

*States and ambiguity*
- **Disabled**
  - "Buy it now" is disabled until a variation is chosen (`pages/item.ts:46`).
  - Pager arrows become `aria-disabled` spans (`pages/results.ts:55,57`).
  - Consent checkbox, as above.
- **Duplicate labels**
  - "Place bid" is a link on the home hero for a different camera, and a button on the listing (`pages/home.ts:35`, `pages/item.ts:45`).
  - Two auctions share the title "Kestrel 35 Rangefinder Camera" (`catalog/cameras.ts:20,22`).
  - An `hl-watch` heart is on every card (`pages/card.ts:59-61`).
  - "Save seller" appears on the listing and on the shop page.
  - "Not now" / "No thanks" spans appear in the promo and in the survey.

*Frames and shadow DOM*
- **Same-origin iframe:** none.
- **Cross-origin iframe:** `iframe[title="Item description from the seller"]`, src `${alternateOrigin}/scenarios/auction-marketplace/desc/<id>`, `loading=lazy`, with CSP `frame-ancestors http://127.0.0.1:*` (`pages/item.ts:73,93`, `route.ts:14,66`).
- **Open shadow DOM:** `hl-watch` heart. Its title toggles "Watch this item" / "Remove from Watchlist" (`client/shell-script.ts:141-162`). **Closed:** none.

*Overlays and timing*
- **role=dialog / modals**
  - App promo `role=dialog aria-modal` "Bid on the go", shown 2500 ms after load on home and results pages. Exits: "Not now" span or an unlabelled close glyph (`pages/overlays.ts:12-20`, `client/shell-script.ts:98-104`).
  - Survey dialog "How are your search results?" at 800 ms (`pages/overlays.ts:28-37`, `client/results-script.ts:72-78`).
  - Bid drawer `role=dialog` "Place your bid", with Enter / Review / Result stages. "Review bid" is a div; "Confirm bid" and "Done" are buttons (`pages/drawers.ts:17-45`, `client/item-script.ts:57-102`).
  - Buy drawer "Review your purchase" (`pages/drawers.ts:49-63`).
- **Native alert/confirm/prompt:** none.
- **Consent banner:** region "Cookie consent", fixed bottom. "Accept all" is a button; "Reject all" is a div (`pages/shell.ts:86-92`).
- **Obstructing overlays:** the vendor chat uses stable ids. `#hal-greeting` opens at 3500 ms over the bid drawer's foot; its close is `.hal-close`. The launcher is `#hal-assist .hal-launcher` (`pages/shell.ts:95-98`, `client/shell-script.ts:81-96`).
- **Delayed rendering**
  - Cards arrive as skeletons in `ul[aria-busy=true]`. They hydrate from a JSON script at 600 ms, then the list reads `aria-busy=false` (`client/results-script.ts:22-38`).
  - "Similar sponsored items" load when scrolled into view (`client/item-script.ts:135-144`).
  - The challenge continues automatically after 5 s (`client/challenge-script.ts:44-56`).
- **Infinite scroll:** none.
- **Pagination:** `nav[aria-label="Results pagination"]` with "Go to next search page". From page 2 on, Next reloads the same page (`pages/results.ts:50-60`). Page sizes 24, 48 or 96. "Pages overlap by two" is stated in the manifest comment (`manifest.ts:130`); the overlap logic is unconfirmed (`pageWindow` not read).
- **Tables:** item specifics `<table>` (`pages/item.ts:58`); bid history table (`pages/seller.ts:38`).
- **Long pages:** listing with specifics, the description frame, and similar items below the fold.
- **Scroll containers:** unconfirmed.

*Interaction and navigation*
- **Keyboard:** Enter in search submits natively. Enter in the max bid input (not in a form) is unconfirmed. No Escape handlers found.
- **Hover menus:** none. The "Watchlist" and "My Hammerline" flyouts are click-toggled buttons with `aria-expanded` (`client/shell-script.ts:49-64`).
- **New tab:** seller shop link, "N bids" history link (`pages/item.ts:30,81`); similar items (`pages/seller.ts:46`).
- **Navigation:** full loads. The challenge uses `location.replace` (`client/challenge-script.ts:52`). 302s on `sspa/click` and on results-to-challenge (`route.ts:44-47,53-56`).
- **Validation errors:** "Enter your max bid." in the drawer's `[role=alert]` (`client/item-script.ts:78`). Server messages: "Enter £X or more.", "Enter a valid amount.", "You're bidding too quickly...", and "Something went wrong..." when restricted (`state.ts:119-138`). The watch limit is 3 toggles per 5 s and shows a toast (`state.ts:7-10,95-98`).
- **404 / retired:** ended listings and unknown sellers return 404. No results: "No exact matches found." (`pages/results.ts:100`).
- **Honeypots**
  - Off-screen "Bid reference" `input[name=reference]` (`pages/drawers.ts:31`).
  - "Order reference" in the buy drawer (`pages/drawers.ts:57`).
  - Filling either restricts bidding and buying for the session (`state.ts:120-122,144`).
- **Generated / volatile**
  - Class hashes per seed (`pages/styles.ts:37`).
  - Card and hydration ids rotate on every results view (`pages/shell.ts:31-33`).
  - The "Sponsored" label interleaves hidden noise letters (`pages/card.ts:75-79`).
  - Ads carry `data-adid`; organic cards carry `data-listingid` (`pages/card.ts:91`).
- **Drift:** skeleton spans are filled; header lists are replaced from `/fragments/header` (`client/shell-script.ts:38-47`); the Watchlist badge goes stale. The Condition filter silently resets the buying format to All (`pages/rail.ts:15-28`).
- **Toggles**
  - Watch CTA `data-testid=x-watch-cta`, `aria-pressed`: "♡ Add to Watchlist" / "♥ Watching" (`pages/watch-controls.ts:21`).
  - Follow `aria-pressed`: "Seller saved" (`pages/watch-controls.ts:25-27`).
  - Rail Model/Type headers: `aria-expanded` divs (`pages/rail.ts:35-43`).

**Variants.** All arm with `set-mode`, which starts a fresh session (`state.ts:62-65`).

| variantId | Workflow | Effect |
| --- | --- | --- |
| `watch-redesign` | `watch-endings` | `x-watch-cta` is gone; a heart "Save item" sits on the photo and "Save this seller" takes the button's place |
| `grid-view` | `kestrel-auctions` | Gallery cards with reversed DOM order and `column-reverse` |
| `feedback-survey` | `kestrel-auctions` | Survey modal on the second and later results pages |

Sources: `manifest.ts:203-264`.

**API operations:** `set-mode`, `consent`, `dismiss-promo`, `dismiss-survey`, `dismiss-greeting`, `view-results`, `pass-challenge`, `toggle-watch`, `follow-seller`, `place-bid`, `buy-now` (`state.ts:61-88`).

**Oracle.** `AuctionState` (`types.ts:97-118`) holds mode, consent, promoDismissed, surveyDismissed, greetingDismissed, resultsViews, challengePassed, watched (initially `m3` `186907334512` and `n1`; `state.ts:18`), followed, bids, purchases, restricted, watchToggleTimes, lastBidAttemptAt, lastWatch, lastBid and activity.

Facts by test id: `watch-flyout`, `bids-flyout`, `purchases-flyout`, `followed-sellers` (`pages/flyouts.ts:73-78`), `x-watch-cta`.

**Specs that open it.** All under `apps/extension/e2e/content/tests/`:
- `dialog-dismissal.spec.ts`
- `evidence/tests/page-view-controls.spec.ts`
- `live-tasks/tests/auction-marketplace-kestrel-auctions.spec.ts`

In-scenario browser tests: `scenarios/auction-marketplace/tests/{browser,breadth-paths}.test.ts`, which use `tests/browser-support.ts`.
