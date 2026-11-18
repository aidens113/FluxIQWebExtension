import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".", testMatch: ["**/containment.spec.ts", "**/probe.spec.ts", "**/transport.spec.ts", "**/fixture.spec.ts", "**/completion.spec.ts"], workers: 1, fullyParallel: false, retries: 0, maxFailures: 1,
  timeout: 180_000, expect: { timeout: 10_000 }, reporter: "list", outputDir: "../../test-results/native-auth-feasibility-artifacts",
  use: { trace: "off", screenshot: "off", video: "off" }
});
