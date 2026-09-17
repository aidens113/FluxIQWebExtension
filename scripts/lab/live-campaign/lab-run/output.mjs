// What a Lab child printed: its run result on stdout, or its refusal or
// facility failure on stderr, each as the last JSON line of its kind.

/** The Lab's own result: its last stdout line that is a run result. */
export function parseLabResult(stdout) {
  return lastJsonLine(stdout, (value) => typeof value.runId === "string" && typeof value.verdict === "string");
}

/** The runner's refusal or facility failure, as the Lab prints it on stderr. */
export function parseRunnerRefusal(stderr) {
  return lastJsonLine(stderr, (value) => value.status === "failed" && typeof value.category === "string");
}

function lastJsonLine(text, accept) {
  const lines = String(text ?? "").split(/\r?\n/u);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index].trim();
    if (!line.startsWith("{")) continue;
    try { const value = JSON.parse(line); if (value && typeof value === "object" && accept(value)) return value; } catch { /* not JSON */ }
  }
  return null;
}
