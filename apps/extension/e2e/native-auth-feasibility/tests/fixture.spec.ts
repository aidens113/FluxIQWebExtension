import { expect, test } from "@playwright/test";
import { nativeProbeFixture } from "../fixture.js";

test("real company-website fixture setup and immediate close have an owned lifecycle", async () => {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const fixture = await nativeProbeFixture();
    try {
      expect(new URL(fixture.configuration.ordinaryUrl).hostname).toBe("127.0.0.1");
      expect(new URL(fixture.configuration.alternateUrl).pathname).toBe("/scenarios/company-website/booking-widget");
    } finally {
      await fixture.close();
    }
  }
});
