# t223: an example of the compact page view

This is the page the model saw in lane C's run on 2026-10-01 at 05:17: Everything Store, results for "wireless earbuds". It is shown here in the proposed format. Every line comes from that run's recorded packet: the words, the handles, the hrefs, the states.

The excerpt shows the top of the page and the first product card. Today the model received this page as 340,542 bytes of JSON, about 113,500 tokens. A prototype of this format renders the whole page in 22,307 bytes, about 7,400 tokens: 15 times smaller.

## What the model sees

```text
PAGE "Brightaisle.com : wireless earbuds"
URL ~/s?i=all&field-keywords=&k=wireless+earbuds   (~ = http://127.0.0.1:58717/scenarios/everything-store)
VIEW 1280x720 at the top · 362 elements with visible words or a control, in page order · find_on_page searches the rest
COVERING t209 "Minimum price" covers 2 · t259 covers 1 · t290 covers 1 · t322 covers 1 · t350 covers 1

[banner]
t903 link "Brightaisle" ~/
t904 "Deliver to Dana Portland 97214"
[search]
t154 select "Search in" ="All" [All|Electronics|Home & Kitchen|Grocery|Toys & Games]
t910 field "Search Brightaisle" ="wireless earbuds"
t158 button "Go"
[banner]
t911 link "Hello, Dana Account & Lists" ~/#account
t913 link "Returns & Orders" ~/#orders
t915 link "2 items in cart" ~/cart
[navigation]
t917 link "All" ~/#all
t918 link "Today's Deals" ~/#today-s-deals
t919 link "Customer Service" ~/#customer-service
[main]
t177 "1-16 of over 1,000 results for \"wireless earbuds\""
t180 select "Sort by:" ="Featured" [Featured|Price: Low to High|Price: High to Low|Avg. Customer Review]
[complementary]
t184 "Delivery"
t185 link "Brightaisle Plus" ~/s?k=wireless+earbuds&rh=plus
t194 "Price"
t195 link "Under $25" ~/s?k=wireless+earbuds&rh=price-under-25
t198 link "$25 to $50" ~/s?k=wireless+earbuds&rh=price-25-50
t209 field "Minimum price" =""
t211 field "Maximum price" =""
t212 button "Go"
t214 "Brands"
t215 link "Kinetra" ~/s?k=wireless+earbuds&rh=brand-kinetra
t218 link "Lumo Audio" ~/s?k=wireless+earbuds&rh=brand-lumo-audio
t234 button "See more"
[main]
- 1/15
t239 "Sponsored"
t240 button "Leave ad feedback"
t241 link ~/sspa/click?ie=UTF8&adId=sp-7Q2K91&url=%2Fscenarios%2Feverything-store%2FPulsebud-Neo-ANC-Wireless-Earbuds-Hybrid-Active-Noise%2Fdp%2FB0DPN4ANC7
t242 img (alt = the title below)
t244 "Pulsebud"
t246 h2 link "Pulsebud Neo ANC Wireless Earbuds, Hybrid Active Noise Cancelling Bluetooth 5.4 Headphones, 50H Playtime, App EQ, Black" same href
t252 "4.5 out of 5 stars"
t253 link "8,214 ratings" same href#customer-reviews
t256 link "$39.99" same href
t263 "FREE delivery"
t264 img "Brightaisle Plus"
t265 "Thu, Sep 24"
t267 button "Add to cart"
- 2/15
t270 "Sponsored"
...
```

How to read it:

- **`t267`** is the handle the model uses to act on that element.
- **No kind word** (`t252 "4.5 out of 5 stars"`) means plain visible text.
- **`~`** is the site's base URL, so links stay short.
- **`- 1/15`** starts result card 1 of 15.
- **`[main]`, `[search]` and the other bracketed words** are page regions.
- **`COVERING`** names elements drawn over others; the covered elements say `covered-by`.
- **Below the visible area**, a `--- below the fold ---` line marks where it starts.
- **Left out:** attributes, pixel boxes, CSS classes, and elements with no visible words that are not controls.

The search field's honeypot (`t155`) is not in this view. It is hidden off-page at x = -9768, so the model never sees it as a field it should fill. Today's format lists it like any other field.

## Searching for anything else

The model calls `find_on_page` to search the page's text and every attribute, including hidden and off-page elements. These are real results on the same page:

```text
find_on_page {"query":"sponsored"}
8 matches
t237 div "Sponsored ⓘ PulsebudPulsebud Neo ANC Wireless Earbuds, Hybrid Active Noise Cance" on screen
t239 span "Sponsored" on screen
t268 div "Sponsored ⓘ Lumo AudioLumo Audio Drift Wireless Earbuds, Bluetooth 5.3 Headphone" on screen
t270 span "Sponsored" on screen
t424 p "Featured from our brands Sponsored" below
t425 span "Sponsored" below
t622 div "Sponsored ⓘ SoundCrestSoundCrest AirPro Wireless Earbuds Bluetooth 5.3 In-Ear He" below
t624 span "Sponsored" below

find_on_page {"query":"field-keywords"}
2 matches
t155 field "Search in" (name="field-keywords") off-page
t925 link "Back to top" (href="http://127.0.0.1:58717/scenarios/everything-store/s?i=all&fi") below

find_on_page {"query":"add to cart"}
30 matches
t237 div "Sponsored ⓘ PulsebudPulsebud Neo ANC Wireless Earbuds, Hybrid Active Noise Cance" on screen
t267 button "Add to cart" on screen
t268 div "Sponsored ⓘ Lumo AudioLumo Audio Drift Wireless Earbuds, Bluetooth 5.3 Headphone" on screen
t302 button "Add to cart" on screen
t303 div "KinetraKinetra Run Wireless Earbuds, Bluetooth 5.3 Headphones with 60H Playtime," on screen
... 25 more: find_on_page {"query":"add to cart","after":5}
```

## Everything about one element

`describe` returns all the details for one element, on request only:

```text
describe {"target":"t155"}
t155 <input> field "Search in"
attributes: class="css-039clqg" type="text" name="field-keywords" value="" tabindex="-1" autocomplete="off" aria-hidden="true"
box: x=-9768 y=10 9x7 (off-page)
context: label=Search in hasValue=false onViewport=false landmark=search
```

## How this was made, and what is not final

- **Generator.** The prototype is `compact-view.mjs` in the supervisor's scratchpad, run on `everything-store--deep.recorded.packet.json` from t223-w1's corpus. It produced the search results and the `describe` result above exactly as shown.
- **Hand-tidied lines in the view.** Rules for these are not written yet, and t223 owns them:
  - `t904` and `t911` had their run-together words spaced.
  - The title shows once (`t246 h2 link`). The prototype printed it three times: as the image's alt text, the heading and the link.
  - The price shows once (`t256 "$39.99"`). The prototype printed `$39.99$39.99` and then the fragments `$`, `39.` and `99`.
  - The rating line `t252` was restored; the prototype's de-duplication dropped it.
- **Sizes.** The 22,307 bytes come from the prototype's untidied output, so the finished format should be a little smaller.
- **Handles.** `t155` stands for the packet's `target.155`. Whether the short form is used is t223's choice.
