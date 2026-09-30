// The mark beside the phase name: a small SVG built node by node (no
// `innerHTML`, which a Trusted Types page makes throw).
//
// A phase under way gets a dot with a ring that pulses; the pulse runs through
// the Web Animations API, which needs no stylesheet and so no `style-src`
// allowance. A person who asked the system for reduced motion gets the dot
// still. A settled phase -- done, failed, waiting for the person -- gets a
// still glyph, because nothing is moving.

import { inertSvgElement } from "./inert-element";
import type { ActivityPhaseMark } from "./phase-appearance";

/** The mark for `kind` in `accent`, `size` CSS pixels square. */
export function phaseMark(kind: ActivityPhaseMark, accent: string, size: number): SVGElement {
  const svg = inertSvgElement("svg", { viewBox: "0 0 16 16", width: `${size}`, height: `${size}`, "aria-hidden": "true", focusable: "false" }, {
    display: "block",
    "flex-shrink": "0",
    overflow: "visible"
  });
  const stroke = { fill: "none", stroke: accent, "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round" };
  if (kind === "check") {
    svg.append(inertSvgElement("path", { d: "M3.5 8.5l3 3 6-7", ...stroke }));
  } else if (kind === "cross") {
    svg.append(inertSvgElement("path", { d: "M4.5 4.5l7 7M11.5 4.5l-7 7", ...stroke }));
  } else if (kind === "attention") {
    svg.append(
      inertSvgElement("circle", { cx: "8", cy: "8", r: "6.5", ...stroke, "stroke-width": "1.6" }),
      inertSvgElement("path", { d: "M8 4.8v3.8", ...stroke }),
      inertSvgElement("circle", { cx: "8", cy: "11.3", r: "1.1", fill: accent })
    );
  } else {
    const ring = inertSvgElement("circle", { cx: "8", cy: "8", r: "6", fill: "none", stroke: accent, "stroke-width": "1.5", opacity: "0.45" }, {
      "transform-box": "fill-box",
      "transform-origin": "center"
    });
    svg.append(ring, inertSvgElement("circle", { cx: "8", cy: "8", r: "3.5", fill: accent }));
    pulse(ring);
  }
  return svg;
}

function pulse(ring: SVGElement): void {
  if (prefersReducedMotion() || typeof ring.animate !== "function") return;
  ring.animate(
    [
      { transform: "scale(0.55)", opacity: 0.7 },
      { transform: "scale(1.15)", opacity: 0 }
    ],
    { duration: 1400, iterations: Infinity, easing: "ease-out" }
  );
}

function prefersReducedMotion(): boolean {
  try {
    return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    // best-effort: a page that broke `matchMedia` gets the pulse, which is only decoration
    return false;
  }
}
