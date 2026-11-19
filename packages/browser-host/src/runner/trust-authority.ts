import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { BrowserHostError } from "../errors/index.js";

/**
 * Adds a certificate authority to the NSS database Chromium reads trust from
 * (`<home>/.pki/nssdb`), so the runner reaches a rehearsal's public origin over
 * TLS without any verification turned off. The certificate is public; the
 * database lives in the runner's home, a tmpfs folder.
 */
export async function trustAuthority(home: string, pem: string, run: (file: string, args: string[]) => Promise<void> = runFile): Promise<void> {
  const database = path.join(home, ".pki", "nssdb");
  await mkdir(database, { recursive: true, mode: 0o700 });
  const certificate = path.join(home, "fluxiq-authority.pem");
  await writeFile(certificate, pem, { mode: 0o600 });
  await run("certutil", ["-N", "-d", `sql:${database}`, "--empty-password"]);
  await run("certutil", ["-A", "-d", `sql:${database}`, "-n", "fluxiq-deployment", "-t", "C,,", "-i", certificate]);
}

function runFile(file: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(file, args, (error, _stdout, stderr) => {
      if (error === null) resolve();
      else reject(new BrowserHostError("browser_host.runner_trust_failed", `${file} could not add the deployment's certificate authority: ${stderr.trim().split("\n").slice(-1)[0] ?? error.message}`));
    });
  });
}
