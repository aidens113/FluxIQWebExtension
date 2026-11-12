import { normalizePath } from "./normalize-path.js";

const USER_DATA_DIR = "--user-data-dir=";

/** The normalized `--user-data-dir` value of one command line, in any of the three quotings Windows produces. */
export function userDataDirOf(commandLine: string): string | undefined {
  const at = commandLine.indexOf(USER_DATA_DIR);
  if (at < 0) return undefined;
  const start = at + USER_DATA_DIR.length;
  // `--user-data-dir="C:\a b"`, `"--user-data-dir=C:\a b"`, or `--user-data-dir=C:\a`.
  const valueQuoted = commandLine[start] === "\"";
  const argumentQuoted = at > 0 && commandLine[at - 1] === "\"";
  const from = valueQuoted ? start + 1 : start;
  const end = valueQuoted || argumentQuoted ? commandLine.indexOf("\"", from) : commandLine.slice(from).search(/\s/u) + from;
  const value = end < from ? commandLine.slice(from) : commandLine.slice(from, end);
  return normalizePath(value);
}
