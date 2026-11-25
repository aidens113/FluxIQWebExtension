import type { ChartFlow, ChartNode } from "./chart/index.js";
import { escapeSvgText } from "./escape-svg-text.js";
import { shortenChartText } from "./shorten-chart-text.js";
import { wrapChartText } from "./wrap-chart-text.js";

const WIDTH = 980, LEFT = 170, BOX_W = 640, PAD = 14, LINE = 17, GAP = 26, CHARS = 80, FONT = "Segoe UI, Arial, DejaVu Sans, sans-serif";
const INK = "#1f2933", MUTED = "#52606d", LINEC = "#9aa5b1", ACCENT = "#0b69a3", RESULT = "#127a3d";

type Style = "title" | "body" | "muted" | "result";
type Row = { text: string; style: Style };

const rowsFrom = (lines: string[], style: Style): Row[] => lines.map((text) => ({ text, style }));

/** The lines a node's box holds, wrapped: its number and kind, its target, what was typed, and what went through it. */
function rowsOf(node: ChartNode): Row[] {
  const rows: Row[] = [{ text: `${node.step}   ${node.kind.toUpperCase()}${node.act ? `   (does ${node.act})` : ""}${node.result ? "   * RESULT" : ""}`, style: node.result ? "result" : "title" }];
  if (node.target) rows.push(...rowsFrom(wrapChartText(`target: ${node.target}`, CHARS, 2), "body"));
  if (node.typed !== undefined) rows.push(...rowsFrom(wrapChartText(`typed / chosen: "${node.typed}"`, CHARS, 2), "body"));
  for (const line of node.example) rows.push(...rowsFrom(wrapChartText(`example: ${line}`, CHARS, 3), "muted"));
  return rows;
}

const text = (x: number, y: number, value: string, style: Style | "head", anchor = "start"): string => {
  const fill = style === "muted" ? MUTED : style === "result" ? RESULT : style === "title" ? ACCENT : INK;
  const weight = style === "body" || style === "muted" ? "400" : "700";
  return `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${style === "head" ? 18 : 13}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" xml:space="preserve">${escapeSvgText(value)}</text>`;
};

const panelHeight = (rows: Row[]): number => PAD * 2 + 4 + (rows.length + 1) * LINE;

const panel = (y: number, label: string, rows: Row[]): string =>
  `<rect x="${LEFT}" y="${y}" width="${BOX_W}" height="${panelHeight(rows)}" rx="8" fill="#f5f7fa" stroke="${LINEC}"/>${text(LEFT + PAD, y + PAD + 11, label, "title")}${rows.map((row, index) => text(LEFT + PAD, y + PAD + 11 + (index + 1) * LINE, row.text, row.style)).join("")}`;

const arrow = (y1: number, y2: number): string => {
  const x = LEFT + BOX_W / 2;
  return `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2 - 6}" stroke="${LINEC}" stroke-width="2"/><path d="M${x - 5} ${y2 - 8} L${x} ${y2 - 1} L${x + 5} ${y2 - 8} Z" fill="${LINEC}"/>`;
};

/** The input panel: the instruction the chat received and each value the run typed or chose. */
function inputRows(flow: ChartFlow): Row[] {
  const rows = flow.instruction === null ? rowsFrom(["instruction: not recorded in this run's step files"], "muted") : rowsFrom(wrapChartText(`instruction: ${flow.instruction}`, CHARS, 14), "body");
  if (flow.parameters.length === 0) rows.push({ text: "parameters: none typed or chosen", style: "muted" });
  for (const parameter of flow.parameters) rows.push(...rowsFrom(wrapChartText(`parameter ${parameter.name} = "${parameter.value}"`, CHARS, 2), "body"));
  return rows;
}

/** The output panel: the result the attempt returned (the first rows with their columns, and the total), or no result. */
function outputRows(flow: ChartFlow): Row[] {
  const { output } = flow;
  if (output.kind === "none") return rowsFrom([`no result: ${shortenChartText(output.why, 120)}`], "muted");
  if (output.kind === "text") return [{ text: `(${output.source})`, style: "muted" }, ...rowsFrom(wrapChartText(output.text, CHARS, 8), "body")];
  const shown = output.rows.slice(0, 5);
  return [
    { text: `(${output.source})`, style: "muted" },
    ...output.check.flatMap((line) => rowsFrom(wrapChartText(line, CHARS, 3), "muted")),
    { text: `${output.total} row${output.total === 1 ? "" : "s"}${shown.length < output.total ? `, first ${shown.length} shown` : ""}${output.headline ? `: ${shortenChartText(output.headline, 70)}` : ""}`, style: "body" },
    ...(output.columns.length === 0 ? [] : [{ text: shortenChartText(output.columns.map((column) => shortenChartText(column, 22)).join(" | "), CHARS), style: "title" as const }]),
    ...shown.map((row): Row => ({ text: shortenChartText(row.map((cell) => shortenChartText(cell, 24)).join(" | "), CHARS), style: "body" })),
  ];
}

/**
 * The Flow as a top-to-bottom chart in SVG: start, the input, one box per node in Flow order (never dropped or merged),
 * loops as brackets on the left, branches as arrows on the right, the output and the end. Pure and deterministic; tall
 * Flows grow the image. Long texts wrap or end in an ellipsis.
 */
export function buildFlowChartSvg(flow: ChartFlow): string {
  const parts: string[] = [];
  let y = 20;
  parts.push(text(LEFT, y + 18, `Flow chart${flow.attempt === undefined ? "" : `, attempt ${flow.attempt}`} (${flow.source})`, "head"));
  y += 38;
  parts.push(`<circle cx="${LEFT + BOX_W / 2}" cy="${y + 8}" r="8" fill="${ACCENT}"/>${text(LEFT + BOX_W / 2 + 18, y + 13, "START", "title")}`);
  y += 16;
  const input = inputRows(flow);
  parts.push(arrow(y, y + GAP), panel(y + GAP, "INPUT", input));
  y += GAP + panelHeight(input);
  const boxes = new Map<number, { top: number; bottom: number }>();
  if (flow.nodes.length === 0) {
    const none = rowsFrom(["no step is in the Flow yet"], "muted");
    parts.push(arrow(y, y + GAP), panel(y + GAP, "FLOW", none));
    y += GAP + panelHeight(none);
  }
  for (const node of flow.nodes) {
    const rows = rowsOf(node), height = PAD * 2 + rows.length * LINE - 4;
    parts.push(arrow(y, y + GAP));
    y += GAP;
    parts.push(`<rect x="${LEFT}" y="${y}" width="${BOX_W}" height="${height}" rx="8" fill="${node.result ? "#eaf7ef" : "#ffffff"}" stroke="${node.result ? RESULT : LINEC}" stroke-width="${node.result ? 2 : 1}"/>${rows.map((row, index) => text(LEFT + PAD, y + PAD + 11 + index * LINE, row.text, row.style)).join("")}`);
    boxes.set(node.step, { top: y, bottom: y + height });
    y += height;
  }
  flow.loops.forEach((loop, depth) => {
    const inside = flow.nodes.filter((node) => node.step >= loop.from && node.step <= loop.to).map((node) => boxes.get(node.step)!);
    if (inside.length === 0) return;
    const top = Math.min(...inside.map((box) => box.top)) - 6, bottom = Math.max(...inside.map((box) => box.bottom)) + 6, x = LEFT - 14 - depth * 10;
    parts.push(`<path d="M${LEFT - 4} ${top} H${x} V${bottom} H${LEFT - 4}" fill="none" stroke="${ACCENT}" stroke-width="2"/>`);
    wrapChartText(loop.label, 16, 6).forEach((line, index) => parts.push(text(x - 6, top + 16 + index * 15, line, "muted", "end")));
  });
  flow.branches.forEach((branch, index) => {
    const from = boxes.get(branch.from), to = boxes.get(branch.to);
    if (!from || !to) return;
    const x = LEFT + BOX_W + 16 + index * 10, y1 = (from.top + from.bottom) / 2, y2 = (to.top + to.bottom) / 2;
    parts.push(`<path d="M${LEFT + BOX_W} ${y1} H${x} V${y2} H${LEFT + BOX_W + 4}" fill="none" stroke="${ACCENT}" stroke-width="2" stroke-dasharray="5 3"/><path d="M${LEFT + BOX_W + 10} ${y2 - 5} L${LEFT + BOX_W + 3} ${y2} L${LEFT + BOX_W + 10} ${y2 + 5} Z" fill="${ACCENT}"/>`);
    wrapChartText(branch.label, 20, 4).forEach((line, row) => parts.push(text(x + 6, Math.min(y1, y2) + 16 + row * 15, line, "muted")));
  });
  if (flow.otherSteps > 0) {
    parts.push(text(LEFT, y + 20, `${flow.otherSteps} other step${flow.otherSteps === 1 ? "" : "s"} tried (looks, failed tries, dropped repeats) are not in the Flow`, "muted"));
    y += 30;
  }
  const out = outputRows(flow);
  parts.push(arrow(y, y + GAP), panel(y + GAP, "OUTPUT", out));
  y += GAP + panelHeight(out);
  parts.push(arrow(y, y + GAP));
  y += GAP;
  parts.push(`<rect x="${LEFT + BOX_W / 2 - 8}" y="${y}" width="16" height="16" rx="3" fill="${ACCENT}"/>${text(LEFT + BOX_W / 2 + 18, y + 13, "END", "title")}`);
  const height = y + 40;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}"><rect width="${WIDTH}" height="${height}" fill="#ffffff"/>${parts.join("")}</svg>\n`;
}
