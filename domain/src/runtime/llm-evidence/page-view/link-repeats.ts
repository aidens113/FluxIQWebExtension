// A link target the view has already printed is not printed again (t223,
// "Repeats"). The target stays exact; only how it is written changes:
//
//  - `same href`: the same target as the link line before it;
//  - `same href#fragment`: that target with only a fragment added -- a card's
//    ratings link beside its title link;
//  - `same href as tN`: a target an earlier link line printed in full.
//
// "The link line before it" is the last link line not written as
// `same href#fragment`, so a card's title, ratings and price links read
// `same href`, `same href#customer-reviews`, `same href`. A repeat form is used
// only where it is shorter than writing the target, so `~/` stays `~/`.

import type { WebLlmLinkWriter } from "./link-writer";

/** Writes each link line's target in turn, in the order the lines are printed. */
export function webLlmLinkRepeats(links: WebLlmLinkWriter): (handle: string, href: string) => string {
  let previous: string | undefined;
  const printedBy = new Map<string, string>();
  return (handle, href) => {
    const written = links.write(href);
    const fragmentOf = previous !== undefined && !previous.includes("#") && href.startsWith(`${previous}#`) ? href.slice(previous.length) : undefined;
    const earlier = printedBy.get(href);
    const repeat = href === previous ? "same href"
      : fragmentOf !== undefined ? `same href${fragmentOf}`
      : earlier !== undefined ? `same href as ${earlier}`
      : undefined;
    if (repeat !== undefined && repeat.length < written.length) {
      if (fragmentOf === undefined) previous = href;
      return repeat;
    }
    previous = href;
    if (!printedBy.has(href)) printedBy.set(href, handle);
    return written;
  };
}
