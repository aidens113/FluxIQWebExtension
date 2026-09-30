import assert from "node:assert/strict";
import test from "node:test";
import { findBrowserProcess, type BrowserProcessEntry } from "../find-browser-process.js";
import { parseProcessList } from "../parse-process-list.js";

const CHROME = "C:\\Users\\me\\AppData\\Local\\ms-playwright\\chromium-1161\\chrome-win\\chrome.exe";
const OURS = "C:\\Users\\me\\FluxStuff\\fxwork\\t193\\runs\\.work\\run-a\\browser-profile";
const THEIRS = "C:\\Users\\me\\FluxStuff\\fxwork\\t191\\runs\\.work\\run-b\\browser-profile";

/** A process list as four concurrent lanes leave it: two browsers, each with children that repeat its profile directory. */
const processes: BrowserProcessEntry[] = [
  { pid: 100, parentPid: 1, commandLine: `${CHROME} --disable-field-trial-config --user-data-dir=${THEIRS} --remote-debugging-pipe about:blank` },
  { pid: 101, parentPid: 100, commandLine: `"${CHROME}" --type=renderer --user-data-dir=${THEIRS} --lang=en-US` },
  { pid: 200, parentPid: 2, commandLine: `${CHROME} --no-first-run --user-data-dir=${OURS} --remote-debugging-pipe about:blank` },
  { pid: 201, parentPid: 200, commandLine: `${CHROME} --type=crashpad-handler --user-data-dir=${OURS}` },
  { pid: 202, parentPid: 200, commandLine: `"${CHROME}" --type=gpu-process --no-sandbox --user-data-dir=${OURS}` },
];

test("the browser process is the one launched on the run's profile directory, not its children or another lane's", () => {
  assert.equal(findBrowserProcess(processes, OURS), 200);
  assert.equal(findBrowserProcess(processes, THEIRS), 100);
});

test("the profile directory matches in any case, with either separator and a trailing separator", () => {
  assert.equal(findBrowserProcess(processes, `${OURS.toUpperCase().replace(/\\/gu, "/")}/`), 200);
});

test("a quoted profile directory with spaces is read whole, in both quotings Windows produces", () => {
  const spaced = "C:\\Lab Runs\\run c\\browser-profile";
  assert.equal(findBrowserProcess([{ pid: 7, parentPid: 1, commandLine: `${CHROME} "--user-data-dir=${spaced}" about:blank` }], spaced), 7);
  assert.equal(findBrowserProcess([{ pid: 8, parentPid: 1, commandLine: `${CHROME} --user-data-dir="${spaced}" about:blank` }], spaced), 8);
  assert.equal(findBrowserProcess([{ pid: 9, parentPid: 1, commandLine: `${CHROME} --user-data-dir=C:\\Lab about:blank` }], spaced), undefined);
});

test("when two root-less candidates name the directory, the one whose parent is not a candidate wins", () => {
  const nested = [
    { pid: 301, parentPid: 300, commandLine: `${CHROME} --user-data-dir=${OURS}` },
    { pid: 300, parentPid: 5, commandLine: `${CHROME} --user-data-dir=${OURS}` },
  ];
  assert.equal(findBrowserProcess(nested, OURS), 300);
});

test("no process on the directory answers undefined, never another lane's browser", () => {
  assert.equal(findBrowserProcess(processes, "C:\\elsewhere\\browser-profile"), undefined);
  assert.equal(findBrowserProcess([], OURS), undefined);
});

test("the helper's process listing parses into entries and leaves unreadable lines out", () => {
  const listed = parseProcessList(`200\t2\t${CHROME} --user-data-dir=${OURS}\r\nnot-a-pid\t1\tx\n\n201\t200\t${CHROME} --type=gpu-process\n`);
  assert.deepEqual(listed.map(entry => entry.pid), [200, 201]);
  assert.equal(findBrowserProcess(listed, OURS), 200);
});
