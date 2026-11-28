// PNG screenshots of a journey's pages at named moments, for a person to review the path the extension
// and the panel show. They are evidence beside the journey, never part of it: a capture that fails is
// recorded as skipped and never fails the journey or changes what it asserts. The files land in the
// run's own workspace directory (under `test-runs/`, never committed), with an `index.json` sidecar
// listing each file's moment, surface and path.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Page } from "@playwright/test";

export type JourneyShotRecord = Readonly<{ name: string; surface: string; file: string | null; skipped?: string }>;

export type JourneyShots = {
  /** Captures `page` as `name`; resolves to its record, whose `skipped` says why when the capture could not be taken. */
  shoot(name: string, surface: string, page: Page): Promise<JourneyShotRecord>;
  readonly taken: readonly JourneyShotRecord[];
};

/** A shot recorder writing into `directory`. */
export function journeyShots(directory: string): JourneyShots {
  const taken: JourneyShotRecord[] = [];
  const index = () => writeFile(path.join(directory, "index.json"), `${JSON.stringify(taken, null, 2)}\n`).catch((error: unknown) => { throw new Error("The screenshot index could not be written", { cause: error }); });
  return {
    taken,
    async shoot(name, surface, page) {
      const slug = name.replace(/[^a-z0-9-]+/giu, "-").toLowerCase();
      const file = path.join(directory, `${String(taken.length + 1).padStart(2, "0")}-${slug}.png`);
      try {
        await mkdir(directory, { recursive: true });
        await page.screenshot({ path: file, type: "png", timeout: 10_000 });
        const record: JourneyShotRecord = { name, surface, file };
        taken.push(record);
        await index();
        return record;
      } catch (error) {
        // Not a journey failure: the shot is recorded as skipped, with the reason, in the index.
        const record: JourneyShotRecord = { name, surface, file: null, skipped: error instanceof Error ? error.message : "capture failed" };
        taken.push(record);
        await index();
        return record;
      }
    },
  };
}
