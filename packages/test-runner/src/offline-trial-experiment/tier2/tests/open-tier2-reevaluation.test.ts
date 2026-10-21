// Tier 2's reevaluator is the domain's over a snapshot page running the
// extension's production content code; without a current build it is refused
// before any browser is launched.

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { openTier2Reevaluation } from "../open-tier2-reevaluation.js";

test("an extension with no build is refused with the build command, and nothing is launched", async () => {
  const extensionDir = await mkdtemp(path.join(os.tmpdir(), "p5w8-tier2-"));
  try {
    await assert.rejects(openTier2Reevaluation({ extensionDir }), /pnpm --filter @fluxiq-web-extension\/extension build/u);
  } finally {
    await rm(extensionDir, { recursive: true, force: true });
  }
});
