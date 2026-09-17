import assert from "node:assert/strict";
import test from "node:test";
import { attempt, resultLine } from "../../tests/attempts.mjs";
import { ramFaultSignature } from "../index.mjs";

test("RAM-fault signatures are recognised, and a real outcome never is", () => {
  assert.equal(ramFaultSignature(attempt({ code: 3221225477 })), "exit 3221225477 (access violation)");
  assert.equal(ramFaultSignature(attempt({ code: -1073741819 })), "exit 3221225477 (access violation)");
  assert.equal(ramFaultSignature(attempt({ code: 1, stderr: "ELIFECYCLE Command failed with exit code 3221225477." })), "exit 3221225477 (access violation)");
  assert.equal(ramFaultSignature(attempt({ code: 139 })), "segmentation fault");
  assert.equal(ramFaultSignature(attempt({ code: null, signal: "SIGSEGV" })), "segmentation fault");
  assert.equal(ramFaultSignature(attempt({ code: 1, stderr: "bash: line 1: 4242 Segmentation fault node x" })), "segmentation fault");
  assert.equal(ramFaultSignature(attempt({ code: 1, stderr: '{"status":"failed","category":"process.startup","message":"core-web-build exited"}' })), "process.startup facility failure");
  assert.equal(ramFaultSignature(attempt({ code: 1, stdout: resultLine({ verdict: "failed", failureCategory: "process.startup" }) })), "process.startup facility failure");
  const pnpmCrash = "C:\\Users\\me\\AppData\\Local\\pnpm\\9.15.0\\dist\\pnpm.cjs:1204\n  bunction x() {\n  ^^^^^^^^\nSyntaxError: Unexpected identifier 'bunction'";
  assert.equal(ramFaultSignature(attempt({ code: 1, stderr: pnpmCrash })), "error inside pnpm's own code");

  // Real outcomes: a reported run, whatever else the output holds, and ordinary failures.
  assert.equal(ramFaultSignature(attempt({ stdout: resultLine({}) })), null);
  assert.equal(ramFaultSignature(attempt({ code: 1, stdout: resultLine({ verdict: "failed", failureCategory: "runtime.behavior" }), stderr: "Segmentation fault" })), null);
  assert.equal(ramFaultSignature(attempt({ code: 3221225477, stdout: resultLine({ verdict: "failed" }) })), null);
  assert.equal(ramFaultSignature(attempt({ code: 1, stderr: '{"status":"failed","category":"environment.missing","message":"Unknown option --instruction-task"}' })), null);
  assert.equal(ramFaultSignature(attempt({ code: 1, stderr: "ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL tsc exited 2\nTypeError in src/app.ts" })), null);
  assert.equal(ramFaultSignature(attempt({ code: 1, stderr: "wrote 13221225477 bytes; id 32212254770" })), null);
});
