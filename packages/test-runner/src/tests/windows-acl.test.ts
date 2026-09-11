import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { hardenWindowsPrivatePath, type NativeExec } from "../windows-acl.js";

test("uses argv-only native Windows tools and verifies an exclusive current-user file ACL", async () => {
  const calls: Array<{ file: string; args: readonly string[] }> = [];
  const target = path.resolve("test-runs", ".auth", "session.json");
  const execute: NativeExec = async (file, args) => {
    calls.push({ file, args });
    if (file.endsWith("whoami.exe")) return { stdout: '"MACHINE\\runner","S-1-5-21-1-2-3-1001"\r\n', stderr: "" };
    if (args.length === 1) return { stdout: `${target} MACHINE\\runner:(F)\r\nSuccessfully processed 1 files; Failed processing 0 files\r\n`, stderr: "" };
    return { stdout: "Successfully processed 1 files; Failed processing 0 files\r\n", stderr: "" };
  };
  await hardenWindowsPrivatePath(target, "file", { platform: "win32", systemRoot: "C:\\Windows", exec: execute });
  assert.deepEqual(calls.map(item => [path.win32.basename(item.file), item.args]), [
    ["whoami.exe", ["/user", "/fo", "csv", "/nh"]],
    ["icacls.exe", [target, "/inheritance:r", "/grant:r", "*S-1-5-21-1-2-3-1001:F"]],
    ["icacls.exe", [target, "/verify"]],
    ["icacls.exe", [target]],
  ]);
});

test("directory grants inheritable access and ACL verification fails closed on another principal", async () => {
  const target = path.resolve("test-runs", ".auth");
  const calls: readonly string[][] = [];
  const mutableCalls = calls as string[][];
  const execute: NativeExec = async (file, args) => {
    mutableCalls.push([path.win32.basename(file), ...args]);
    if (file.endsWith("whoami.exe")) return { stdout: '"MACHINE\\runner","S-1-5-21-1-2-3-1001"', stderr: "" };
    if (args.length === 1) return { stdout: `${target} MACHINE\\runner:(OI)(CI)(F)\r\n  BUILTIN\\Users:(RX)`, stderr: "" };
    return { stdout: "ok", stderr: "" };
  };
  await assert.rejects(hardenWindowsPrivatePath(target, "directory", { platform: "win32", systemRoot: "C:\\Windows", exec: execute }), /exclusive current-user access/);
  assert.ok(mutableCalls.some(call => call.includes("*S-1-5-21-1-2-3-1001:(OI)(CI)F")));
});

test("is a no-op outside Windows and fails closed when native identity lookup fails", async () => {
  let calls = 0;
  const execute: NativeExec = async () => { calls += 1; return { stdout: "malformed", stderr: "" }; };
  await hardenWindowsPrivatePath("ignored", "file", { platform: "linux", exec: execute });
  assert.equal(calls, 0);
  await assert.rejects(hardenWindowsPrivatePath("private", "file", { platform: "win32", systemRoot: "C:\\Windows", exec: execute }), /resolve the current Windows account SID/);
});
