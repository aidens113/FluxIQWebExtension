// Matrix row 3: bigbox-retail's pickup-towels read, with an entry that reads
// from where the run is when the results are already narrowed.
//
// The run starts on page 2 of the paper-towel results reached by the Next
// arrow, which drops every filter: a page that looks like the narrowed results
// and is not. The default path searches, ticks the five filters by their own
// checkboxes (`input[value="<group>:<option>"]`, waiting out the bot check the
// third results page raises), and reads the kept listings across every page,
// following the page number after the current one rather than the arrow. The
// `read` entry would begin at the read when the Today filter is ticked; on the
// dropped-filter page it must be refused.
//
// The read's item, fields and paging are the scenario's own recorded
// extraction (`manifest/pickup-towels-workflow.ts`).
//
// **Authoring gap.** The entry's condition is a fact about the Today filter,
// which the candidate grammar can name only by an evidence handle;
// `today-filter` is a placeholder for it, and the runner refuses the Flow.
export const TOWELS_FILTER_ENTRY = String.raw`flow: Read the paper towels ValueRidge sells that the home store can hand over today, rated 4.5 or better, across every page
step: accept the privacy choices if they are still asked
  node: web.dom.click
  selector: [role="dialog"][aria-modal="true"] button:first-of-type
  consequences: none
  optional: yes
step: decline the email offer if it shows
  node: web.dom.click
  selector: form + a[href="#"]
  timeoutMs: 8000
  consequences: none
  optional: yes
step: search for paper towels
  node: web.dom.type
  selector: input[type="search"]
  element.tagName: input
  element.attributes: {"type": "search", "name": "q"}
  text: paper towels
  submit: true
  consequences: none
step: only paper towels
  node: web.dom.check
  selector: input[type="checkbox"][value="dept:Paper Towels"]
  checked: true
step: only what ValueRidge sells
  node: web.dom.check
  selector: input[type="checkbox"][value="retailer_type:ValueRidge"]
  checked: true
  timeoutMs: 25000
step: only pickup
  node: web.dom.check
  selector: input[type="checkbox"][value="fulfillment_method:Pickup"]
  checked: true
  timeoutMs: 25000
step: only today
  node: web.dom.check
  selector: input[type="checkbox"][value="fulfillment_speed:Today"]
  checked: true
step: four stars and up
  node: web.dom.check
  selector: input[type="checkbox"][value="customer_rating:4 & up"]
  checked: true
start at: read
when: exists today-filter
step read: read the kept listings on every page
  node: web.dom.extract_list
  extractList.item: div[data-item-id]:not(:has(> div:first-child)):has(span[style="--pct:90%"], span[style="--pct:92%"], span[style="--pct:94%"], span[style="--pct:96%"], span[style="--pct:98%"], span[style="--pct:100%"]):not([data-item-id="433201876"], [data-item-id="470665371"])
  extractList.fields: {"name": "a span", "price": "span:has(+ span > sup)", "unitPrice": "div:has(> span > sup) > div", "rating": "span:has(+ span[style])"}
  extractList.paginate: {"mode": "next", "next": "nav[aria-label=\"Pagination\"] a[aria-current=\"page\"] + a", "maxPages": 5}
  extractList.minItems: 0`;
