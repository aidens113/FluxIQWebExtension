// The `behind-dev` rule end to end over real git repositories: a live run is
// admitted only when this repository's HEAD contains its local `dev` and the
// Core's HEAD contains Core's, and a repository with no `dev` is refused.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { admitLiveRun, readDevAncestry } from "../index.mjs";

const ARGS = ["run", "bigbox-retail", "--live-llm", "--llm-task", "create-flow", "--instruction-task", "bigbox-retail-pickup-cart"];

function git(root, ...args) {
  return execFileSync("git", ["-C", root, "-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "-c", `core.hooksPath=${path.join(root, ".no-hooks")}`, ...args], { encoding: "utf8", windowsHide: true }).trim();
}

/** A repository whose first branch is `branch`, with `commits` empty commits on it. */
async function repository(root, branch = "dev", commits = 1) {
  await mkdir(root, { recursive: true });
  git(root, "init", "--quiet", "-b", branch);
  for (let index = 0; index < commits; index += 1) git(root, "commit", "--quiet", "--allow-empty", "-m", `${branch} ${index}`);
  return git(root, "rev-parse", "HEAD");
}

async function fixture() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "live-guards-behind-dev-"));
  const slots = path.join(directory, "lab-slots");
  const web = path.join(directory, "web");
  const core = path.join(directory, "core");
  await mkdir(slots, { recursive: true });
  const admit = () => admitLiveRun({ args: ARGS, env: { FLUXIQ_LAB_INSTANCE: "slot-1" }, repositoryRoot: web, coreRoot: core, slotsDirectory: slots, now: Date.now(), isAlive: () => true, fingerprint: async () => ({ digest: "sha256:x", files: 1 }) });
  return { directory, slots, web, core, admit, cleanup: () => rm(directory, { recursive: true, force: true }) };
}

const rules = (admission) => admission.refusals.map((refusal) => refusal.rule);

test("a checkout on dev, a task branch ahead of dev, and a detached Core at dev are admitted", async () => {
  const lab = await fixture();
  try {
    await repository(lab.web);
    const coreDev = await repository(lab.core);
    git(lab.core, "checkout", "--quiet", "--detach", coreDev);
    assert.deepEqual(rules(await lab.admit()), []);

    git(lab.web, "checkout", "--quiet", "-b", "task/t999-lane");
    git(lab.web, "commit", "--quiet", "--allow-empty", "-m", "lane work");
    assert.deepEqual(rules(await lab.admit()), []);
    const ancestry = await readDevAncestry(lab.web);
    assert.deepEqual([ancestry.contains, ancestry.lacking, ancestry.error], [true, 0, null]);
  } finally {
    await lab.cleanup();
  }
});

test("a lane checkout that missed a dev merge is refused, naming its root, HEAD and how many dev commits it lacks", async () => {
  const lab = await fixture();
  try {
    await repository(lab.web);
    await repository(lab.core);
    git(lab.web, "checkout", "--quiet", "-b", "task/t999-lane");
    const laneHead = git(lab.web, "rev-parse", "HEAD");
    git(lab.web, "checkout", "--quiet", "dev");
    git(lab.web, "commit", "--quiet", "--allow-empty", "-m", "merged round 1");
    git(lab.web, "commit", "--quiet", "--allow-empty", "-m", "merged round 2");
    git(lab.web, "checkout", "--quiet", "task/t999-lane");

    const refused = await lab.admit();
    assert.deepEqual(rules(refused), ["behind-dev"]);
    const [refusal] = refused.refusals;
    assert.ok(refusal.why.includes(`this repository, ${lab.web}, is at ${laneHead.slice(0, 7)}, which lacks 2 commit(s) of its local dev`), refusal.why);
    assert.ok(!refusal.why.includes(lab.core), "the Core level with its dev is not named");
    assert.match(refusal.remedy, /run `git merge dev`.*pnpm --filter fluxiq build.*pnpm --filter @fluxiq-web-extension\/extension build/u);

    // Only a file the user creates lets it past; merging dev satisfies it.
    await writeFile(path.join(lab.slots, "OVERRIDE-behind-dev"), "", "utf8");
    const overridden = await lab.admit();
    assert.deepEqual([rules(overridden), overridden.overridden], [[], ["behind-dev"]]);
    await rm(path.join(lab.slots, "OVERRIDE-behind-dev"));
    git(lab.web, "merge", "--quiet", "--no-edit", "dev");
    assert.deepEqual(rules(await lab.admit()), []);
  } finally {
    await lab.cleanup();
  }
});

test("a detached shared Core behind Core's dev is refused, naming the Core", async () => {
  const lab = await fixture();
  try {
    await repository(lab.web);
    const old = await repository(lab.core);
    git(lab.core, "commit", "--quiet", "--allow-empty", "-m", "core dev moved");
    git(lab.core, "checkout", "--quiet", "--detach", old);

    const refused = await lab.admit();
    assert.deepEqual(rules(refused), ["behind-dev"]);
    assert.ok(refused.refusals[0].why.includes(`the FluxIQ Core it builds against, ${lab.core}, is at ${old.slice(0, 7)}, which lacks 1 commit(s) of its local dev`), refused.refusals[0].why);
    assert.ok(refused.refusals[0].remedy.includes(`In ${lab.core}, run`), refused.refusals[0].remedy);
  } finally {
    await lab.cleanup();
  }
});

test("a repository with no local dev branch, or no checkout at all, is refused with the reason rather than admitted", async () => {
  const lab = await fixture();
  try {
    await repository(lab.web, "main");
    await repository(lab.core);
    const refused = await lab.admit();
    assert.deepEqual(rules(refused), ["behind-dev"]);
    assert.match(refused.refusals[0].why, /could not be read: .*has no local dev branch \(refs\/heads\/dev\)/u);

    await rm(lab.core, { recursive: true, force: true });
    await mkdir(lab.core);
    const noCheckout = await readDevAncestry(lab.core);
    assert.equal(noCheckout.contains, false);
    assert.match(noCheckout.error, /git rev-parse --verify HEAD/u);
  } finally {
    await lab.cleanup();
  }
});

test("a checkout that lacks only documentation commits is admitted; one more code commit refuses it", async () => {
  const lab = await fixture();
  try {
    await repository(lab.web);
    const coreDev = await repository(lab.core);
    git(lab.core, "checkout", "--quiet", "--detach", coreDev);
    git(lab.web, "checkout", "--quiet", "-b", "task/t999-lane");
    git(lab.web, "checkout", "--quiet", "dev");
    await mkdir(path.join(lab.web, "docs", "working"), { recursive: true });
    await writeFile(path.join(lab.web, "docs", "working", "plan.md"), "Current State\n");
    await writeFile(path.join(lab.web, "NOTES.md"), "notes\n");
    git(lab.web, "add", "-A");
    git(lab.web, "commit", "--quiet", "-m", "docs only");
    git(lab.web, "checkout", "--quiet", "task/t999-lane");
    assert.deepEqual(rules(await lab.admit()), []);
    const ancestry = await readDevAncestry(lab.web);
    assert.deepEqual([ancestry.contains, ancestry.docsOnly, ancestry.lacking], [false, true, 1]);

    git(lab.web, "checkout", "--quiet", "dev");
    await mkdir(path.join(lab.web, "src"), { recursive: true });
    await writeFile(path.join(lab.web, "src", "run.ts"), "export {};\n");
    git(lab.web, "add", "-A");
    git(lab.web, "commit", "--quiet", "-m", "code");
    git(lab.web, "checkout", "--quiet", "task/t999-lane");
    assert.deepEqual(rules(await lab.admit()), ["behind-dev"]);
  } finally {
    await lab.cleanup();
  }
});
