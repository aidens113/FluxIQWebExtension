// A Lab attempt as `execute` returns it, and the run-result line a Lab prints.

export const resultLine = (fields) => `${JSON.stringify({ runId: "run-x", verdict: "passed", path: "test-runs/run-x", ...fields })}\n`;
export const attempt = (fields = {}) => ({ code: 0, signal: null, stdout: "", stderr: "", ...fields });
