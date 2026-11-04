// Bundles a spec's entry and mounts it in a frame beside a realistic scenario's page, at a
// person's width, so a screen is looked at where it would sit. Pictures go to the run's
// output folder, which git ignores.
import { build } from "esbuild";
import type { Frame, FrameLocator, Page } from "@playwright/test";

export type PanelBundle = { script: string; css: string };

/** `entry` is TypeScript resolved from `apps/extension`, usually a call to `startScriptedPanel`. */
export async function bundlePanel(entry: string): Promise<PanelBundle> {
  const bundled = await build({
    stdin: { resolveDir: process.cwd(), loader: "ts", contents: `import "./src/panel/theme/tokens.css";\n${entry}` },
    bundle: true, write: false, platform: "browser", format: "iife", outfile: "panel-preview.js", loader: { ".css": "css" }
  });
  return {
    script: bundled.outputFiles.find((file) => file.path.endsWith(".js"))!.text,
    css: bundled.outputFiles.find((file) => file.path.endsWith(".css"))?.text ?? ""
  };
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
  await child.addScriptTag({ content: bundle.script });
  return { frame, child };
}
