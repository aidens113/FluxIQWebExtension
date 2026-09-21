// Parses Windows PowerShell 5.1's `ConvertTo-Json -Compress` output for the
// process listing. That serializer leaves some control characters raw inside
// string literals, so one process whose command line carries one would make
// the whole listing unreadable -- and an unreadable listing stops every
// worktree removal. The compressed output is a single line with no structural
// whitespace, so escaping every control character after trimming the line
// ending changes nothing outside the strings.

/** @returns {unknown} */
export function parseProcessListingJson(stdout) {
  const escaped = stdout.trim().replace(/[\u0000-\u001f]/gu, (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`);
  return JSON.parse(escaped);
}
