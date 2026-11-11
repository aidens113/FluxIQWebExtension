// Bundles a spec's entry and mounts it in a frame beside a realistic scenario's page, at a
// person's width, so a screen is looked at where it would sit. Pictures go to the run's
// output folder, which git ignores.
import { build } from "esbuild";
import type { Frame, FrameLocator, Page } from "@playwright/test";

/** A font the panel's styles carry as a data URL. A scenario page's CSP refuses a font by URL, so it is loaded through the FontFace API, which the CSP does not govern. */
export type PanelFont = { family: string; weight: string; data: string };
export type PanelBundle = { script: string; css: string; fonts?: PanelFont[] };

function withoutFontFaces(css: string): { css: string; fonts: PanelFont[] } {
  const fonts: PanelFont[] = [];
  const stripped = css.replace(/@font-face\s*\{[^}]*\}/gu, (rule) => {
    const family = /font-family:\s*["']?([^";']+)["']?\s*;/u.exec(rule)?.[1];
    const weight = /font-weight:\s*([^;]+);/u.exec(rule)?.[1] ?? "400";
    const data = /url\(["']?data:[^;]+;base64,([^"')]+)/u.exec(rule)?.[1];
    if (family && data) fonts.push({ family: family.trim(), weight: weight.trim(), data });
    return "";
  });
  return { css: stripped, fonts };
}

/** `entry` is TypeScript resolved from `apps/extension`, usually a call to `startScriptedPanel`. */
export async function bundlePanel(entry: string): Promise<PanelBundle> {
  const bundled = await build({
    stdin: { resolveDir: process.cwd(), loader: "ts", contents: `import "./src/panel/theme/tokens.css";\n${entry}` },
    bundle: true, write: false, platform: "browser", format: "iife", outfile: "panel-preview.js", loader: { ".css": "css", ".woff2": "dataurl" }
  });
  const split = withoutFontFaces(bundled.outputFiles.find((file) => file.path.endsWith(".css"))?.text ?? "");
  return { script: bundled.outputFiles.find((file) => file.path.endsWith(".js"))!.text, css: split.css, fonts: split.fonts };
}

export type PanelFrame = { frame: FrameLocator; child: Frame };

/** Mounts the bundle in a `width` by `height` frame (the height defaults to the window's) on the page already open. */
export async function mountPanelFrame(page: Page, bundle: PanelBundle, size: { width?: number; height?: number } = {}): Promise<PanelFrame> {
  const width = size.width ?? 360;
  const height = size.height === undefined ? "100vh" : `${size.height}px`;
  await page.evaluate(({ width, height }) => {
    const rail = document.createElement("iframe");
    rail.id = "panel-frame";
    rail.name = "panel-frame";
    rail.title = "FluxIQ panel";
    Object.assign(rail.style, { position: "fixed", right: "0", top: "0", width: `${width}px`, height, border: "0", zIndex: "2147483646", background: "white" });
    rail.srcdoc = `<!doctype html><html><body style="margin:0"><div id="app" style="height:${height === "100vh" ? "100vh" : height}"></div></body></html>`;
    document.documentElement.append(rail);
  }, { width, height });
  const frame = page.frameLocator("#panel-frame");
  await frame.locator("#app").waitFor();
  const child = page.frame({ name: "panel-frame" })!;
  await child.addStyleTag({ content: bundle.css });
  await child.evaluate(async (fonts) => {
    for (const font of fonts) {
      const bytes = Uint8Array.from(atob(font.data), (character) => character.charCodeAt(0));
      const face = new FontFace(font.family, bytes.buffer, { weight: font.weight, display: "swap" });
      document.fonts.add(await face.load());
    }
  }, bundle.fonts ?? []);
  await child.addScriptTag({ content: bundle.script });
  return { frame, child };
}

/**
 * What Firefox's popup does when the person clicks the page: the window closes, so the page
 * unloads (`pagehide`) and the frame goes. Playwright cannot load the real popup, so this models it:
 * a real click on the scenario's own page (left of the panel), then `pagehide` in the panel and the
 * frame removed. What the background and Core keep survives only where the caller keeps it
 * (`journey-panel.ts` keeps it on the page that holds the frame); a new `mountPanelFrame` is the reopening.
 */
export async function closePopupOnPageClick(page: Page): Promise<void> {
  await page.mouse.click(6, 6);
  await page.frame({ name: "panel-frame" })?.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  await page.evaluate(() => document.getElementById("panel-frame")?.remove());
}
