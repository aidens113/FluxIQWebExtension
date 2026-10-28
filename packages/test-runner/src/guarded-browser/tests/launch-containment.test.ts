// Structural: no browser this package launches may run outside the network
// guard. Before 2026-09-28 the demo and UI end-to-end lanes -- the ones the
// live campaign drives -- launched Chromium with no guard at all, and nothing
// noticed. This test reads the sources, so a new launch site fails the build
// until it is either routed through `launchGuardedPersistentContext` or added
// here with the check that proves it is guarded.

import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

// Compiled to dist/guarded-browser/tests/, three levels below the package root.
const sourceRoot = path.resolve(import.meta.dirname, "..", "..", "..", "src");
const LAUNCH = /\b(?:chromium|firefox|webkit)\s*\.\s*(?:launch|launchPersistentContext|launchServer|connect|connectOverCDP)\s*\(|\.launchPersistentContext\s*\(/u;

/** Every file allowed to start a browser directly, and why that is safe. */
const SANCTIONED: Record<string, string> = {
  "guarded-browser/launch-guarded-context.ts": "installs the guard before it returns the context",
  "run-scenario/browser-session/launch-browser.ts": "launch-extension-session.ts installs and proves the guard before returning control",
  "interactive-session.ts": "installs the guard before opening any page",
  "offline-snapshot-page/open-web-snapshot-page.ts": "launches no page of its own: open-snapshot-sandbox.ts opens only an offline context whose route answers every request from the recorded snapshot, so no request reaches a network (added with fc8370c3, never listed)",
  "bench/compatibility.ts": "launches headless only to read the browser version; it opens no page",
  "extension-chat-check/firefox/launch-firefox.ts": "installs the guard before it installs the add-on or returns the context; Firefox has no containment switches",
};

/** Source text without comments, so a launch named in prose is not a launch. */
function code(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//gu, "").replace(/(^|[^:])\/\/.*$/gmu, "$1");
}

async function sourceFiles(directory: string): Promise<string[]> {
  const found: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) { if (entry.name !== "tests") found.push(...await sourceFiles(full)); }
    else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")) found.push(full);
  }
  return found;
}

const source = async (relative: string) => code(await readFile(path.join(sourceRoot, relative), "utf8"));

/** Asserts `first` appears in `text`, then `second`, and that nothing matching `before` sits between `first` and `second`. */
function assertOrder(text: string, label: string, first: string, second: string, before: string): void {
  const a = text.indexOf(first);
  const b = text.indexOf(second, a);
  const c = text.indexOf(before, a);
  assert.ok(a >= 0, `${label}: ${first} is present`);
  assert.ok(b > a, `${label}: ${second} follows ${first}`);
  assert.ok(c > b, `${label}: ${second} comes before the first ${before} after ${first}`);
}

test("only sanctioned files start a browser; any other launch must go through launchGuardedPersistentContext", async () => {
  const launching: string[] = [];
  for (const file of await sourceFiles(sourceRoot)) {
    if (LAUNCH.test(code(await readFile(file, "utf8")))) launching.push(path.relative(sourceRoot, file).replaceAll("\\", "/"));
  }
  const unsanctioned = launching.filter(file => !(file in SANCTIONED));
  assert.deepEqual(unsanctioned, [], `These files launch a browser without the network guard. Use launchGuardedPersistentContext from guarded-browser/: ${unsanctioned.join(", ")}`);
  assert.deepEqual(Object.keys(SANCTIONED).filter(file => !launching.includes(file)), [], "a sanctioned file no longer launches a browser; remove its entry");
});

test("each sanctioned launch installs the guard before any page is opened", async () => {
  const guarded = await source("guarded-browser/launch-guarded-context.ts");
  assert.ok(guarded.includes("networkContainmentArgs("), "guarded launcher: the containment switches are on its command line");
  assert.ok(guarded.indexOf("await launch(") < guarded.indexOf("installDeterministicNetworkGuard(context"), "guarded launcher: the guard is installed on the launched context");
  assert.deepEqual(guarded.match(/\breturn\b[^;]*;/gu), ["return { context, guard: await installDeterministicNetworkGuard(context, policy) };"], "guarded launcher: its only return hands back the context together with the installed guard");

  assert.ok((await source("run-scenario/browser-session/launch-browser.ts")).includes("networkContainmentArgs("), "run lane: the containment switches are on its command line");
  const run = await source("run-scenario.ts");
  const session = await source("run-scenario/browser-session/launch-extension-session.ts");
  assertOrder(session, "run session", "await launch(topology", "await installGuard(context", "await openControl(context)");
  assertOrder(session, "run session", "await openControl(context)", "await guard.serviceWorkersProven()", "return { ...session");
  assert.ok(run.indexOf("await launchExtensionSession(") < run.indexOf("context.newPage("), "run lane: the guarded and worker-proven session precedes fixture pages");

  assertOrder(await source("interactive-session.ts"), "interactive session", "chromium.launchPersistentContext(", "installDeterministicNetworkGuard(context", "newPage(");
  // The saved-Flow replay launches nothing itself: it starts through the run lane's session, so it gets the same containment, worker proofs and one-time relaunch.
  const replay = await source("saved-flow-replay/replay-browser.ts");
  assert.equal(LAUNCH.test(replay), false, "saved-Flow replay: starts no browser directly");
  assert.ok(replay.includes("await launchExtensionSession("), "saved-Flow replay: starts through launchExtensionSession");
  assert.ok(replay.indexOf("await launchExtensionSession(") < replay.indexOf("newPage("), "saved-Flow replay: the guarded and worker-proven session precedes fixture pages");
  assert.equal(/installDeterministicNetworkGuard\(|awaitExtensionWorker\(/u.test(replay), false, "saved-Flow replay: no guard or readiness wait of its own beside the session's");

  const firefoxChat = await source("extension-chat-check/firefox/launch-firefox.ts");
  assertOrder(firefoxChat, "Firefox chat check", "firefox.launchPersistentContext(", "installDeterministicNetworkGuard(context", "installTemporaryAddon(");
  assert.equal(/newPage\(|\.goto\(/u.test(firefoxChat), false, "the Firefox chat launcher opens no page itself");
  const chromeChat = await source("extension-chat-check/open-chrome-session.ts");
  assertOrder(chromeChat, "Chrome chat check", "await launchBrowser(", "installDeterministicNetworkGuard(context", "newPage(");
  assertOrder(chromeChat, "Chrome chat check", "await launchBrowser(", "installDeterministicNetworkGuard(context", ".goto(");

  const bench = await source("bench/compatibility.ts");
  assert.equal(/newPage\(|\.goto\(/u.test(bench), false, "the compatibility bench opens no page from its unguarded browser");
});

test("the demo and UI end-to-end lanes launch only through the guarded launcher", async () => {
  for (const file of ["demo-workspace/browser-session.ts", "ui-e2e/topology.ts"]) {
    const text = await source(file);
    assert.ok(text.includes("launchGuardedPersistentContext("), `${file} uses the guarded launcher`);
    assert.equal(LAUNCH.test(text), false, `${file} starts no browser directly`);
  }
});
