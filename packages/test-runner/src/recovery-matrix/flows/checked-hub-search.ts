// Matrix case 15: a check only a person may pass, met by a saved Flow's run part
// way through and again at its last step, is handed to the person, and once they
// clear it the run goes on from that step with no model call (t972, F18).
//
// crossborder-marketplace's traffic screen replaces every results load once two
// have been made since it was last passed (`apps/scenario-lab/src/scenarios/
// crossborder-marketplace/route.ts`). Passing it reloads the address that was
// asked for, which is the first load counted again. So, from the home page, by
// the node keys Core saves (each optional step is followed by the merge its plan
// adds, s2 and s4):
//
//   s5  search            results load 1
//   s6  Free shipping     results load 2
//   s7  4★ & up           load 3: the screen, mid-Flow; once passed, its reload is load 1
//   s8  Price ↑           load 2
//   s9  type Max 10       no load
//   s10 OK                load 3: the screen again, at the Flow's last step
//
// In live run `run-mwoq9g4l-dbd69bd6` a saved Flow's replay met the screen at its
// last step, the person cleared it and pressed Continue, and Core ended the run as
// though they had pressed Stop (`engine/automation/person-needed.ts` in Core,
// `automationStudioPersonNeededEnding`): the attempt then went back to the model
// to repair a Flow that had done its work. Each press here is a plain press that
// says nothing of what it leaves, so once the check is cleared the run goes on
// from it without pressing it again (`engine/automation/person-cleared.ts`): the
// filters are toggles, and a second press would undo one.
//
// Every class is the build's hash for the canonical seed (7342), as the scenario's
// own scripts name them (`manifest/steps.ts`): `css-0bsf0ra` the sidebar, whose
// second and third groups (`css-00bqgkn`) are Delivery and Rating, each one option
// (`css-1l94r3x`); `css-17rxkzv > css-1ow3nqx` the sort tabs, the fourth "Price ↑";
// `css-1h3taby` the price boxes and their OK button (`css-0a6ojji`). The 4★ filter
// comes before the ceiling because toggling a filter drops the price boxes' values
// (`markup/search.ts`, `toggled`), and a sort keeps them.
export const CHECKED_HUB_SEARCH = String.raw`flow: Show free-shipping USB-C hubs rated 4 stars and up, cheapest first, at 10 euros or less
step: decline the welcome coupons if they are still offered
  node: web.dom.click
  selector: .css-033dshf > .css-0tkka45
  timeoutMs: 10000
  consequences: none
  optional: yes
step: accept the cookies if they are still asked
  node: web.dom.click
  selector: .css-0rslz0n > .css-15iz7xc
  consequences: none
  optional: yes
step: search for usb c hub
  node: web.dom.type
  selector: input[name="q"]
  element.tagName: input
  element.attributes: {"name": "q"}
  text: usb c hub
  submit: true
  consequences: none
step: show only free shipping
  node: web.dom.click
  selector: .css-0bsf0ra > .css-00bqgkn:nth-of-type(2) > .css-1l94r3x
  timeoutMs: 8000
  consequences: none
step: show only 4 stars and up
  node: web.dom.click
  selector: .css-0bsf0ra > .css-00bqgkn:nth-of-type(3) > .css-1l94r3x
  timeoutMs: 8000
  consequences: none
step: sort by price, lowest first
  node: web.dom.click
  selector: .css-17rxkzv > .css-1ow3nqx:nth-child(4)
  timeoutMs: 8000
  consequences: none
step: set the price maximum to 10
  node: web.dom.type
  selector: .css-1h3taby > input[placeholder="Max"]
  element.tagName: input
  element.attributes: {"placeholder": "Max"}
  text: 10
step: apply the price maximum
  node: web.dom.click
  selector: .css-1h3taby > .css-0a6ojji
  timeoutMs: 8000
  consequences: none`;
