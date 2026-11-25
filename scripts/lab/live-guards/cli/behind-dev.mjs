#!/usr/bin/env node
// `node scripts/lab/live-guards/cli/behind-dev.mjs && <launch>`: exits 1 with
// the Lab's refusal when this checkout or its Core lacks local `dev`, and 0,
// silently, when it does not. Put first in every script that opens a browser.

import { coreRepositoryRoot } from "../../core/index.mjs";
import { repositoryRoot } from "../../lab-instance.mjs";
import { runBehindDevCheck } from "../index.mjs";

process.exit(await runBehindDevCheck({ repositoryRoot, coreRoot: coreRepositoryRoot(process.env, repositoryRoot) }));
