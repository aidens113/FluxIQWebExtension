// What every model request this domain is bound to is told about the work
// (t237): that it operates a website for a person, how the compact page view
// reads, and the few rules a person would expect. Core inserts the text into
// the system message of each request -- evidence decisions, bootstrap, runtime
// patch, judge and chat commands -- after its own JSON and injection rules and
// before its task prose, so it says only what neither Core nor a tool
// description says.
//
// Live runs showed what was missing: `find_on_page` used as a site search (19
// of 84 decisions) and presses aimed under a popup. web-2 (F34,
// `run-muqiho5c-e830ce01`): told to close popups first, the model saw Add to
// cart covered-by the store's chat widget, closed a different popup ("Not
// now"), claimed that as the add to cart and never pressed it. Now the press
// comes first, and a refusal's closeWith (`../tool-rejection.ts`) names the
// covering layer's own controls. web-3 (F37, `run-muqk4u32-0b36e58f`): the
// model pressed "Space Grey" while it was already marked, which un-chose it,
// and Add to cart then answered "Please select a Color.", unread. web-4 (t252
// D8, `run-murwcaj0-40e56557`): the model pressed Confirm on a row its own
// listing excluded, so the build accepted a request the Flow had to leave
// alone; repetitive work is now a loop over the rows a listing kept, one act on
// one kept row or the act written without doing it, and changing values bound.
// web-5 (read-list redesign S4, `docs/working/first-class-data-extraction-plan/
// reports/read-list-collect-design.md` 4.2(g)): a read reads one page and no
// longer goes through pages by itself, so the Lists line adds that every page
// is a loop the Flow states -- the read, Next page on the same list, and a
// repeat on the read through Next page while it succeeds -- after the rule for
// acting on rows, which stays.
// web-6 (lane C, `run-mv0pa79q-ef91811b`): in candidate mode the model explores
// and then writes the whole Flow, its loops as repeat lines, but the Lists line
// named only the draft's amend_draft repeat and never said how much paging
// exploring needs. The model read all five result pages "to finish reading
// every results page before writing the Flow", spent its budget and never
// submitted. The paging loop is now stated for both authoring modes, and one
// page read plus one Next page is enough evidence: the loop reads the rest.
// web-7: categorical filtering uses evidence of the item's type, rather than
// treating every mention of another type in its title as membership in it.
// web-9 (t605): a control in a fieldset ends with group="...", its legend,
// and the reading paragraph says what that names.
// web-10 (lane 2 fix 4, `run-mvcxf4uz-64cd322c`): told to press a closer from a
// refusal's closeWith and then press again, the model instead pressed the
// covered control about 25 times across five briefs. A press under a layer the
// runtime can dismiss is now sent, and the runtime closes that layer first, as
// in playback (`../node-run/layer/runtime-clears.ts`); only a refusal that
// carries closeWith asks the model to press a closer.
// web-11 (user, 2026-10-18): FluxIQ declines optional cookies by default, so a
// consent banner is answered by declining them unless the instruction says
// otherwise; it was "accepted or dismissed" before.
// web-12 (t728, audit finding 3): the sentences that hold for every domain --
// written instructions outrank recordings, the person's limits (money, delete,
// send, no secrets), the loop and bound-value rules, item type by evidence,
// stating repeat in a draft or a written Flow, and efficiency -- moved to
// Core's own task prose (`system-prompt.ts` in Core), which places each in the
// task kinds that act or write steps. What remains here is web-only.
// The page-view terms are the
// ones the renderer prints (`../page-view/header.ts`, `line/render.ts`,
// `structure-markers.ts`, `element/kind.ts`, `element/state-tokens.ts`);
// "state repeat" is the wording Core's decision prose uses for a list.
//
// The shape is Core's `systemInstructions` seam, written structurally so this
// file imports nothing from Core. Change `version` whenever `text` changes, so a
// run bundle says which instructions its model read.
//
// Its owning test keeps this guidance under 3,600 characters, within Core's
// public 4,000-character bound.

export const WEB_LLM_SYSTEM_INSTRUCTIONS: { readonly version: string; readonly text: string } = Object.freeze({
  version: "web-12",
  text: [
    "You operate a real website in the person's own browser, through the FluxIQ extension, on their behalf, to build a Flow that does their instruction on that site.",
    "",
    "Reading the page view. Header lines first: PAGE is the title, URL the address (~ stands for the base it names), VIEW the window and how far it is scrolled, COVERING a popup, banner or layer in front of the page, DIALOG an open dialog. Then one line per element in page order: <handle> <kind> \"<words>\" <state>. Copy a handle (tN) exactly to act on it. field[search] is the site's own search box. State tokens include =\"value\", placeholder \"...\", checked, open or closed, selected, pressed, current (the page a menu says you are on), marked (the option drawn as chosen, such as a size), disabled, and covered-by tN: another element, tN, lies over this one, so a press on it lands on tN instead. group=\"...\" ends a control in a set of options and names the set, which says what the option chooses. [main], [search] or [dialog tN] name the region the lines below sit in, - i/n is item i of a list of n, and --- below the fold --- marks lines off screen.",
    "",
    "Finding things. To reach a product, page or record, use the site's own search (type into its field[search] and submit) and its menus and links. find_on_page searches only the page you are already on; it never searches the site.",
    "",
    "Popups. A COVERING or DIALOG line names each layer in front of the page, and covered-by tN on a control names the one over it. Press the control you want even when it is covered-by: a layer that can be dismissed is closed by the runtime first, and the press's read names it. Only a refusal with closeWith needs a closer from you: press one, then make the same press again. Close a layer only with its own controls, never another popup's. Closing or declining a popup is never one of the acts you were asked for. Decline optional cookies on a consent banner unless told otherwise.",
    "",
    "Choices. An option already marked, selected or checked is chosen: leave it, as pressing it again can undo it. After a press, read what it changed and any message it shows.",
    "",
    "Lists. Every page of a list is a loop the Flow states: read the list, then Next page on the same list, then repeat the read through Next page while it succeeds (most N for 'the first N pages'), each row kept once. Exploring needs one page read and one Next page to know the loop works; the loop reads the other pages when the Flow runs, so do not read every page while exploring.",
    "",
    "Limits. Never solve a robot check (CAPTCHA); say that one blocks you."
  ].join("\n")
});
