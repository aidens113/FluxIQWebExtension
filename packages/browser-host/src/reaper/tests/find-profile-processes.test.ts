import assert from "node:assert/strict";
import test from "node:test";
import { findBrowserProcess, findProfileProcesses, type BrowserProcessEntry } from "../index.js";
import { parseProcessTable } from "../parse-process-table.js";

const CHROME = "C:\\pw\\chromium-1161\\chrome-win\\chrome.exe";
const DIR = "C:\\Temp\\fluxiq-host-host-1-abc";
const SPACED = "C:\\Lab Runs\\profile one";
const entry = (pid: number, commandLine: string, parentPid = 1): BrowserProcessEntry => ({ pid, parentPid, commandLine });

test("every --user-data-dir quoting form matches its directory", () => {
  const forms = [
    `${CHROME} --user-data-dir=${DIR} about:blank`,
    `${CHROME} --user-data-dir="${SPACED}" about:blank`,
    `${CHROME} "--user-data-dir=${SPACED}" about:blank`,
    `${CHROME} --user-data-dir=${DIR}`,
    `${CHROME} --user-data-dir=${DIR.toUpperCase()}\\`,
    `${CHROME} --user-data-dir=${DIR.replace(/\\/gu, "/")}/`
  ];
  const processes = forms.map((form, index) => entry(10 + index, form));
  assert.deepEqual(findProfileProcesses(processes, DIR).map(found => found.pid), [10, 13, 14, 15]);
  assert.deepEqual(findProfileProcesses(processes, SPACED).map(found => found.pid), [11, 12]);
});

test("children that repeat the directory are found, a different directory and an unrelated process are not", () => {
  const processes = [
    entry(100, `${CHROME} --user-data-dir=${DIR}`),
    entry(101, `"${CHROME}" --type=renderer --user-data-dir=${DIR}`, 100),
    entry(102, `${CHROME} --user-data-dir=${DIR}-other`),
    entry(103, "node server.js")
  ];
  assert.deepEqual(findProfileProcesses(processes, DIR).map(found => found.pid), [100, 101]);
  assert.equal(findBrowserProcess(processes, DIR), 100);
  assert.equal(findBrowserProcess(processes, "C:\\nowhere"), undefined);
});

test("the process table parses Windows and ps lines and skips what does not read", () => {
  const table = parseProcessTable(["  12 1 /usr/bin/chrome --user-data-dir=/tmp/p", "300 12 C:\\a\\chrome.exe --x", "garbage"].join("\r\n"));
  assert.deepEqual(table.map(row => [row.pid, row.parentPid]), [[12, 1], [300, 12]]);
  assert.equal(table[0]?.commandLine, "/usr/bin/chrome --user-data-dir=/tmp/p");
});
