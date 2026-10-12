// Matrix row 3: bigbox-retail's pickup-towels read, with a shortcut entry
// that a similar page with the wrong filters must not take.
//
// The wrong-filter page is a real one, reached the way a person reaches it.
// The Flow searches, ticks the five filters by their own checkboxes
// (`input[value="<group>:<option>"]`, waiting out the bot check the third
// results document raises), and then presses the results' Next arrow, which
// an older helper builds from the query and page alone
// (`pages/results-pagination.ts`): it lands on page 2 of every paper towel,
// filters dropped, a page that looks like the narrowed results and is not.
//
// Only there does it call the `filtered-read` part, whose frame chooses its
// entry at that invocation (contract C2): the `read` entry would start at the
// read when the Today filter is ticked; on the dropped-filter page it is not,
// so the part must begin at its default, tick the filters again (ticking one
// returns the results to page 1), and read the kept listings. The primary
// block declares no entry, so the first entry record in the run is the part's.
//
// The entry's fact names the Today checkbox by a locator (`at "<css>"`,
// t402): a hand-authored Flow has no evidence handle. The site renders a
// ticked filter with the `checked` attribute, and the locator asks for the
// checked one, so `exists` holds only on a page where Today is in force. A
// locator sits inside the line's double quotes, so its own quotes are single.
//
// The read's item and fields are the scenario's own recorded extraction
// (`manifest/pickup-towels-workflow.ts`). It reads one page: a read that pages
// by itself is refused (`web.extract_list.paginate_retired`; a Flow pages with
// a Next step and a repeat), and the row is about the entry, not the paging.
const FILTERS = [
  ["only paper towels", "dept:Paper Towels", ""],
  ["only what ValueRidge sells", "retailer_type:ValueRidge", "25000"],
  ["only pickup", "fulfillment_method:Pickup", "25000"],
  ["only today", "fulfillment_speed:Today", ""],
  ["four stars and up", "customer_rating:4 & up", ""],
] as const;

/** The five filter steps, indented for the block they are written in. */
function filterSteps(indent: string): string {
  return FILTERS.map(([words, value, timeoutMs]) => [
    `${indent}step: ${words}`,
    `${indent}  node: web.dom.check`,
    `${indent}  selector: input[type="checkbox"][value="${value}"]`,
    `${indent}  checked: true`,
    ...(timeoutMs ? [`${indent}  timeoutMs: ${timeoutMs}`] : []),
  ].join("\n")).join("\n");
}

export const TOWELS_FILTER_ENTRY = String.raw`flow: Read the paper towels ValueRidge sells that the home store can hand over today, rated 4.5 or better, on the first page of results
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
${filterSteps("")}
step: go to the next page by the arrow
  node: web.dom.click
  selector: nav[aria-label="Pagination"] a[aria-label="Next page"]
  consequences: none
step towels: read the kept towels with every filter in force
  call: filtered-read
part filtered-read: read the kept towels with every filter in force
${filterSteps("  ")}
  start at: read
  when: exists at "input[type='checkbox'][value='fulfillment_speed:Today']:checked"
  step read: read the kept listings on the first page
    node: web.dom.extract_list
    extractList.item: div[data-item-id]:not(:has(> div:first-child)):has(span[style="--pct:90%"], span[style="--pct:92%"], span[style="--pct:94%"], span[style="--pct:96%"], span[style="--pct:98%"], span[style="--pct:100%"]):not([data-item-id="433201876"], [data-item-id="470665371"])
    extractList.fields: {"name": "a span", "price": "span:has(+ span > sup)", "unitPrice": "div:has(> span > sup) > div", "rating": "span:has(+ span[style])"}
    extractList.minItems: 0
end`;
