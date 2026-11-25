// `admitDevAncestry` over real git repositories: every Lab run that is not a
// live run is refused, before anything is built, when this checkout or its Core
// lacks local `dev`; read-only commands are never asked.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { admitDevAncestry, formatRefusals } from "../index.mjs";

const SCRIPTED = ["attempt", "bigbox-retail", "--scripted-model", "--instruction-task", "bigbox-retail-pickup-cart"];
const PROVIDER_FREE = ["run", "bigbox-retail", "--flow"];

function git(root, ...args) {
  return execFileSync("git", ["-C", root, "-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "-c", `core.hooksPath=${path.join(root, ".no-hooks")}`, ...args], { encoding: "utf8", windowsHide: true }).trim();
}

async function repository(root) {
  await mkdir(root, { recursive: true });
  git(root, "init", "--quiet", "-b", "dev");
  git(root, "commit", "--quiet", "--allow-empty", "-m", "dev 0");
}

async function fixture() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "admit-dev-ancestry-"));
  const slots = path.join(directory, "lab-slots");
  const web = path.join(directory, "web");
  const core = path.join(directory, "core");
  await mkdir(slots, { recursive: true });
  await repository(web);
  await repository(core);
  const admit = (args) => admitDevAncestry({ args, repositoryRoot: web, coreRoot: core, slotsDirectory: slots });
  return { slots, web, core, admit, cleanup: () => rm(directory, { recursive: true, force: true }) };
}

/** Leaves the checkout on a lane branch that lacks one commit `dev` has. */
function fallBehind(root, file = "src.txt") {
  git(root, "checkout", "--quiet", "-b", "task/t999-lane");
  git(root, "checkout", "--quiet", "dev");
  return writeFile(path.join(root, file), "x\n").then(() => {
    git(root, "add", ".");
    git(root, "commit", "--quiet", "-m", "dev moved");
    git(root, "checkout", "--quiet", "task/t999-lane");
  });
}

test("trees containing dev admit a scripted attempt and a provider-free run", async () => {
  const lab = await fixture();
  try {
    for (const args of [SCRIPTED, PROVIDER_FREE]) assert.deepEqual(await lab.admit(args), { refusals: [], overridden: [] });
  } finally {
    await lab.cleanup();
  }
});

test("a checkout lacking dev refuses a scripted attempt and a provider-free run, naming git merge dev", async () => {
  const lab = await fixture();
  try {
    await fallBehind(lab.web);
    for (const args of [SCRIPTED, PROVIDER_FREE, ["interactive"]]) {
      const admission = await lab.admit(args);
      assert.deepEqual(admission.refusals.map((refusal) => refusal.rule), ["behind-dev"]);
      assert.match(admission.refusals[0].remedy, /git merge dev/u);
      const { text, line } = formatRefusals(admission.refusals, "run");
      assert.match(text, /run refused by rule "behind-dev"/u);
      assert.equal(JSON.parse(line).category, "lab.live-guard");
    }
  } finally {
    await lab.cleanup();
  }
});

test("a Core lacking dev refuses the run too", async () => {
  const lab = await fixture();
  try {
    await fallBehind(lab.core);
    const admission = await lab.admit(SCRIPTED);
    assert.deepEqual(admission.refusals.map((refusal) => refusal.rule), ["behind-dev"]);
    assert.ok(admission.refusals[0].why.includes("the FluxIQ Core it builds against"), admission.refusals[0].why);
  } finally {
    await lab.cleanup();
  }
});

test("read-only commands are never checked, even on a stale tree", async () => {
  const lab = await fixture();
  try {
    await fallBehind(lab.web);
    let asked = 0;
    for (const command of ["inspect", "compare", "auth", "clone-cache", "flow-chart", "stop", "watch"]) {
      const admission = await admitDevAncestry({ args: [command], repositoryRoot: lab.web, coreRoot: lab.core, slotsDirectory: lab.slots, devAncestry: async () => { asked += 1;
        throw new Error("asked");
      } });
      assert.equal(admission, null);
    }
    assert.equal(asked, 0);
  } finally {
    await lab.cleanup();
  }
});

test("a docs-only gap is admitted, a git error is refused, and the override file admits", async () => {
  const lab = await fixture();
  try {
    await mkdir(path.join(lab.web, "docs"), { recursive: true });
    await fallBehind(lab.web, path.join("docs", "plan.md"));
    assert.deepEqual(await lab.admit(SCRIPTED), { refusals: [], overridden: [] });

    await rm(path.join(lab.web, ".git"), { recursive: true, force: true });
    const broken = await lab.admit(SCRIPTED);
    assert.deepEqual(broken.refusals.map((refusal) => refusal.rule), ["behind-dev"]);

    await writeFile(path.join(lab.slots, "OVERRIDE-behind-dev"), "", "utf8");
    assert.deepEqual(await lab.admit(SCRIPTED), { refusals: [], overridden: ["behind-dev"] });
  } finally {
    await lab.cleanup();
  }
});
