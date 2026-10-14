// The fence that keeps a checkout's env files, and the real provider key in
// them, out of every test.

export { runningUnderTestRunner } from "./test-process.js";
export { assertTestMayReadEnvFile } from "./test-read-guard.js";
