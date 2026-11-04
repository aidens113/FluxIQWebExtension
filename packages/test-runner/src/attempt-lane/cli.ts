// `node dist/attempt-lane/cli.js [--task <id>] [--evidence <dir>] [--site-only]`
//
// The same-workspace attempt lane's provider-free proof, headed on a realistic site
// (`run-attempt-proof.ts`). Provider credentials are removed from this process before
// anything it starts can inherit them, so no model can be called. Prints the proof as
// one JSON line and exits 0 only when every claim held.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withoutProviderSecrets } from "../environment.js";
import { runAttemptProof } from "./run-attempt-proof.js";

const scrubbed = withoutProviderSecrets(process.env);
for (const key of Object.keys(process.env)) if (!(key in scrubbed)) delete process.env[key];

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const args = process.argv.slice(2);
const option = (name: string, fallback: string) => {
  const at = args.indexOf(name);
  return at >= 0 && args[at + 1] ? args[at + 1]! : fallback;
};
const stamp = new Date().toISOString().replace(/[:.]/gu, "-");

const result = await runAttemptProof({
  repositoryRoot,
  fluxiqRepositoryRoot: path.resolve(repositoryRoot, "..", "!FluxIQ"),
  scenarioId: option("--scenario", "everything-store"),
  taskId: option("--task", "everything-store-kettle-to-cart"),
  // Past the "Added to cart" sheet by its own "Continue shopping", and the same button pressed again: the retry that adds them a second time.
  doubleAct: {
    afterStep: "cart-added",
    replay: [
      { id: "double-close-sheet", operation: "click", target: "[data-sheet-close]" },
      { id: "double-add", operation: "click", target: "role:button:Add to Cart" },
      { id: "double-added", operation: "waitForState", target: "role:dialog:Added to cart", timeoutMs: 6000 },
    ],
  },
  evidenceDirectory: option("--evidence", path.join(repositoryRoot, "test-runs", "attempt-proof", stamp)),
  fromChat: !args.includes("--site-only"),
  log: (line) => { process.stderr.write(`${line}\n`); },
});
process.stdout.write(`${JSON.stringify(result)}\n`);
process.exitCode = result.held ? 0 : 1;
