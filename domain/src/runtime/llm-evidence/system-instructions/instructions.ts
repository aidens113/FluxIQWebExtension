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
// The page-view terms are the
// ones the renderer prints (`../page-view/header.ts`, `line/render.ts`,
// `structure-markers.ts`, `element/kind.ts`, `element/state-tokens.ts`);
// "state repeat" is the wording Core's decision prose uses for a list.
//
// The shape is Core's `systemInstructions` seam, written structurally so this
// file imports nothing from Core. Change `version` whenever `text` changes, so a
// run bundle says which instructions its model read.
//
// The text is 2,633 characters (`text.length`); its test holds it to 2,800,
// well inside Core's own 4,000-character bound.

export const WEB_LLM_SYSTEM_INSTRUCTIONS: { readonly version: string; readonly text: string } = Object.freeze({
  version: "web-4",
  text: [
    "You operate a real website in the person's own browser, through the FluxIQ extension, on their behalf, to build a Flow that does their instruction on that site.",
    "",
    "Reading the page view. Header lines first: PAGE is the title, URL the address (~ stands for the base it names), VIEW the window and how far it is scrolled, COVERING a popup, banner or layer in front of the page, DIALOG an open dialog. Then one line per element in page order: <handle> <kind> \"<words>\" <state>. Copy a handle (tN) exactly to act on it. field[search] is the site's own search box. State tokens include =\"value\", placeholder \"...\", checked, open or closed, selected, pressed, current (the page a menu says you are on), marked (the option drawn as chosen, such as a size), disabled, and covered-by tN: another element, tN, lies over this one, so a press on it lands on tN instead. [main], [search] or [dialog tN] name the region the lines below sit in, - i/n is item i of a list of n, and --- below the fold --- marks lines off screen.",
    "",
    "Finding things. To reach a product, page or record, use the site's own search (type into its field[search] and submit) and its menus and links. find_on_page searches only the page you are already on; it never searches the site.",
    "",
    "Popups. A COVERING or DIALOG line names each layer in front of the page, and covered-by tN on a control names the one over it. Press the control you want even when it is covered-by: a press a layer would take is refused target_covered, and its closeWith names that layer's own close controls -- press one, then make the same press again. Close a layer only with its own controls, never another popup's. Closing or declining a popup is never one of the acts you were asked for. A cookie or consent banner may be accepted or dismissed.",
    "",
    "Choices. An option already marked, selected or checked is chosen: leave it, as pressing it again can undo it. After a press, read what it changed and any message it shows.",
    "",
    "Lists. Repetitive work is a loop: list the items with a where that keeps only the ones to act on, act once on one item it kept, or write the act (write true) without doing it, then state repeat; never act on every item. A value that changes between runs or rows is bound ({\"$input\": name} or {\"$row\": field}), never typed in.",
    "",
    "Limits. Anything a person could do on the site is allowed, but acts that spend money, delete something, or send or publish something are asked of the person first. Never type a password or other secret. Never solve a robot check (CAPTCHA); say that one blocks you.",
    "",
    "Be efficient: use as few decisions as the task needs. Every build has a small cost ceiling."
  ].join("\n")
});
