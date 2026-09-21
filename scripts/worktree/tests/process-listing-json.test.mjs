import assert from "node:assert/strict";
import test from "node:test";
import { parseProcessListingJson } from "../process-listing-json.mjs";

test("a command line carrying a raw control character still parses, and keeps the character", () => {
  const stdout = `[{"ProcessId":4,"ParentProcessId":0,"Name":"System","CommandLine":null},{"ProcessId":88,"ParentProcessId":4,"Name":"odd.exe","CommandLine":"odd.exe --flag \u0001value\u0007"}]\r\n`;
  assert.throws(() => JSON.parse(stdout), SyntaxError, "the raw listing is what Windows PowerShell 5.1 emits and plain JSON.parse refuses");
  const rows = parseProcessListingJson(stdout);
  assert.deepEqual(rows, [
    { ProcessId: 4, ParentProcessId: 0, Name: "System", CommandLine: null },
    { ProcessId: 88, ParentProcessId: 4, Name: "odd.exe", CommandLine: "odd.exe --flag \u0001value\u0007" },
  ]);
});

test("a single process serializes as an object and ordinary escapes are left alone", () => {
  const rows = parseProcessListingJson(`{"ProcessId":1,"ParentProcessId":null,"Name":"a","CommandLine":"C:\\\\x \\"q\\""}\r\n`);
  assert.deepEqual(rows, { ProcessId: 1, ParentProcessId: null, Name: "a", CommandLine: "C:\\x \"q\"" });
});

test("a listing that is not JSON is still an error, never an empty list", () => {
  assert.throws(() => parseProcessListingJson("Get-CimInstance : Access denied"), SyntaxError);
});
