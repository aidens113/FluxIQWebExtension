// The FluxIQ mark, as the website draws it: an F whose middle bar ends in an
// amber node. Built with DOM APIs; the strokes follow the surrounding text
// colour and the node is filled by `.logo-node` in shell.css (an amber token).
// Decorative: the "FluxIQ" wordmark beside it is the accessible name.

const SVG = "http://www.w3.org/2000/svg";

/** A fresh 32-viewBox mark, `size` pixels square. */
export function logoMark(size = 24): SVGSVGElement {
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", "0 0 32 32");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("fill", "none");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  for (const d of ["M9 26V11a5 5 0 0 1 5-5h12", "M9 16.5h9"]) {
    const path = document.createElementNS(SVG, "path");
    path.setAttribute("d", d);
    path.setAttribute("stroke", "currentColor");
    path.setAttribute("stroke-width", "3.5");
    path.setAttribute("stroke-linecap", "round");
    svg.append(path);
  }
  const node = document.createElementNS(SVG, "circle");
  node.setAttribute("class", "logo-node");
  node.setAttribute("cx", "23.5");
  node.setAttribute("cy", "16.5");
  node.setAttribute("r", "3");
  svg.append(node);
  return svg;
}
