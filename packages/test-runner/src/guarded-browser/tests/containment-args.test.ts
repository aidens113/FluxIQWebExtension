import assert from "node:assert/strict";
import test from "node:test";
import { networkContainmentArgs } from "../containment-args.js";

test("a loopback lane resolves only the two loopback names and bypasses any system proxy", () => {
  assert.deepEqual(networkContainmentArgs(["http://127.0.0.1:4100", "http://localhost:4100", "ws://127.0.0.1:4877/client", undefined]), [
    "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1",
    "--no-proxy-server",
  ]);
});

test("an allowlisted remote host, such as an existing target's panel, still resolves; nothing else is added", () => {
  const [rules] = networkContainmentArgs(["https://FluxIQ.Example.test", "wss://fluxiq.example.test/client", "http://127.0.0.1:4100"]);
  assert.equal(rules, "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1, EXCLUDE fluxiq.example.test");
});

test("a host that would inject another resolver rule is refused rather than written", () => {
  // WHATWG URL parsing accepts a comma in a host, which would end this rule and start another.
  assert.throws(() => networkContainmentArgs(["http://a,b"]), /not a plain DNS name/u);
  assert.throws(() => networkContainmentArgs(["http://evil.test,EXCLUDE*:80"]), /not a plain DNS name/u);
});
