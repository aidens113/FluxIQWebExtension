#!/usr/bin/env node
// A live campaign: catalog tasks, run one at a time through the Lab, with one
// summary at the end. Two kinds of task:
//
// - Creation tasks (`LIVE_INSTRUCTION_TASKS`): a plain-English instruction,
//   run as `pnpm lab run <scenario> [--variant <v>] --live-llm ... --llm-task
//   create-flow --instruction-task <id>`, and judged by the run's verdict.
// - Repair tasks (`LIVE_REPAIR_TASKS`, `--kind repair`): the scenario's
//   recorded Flow against a variant that breaks it, run as `pnpm lab run
//   <scenario> [--workflow <w>] [--variant <v>] --flow --live-llm ...
//   --llm-task adapt` with `REPAIR_LIMITS`, and judged by the run's recovery
//   record and final state (`repairJudgement`), never by its first failure.
//
//   pnpm lab:campaign --dry-run                    every task, commands only
//   pnpm lab:campaign --kind extract --limit 3     the first three scraping tasks
//   pnpm lab:campaign --kind repair --dry-run      the repair commands
//   pnpm lab:campaign product-catalog-all-pages -- --llm-max-cost-usd 0.25
//   pnpm lab:campaign social-scheduler-schedule-post -- --llm-permit send_or_publish
//
// Everything after `--` is handed to every task's Lab run unchanged, except the
// options the campaign sets itself (`CAMPAIGN_OWNED_OPTIONS`). That is how a
// campaign permits consequences: `--llm-permit` puts the named classes into
// each run's execution grant, so a job that has to schedule, send or change
// something does it instead of stopping to ask. Absent, a grant permits none.
//
// Each run is spawned as `node scripts/lab/run-lab.mjs` with the same
// arguments, never in parallel and with npm_config_workspace_concurrency=1. The
// catalog is the scenarios barrel `apps/scenario-lab/src/scenarios/index.ts`,
// compiled into the Lab instance's scenario output first. A live run needs an
// explicit selection (task ids, --kind, or --all); a dry run defaults to every
// task.
//
// This machine has faulty RAM, so an attempt that died with one of its
// signatures (see `ramFaultSignature`) is retried up to --max-attempts. An
// attempt that reported a run outcome is never retried: that is a real result.
// Tokens and cost in the summary are what the provider reported: per call for
// a Flow run, and the build's totals (`build.accounting`) for a created Flow,
// which itemizes no call. Never Core's charged figures, which include
// reservations, and a figure no record holds reads "not recorded", not 0.
//
// This file is only the entry point. The campaign lives in `live-campaign/`,
// divided by responsibility; its barrel, `live-campaign/index.mjs`, says which
// part is where. `REPAIR_LIMITS` is in `live-campaign/lab-run/command.mjs`,
// `repairJudgement` in `live-campaign/row/repair-judgement.mjs`.

import { pathToFileURL } from "node:url";
import { runCommandLine } from "./live-campaign/index.mjs";

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCommandLine(process.argv.slice(2));
}
