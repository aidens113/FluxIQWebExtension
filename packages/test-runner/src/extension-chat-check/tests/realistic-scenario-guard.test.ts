// The extension chat check opens a headed browser on a Scenario Lab page, so it
// refuses any scenario outside the ten realistic ones before it starts anything.

import assert from "node:assert/strict";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { runExtensionChatCheck } from "../run-chat-check.js";

const RULE = /every Lab or browser test run, live or provider-free, uses only the ten realistic scenarios \(user rule, 2026-09-29\): everything-store, crossborder-marketplace, bigbox-retail, job-board, local-classifieds, auction-marketplace, photo-social, social-network-feed, company-website, professional-network\./u;

test("the chat check refuses basic-form and product-catalog before it starts a topology or a browser", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-chat-check-guard-"));
  try {
    for (const scenarioId of ["basic-form", "product-catalog"]) {
      await assert.rejects(runExtensionChatCheck({
        repositoryRoot: root,
        fluxiqRepositoryRoot: path.join(root, "no-core"),
        browser: "chrome",
        scenarioId,
        pagePath: "",
        ask: false,
        evidenceDirectory: path.join(root, "evidence"),
      }), { message: new RegExp(`^The extension chat check refused ${scenarioId}: ${RULE.source}`, "u") });
    }
    assert.deepEqual(await readdir(root), [], "no evidence, run or topology state was written");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
