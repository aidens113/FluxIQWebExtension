// Release-candidate checklist (MVP plan 4.7, 4.9, 4.10).
//
//   node apps/extension/scripts/release/release-candidate-checklist.mjs \
//     [--evidence rc-evidence.json] [--bench <FluxBench report.json>]... [--json out.json]
//   node apps/extension/scripts/release/release-candidate-checklist.mjs --template > rc-evidence.json
//
// A skeleton that already runs: the checks a machine can make now (store
// packages build and verify in release mode, user documentation exists) run
// every time; the rest read evidence recorded by the person who ran the clean-
// environment test (`--evidence`) and FluxBench reports written by
// `pnpm lab bench` (`--bench`, the `report.json` of packages/test-contracts'
// BenchReport, schema 0.1). Nothing is ever assumed: an item without evidence is
// `pending`, and a release candidate is ready only when every item passes.
//
// Exit codes: 0 ready, 1 at least one item failed, 2 nothing failed but items
// are pending.
//
// The FluxBench thresholds below are PROVISIONAL. The plan sets none (4.7 says
// to decide from benchmark results, not intuition); these exist so the gate has
// something to compare against, and the owner replaces them once the first
// qualification runs are in.

import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { packageExtension } from "./package-extension.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

/** Plan 4.10: the clean-environment run, in order. Evidence keys are these ids. */
export const CLEAN_ENVIRONMENT_STEPS = Object.freeze([
  ["install-extension", "Install the extension from the store package in a browser profile with no FluxIQ state"],
  ["start-runtime", "Install and start the FluxIQ runtime on a machine with no .fluxiq configuration"],
  ["onboarding", "Complete onboarding (start runtime, pair, add DeepSeek key) in under 5 minutes"],
  ["create-natural-language", "Create a natural-language automation"],
  ["create-recorded", "Create a recorded automation"],
  ["create-scraper", "Create a scraper"],
  ["repeat-runs", "Execute them repeatedly"],
  ["trigger-adaptation", "Trigger at least one unexpected-state adaptation"],
  ["persistence", "Confirm the adaptation persisted"],
  ["deterministic-reuse", "Re-run and confirm deterministic reuse (no LLM call on the adapted step)"],
  ["advanced-editor", "Open the Advanced Editor"],
  ["stop-pause-takeover", "Stop, pause and take over a workflow"],
  ["restart-recovery", "Restart the browser and the runtime and verify recovery"]
].map(([id, title]) => Object.freeze({ id, title })));

/** Owner-only actions no script can take. Evidence keys are these ids. */
export const OWNER_ACTIONS = Object.freeze([
  ["ci-configuration", "CI repository variables FLUXIQ_CORE_REPOSITORY and FLUXIQ_CORE_REF and secret FLUXIQ_CORE_TOKEN are set, and a full CI run is green"],
  ["firefox-addon-id", "Permanent Firefox add-on id chosen and set in apps/extension/manifest.firefox.json"],
  ["store-accounts", "Chrome Web Store and addons.mozilla.org developer accounts exist"],
  ["privacy-policy-url", "docs/user/privacy-policy.md is published at a public URL entered in both store listings"],
  ["store-screenshots", "Store screenshots captured from the release build (docs/user/store-listing.md)"],
  ["amo-source-submission", "Source archive and build instructions prepared for AMO review (bundled code)"]
].map(([id, title]) => Object.freeze({ id, title })));

/** PROVISIONAL FluxBench qualification thresholds, flow lane. See the header. */
export const PROVISIONAL_BENCH_THRESHOLDS = Object.freeze({
  minRepeatCount: 3,
  flow: Object.freeze({
    flowCreationSuccess: { min: 0.8 },
    initialExecutionSuccess: { min: 0.9 },
    deterministicReplaySuccess: { min: 0.95 },
    fuzzyRecovery: { min: 0.7 },
    failureClassificationAccuracy: { min: 0.9 },
    falseSuccess: { max: 0.02 }
  })
});

const USER_DOCS = ["docs/user/README.md", "docs/user/install.md", "docs/user/quickstart.md", "docs/user/permissions.md", "docs/user/privacy-policy.md", "docs/user/store-listing.md"];

/**
 * @typedef {{ id: string, group: string, title: string, status: "pass" | "fail" | "pending", detail: string }} ChecklistItem
 * @param {{ packaging: { ok: boolean, detail: string }, docsMissing: string[], evidence: any, benchReports: { file: string, report: any }[] }} input
 * @returns {{ ready: boolean, items: ChecklistItem[] }}
 */
export function evaluateReleaseCandidate(input) {
  /** @type {ChecklistItem[]} */
  const items = [];
  items.push({ id: "store-packages", group: "packaging", title: "Chrome/Edge and Firefox store packages build and verify in release mode", status: input.packaging.ok ? "pass" : "fail", detail: input.packaging.detail });
  items.push({ id: "user-docs", group: "packaging", title: "Install, quickstart, permissions, privacy and store documentation exist", status: input.docsMissing.length === 0 ? "pass" : "fail", detail: input.docsMissing.length === 0 ? "all present" : `missing: ${input.docsMissing.join(", ")}` });
  for (const step of OWNER_ACTIONS) items.push(fromEvidence("owner", step, input.evidence?.owner?.[step.id]));
  for (const step of CLEAN_ENVIRONMENT_STEPS) items.push(fromEvidence("clean-environment", step, input.evidence?.cleanEnvironment?.[step.id]));
  items.push(...benchItems(input.benchReports));
  return { ready: items.every((item) => item.status === "pass"), items };
}

function fromEvidence(group, step, record) {
  if (!record || (record.status !== "pass" && record.status !== "fail")) {
    return { id: step.id, group, title: step.title, status: "pending", detail: "no evidence recorded" };
  }
  const where = [record.browser, record.at].filter(Boolean).join(", ");
  const detail = [where, record.notes].filter(Boolean).join(" - ") || "recorded without notes";
  if (record.status === "pass" && !record.at) return { id: step.id, group, title: step.title, status: "fail", detail: "a pass must say when it was observed (`at`)" };
  return { id: step.id, group, title: step.title, status: record.status, detail };
}

function benchItems(reports) {
  const title = "FluxBench qualification (provisional thresholds, flow lane)";
  if (reports.length === 0) return [{ id: "fluxbench", group: "fluxbench", title, status: "pending", detail: "no bench report given (--bench)" }];
  return reports.map(({ file, report }, index) => {
    const id = `fluxbench-${index + 1}`;
    const problems = [];
    if (report?.schemaVersion !== "0.1") problems.push(`schemaVersion ${String(report?.schemaVersion)} is not 0.1`);
    if (!(report?.repeatCount >= PROVISIONAL_BENCH_THRESHOLDS.minRepeatCount)) problems.push(`repeatCount ${String(report?.repeatCount)} < ${PROVISIONAL_BENCH_THRESHOLDS.minRepeatCount}`);
    const rates = report?.metrics?.ratesByLane?.flow;
    if (!rates) problems.push("the report has no flow-lane rates");
    else {
      for (const [metric, bound] of Object.entries(PROVISIONAL_BENCH_THRESHOLDS.flow)) {
        const rate = rates[metric]?.rate;
        if (typeof rate !== "number") problems.push(`${metric} was not measured`);
        else if ("min" in bound && rate < bound.min) problems.push(`${metric} ${rate.toFixed(3)} < ${bound.min}`);
        else if ("max" in bound && rate > bound.max) problems.push(`${metric} ${rate.toFixed(3)} > ${bound.max}`);
      }
    }
    const label = `${path.basename(path.dirname(file))}/${path.basename(file)} (${report?.corpusId ?? "unknown corpus"}, ${report?.workflows?.length ?? 0} workflows, llm calls ${report?.llm?.calls ?? "?"})`;
    return { id, group: "fluxbench", title, status: problems.length === 0 ? "pass" : "fail", detail: problems.length === 0 ? label : `${label}: ${problems.join("; ")}` };
  });
}

function evidenceTemplate() {
  const blank = { status: "pending", at: "", browser: "", notes: "" };
  return {
    owner: Object.fromEntries(OWNER_ACTIONS.map((step) => [step.id, { ...blank }])),
    cleanEnvironment: Object.fromEntries(CLEAN_ENVIRONMENT_STEPS.map((step) => [step.id, { ...blank }]))
  };
}

async function runPackaging() {
  const outDir = await mkdtemp(path.join(tmpdir(), "fluxiq-rc-packages-"));
  const lines = [];
  try {
    const { ok } = await packageExtension({ release: true, outDir, log: (line) => lines.push(line) });
    return { ok, detail: lines.filter((line) => !line.startsWith("ok")).map((line) => line.trim()).join("; ") || "chrome and firefox packages verified" };
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
}

async function main(args) {
  if (args.includes("--template")) {
    process.stdout.write(`${JSON.stringify(evidenceTemplate(), null, 2)}\n`);
    return 0;
  }
  let evidence = {};
  const benchFiles = [];
  let jsonOut;
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index + 1];
    if (args[index] === "--evidence" && value) { evidence = JSON.parse(await readFile(path.resolve(value), "utf8")); index += 1; }
    else if (args[index] === "--bench" && value) { benchFiles.push(path.resolve(value)); index += 1; }
    else if (args[index] === "--json" && value) { jsonOut = path.resolve(value); index += 1; }
    else throw new Error(`unknown or incomplete argument ${args[index]}; usage: [--evidence FILE] [--bench REPORT]... [--json OUT] | --template`);
  }
  const docsMissing = [];
  for (const doc of USER_DOCS) {
    try {
      await access(path.join(repoRoot, doc));
    } catch (error) {
      if (/** @type {NodeJS.ErrnoException} */ (error).code !== "ENOENT") throw error;
      docsMissing.push(doc);
    }
  }
  const benchReports = await Promise.all(benchFiles.map(async (file) => ({ file, report: JSON.parse(await readFile(file, "utf8")) })));
  const result = evaluateReleaseCandidate({ packaging: await runPackaging(), docsMissing, evidence, benchReports });
  for (const item of result.items) console.log(`${item.status.toUpperCase().padEnd(7)} [${item.group}] ${item.title}${item.detail ? ` -- ${item.detail}` : ""}`);
  const failed = result.items.filter((item) => item.status === "fail").length;
  const pending = result.items.filter((item) => item.status === "pending").length;
  console.log(`\nrelease candidate: ${result.ready ? "READY" : "NOT READY"} (${result.items.length - failed - pending} pass, ${failed} fail, ${pending} pending)`);
  if (jsonOut) await writeFile(jsonOut, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  return result.ready ? 0 : failed > 0 ? 1 : 2;
}

function isEntryPoint() {
  if (!process.argv[1]) return false;
  const canonical = (file) => (process.platform === "win32" ? path.resolve(file).toLowerCase() : path.resolve(file));
  return canonical(fileURLToPath(import.meta.url)) === canonical(process.argv[1]);
}

if (isEntryPoint()) process.exit(await main(process.argv.slice(2)));
