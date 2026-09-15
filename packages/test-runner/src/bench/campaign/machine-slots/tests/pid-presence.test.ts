import assert from "node:assert/strict";
import test from "node:test";
import { pidPresence } from "../index.js";

const failingWith = (code: unknown) => () => { throw Object.assign(new Error("signal failed"), { code }); };

test("signal 0 success and EPERM both mean a process holds the PID", () => {
  assert.equal(pidPresence(10, () => true), "present");
  assert.equal(pidPresence(10, failingWith("EPERM")), "present");
});

test("ESRCH means no process holds the PID", () => {
  assert.equal(pidPresence(10, failingWith("ESRCH")), "absent");
});

test("any other failure is not evidence either way", () => {
  for (const code of ["EINVAL", "ERR_INVALID_ARG_TYPE", 1, undefined]) assert.equal(pidPresence(10, failingWith(code)), "unknown", String(code));
  assert.equal(pidPresence(10, () => { throw "not an error object"; }), "unknown");
});

test("the injected signal receives the PID and signal 0", () => {
  const sent: Array<[number, number]> = [];
  pidPresence(4242, (pid, signal) => { sent.push([pid, signal]); });
  assert.deepEqual(sent, [[4242, 0]]);
});

test("the default checks the real process table", () => {
  assert.equal(pidPresence(process.pid), "present");
  assert.equal(pidPresence(2_147_483_647), "absent");
  assert.equal(pidPresence(2 ** 40), "unknown");
});
