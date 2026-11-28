# Phase 1: how big is the "entire page" input

Measured 2026-11-28, provider-free, no product code touched. Scripts are in the session scratchpad, not in the repository.

## Method

- **Browser:** Playwright 1.51.1 (repo `node_modules`), Chromium 1161, headless, viewport 1534x945, fresh temporary profile (deleted afterwards), no login, no cookies kept, no input. Each page: `domcontentloaded`, then `load` and `networkidle` where they came, then 4 s more. No scrolling, so lazily loaded rows are not in these numbers.
- **Source:** `document.documentElement.outerHTML` after JS ran. It was parsed again with `DOMParser` in a blank page and walked in document order.
- **Format (D1):** one element per line, two spaces of indent per depth, `tag attr="value" ...`. Every non-blank text node is its own quoted line (whitespace collapsed). HTML comments are left out (under 500 characters on every page). Shadow DOM and iframe contents are not in `outerHTML` and are not counted. The per-element handle that D1 adds (`@t412`, about 6 characters) is not included: add about 6 characters x elements (13k to 30k characters on the big pages).
- **Variants:** V1 everything. V2 = V1 without `script` and `style` text (the elements stay). V3 = V2 with `d` (path) and `points` (polygon, polyline) values emptied and base64 `data:` URIs replaced by `data:...`. V4 = V3 without `class` values longer than 200 characters.
- **Tokens:** `@anthropic-ai/tokenizer` is not installed (no `@anthropic-ai` in `node_modules`), so tokens are characters / 3.5 everywhere. Real HTML-ish text often tokenizes nearer 3 characters per token, which would add about 17 percent. Treat tokens as an estimate, not a count.
- **Not reachable without a bypass (not attempted, replaced):** ebay (error page), old.reddit and www.reddit (login wall), bestbuy (country picker), newegg (challenge), wayfair (access denied), rei (protocol error). Their small "sizes" in the raw runs are block pages and are not used.

## Sizes (characters, estimated tokens)

| Page | Elements | outerHTML | V1 | V2 | V3 | V4 |
|---|---|---|---|---|---|---|
| eldorado.gg OSRS accounts (user's task page) | 2,196 | 344,453 | 396,908 (113.4k) | 313,485 (89.6k) | 276,328 (79.0k) | 269,024 (76.9k) |
| IKEA sofas listing (e-commerce) | 4,301 | 1,435,633 | 1,555,036 (444.3k) | 635,888 (181.7k) | 566,591 (161.9k) | 566,591 (161.9k) |
| Nike men's shoes listing (e-commerce) | 5,064 | 1,821,687 | 1,994,351 (569.8k) | 809,514 (231.3k) | 796,460 (227.6k) | 796,460 (227.6k) |
| BBC News front page (news) | 1,690 | 351,106 | 385,834 (110.2k) | 254,689 (72.8k) | 235,728 (67.4k) | 235,728 (67.4k) |
| Remote OK (job board) | 3,797 | 950,576 | 913,615 (261.0k) | 776,323 (221.8k) | 704,723 (201.3k) | 704,723 (201.3k) |
| discuss.python.org /latest (forum) | 1,979 | 604,704 | 615,319 (175.8k) | 390,254 (111.5k) | 185,302 (52.9k) | 185,302 (52.9k) |
| Hacker News front (small control) | 787 | 32,868 | 54,707 (15.6k) | 54,707 (15.6k) | 54,707 (15.6k) | 54,707 (15.6k) |
| Lobsters front (small control) | 848 | 55,624 | 64,288 (18.4k) | 64,197 (18.3k) | 64,197 (18.3k) | 64,197 (18.3k) |

V1 is not smaller than `outerHTML` in general: dropping `<`, `>` and closing tags saves little, and the indentation and per-text-node quotes add it back (HN: 32.9k to 54.7k).

## What takes the space (share of V1 characters)

| Page | script bodies | style bodies | SVG subtree (overlaps the rest) | SVG path data | base64 | all class attrs | class attrs over 200 chars |
|---|---|---|---|---|---|---|---|
| eldorado.gg | 5.3% | 15.7% | 14.8% | 9.4% | 0% | 10.4% | 1.8% (32 attrs) |
| IKEA | 55.3% | 3.8% | 7.0% | 4.5% | 0% | 9.5% | 0% |
| Nike | 31.4% | 28.0% | 1.7% | 0.7% | 0% | 6.8% | 0% |
| BBC | 27.2% | 6.8% | 7.0% | 4.9% | 0% | 21.9% | 0% |
| Remote OK | 14.7% | 0.3% | 0.3% | 0.1% | 7.7% | 4.9% | 0% |
| discuss.python.org | 35.1% | 1.5% | 41.3% | 33.3% | 0% | 4.0% | 0% |
| Hacker News | 0% | 0% | 0% | 0% | 0% | 13.0% | 0% |
| Lobsters | 0.1% | 0% | 0.1% | 0% | 0% | 13.2% | 0% |

The SVG column counts every line inside an `svg` element, so it overlaps path data and class attributes.

## Recorded compact views, for comparison (this repository's `test-runs/manual-panel/`)

| Item | Characters | Estimated tokens |
|---|---|---|
| `core.page_window` inside a decide request, eldorado home, step 0003 | about 8,200 | about 2.3k |
| `core.page_window`, step 0030 (largest in that run) | about 18,100 | about 5.2k |
| `core.page_window`, current run step 0016 | about 21,100 | about 6.0k |
| Whole decide request.json, step 0003 | 67,833 | about 19.4k |
| Whole decide request.json, step 0036 / largest (0065) | 207,514 / 223,932 | about 59k / 64k |
| `core.full_page` capture, step 0049 (`page.txt`) | 180,581 | about 51.6k |

For the same site, the full-page capture (180,581 characters) is a compact view that already drops all script and style bodies. The user's task page as raw V1 is 396,908 characters, 2.2x that. Against the page window the model sees today (2.3k to 6k tokens), V1 is 19x to 50x more page.

## Cost and wait per decision

Prices are quoted from the claude-api skill's model table (cached 2026-11-03), per million tokens:

- Haiku 5.5: input $0.10 and output $0.50 for prompts up to 100K tokens, $0.50 and $2.50 beyond that.
- Sonnet 5.5: input $2.00, output $10.00, cache reads $0.10 (the skill says Sonnet 5.5 cache reads are $0.10; for Haiku it states no cache price).

Assumptions I made, not quotes:

- Haiku cache reads at 0.1 x the input price of the tier, which is the skill's "about 0.1x" rule.
- The Haiku higher tier applies to the whole request once it passes 100K tokens.
- One page plus 15k tokens of instructions and history per request, and 500 output tokens.
- Wait is **not measured** (no API call was made). It assumes prefill of 20k tokens per second on Haiku and 8k on Sonnet, and output of 150 and 70 tokens per second. It is a planning figure only. A real latency probe would cost money, so it was not run.

Cost columns: no cache; 15k instructions cached and the page new (the usual case, because the page changes per decision); page also cached (only when the page is unchanged from the previous decision).

| Page | Variant | Request tokens | Haiku no cache | Haiku 15k cached | Haiku page also cached | Sonnet no cache | Sonnet 15k cached | Sonnet page also cached |
|---|---|---|---|---|---|---|---|---|
| eldorado | V1 | 128.4k | $0.065 | $0.059 | $0.008 | $0.262 | $0.235 | $0.031 |
| eldorado | V2 | 104.6k | $0.054 | $0.047 | $0.006 | $0.214 | $0.187 | $0.026 |
| eldorado | V3 | 94.0k | $0.010 | $0.008 | $0.001 | $0.193 | $0.166 | $0.024 |
| IKEA | V1 | 459.3k | $0.231 | $0.224 | $0.024 | $0.924 | $0.897 | $0.097 |
| IKEA | V3 | 176.9k | $0.090 | $0.083 | $0.010 | $0.359 | $0.332 | $0.040 |
| Nike | V1 | 584.8k | $0.294 | $0.287 | $0.030 | $1.175 | $1.148 | $0.122 |
| Nike | V3 | 242.6k | $0.123 | $0.116 | $0.013 | $0.490 | $0.463 | $0.054 |
| BBC | V1 | 125.2k | $0.064 | $0.057 | $0.008 | $0.255 | $0.228 | $0.030 |
| BBC | V3 | 82.4k | $0.008 | $0.007 | $0.001 | $0.170 | $0.143 | $0.021 |
| Remote OK | V1 | 276.0k | $0.139 | $0.133 | $0.015 | $0.557 | $0.530 | $0.060 |
| Remote OK | V3 | 216.3k | $0.109 | $0.103 | $0.012 | $0.438 | $0.411 | $0.048 |
| discuss.python.org | V1 | 190.8k | $0.097 | $0.090 | $0.011 | $0.387 | $0.360 | $0.043 |
| discuss.python.org | V3 | 67.9k | $0.007 | $0.006 | $0.001 | $0.141 | $0.114 | $0.019 |

Each cost includes 500 output tokens ($0.0003 to $0.005). V2 rows for the other pages are in the scratchpad output and sit between V1 and V3.

| Page | Variant | Request tokens | Haiku wait (s) | Sonnet wait (s) |
|---|---|---|---|---|
| eldorado | V1 | 128.4k | about 10 | about 23 |
| eldorado | V3 | 94.0k | about 8 | about 19 |
| IKEA | V1 | 459.3k | about 26 | about 65 |
| Nike | V1 | 584.8k | about 33 | about 80 |
| BBC | V1 | 125.2k | about 10 | about 23 |
| Remote OK | V1 | 276.0k | about 17 | about 42 |
| discuss.python.org | V1 | 190.8k | about 13 | about 31 |

Prompt caching with a changing page saves only the 15k instructions, which is 5 to 12 percent of the request, so the page itself is billed in full every decision. It only changes the picture when the same page is sent twice in a row (then the whole request is cache-read).

## Conclusion

- **Pushback 1 holds, on numbers.** The user's literal V1 is 79k to 570k tokens for a single page: 113k on the eldorado task page, 110k on a news front, 261k on a job board, 444k to 570k on big shop listings. Only tiny server-rendered pages (HN, Lobsters) stay under 20k.
- **The size is not the markup characters.** Removing `<`, `>` and closing tags saves almost nothing. What dominates: script bodies (up to 55%, IKEA), style bodies (up to 28%, Nike; 16% on eldorado), inline SVG (41% on discourse, mostly path data), base64 (7.7% on Remote OK), class attributes (10 to 22% on some pages, but almost never over 200 characters).
- **V2 (drop script and style bodies, keep every element) is the one cut that matters.** It saves 21% on eldorado, 34% on BBC, 59% on IKEA and Nike, 15% on Remote OK, 37% on discourse. None of it is page content a person sees, and the elements, attributes and text nodes are all still sent.
- **V3 adds** 12% on eldorado, 53% more on discourse (SVG path data), 9% on Remote OK (base64). **V4 adds almost nothing** (eldorado 2.6%, others 0): not worth a rule.
- **Cost per decision on the user's task page:** V1 about $0.26 on Sonnet 5.5 and $0.065 on Haiku 5.5 (V3: $0.19 and $0.010). Big shop listings at V1 are $0.92 to $1.18 on Sonnet and 26 to 33 s of assumed prefill wait; at V2 they are $0.40 to $0.50. A 10-decision run on eldorado costs about $2.60 on Sonnet at V1.
- **A cliff on Haiku:** Haiku's price rises 5x above 100K prompt tokens. Eldorado V1 (128k) crosses it, V3 (94k) does not, so V1 costs about 6x V3 on Haiku. That cliff, not the character count, is what decides whether the cheap model stays cheap.
- **Recommendation for the user's decision:** the rule "feed the entire page" can stay literal for elements, attributes and text, with D1 fixed as V2 or V3: script and style bodies, SVG path data and base64 payloads are not page content. If the user still wants V1, it is buildable at the costs above, with pages up to 570k tokens (inside the 1M context window, but about $1 and 80 s per decision on Sonnet).
- **Unmeasured:** real tokenizer counts, real latency, lazily loaded rows (no scrolling), shadow DOM and iframe content, and pages behind bot walls (ebay, reddit, bestbuy, newegg, wayfair). The sites are marketplace/news/forum pages seen as an anonymous headless visitor and may serve different markup to real users.
