import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { captureBrowserWindows } from "./browser-window-capture.js";
import type { ChatBrowserSession } from "./types.js";

export type EvidenceWriter = {
  directory: string;
  /**
   * Photographs the moment three ways: every browser window as it stands on
   * screen, the chat's own page, and the scenario page. Answers the files
   * written, and says why for any that could not be.
   */
  shot(name: string): Promise<{ files: string[]; missing: string[] }>;
  json(name: string, value: unknown): Promise<string>;
};

/** Writes one run's screenshots and records into `directory`, numbering them in the order taken. */
export function evidenceWriter(directory: string, session: () => ChatBrowserSession | undefined): EvidenceWriter {
  let sequence = 0;
  return {
    directory,
    async shot(name) {
      await mkdir(directory, { recursive: true });
      sequence += 1;
      const stem = `${String(sequence).padStart(2, "0")}-${name}`;
      const files: string[] = [];
      const missing: string[] = [];
      const current = session();
      if (!current) return { files, missing: ["no browser session"] };
      const windows = await captureBrowserWindows(current.browser, current.profileDir);
      if (windows.bytes) {
        const file = path.join(directory, `${stem}-window.jpg`);
        await writeFile(file, windows.bytes);
        files.push(file);
      } else missing.push(`window: ${windows.reason}`);
      for (const [label, page] of [["panel", current.panel?.page], ["scenario", current.scenario]] as const) {
        if (!page || page.isClosed()) { missing.push(`${label}: no page of its own (the window capture shows it)`); continue; }
        const file = path.join(directory, `${stem}-${label}.png`);
        try { await page.screenshot({ path: file, timeout: 10_000 }); files.push(file); } catch (error) { missing.push(`${label}: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`); }
      }
      return { files, missing };
    },
    async json(name, value) {
      await mkdir(directory, { recursive: true });
      const file = path.join(directory, `${name}.json`);
      await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
      return file;
    },
  };
}
