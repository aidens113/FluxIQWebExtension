import { spawn } from "node:child_process";

/** Past this, the helper's output is not a screenshot the bundle would keep anyway. */
const MAX_OUTPUT_BYTES = 16 * 1024 * 1024;

/** A helper run that ended with a non-zero exit, carrying the code so a caller can tell "no window" (2) from a failure. */
export type WindowCaptureHelperFailure = Error & { exitCode: number | null };

/**
 * Runs the compiled helper once and answers its stdout.
 *
 * The signal kills the helper, which is how `withDeadline` keeps a capture from
 * outliving its budget. The helper runs hidden, so no console window flashes
 * over the browser the person is watching.
 */
export function runWindowCaptureHelper(executable: string, args: readonly string[], signal: AbortSignal): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const child = spawn(executable, [...args], { signal, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    const chunks: Buffer[] = [];
    let size = 0;
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      size += chunk.byteLength;
      if (size > MAX_OUTPUT_BYTES) child.kill();
      else chunks.push(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => { stderr = (stderr + chunk.toString("utf8")).slice(-2000); });
    child.on("error", reject);
    child.on("close", code => {
      if (code === 0 && size <= MAX_OUTPUT_BYTES) { resolve(Buffer.concat(chunks)); return; }
      const reason = size > MAX_OUTPUT_BYTES ? `wrote more than ${MAX_OUTPUT_BYTES} bytes` : `exited ${code ?? "on a signal"}${stderr.trim() ? `: ${stderr.trim()}` : ""}`;
      reject(Object.assign(new Error(`The window capture helper ${reason}`), { exitCode: code }) satisfies WindowCaptureHelperFailure);
    });
  });
}
