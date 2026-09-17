// The shell lines that run a campaign from the pair, printed after every
// `pnpm lab:pair`. Values are single-quoted for bash, so a Core path spelled
// `!FluxIQ` is never taken for history expansion.
//
// The Lab and the campaign are started by absolute script path rather than as
// `pnpm lab ...`: `pnpm lab:campaign` shows up in the process list only as
// `node scripts/lab/live-campaign.mjs`, which names no checkout, so between
// two tasks nothing would tell `pnpm lab:pair` that a campaign is using the
// pair. Both scripts resolve every path from their own location, so the
// absolute form behaves identically from any directory.

/**
 * @param {{
 *   extRoot: string,
 *   environment: Readonly<Record<string, string>>,
 *   providerKey: { name: string, found: boolean, source?: string, searched?: string[] },
 * }} input
 */
export function renderPairInstructions({ extRoot, environment, providerKey }) {
  const key = providerKey.found
    ? `# ${providerKey.name}: a live run from the pair reads it from ${providerKey.source}.`
    : [
      `# ${providerKey.name}: NOT reachable from the pair (searched ${providerKey.searched?.join(", ")}), so a live campaign would be refused.`,
      `#   Export it in the shell that starts the campaign, or copy .env.local from the working checkout into ${extRoot}:`,
      "#   git ignores that file, and with FLUXIQ_TEST_ENV_FILES=none the Lab takes only that one name from it.",
    ].join("\n");
  const root = extRoot.replaceAll("\\", "/");
  const lab = quote(`${root}/scripts/lab/run-lab.mjs`);
  const campaign = quote(`${root}/scripts/lab/live-campaign.mjs`);
  return [
    "# Run from the pair (bash). What runs there is exactly the two commits above.",
    `cd ${quote(root)}`,
    `export ${Object.entries(environment).map(([name, value]) => `${name}=${quote(value)}`).join(" ")}`,
    `node ${lab} run basic-form --target isolated   # a non-live check, about a minute`,
    `node ${campaign} --dry-run   # the campaign's commands, nothing run`,
    `node ${campaign} --all --max-attempts 4 -- <lab options>`,
    "# Started by absolute path, the campaign stays visible to pnpm lab:pair, which refuses to move the pair under it.",
    key,
  ].join("\n");
}

function quote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}
