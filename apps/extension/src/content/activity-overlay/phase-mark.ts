// The mark beside the headline: a small SVG built node by node (no
// `innerHTML`, which a Trusted Types page makes throw).
//
// Every glyph is built once, when the overlay is, and a change of mark only
// shows one and hides the others and recolours them: the overlay updates in
// place, so no node is created or dropped while it is up.
//
// Work under way gets a dot with a ring that pulses; the pulse runs through
// the Web Animations API, which needs no stylesheet and so no `style-src`
// allowance, and it is paused while the dot is hidden. A person who asked the
// system for reduced motion gets the dot still. A settled display -- done,
// failed, waiting for the person -- gets a still glyph, because nothing is
// moving.

import { inertSvgElement } from "./inert-element";
import type { ActivityPhaseMark } from "./phase-appearance";

type Glyph = { readonly group: SVGElement; readonly paint: ReadonlyArray<{ node: SVGElement; attribute: "stroke" | "fill" }> };

export class PhaseMark {
  readonly element: SVGElement;
  private readonly glyphs: Readonly<Record<ActivityPhaseMark, Glyph>>;
  private readonly ring: SVGElement;
  private pulse: Animation | undefined;
  private shown: { kind: ActivityPhaseMark; accent: string } | undefined;

  /** A mark `size` CSS pixels square, showing nothing until `show`. */
  constructor(size: number) {
    this.element = inertSvgElement("svg", { viewBox: "0 0 16 16", width: `${size}`, height: `${size}`, "aria-hidden": "true", focusable: "false" }, {
      display: "block",
      "flex-shrink": "0",
      overflow: "visible"
    });
    const stroke = { fill: "none", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round" };
    this.ring = inertSvgElement("circle", { cx: "8", cy: "8", r: "6", fill: "none", "stroke-width": "1.5", opacity: "0.45" }, {
      "transform-box": "fill-box",
      "transform-origin": "center"
    });
    const dot = inertSvgElement("circle", { cx: "8", cy: "8", r: "3.5" });
    const check = inertSvgElement("path", { d: "M3.5 8.5l3 3 6-7", ...stroke });
    const cross = inertSvgElement("path", { d: "M4.5 4.5l7 7M11.5 4.5l-7 7", ...stroke });
    const ringOutline = inertSvgElement("circle", { cx: "8", cy: "8", r: "6.5", ...stroke, "stroke-width": "1.6" });
    const bar = inertSvgElement("path", { d: "M8 4.8v3.8", ...stroke });
    const point = inertSvgElement("circle", { cx: "8", cy: "11.3", r: "1.1" });
    this.glyphs = Object.freeze({
      pulse: glyph([this.ring, dot], [{ node: this.ring, attribute: "stroke" }, { node: dot, attribute: "fill" }]),
      check: glyph([check], [{ node: check, attribute: "stroke" }]),
      cross: glyph([cross], [{ node: cross, attribute: "stroke" }]),
      attention: glyph([ringOutline, bar, point], [{ node: ringOutline, attribute: "stroke" }, { node: bar, attribute: "stroke" }, { node: point, attribute: "fill" }])
    });
    for (const { group } of Object.values(this.glyphs)) this.element.append(group);
  }

  /** Shows `kind` in `accent`; the same mark again changes nothing. */
  show(kind: ActivityPhaseMark, accent: string): void {
    if (this.shown?.kind === kind && this.shown.accent === accent) return;
    this.shown = { kind, accent };
    for (const [name, { group, paint }] of Object.entries(this.glyphs) as Array<[ActivityPhaseMark, Glyph]>) {
      group.style.setProperty("display", name === kind ? "inline" : "none", "important");
      if (name === kind) for (const { node, attribute } of paint) node.setAttribute(attribute, accent);
    }
    this.setPulsing(kind === "pulse");
  }

  private setPulsing(on: boolean): void {
    if (!on) {
      this.pulse?.pause();
      return;
    }
    if (this.pulse) {
      this.pulse.play();
      return;
    }
    if (prefersReducedMotion() || typeof this.ring.animate !== "function") return;
    this.pulse = this.ring.animate(
      [
        { transform: "scale(0.55)", opacity: 0.7 },
        { transform: "scale(1.15)", opacity: 0 }
      ],
      { duration: 1400, iterations: Infinity, easing: "ease-out" }
    );
  }
}

function glyph(nodes: SVGElement[], paint: Glyph["paint"]): Glyph {
  const group = inertSvgElement("g", {}, { display: "none" });
  group.append(...nodes);
  return { group, paint };
}

function prefersReducedMotion(): boolean {
  try {
    return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    // best-effort: a page that broke `matchMedia` gets the pulse, which is only decoration
    return false;
  }
}
