import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { initWasm, Resvg } from "@resvg/resvg-wasm";
import { chartFonts } from "./chart/index.js";

let ready: Promise<void> | undefined;

/** An SVG as PNG bytes, rasterised in wasm: no browser, no window, no network. */
export async function renderChartPng(svg: string): Promise<Uint8Array> {
  ready ??= readFile(createRequire(import.meta.url).resolve("@resvg/resvg-wasm/index_bg.wasm")).then((wasm) => initWasm(wasm));
  await ready;
  const { family, buffers } = await chartFonts();
  const image = new Resvg(svg, { font: { fontBuffers: buffers, defaultFontFamily: family, sansSerifFamily: family }, fitTo: { mode: "zoom", value: 1 }, background: "#ffffff" }).render();
  return image.asPng();
}
