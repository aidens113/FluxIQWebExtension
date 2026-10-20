import { writeFile } from "node:fs/promises";
import type { TestInfo } from "@playwright/test";

/**
 * Keeps a proof's structural diagnostic: attached to the report, and written
 * to the test's own ignored output folder so it can be read without opening
 * the report. It holds opaque tokens, digests, codes and counts, and the page
 * views of Lab fixture pages; never credentials or recorded user data.
 */
export async function keepDiagnostic(testInfo: TestInfo, name: string, value: unknown): Promise<void> {
  const body = Buffer.from(JSON.stringify(value, null, 1));
  await testInfo.attach(name, { body, contentType: "application/json" });
  await writeFile(testInfo.outputPath(name), body);
}
