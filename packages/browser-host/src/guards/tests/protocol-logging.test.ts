import assert from "node:assert/strict";
import test from "node:test";
import { assertProtocolLoggingOff } from "../protocol-logging.js";

const refuses = (debug: string) => assert.throws(() => assertProtocolLoggingOff({ DEBUG: debug }), { code: "browser_host.protocol_logging_on" });
const allows = (debug: string | undefined) => assert.doesNotThrow(() => assertProtocolLoggingOff(debug === undefined ? {} : { DEBUG: debug }));

test("DEBUG naming the protocol channel, directly or by wildcard, is refused", () => {
  for (const debug of ["pw:protocol", "pw:*", "*", "foo,pw:protocol", "pw:protocol pw:api"]) refuses(debug);
});

test("other channels, an unset DEBUG, and an exclusion that follows are allowed", () => {
  for (const debug of [undefined, "", "pw:api", "express:*", "pw:*,-pw:protocol", "*,-pw:protocol"]) allows(debug);
});

test("an exclusion before the enabling entry does not save it", () => {
  refuses("-pw:protocol,pw:*");
});

test("the refusal never echoes the value", () => {
  try {
    assertProtocolLoggingOff({ DEBUG: "pw:protocol,secretish" });
    assert.fail("expected a refusal");
  } catch (error) {
    assert.ok(!(error as Error).message.includes("secretish"));
  }
});
