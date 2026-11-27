// What kestrel `run-mwz2jc4w-0c207128`'s attempt 2 saw around its search (step 0043), for
// `./seen.test.ts` (t1083, K1). The route states are the host's projection of the
// client's own captures (`../../project.ts` over the sanitized packet), from the Lab's
// auction-marketplace fixture site:
//
//   - the home page the search was typed on (trace seq 56, after 0040 opened it);
//   - the site's robot check the submitted search landed on, the same at all six looks
//     the effect wait took (trace seq 77, 80, 83, 86, 89 and 92);
//   - the results page the check let the visitor on to (trace seq 123, 14:24:22.613).
//
// The effect is the one the saved Flow's s4 ("Search for anything", typed with
// `submit`) carried, signed before t1083: no `from`.

import type { JsonObject } from "fluxiq/core";

/** s4's recorded effect: the home page to the results page. */
export const KESTREL_SEARCH_EFFECT: JsonObject = {
  "v": "web-effect.v1",
  "added": [
    "0c81db3a",
    "144c23ed",
    "33098d23",
    "3cce455f",
    "3da55853",
    "456430d9",
    "498a7035",
    "4d4412ef",
    "4e2659a4",
    "4fce1235",
    "517ad735",
    "551f758f",
    "5eb154c8",
    "5eea5119",
    "60911ad8",
    "6444a4d7"
  ],
  "removed": [
    "0790af46",
    "23903c83",
    "434bc2af",
    "44f9bd82",
    "5bb84371",
    "688ca193",
    "728e6683",
    "7731cb76",
    "79c38042",
    "80b260a8",
    "8be0fcda",
    "c889891d",
    "ef973994",
    "f0ad8c83",
    "fc977788",
    "ffe0d403"
  ],
  "path": "488e7727",
  "marked": {
    "added": [
      "014b5fe2",
      "063def6b",
      "070e0286",
      "0d056047",
      "1929911e",
      "1ea0a508",
      "27e2fa3a",
      "34662e7f",
      "3536d6a3",
      "3d4ce637",
      "41f8c453",
      "4d130443",
      "4ed08d1b",
      "5a3eb72e",
      "5e221120",
      "61fc523b"
    ],
    "removed": [
      "1ac1eb2d",
      "1eaec5bc",
      "221a6ecd",
      "2cf41160",
      "3df7279c",
      "5ea9f43d",
      "5f4258c9",
      "8735c35d",
      "8e04028f",
      "95723f44",
      "a870cb59",
      "acfe569d",
      "ad4ccf6b",
      "c330c5be",
      "dcb5aee0",
      "ebac6c45"
    ]
  }
};

/** The home page the search was typed on. */
export const KESTREL_HOME: JsonObject = {
  "page": {
    "location": "http://127.0.0.1:52619/scenarios/auction-marketplace/",
    "path": "/scenarios/auction-marketplace/",
    "title": "Buy and sell cameras, collectibles and more | Hammerline",
    "controls": "Sign out | Daily Deals | Help & Contact | Sell | Watchlist 2 | My Hammerline | hammerline | Search for anything | Select a category for search | Search | Advanced | Kestrel 35S rangefinder camera, 40mm f/1.7 | [Kestrel 35S rangefinder camera, 40mm f/1.7] Place bid | ♡ Add to Watchlist | [Your saved searches] kestrel 35 | [Shop by category] Film cameras | Rangefinders | Lenses | Kestrel | [Deals for you] Vantor V2 rangefinder with 50mm f/2 — serviced £219.00 | Ostara Autoflex TLR camera, 75mm f/3.5 £125.00 | Vantor 28mm f/3.5 wide-angle lens EUR 89,00 | Portra 400 35mm film x5 — for Kestrel, Ostara, any 35mm £52.00 | [Your recently viewed items] Kestrel 35S rangefinder camera, 40mm f/1.7 £88.00 | Kestrel 35 — CLA'd 2025, shutter accurate, lovely example US $189.00 | Kestrel 35 — mint, boxed, with 3 lenses & hood EUR 1.165,00 | Ostara 50mm f/1.8 lens, M39 mount, clean glass £68.00 | Chat with Hal"
  }
};

/** The robot check the search landed on, which lets the visitor on by itself after five seconds. */
export const KESTREL_CHECK: JsonObject = {
  "page": {
    "location": "http://127.0.0.1:52619/scenarios/auction-marketplace/splashui/challenge?ru=%2Fscenarios%2Fauction-marketplace%2Fsch%2Fi.html%3F_nkw%3Dkestrel%2B35%26_sacat%3D0",
    "path": "/scenarios/auction-marketplace/splashui/challenge",
    "title": "Pardon the wait | Hammerline",
    "controls": "[Checking your browser before you continue] Continue"
  }
};

/** The results page the check let the visitor on to. */
export const KESTREL_RESULTS: JsonObject = {
  "page": {
    "location": "http://127.0.0.1:52619/scenarios/auction-marketplace/sch/i.html?_nkw=kestrel+35&_sacat=0",
    "path": "/scenarios/auction-marketplace/sch/i.html",
    "title": "kestrel 35 for sale | Hammerline",
    "controls": "Sign out | Daily Deals | Help & Contact | Sell | Watchlist 2 | My Hammerline | hammerline | Search for anything | Select a category for search | Search | Advanced | Seller refurbished (1) | Pre-owned (45) | For parts or not working (6) | Model | Type | Minimum Value in £ | Maximum Value in £ | Submit price range | [52 results for kestrel 35] Save this search | All listings | Auction | Buy it now | Sort: Best Match | Watch this item | Kestrel 35S rangefinder camera, 40mm f/1.7 | [Kestrel 35S rangefinder camera, 40mm f/1.7] Kestrel 35 Rangefinder Camera | [Kestrel 35 Rangefinder Camera] Kestrel 35 rangefinder camera body + original leather case | Original lens cap for Kestrel 35 | [Original lens cap for Kestrel 35] Kestrel 35 rangefinder, 45mm f/2.8 lens, film tested | [Kestrel 35 rangefinder, 45mm f/2.8 lens, film tested] Portra 400 35mm film x5 — for Kestrel, Ostara, any 35mm | [Portra 400 35mm film x5 — for Kestrel, Ostara, any 35mm] New listing Kestrel 35-S compact rangefinder — tested | [New listingKestrel 35-S compact rangefinder — tested] Kestrel 35, early serial 10xxx, beautiful | [Kestrel 35, early serial 10xxx, beautiful] KESTREL 35 45mm f/2.8 Voss-Anastigmat — film tested, new seals | [KESTREL 35 45mm f/2.8 Voss-Anastigmat — film tested, new seals] Vantor V2 rangefinder with 50mm f/2 — serviced | [Vantor V2 rangefinder with 50mm f/2 — serviced] Leather half case for Kestrel 35 — tan, black or oxblood | [Leather half case for Kestrel 35 — tan, black or oxblood] Kestrel 35 for spares or repair, shutter jammed | [Kestrel 35 for spares or repair, shutter jammed] Kestrel 35 Mk II rangefinder, 45mm f/2 | [Kestrel 35 Mk II rangefinder, 45mm f/2] New listing Kestrel 35 Kamera Messsucher 45mm 2.8 — sehr gut | [New listingKestrel 35 Kamera Messsucher 45mm 2.8 — sehr gut] Kestrel 35 — mint, boxed, with 3 lenses & hood | [Kestrel 35 — mint, boxed, with 3 lenses & hood] Case only — for Kestrel 35 rangefinder (camera not included) | [Case only — for Kestrel 35 rangefinder (camera not included)] Kestrel 50 Deluxe 35mm film camera | [Kestrel 50 Deluxe 35mm film camera] Kestrel 35 rangefinder — collection only, Sheffield | [Kestrel 35 rangefinder — collection only, Sheffield] Kestrel 350 SLR body only | [Kestrel 350 SLR body only] Kestrel 35 boxed, near mint, with instructions | [Kestrel 35 boxed, near mint, with instructions] Kestrel 35 instruction manual (reprint) | [Kestrel 35 instruction manual (reprint)] Kestrel 35 lens only — 45mm f/2.8, removed from body | [Kestrel 35 lens only — 45mm f/2.8, removed from body] New listing Kestrel 35 — Buy it now, fast dispatch from Leeds | Remove from Watchlist | [Kestrel 35 Rangefinder Camera] Kestrel 35 — CLA'd 2025, shutter accurate, lovely example | [Kestrel 35 — CLA'd 2025, shutter accurate, lovely example] 1 | 2 | 3 | Go to next search page | Items per page | kestrel 35s | kestrel rangefinder | kestrel 35 case | Chat with Hal"
  }
};
