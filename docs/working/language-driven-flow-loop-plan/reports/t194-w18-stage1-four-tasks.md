# t194-w18: Stage 1 for four live tasks

Paths are relative to `apps/scenario-lab/src/scenarios/`. Records were transcribed from the source and checked against the manifests' own `expected.extracted`, printed from the built `apps/scenario-lab/dist` with node. No file under `test-runs/` was read.

## Stage 1 — local-classifieds-bike-search

Written from `local-classifieds/live-tasks.ts:3,23`, `answers.ts:16-23`, `targets.ts:10`, `manifest.ts:62-68,85-113,148-182`, `catalog/{matching,feed,places,adverts,listings/bicycles,options}.ts`, `view/card.ts`, `limits.ts`, before any run's artifacts were read.

Instruction (verbatim): "On Kerbfind Marketplace, find every bicycle for sale within 10 miles of Kelford that costs from £100 to £400 and is new, like new or in good condition. List each bike once, cheapest first, and leave out sponsored posts, in a table with columns title, price, location and url, where location is the place the listing names and url is the address of the listing's own page."

Expected dataset: `extract-bike-results` (`manifest.ts:175,182`): **12 records**, columns title, price, location, url. They are computed by `bikeRecords()` (`answers.ts:16-23`) as `matchingListings(BIKE_QUERY)`. The query is: category bicycles, not sold, place ≤10 mi, £100–£400 inclusive, condition new/like-new/good, sorted price ascending with ties broken by newest (`targets.ts:10`, `catalog/matching.ts:22-55`). url = `listingPath` = `/scenarios/local-classifieds/item/<id>/` (`view/card.ts:11-13`).

| # | title | price | location | url | src |
|---|---|---|---|---|---|
| 1 | Kids' mountain bike, 24in wheels | £100 | Ashby Moor | /scenarios/local-classifieds/item/1045935841478603/ | bicycles.ts:31 |
| 2 | Folding commuter bike with rack | £120 | Kelford Harbour | /scenarios/local-classifieds/item/1073376858594405/ | :17 |
| 3 | Hybrid bike, women's 17in frame, 21 gears | £135 | Brackwater | /scenarios/local-classifieds/item/1032760080684131/ | :29 |
| 4 | Cruiser bike with basket, mint green | £150 | Kelford Harbour | /scenarios/local-classifieds/item/1041089657140266/ | :45 |
| 5 | Folding bike, 16in wheels, 6-speed, barely used | £165 | Upper Kelford | /scenarios/local-classifieds/item/1063693215348259/ | :15 |
| 6 | Single-speed town bike, 54cm | £190 | Kelford Centre | /scenarios/local-classifieds/item/1041098121250477/ | :53 |
| 7 | Road bike, 50cm, triple chainset | £230 | Ashby Moor | /scenarios/local-classifieds/item/1010426906246033/ | :57 |
| 8 | Ridgeline 27.5in mountain bike, medium frame | £240 | Upper Kelford | /scenarios/local-classifieds/item/1095330814410605/ | :11 |
| 9 | Road bike, 56cm aluminium frame, 16-speed | £285 | Kelford Centre | /scenarios/local-classifieds/item/1054477481311927/ | :25 |
| 10 | Gravel bike, 52cm, hydraulic disc brakes | £375 | Upper Kelford | /scenarios/local-classifieds/item/1068543414736208/ | :41 |
| 11 | Carbon road bike, 58cm, 22-speed | £395 | Kelford Harbour | /scenarios/local-classifieds/item/1058806569724343/ | :65 |
| 12 | Electric bike, 250W, 40-mile range | £400 | Saltmarsh Row | /scenarios/local-classifieds/item/1012035340389303/ | :35 |

Node chain a correct Flow must have:
1. Optional, but shown on first visit: answer the cookie wall, "Allow all cookies" or "Decline optional cookies" (`view/shell.ts:100-107`).
2. Open the Bicycles category, `role:link:Bicycles` (`manifest.ts:153`). A text search for "bike" also finds non-bicycle items (`bicycles.ts:73-78`, category sport).
3. Optional, arrives on a timer: the notification prompt, answered with "Not now" (`client/shell-script.ts:89-96`).
4. Radius 20 → 10 mi. The picker sits in a shadow root (`client/location-element.ts:21`), and Apply swallows its first press, so press it twice and then wait for the chip "Kelford · Within 10 mi" (`manifest.ts:32-44`).
5. Min 100 (Enter), Max 400 (Enter); Item condition: New, Used – like new, Used – good; Sort "Price: lowest first" (`manifest.ts:156-164`).
6. Optional: the "Checking your browser" pause on the 4th new search within 10 s. It clears by itself after 2.5 s, or at once on Continue (`limits.ts:17-19,28-31`, `route.ts:77`, `client/feed-script.ts:77`). Every filter change is a new search (`client/feed-script.ts:9-10`).
7. Pagination is infinite scroll in batches of 6 (`catalog/feed.ts:7`). At seed 44 the feed has 3 batches, and one batch fails the first time it is requested (`feed.ts:40-41`). The failure shows a bare-span "Try again" under skeleton cards, which must be pressed (`client/feed-script.ts:6-8,69`). Keep scrolling until "Results outside your search" appears (`view/feed.ts:11-20`).
8. Extract the cards in `section[aria-label="Collection of Marketplace items"] > div:first-child` (`manifest.ts:11,175`): title, price as the current price and not the struck-through `was`, location as the place line, and url as the `@href` (`manifest.ts:62-68`, `view/card.ts:42-49`). A `where` excluding sponsored cards reads the "Sponsored" line or the `/ad/` href (`card.ts:29-31`). Dedupe by url, not by title.
9. No detail-page visits are needed.

What a wrong answer that looks right would look like here:
- 14 rows with the 2 adverts: "Folding bike, 20in, 7-speed, clearance" £149 and "Gravel bike, 2x9 drivetrain, all sizes" £349, town "Kelford" (`adverts.ts:26-29`). They ignore every filter (`matching.ts:82-89`).
- 13 rows: "Folding bike, 16in wheels…" twice, because the next batch repeats the last listing of the batch before (`feed.ts:35-39`). The manifest itself notes its recorded extract reads one too many (`manifest.ts:100-103`).
- The tail of "Results outside your search" read as results. At seed 44 that is BMX £90, Cargo £1250, balance bike £35, Electric folding bike £420 (was £480), Old kids' bike (Free), and Kids' bike 16in £45 (`matching.ts:72-75`).
- 5 rows (batch 1 only, minus its advert), or 9–10 rows that miss the failing third batch ("Gravel bike, 52cm…", "Carbon road bike…", "Electric bike…") because Try again was never pressed (seed 44: batches are [advert, #1–#5], [#5 repeat, #6, #7, advert, #8, #9], [#10–#12], computed from `feed.ts:25-41`).
- Near-misses kept in or dropped wrongly:
  - Ridgeline at Hallam Cross £180, which has the same title as #8 but is 11.4 mi away (`bicycles.ts:13`, `places.ts:17`).
  - Sold folding/road bikes (`:23,:67`).
  - Fair-condition bikes (`:27`).
  - £400 and £100 dropped by an exclusive bound.
  - Price read as the struck-through "was" figure (#8 shows £240 with £300 struck through).
- The count beside the heading is stale and never recomputed (`view/results.ts:11-17`).

Site traps (file:line):
- Cookie wall: `view/shell.ts:100-107`.
- Timed notification modal: `client/shell-script.ts:89-96`.
- Shadow-root radius picker with a double Apply: `client/location-element.ts:21`, `manifest.ts:32-36`.
- Robot pause: `limits.ts:28-31`, `client/feed-script.ts:77`.
- Failing lazy batch: `feed.ts:41`, `client/feed-script.ts:69`.
- Duplicate across batches: `feed.ts:35-39`.
- Adverts built from the listing card: `view/card.ts:15-38`.
- Class names that change with every seed: `manifest.ts:94-95`.
- Positional field selectors only (`manifest.ts:63-67`). The list-layout variant moves price and place out of the link (`view/card.ts:44-46`).
- No permission point applies to this task.

## Stage 1 — auction-marketplace-kestrel-auctions

Written from `auction-marketplace/live-tasks.ts:3,22-29`, `manifest.ts:13-21,60-98,110-113,120-136,211-259`, `catalog/{cameras,accessories,listings,search,money}.ts`, `pages/{results,card,rail}.ts`, `route.ts:11,44-46`, `client/results-script.ts:1-16`, before any run's artifacts were read.

Instruction (verbatim): "On Hammerline, collect every auction for a Kestrel 35 camera: the original Kestrel 35 itself, not the 35S, the Mark II or the 350, and not a lens, case, box or any other accessory. Leave out anything listed as for parts or not working, and anything whose current bid is £150 or more, counting a listing priced in another currency at the pound estimate the site shows for it. Auctions that also offer Buy it now count; fixed-price listings do not. List each auction once, soonest-ending first, with columns title, price, bids and postage, each exactly as the listing's search result shows it, the price in the listing's own currency."

Expected dataset: `extract-kestrel-auctions` (`manifest.ts:110-111,239`): **10 records**, columns title, price, bids, postage. They are listings m1–m10 sorted by `endsIn` (`manifest.ts:19-21`), with text from `cardSlots` slots 0/2/6 (`manifest.ts:93-98`, `pages/card.ts:25-41`).

| # | title | price | bids | postage | src |
|---|---|---|---|---|---|
| 1 | Kestrel 35 Rangefinder Camera | £64.00 | 11 bids | +£4.95 postage | cameras.ts:20 |
| 2 | KESTREL 35 45mm f/2.8 Voss-Anastigmat — film tested, new seals | EUR 109,00 | 6 bids | +EUR 14,50 postage | :21 |
| 3 | Kestrel 35 Rangefinder Camera | £41.00 | 4 bids | Free postage | :22 |
| 4 | Kestrel 35 rangefinder camera body + original leather case | £96.00 | 4 bids | +£6.50 postage | :23 |
| 5 | Kestrel 35 — CLA'd 2025, shutter accurate, lovely example | US $189.00 | 13 bids | +US $32.00 postage | :25 |
| 6 | Vintage Kestrel 35 35mm film camera, working, light meter dead | £27.50 | 9 bids | +£3.99 postage | :24 |
| 7 | Kestrel 35 rangefinder, 45mm f/2.8 lens, film tested | £78.00 | 3 bids | +£5.20 postage | :26 |
| 8 | Kestrel 35 camera with flash & manual — refurbished by seller | £122.00 | 7 bids | Free postage | :27 |
| 9 | Kestrel 35 Kamera Messsucher 45mm 2.8 — sehr gut | EUR 169,00 | 12 bids | +EUR 19,90 postage | :28 |
| 10 | Kestrel 35 rangefinder — collection only, Sheffield | £35.00 | 2 bids | Collection in person | :29 |

Node chain a correct Flow must have:
1. Arrival overlays in order: promotion "Bid on the go" → "Not now" (~2.5 s), greeting `#hal-greeting` close (~3.5 s), cookie "Accept all" (`manifest.ts:48-67`). Search "kestrel 35" in `input[name="_nkw"]` + Enter; wait for `ul[aria-busy="false"]`, since cards hydrate from skeletons after 600 ms (`client/results-script.ts:4-6`).
2. Filters (either route must yield the same 10, `manifest.ts:13-18`): Condition Pre-owned + Seller refurbished; then the "Auction" tab, because a condition click resets the format to All (`pages/rail.ts:17,24`); Model "Kestrel 35"; Type "Rangefinder camera" **and** "Film camera"; Max 150 submitted by the round-arrow div, since Enter submits nothing (`client/results-script.ts:11-13`, `manifest.ts:215-233`).
3. Optional bot check: from the 4th results view, results redirect to a challenge; press Continue (`route.ts:11,44-46`).
4. Sort "Time: ending soonest"; the button ignores its first press, so press twice (`client/results-script.ts:7-9`, `manifest.ts:234-237`).
5. Extract `ul[aria-busy] > li[data-listingid]` (organic only; ads carry `data-adid`, `pages/card.ts:91,117`), fields by position: title, price slot 1, bids slot 3, postage slot 7 (`manifest.ts:85-91`). `where` on the keyword route: original 35 model (title misleads: "KESTREL 35 45mm…" is a camera), condition not "For parts or not working", the "approx. £…" estimate (`money.ts:31-34`) < £150, format auction or auction-bin. Dedupe by item id/href, never title.
6. Pagination: 24 per page (`catalog/filters.ts:18,56`), pages overlap by 2 (`catalog/search.ts:82-94`); numbered links only, since Next reloads page 2 forever from page 2 (`pages/results.ts:44-57`). Unfiltered "kestrel 35" = 50 live listings = 3 pages. No detail visits needed.

What a wrong answer that looks right would look like here:
- The two "Kestrel 35 Rangefinder Camera" rows (m1, m3, different auctions) collapsed to one; or the third such title, x4, kept though fixed-price (`cameras.ts:20,22,34`).
- Ads kept: page 1 advertises m4 and page 3 m9 (repeats of owed rows), plus n2, l1, a2, x5 (`pages/results.ts:14-20`); the "Sponsored" label is split by ghost letters (`pages/card.ts:69-77`). Seam duplicates: m3/m6 at Best Match positions 22–23, m4/m5 at 44–45 (`catalog/listings.ts:8-17`).
- Currency: dropping #9 EUR 169,00 (≈£146.68) or #5 US $189.00 (≈£141.05); keeping x9 EUR 175,00 (≈£151.88), x10 US $210.00 (≈£156.72) (`cameras.ts:39-40`, `money.ts:11`) or x8 £152.00 (`:38`); "EUR 1.165,00" (x7) read as £1.17 (`cameras.ts:37`, `money.ts:3-9`); m4 price read as "or Buy it now £140.00" (`card.ts:30`).
- m10 lost to a Rangefinder-only Type filter (type Film camera, `cameras.ts:29`). Kept lookalikes: 35S/Mk II/350 (`cameras.ts:45-54`), the 35+35S pair (`:57`), lens o6 and case a6 whose model is "Kestrel 35" (`cameras.ts:59`, `accessories.ts:22`), parts x1–x3, x12, x13 (`cameras.ts:31-33,42-43`). m5 "light meter dead" is Pre-owned and owed.
- The header count includes ended auctions (`catalog/search.ts:60-67`).

Site traps (file:line): overlays `manifest.ts:48-67`; bot check `route.ts:11,44-46`; skeletons `pages/card.ts:86-102`; sort first-press `client/results-script.ts:7-9`; condition resets format `pages/rail.ts:17-24`; broken Next `pages/results.ts:44-57`; page overlap `catalog/search.ts:82-87`; ads `pages/results.ts:20-22`; build-hash classes and rotating ids leave only positional selectors (`manifest.ts:79-91`); variants grid-view and a survey from page 2 (`manifest.ts:250-258`); the price filter is inclusive (`catalog/search.ts:40`) while the instruction excludes "£150 or more". No permission point.

## Stage 1 — crossborder-marketplace-spain-hubs

Written from `crossborder-marketplace/live-tasks.ts:3,5-11,34-41`, `manifest/answers.ts:15-33`, `manifest/manifest.ts:25-27,77-84`, `manifest/steps.ts:18-28,74-103`, `catalog/{results,listings}.ts`, `markup/{search,cards,overlays}.ts`, `route.ts:14-71`, `client/search-script.ts:46-75`, `person-check.ts`, before any run's artifacts were read.

Instruction (verbatim): "On Farbazaar, search for "usb c hub" and collect every hub that ships from Spain, has free shipping and is rated 4.5 stars or higher, across all of the results. Leave out the ads and list each item only once, keeping the order the search ranks them in by default (Best Match), with columns title, store, price and rating, written exactly as the results show them."

Expected dataset: `extract-spain-hubs` (`manifest/manifest.ts:84`, `steps.ts:97`): **13 records**, columns title, store, price, rating. They are computed by `spainHubRecords()` (`answers.ts:24-33`): ORGANIC_LISTINGS in catalogue (Best Match) order, filtered to origins including Spain, free shipping, and rating ≥ 45 (tenths). Price is `formatMoney(…, "DE")` for a buyer in Germany.

| # | title | store | price | rating | src |
|---|---|---|---|---|---|
| 1 | Castellan USB C Hub 5 in 1 Ethernet RJ45 Gigabit HDMI 4K 3 USB 3.0 Ports Aluminium Adapter Plug and Play | Castellan Gadgets ES | 16,49 € | 4.8 | listings.ts:49 |
| 2 | Voltbay USB C Hub Multiport Adapter Type C to HDMI 4K 60Hz USB 3.0 PD 100W SD TF Card Reader Docking Station for Laptop Tablet | Voltbay Official Store | 12,49 € | 4.8 | :50 |
| 3 | Oaklane 7 in 1 USB C Docking Station Dual HDMI Triple Display 100W PD Charging Hub for Laptop | Oaklane Iberia Tech | 27,90 € | 4.7 | :52 |
| 4 | Nordwave USB C Hub 3 Ports USB 3.0 with Gigabit Ethernet Adapter Type C to RJ45 LAN | Nordwave Electronics | 13,29 € | 4.6 | :56 |
| 5 | Voltbay USB C Hub Multiport Adapter Type C to HDMI 4K 60Hz USB 3.0 PD 100W SD TF Card Reader Docking Station for Laptop Tablet | VoltBay Store | 11,99 € | 4.6 | :59 |
| 6 | Keelson USB C Hub 9 in 1 HDMI 4K 30Hz Ethernet 1000M PD 100W SD TF USB 3.0 Adapter | Keelson Plaza ES | 19,95 € | 4.9 | :62 |
| 7 | Oaklane USB C Hub 4 Port USB 3.0 Slim Aluminium Data Hub with 60cm Extended Cable | Oaklane Iberia Tech | 9,49 € | 4.5 | :65 |
| 8 | Nordwave 6 in 1 USB C Hub HDMI 4K 60Hz Ethernet PD 100W USB 3.0 Aluminium Dock | Nordwave Electronics | 22,49 € | 4.7 | :69 |
| 9 | Castellan USB C Hub 10 in 1 Dual HDMI Ethernet VGA PD 100W Docking Station Triple Display | Castellan Gadgets ES | 34,90 € | 4.8 | :73 |
| 10 | Keelson USB C Docking Station 12 in 1 Triple Display 2 HDMI DP Ethernet PD 100W | Keelson Plaza ES | 45,99 € | 4.7 | :77 |
| 11 | Nordwave USB C Hub 7 in 1 HDMI 4K 60Hz 2 USB 3.0 USB C Data SD TF PD 100W | Nordwave Electronics | 18,99 € | 4.8 | :79 |
| 12 | Oaklane USB C Hub 8 in 1 HDMI 4K 60Hz Ethernet PD 100W SD TF 2 USB 3.0 Docking | Oaklane Iberia Tech | 24,99 € | 4.9 | :83 |
| 13 | Castellan USB C Hub 4 in 1 USB 3.0 Ports 5Gbps Ultra Slim Aluminium Hub | Castellan Gadgets ES | 7,99 € | 4.5 | :88 |

Node chain a correct Flow must have:
1. Arrival: "Welcome back, Mara!" modal → "No thanks", then consent → "Accept all" (`steps.ts:21-25`, `markup/overlays.ts:23-34`). Type "usb c hub" in `input[name="q"]` + Enter (`steps.ts:26-27`).
2. Optional, timed: notification prompt "Never miss a price drop" → "Not now" (`steps.ts:83-84`).
3. Sidebar filters "Spain", "Free shipping", "4★ & up" (`steps.ts:85-92`). Not the header region picker's "Spain", which sits in a shadow root and changes region and locale (`steps.ts:45-48`).
4. Optional: traffic screen "I'm not a robot" replaces the 3rd search load since it was last passed (`route.ts:31-33`, `person-check.ts:9-14`, `live-tasks.ts:5-11`); a person hand-off, not required.
5. Lazy loading: 10 cards drawn from a template after 600 ms; the rest fetched only when the skeletons scroll into view, so scroll before extracting (`markup/search.ts:20-22`, `client/search-script.ts:46-61`, `steps.ts:94-95`).
6. Extract grid cards without `.adTag` ("Ad", `markup/cards.ts:28`): title, store, price, rating (`steps.ts:96-101`). The `where` must read the card's rating ≥ 4.5 (`ratingValue` text, or star-fill width ≥ 90%, `cards.ts:43`, `steps.ts:18-19`); the "4★ & up" filter band is 4.0 (`catalog/results.ts:91`) and leaves 4.1/4.3/4.4 cards in. Dedupe by item id/href, never title or title+price.
7. Pagination: filtered, everything fits on 1 page (`steps.ts:74-80`); unfiltered, 3 pages of 17 organic + 3 ads (`results.ts:29-32`). Numbered links or Previous only; "Next ›" is a div whose handler throws (`markup/search.ts:24-25,120`). No detail visits needed.

What a wrong answer that looks right would look like here:
- Ads kept: ad-only "Castellan USB C Hub 7 in 1 HDMI 4K 60Hz…" (Spain, free, 4.9) and Keelson "USB C Hub 6 in 1…" (Spain, free, 4.6) (`listings.ts:102,105`); paid copies of owed #3 and #10 (and #5 on the broad route) on the same page as their organic card (`results.ts:47-55`).
- Unfiltered-route duplicates: page 2 opens repeating #6, page 3 repeating #11 (`results.ts:57-63`). Or #2 and #5 collapsed: identical titles, different stores ("Voltbay Official Store" vs "VoltBay Store", `listings.ts:21-23,50,59`).
- Near-misses kept: Spain + free but rated 4.3/4.1/4.4 (`listings.ts:53,70,81`) or unrated (`:67`); Spain with paid shipping (`:61,:75`); 4.5+ shipping from Poland or Czech Republic.
- Only 10 rows (extracted before the lazy tail); prices in another locale ("€16.49") after the region picker was touched; the header count is the unfiltered total on every page (`markup/search.ts:22-24`).

Site traps (file:line): welcome modal and consent `markup/overlays.ts:23-34`; notification prompt `steps.ts:83`; robot check `route.ts:31-33`, `person-check.ts:16-31`; 429 on the home feed's second request `route.ts:64-70` (home page, not the search; listed as noise `manifest.ts:12`); lazy card fetch `client/search-script.ts:51-60`; broken Next `markup/search.ts:120`; brand filters "temporarily unavailable" `client/search-script.ts:67`; generated classes per seed and build `steps.ts:12-16`; list-layout variant after build (`live-tasks.ts:7-8`). No permission point.

## Stage 1 — professional-network-rotterdam-data-engineers

Written from `professional-network/live-tasks.ts:3,22-29`, `records.ts:6-20`, `manifest.ts:19-36,62-106`, `search/{results,query,rate-limit,people-client,people-page,card,fragment}.ts`, `data/{geo,members}.ts`, `route.ts:29,42-43`, before any run's artifacts were read.

Instruction (verbatim): "Use Guildline's people search to find data engineers who are 2nd-degree connections and based in Rotterdam in the Netherlands (not the Rotterdam in New York). Collect every person the search returns across all of its pages into a table with columns name, headline and location, listing each person only once and leaving out anything marked as promoted."

Expected dataset: `extract-rotterdam-engineers` (`manifest.ts:100,106`): **23 records** over 3 pages, columns name, headline, location; `peopleRecords(ROTTERDAM_ENGINEERS)` (`records.ts:10,18-20`) = MEMBERS in order where every keyword ("data", "engineer") begins some headline word, degree is S, and the city is rotterdam-nl, geo 106169143 (`search/results.ts:32-49`, `data/geo.ts:17`). Rows from `data/members.ts:23-67`.

| # | name | headline | location |
|---|---|---|---|
| 1 | Mara Okafor | Senior Data Engineer at Harbourline Logistics | Rotterdam, South Holland, Netherlands |
| 2 | Joost van Dijk 🚀 | Data Engineer \| Spark · Kafka · Airflow \| Building the port's data platform | Rotterdam, South Holland, Netherlands |
| 3 | Aylin Demir | Lead Data Engineer @ Maasvlakte Terminals | Rotterdam, Netherlands |
| 4 | Ruben Klaassen | Data Engineer II at Kade Energy | Rotterdam, South Holland, Netherlands |
| 5 | Priyanka Raman | Analytics Engineer \| dbt, Data Modelling, Looker | Rotterdam, South Holland, Netherlands |
| 6 | Tomasz Wiśniewski | Software Engineer, Data Platform — Veldhuis Bank | Rotterdam, South Holland, Netherlands |
| 7 | Femke de Graaf | Freelance Data Engineer \| Azure · Databricks \| Open to projects | Rotterdam |
| 8 | Chidi Nwosu | Data Engineering Manager at Harbourline Logistics | Rotterdam, South Holland, Netherlands |
| 9 | Lotte Jansen | Junior Data Engineer · Trainee at Portwise | Rotterdam, Zuid-Holland, Nederland |
| 10 | Sébastien Moreau | Staff Data Engineer \| Streaming & real-time analytics | Rotterdam, South Holland, Netherlands |
| 11 | Hana Sato, PhD | Machine Learning & Data Engineer at Erasmus Health Data Lab | Rotterdam, South Holland, Netherlands |
| 12 | Daan Visser | Big Data Engineer bij Kade Energy | Rotterdam, South Holland, Netherlands |
| 13 | Olumide Adeyemi | Data Engineer \| GCP Professional Data Engineer \| Python | Rotterdam, South Holland, Netherlands |
| 14 | Isabel Fonseca | Senior Data Engineer — Payments at Veldhuis Bank | Rotterdam, South Holland, Netherlands |
| 15 | Kees Bakker | Engineer, Data & Integration at Gemeente Rotterdam | Rotterdam, South Holland, Netherlands |
| 16 | Zoë Hendriks | Data Engineer at Portwise \| Ex-Maasvlakte Terminals | Rotterdam, South Holland, Netherlands |
| 17 | Arjun Mehta | Cloud Data Engineer \| AWS · Terraform · Snowflake | Rotterdam, South Holland, Netherlands |
| 18 | Noor El Amrani | Data Engineer & Data Steward \| Harbourline Logistics | Rotterdam, Netherlands |
| 19 | Bram Mulder | Principal Data Engineer at Northsea Freight | Rotterdam, South Holland, Netherlands |
| 20 | Lars Hoekstra | Data Engineer at TalentBridge Recruitment (we're hiring!) | Rotterdam, South Holland, Netherlands |
| 21 | Ewa Kowalczyk | Data Engineer \| Kafka Streams \| Open to relocation | Rotterdam, South Holland, Netherlands |
| 22 | Matteo Ricci | Senior Data Engineer at Kade Energy | Rotterdam, South Holland, Netherlands |
| 23 | Yara Haddad | Data Engineer (m/v/x) bij Gemeente Rotterdam | Rotterdam |

Node chain a correct Flow must have:
1. Arrival (`manifest.ts:19-36`): app prompt "Not now" (~2.5 s, covers everything), the conversation close (~3.5 s, covers the cookie Accept), then cookie "Accept".
2. Global search "data engineer" + Enter, then "See all people results" (`manifest.ts:85-88`). Connections ▾ → check "2nd" → "Show results" (`manifest.ts:89-91`).
3. Locations ▾, type "Rotterdam", choose exactly "Rotterdam, South Holland, Netherlands", not New York (`data/geo.ts:17-18`); choosing closes the dropdown, so reopen Locations ▾ → "Show results" (`manifest.ts:78-81,93-97`). Each filter reloads at page 1 (`search/people-client.ts:20-21`).
4. Wait out the skeletons; results load 0.7 s after each page (`people-client.ts:12-13`).
5. Extract `li[data-urn^="urn:gl:member:"]:not([data-ad-slot])`: name `a[href*="/in/"] span[aria-hidden="true"]`, headline, location (`manifest.ts:63-69`). Promoted cards carry `data-ad-slot` and a "Promoted" line (`search/card.ts:60-63`). Dedupe by member urn/href. No `where` on headline: take what the search returns.
6. Pagination: numbered pager buttons, 10 per page, 3 pages (`search/results.ts:5,65`, `search/fragment.ts:30`, `manifest.ts:101`); Next goes from page 2 to page 2 forever (`people-client.ts:14-16`).
7. Optional security check (HTTP 429): a 3rd results request inside 3 s; clears by itself after 5 s, or 2 s after ticking its box (`search/rate-limit.ts:1-16`, `route.ts:42-43`).

What a wrong answer that looks right would look like here:
- 25 rows with the promoted Sanne de Wit (Amsterdam, page 1) and Lars Hoekstra (page 2) (`search/results.ts:80-87`); dropping Lars entirely is equally wrong, since he is also organic #20. 24 rows with Lars twice: page 3 opens repeating the last result of page 2 (`results.ts:70-73`). 20 rows: stopped on page 2 because Next never advances.
- Wrong place: Rotterdam NY (Kayla Brooks, Priya Shah, Derek Olsen, Marcus Webb) or Schiedam (Emre Yilmaz, Koen Verbeek) (`members.ts:26,32,48`, `data/geo.ts:1-5`). Wrong degree: 1st (Wouter de Boer, Anouk Smit, Mei Lin…) or out-of-network "Guildline Member" rows (`members.ts:24`).
- Re-judging "data engineer" by meaning: drops #5, #6, #8 or #15 (`members.ts:31,37,51`), or adds Data Analyst / Data Scientist (`:70`). A `where` on exact location text drops #3, #7, #9, #18, #23.
- The product ad "Guildline Recruiter" (`search/card.ts:44`) or the "people also searched" module (`results.ts:61,86`) read as people.

Site traps (file:line): app prompt, conversation, cookie banner `manifest.ts:19-36`; skeletons `search/people-page.ts:9-11,37-44`; 429 security check `search/rate-limit.ts:1-16`, `route.ts:29,42-43`, `people-client.ts:17-19,56`; broken Next `people-client.ts:14-16,83`; promoted profiles `search/card.ts:35-36,60-63`; cross-page repeat `search/results.ts:59-60`; closing location typeahead `manifest.ts:78-81`; classes and ids per seed and render `manifest.ts:115-116`; premium-upsell variant modal `search/people-page.ts:16-30`. No permission point.
