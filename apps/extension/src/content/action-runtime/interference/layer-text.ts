// A layer's own words, bounded: enough to say what the layer is about, never a
// page's worth.
//
// Two readers ask it the same question. `way-out.ts` asks whether a layer is a
// consent prompt or a rate-limit notice, which decides which of its controls may
// be pressed; `../rate-limit-notice.ts` asks whether a layer a press just opened
// says the press was refused, and for how long. One implementation, so the layer
// the detector reports is the layer the defence may close.
//
// The text is read, classified and dropped where it is read. It never leaves the
// frame on a result: what a result says about a layer is what the classifier
// concluded, not what the page wrote.

/** At most this many elements of one layer are read. */
const LAYER_SCAN_LIMIT = 400;

/** Characters of a layer's own text kept. */
const LAYER_TEXT_MAX = 600;

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

/**
 * Elements whose text is not words on the page: a widget's stylesheet, its
 * script, an inert template. Read, a shadow root's `<style>` alone filled most
 * of the budget before the line it was asked about (crossborder's store coupon:
 * about 450 characters of CSS ahead of "Network busy, please try again").
 */
const UNREAD_TAGS = new Set(["style", "script", "template", "noscript"]);

/**
 * The layer's `aria-label` and the text of its text nodes in document order,
 * collapsed to single spaces and cut at `LAYER_TEXT_MAX`. Each text node is read
 * with a space before it, so a number in its own `<span>` stays a separate word.
 * A stylesheet, script or template inside it is not read (`UNREAD_TAGS`).
 *
 * Document order matters. Until 2026-09-30 each element's own text nodes were
 * read before its children's, so "You can try again in <span>12</span>
 * seconds." read as "try again in seconds. 12" and the wait the notice named
 * was lost (live run `run-munq51ik-a7ebd077`). An open shadow root is read
 * before its host's light children.
 */
export function boundedLayerText(layer: Element): string {
  const parts: string[] = [];
  let length = 0;
  let scanned = 0;
  const visit = (parent: Element | ShadowRoot): boolean => {
    for (const node of Array.from(parent.childNodes)) {
      if (length > LAYER_TEXT_MAX) return false;
      if (node.nodeType === TEXT_NODE) {
        const text = node.textContent ?? "";
        parts.push(text);
        length += text.length + 1;
        continue;
      }
      if (node.nodeType !== ELEMENT_NODE) continue;
      if (++scanned > LAYER_SCAN_LIMIT) return false;
      const element = node as Element;
      if (UNREAD_TAGS.has(String(element.tagName ?? "").toLowerCase())) continue;
      if (element.shadowRoot && !visit(element.shadowRoot)) return false;
      if (!visit(element)) return false;
    }
    return true;
  };
  if (!layer.shadowRoot || visit(layer.shadowRoot)) visit(layer);
  const label = layer.getAttribute("aria-label") ?? "";
  return `${label} ${parts.join(" ")}`.replace(/\s+/gu, " ").trim().slice(0, LAYER_TEXT_MAX);
}
