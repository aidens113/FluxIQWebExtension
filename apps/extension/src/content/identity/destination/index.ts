// A link's own destination, as the thing that stays the same when its words do not (t1071, F1).
//
// The bigbox header's cart link is named by the cart: an icon, a count and a
// total. A Flow saved it as "🛒 1 $3.97", the next attempt met "🛒 2 $5.25" on the
// same link, and both acting paths refused it, since nothing the recording named
// agreed exactly (`corroboration.ts`). The domain now marks such a target: the
// build saw its words change while it always led to one place, so its words are a
// value (`readsWords`, judged as a read's are, `read-words.ts`) and it carries that
// place as `href`, a path (`domain/.../self-changing/state-words.ts`).
//
// **The rule.** For such a target, the candidate's own destination confirms it
// when it is the recorded path and no other visible link in the candidate's root
// leads there. Its own destination is where it goes within the site: the path of
// its address, without query or fragment, and only for a link that leads
// somewhere -- never one that acts on the page (`action-link.ts`), and never one
// to another origin. A hidden link to the same place (a closed mini cart's "View
// cart") is no rival; two visible ones are, and then the destination says nothing.
//
// It corroborates as an exact signal does, in the veto's rule 2 and at Level 2's
// last check, and nowhere else: it never adds to a score, never lowers one, and a
// candidate going elsewhere simply has nothing to show for it. The score's own
// rule -- the page may not contradict the recording on net -- still applies to
// everything else the recording named.

export { destinationVerdict } from "./verdict";
export { recordedDestination } from "./recorded";
