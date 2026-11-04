const SVG = "http://www.w3.org/2000/svg";

/** The record mark: a ring around a dot, drawn in the text's colour. */
export function recordIcon(): SVGSVGElement {
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("width", "14");
  svg.setAttribute("height", "14");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const ring = document.createElementNS(SVG, "circle");
  ring.setAttribute("cx", "8");
  ring.setAttribute("cy", "8");
  ring.setAttribute("r", "6.5");
  ring.setAttribute("fill", "none");
  ring.setAttribute("stroke", "currentColor");
  ring.setAttribute("stroke-width", "1.5");
  const dot = document.createElementNS(SVG, "circle");
  dot.setAttribute("cx", "8");
  dot.setAttribute("cy", "8");
  dot.setAttribute("r", "3.5");
  dot.setAttribute("fill", "currentColor");
  svg.append(ring, dot);
  return svg;
}
