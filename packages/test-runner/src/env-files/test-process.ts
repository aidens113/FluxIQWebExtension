// Whether this process is a test, as Node's own test runner starts one.
//
// `node --test` runs each test file in a child process and sets
// `NODE_TEST_CONTEXT` there (`child-v8` on Node 22); a CLI a test spawns with
// the test's environment inherits it. A test file run directly (`node
// x.test.js`) has no such variable, so its script name is the signal instead.
// The env-file guard (`test-read-guard.ts`) and the provider credential's
// reader (`live-llm/provider-credential.ts`) read this, and
// `tests/test-read-guard.test.ts` fails if it ever stops being true inside a
// test, so a Node release that renames the variable cannot quietly switch the
// guard off.

import path from "node:path";

const TEST_SCRIPT = /\.test\.[cm]?[jt]s$/u;

/** True inside a process Node's test runner started, or a test file run on its own. */
export function runningUnderTestRunner(processEnvironment: NodeJS.ProcessEnv = process.env, argv: readonly string[] = process.argv, execArgv: readonly string[] = process.execArgv): boolean {
  if (processEnvironment.NODE_TEST_CONTEXT !== undefined) return true;
  if (execArgv.includes("--test")) return true;
  const script = argv[1];
  return script !== undefined && TEST_SCRIPT.test(path.basename(script));
}
