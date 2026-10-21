// The `reads` command (the P5 changed-read gate tool): the store named by
// `--store` copied to `--work` (`../run/fresh-store-copy.ts`; only the copy is
// opened, and opening it applies Core's migrations), its traces read through
// Core's exported trace store, tier 2 opened over a headed snapshot page
// running the extension's production content code (`../tier2/`), and the gate
// run (`./run-reads-gate.ts`). Writes JSON of counts, codes, field paths and
// digest prefixes; progress lines go to stderr. Returns the exit code: 0 done,
// 2 usage.

import { writeFile } from "node:fs/promises";
import path from "node:path";
import { AutomationStudioProjectDatabasePool, AutomationStudioProjectGatewayTraceStore } from "fluxiq/automation-studio";
import { freshStoreCopy } from "../run/index.js";
import { openTier2Reevaluation } from "../tier2/index.js";
import { parseReadsArguments, READS_USAGE } from "./reads-arguments.js";
import { runReadsGate } from "./run-reads-gate.js";

export async function readsCommand(argv: readonly string[], repositoryRoot: string): Promise<number> {
  const parsed = parseReadsArguments(argv);
  if ("error" in parsed) {
    process.stderr.write(`${parsed.error}\n${READS_USAGE}\n`);
    return 2;
  }
  const started = performance.now();
  const copy = await freshStoreCopy({ sourceFluxiqDir: parsed.store, work: parsed.work });
  const pool = new AutomationStudioProjectDatabasePool({ rootDir: path.join(copy.fluxiqDir, "artifacts", "automation-studio") });
  try {
    const store = await AutomationStudioProjectGatewayTraceStore.open({ pool, projectId: parsed.project });
    try {
      const traceIds = (await store.listManifests({})).map((manifest) => manifest.traceId);
      const tier2 = await openTier2Reevaluation({ extensionDir: path.join(repositoryRoot, "apps", "extension"), channel: parsed.channel });
      let report;
      try {
        report = await runReadsGate({
          store, traceIds, tier2, pairs: parsed.pairs, named: parsed.named, onePerFields: parsed.onePerFields, fidelity: parsed.fidelity,
          progress: (line) => process.stderr.write(`${line}\n`),
        });
      } finally {
        await tier2.close();
      }
      const text = `${JSON.stringify({ project: parsed.project, channel: tier2.channel, wallMs: Math.round(performance.now() - started), ...report }, null, 2)}\n`;
      if (parsed.out === null) process.stdout.write(text);
      else await writeFile(parsed.out, text);
      process.stderr.write(`pairs ${JSON.stringify(report.summary.pairs)}\nfidelity ${JSON.stringify(report.summary.fidelity)}\n`);
      return 0;
    } finally {
      await store.close();
    }
  } finally {
    await pool.closeAll();
  }
}
