import { defineConfig } from "@playwright/test";
export default defineConfig({ testDir: "./tests", testMatch: "probe.spec.ts", workers: 1, fullyParallel: false, retries: 0, timeout: 120_000, expect: { timeout: 5000 }, reporter: "list", outputDir: "../../test-results/user-script-feasibility-artifacts", use: { trace: "off", screenshot: "off", video: "off" } });
