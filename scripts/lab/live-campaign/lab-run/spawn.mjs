// Starting Node children from the repository root: a Lab run, whose output is
// echoed, kept (its tail) for classification and written to the attempt's log,
// and a build step, whose output goes straight to the terminal.

import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { repositoryRoot } from "../../lab-instance.mjs";
import { displayCommand } from "./command.mjs";

const OUTPUT_TAIL_CHARS = 1_000_000;

/** An `execute` for `runCampaign` that runs `labScript` with a task's arguments. */
export function spawnLab(labScript) {
  return ({ args, env, logPath }) => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [labScript, ...args], { cwd: repositoryRoot, env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    const stdout = tail();
    const stderr = tail();
    child.stdout.on("data", (chunk) => { process.stdout.write(chunk); stdout.push(chunk.toString("utf8")); });
    child.stderr.on("data", (chunk) => { process.stderr.write(chunk); stderr.push(chunk.toString("utf8")); });
    child.once("error", reject);
    child.once("close", (code, signal) => {
      const attempt = { code, signal, stdout: stdout.text(), stderr: stderr.text() };
      writeFile(logPath, `# ${displayCommand(args)}\n# exit ${code ?? signal}\n\n## stdout\n${attempt.stdout}\n## stderr\n${attempt.stderr}`).then(() => resolve(attempt), reject);
    });
  });
}

/** Runs one Node script with inherited output; the result carries no output, only how it ended. */
export function runNode(script, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script], { cwd: repositoryRoot, env, stdio: "inherit", windowsHide: true });
    child.once("error", reject);
    child.once("close", (code, signal) => resolve({ code, signal, stdout: "", stderr: "" }));
  });
}

function tail() {
  let text = "";
  return { push(chunk) { text = (text + chunk).slice(-OUTPUT_TAIL_CHARS); }, text: () => text };
}
