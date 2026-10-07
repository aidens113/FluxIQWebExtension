import assert from "node:assert/strict";
import test from "node:test";
import { attempt, resultLine } from "../../tests/attempts.mjs";
import { ramFaultSignature, STARTUP_FAILURE } from "../index.mjs";

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

// t342: a Core that answered 400 from its identity endpoint was reported as
// "this machine's memory fault can cause that ... only a retry tells them
// apart". Core answering an HTTP request is not a crash, and the standing rule
// is that a live failure is a product or Lab defect, never the machine.
const IDENTITY_400 = "FluxIQ control request failed: /api/programs/automation-studio/get-runtime-build-identity (400): Executing Core runtime build identity is unavailable.";

test("a startup failure that is Core control answering over HTTP is a real outcome, never the memory fault", () => {
  const startup = attempt({ code: 1, stdout: resultLine({ verdict: "failed", failureCategory: "process.startup", path: "F:/runs/run-a" }) });
  const reads = [];
  assert.equal(ramFaultSignature(startup, { readFirstFailure: (runPath) => { reads.push(runPath); return IDENTITY_400; } }), null);
  assert.equal(reads.length, 1, "the run's own first failure is what decides");
  assert.equal(ramFaultSignature(startup, { readFirstFailure: () => "FluxIQ control request failed: /api/session (503)" }), null, "any status Core answered with");
  assert.equal(ramFaultSignature(attempt({ code: 1, stderr: `${JSON.stringify({ status: "failed", category: "process.startup", message: IDENTITY_400 })}\n` })), null, "a runner refusal carrying it");

  // A startup failure that is not an answer from Core keeps its label, and is
  // still only retried once by the campaign's repeat check.
  assert.equal(ramFaultSignature(startup, { readFirstFailure: () => "Core web panel production build did not succeed" }), STARTUP_FAILURE);
  assert.equal(ramFaultSignature(startup, { readFirstFailure: () => null }), STARTUP_FAILURE);
});
