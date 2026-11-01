# Persisted native replay discovery

Outcome: Done — read-only discovery. The failing loader press is identified; the precise positive-settlement suppression gate is absent from the recorded evidence.

## Evidence and causal limits

- Original finalized run: `run-mvx64gvn-6781507e`. Manifest source is downstream `f092402b73daaca3aa24b70cd3afd8c63bfbecaa`, Core `16b5043c5b986cb5a31b71bbabf4d4c11c289819`, both clean. Authoring mode was `legacy`; `--model-reset-only` was absent.
- `snapshots/creation-context.json` supplies the actual persistent workspace, project and Flow identities. The corresponding workspace, browser profile, project database and selected Flow source directory exist under the pinned Lab instance. No identity was inferred from a default project. Saved content hash: `73f4a73b2ddbe1c1db8c743a63bbca35c7866056f0eab57c782dd9ce11da3474`. Its final `outcome: failed` does not mean no Flow was saved: the native Flow was created and subsequently failed playback/judgement.
- The final whole authoring test consists of replay reset, navigation, two click nodes, then raw list counts **8 → 16 → 24 → 28 → ended**. Finalized step kinds identify these as test steps 40–51, followed by two judges. Both judges answered `yes` with zero defects. Steps were located by kind; the ordinals here describe this finalized bundle only.
- Native playback similarly navigates and executes its two click nodes. Its first two `web.dom.next_page` receipts explicitly confirm `moved by scroll`. The third occurrence of that same persisted node is the **first native loader-control press**, after the raw24 read. It fails `web.validation.output_not_observed`, category `output_not_observed`, stage `verification`, `list_unchanged`; its quoted control matches the configured control after backslash normalization. Duration is about11.1s and the failed action carries ambiguous effect. The earlier two native pager calls did not prime the spinner.
- The failure/inspection snapshots contain the spinner state, with no ended state. The later `web.recovery.press` snapshot loses the spinner and reaches ended. Together with the control match, this supports that the intended loader received the first press and the subsequent recovery press loaded the remaining batch. It does not support a simple absent-control explanation.
- Native extraction reached three raw reads (8+16+24=48 collected records); its dataset judgement matched6 of expected8 records. It did not reach the final batch. This is meaningful progress, but not task completion.
- Resolved `nextPage` JSON is identical across the final test and all three native occurrences: SHA-256 of `JSON.stringify(nextPage)` is `9521c5a07bb71f283397b452fa44669c34e466573ae5118ea33b2c2b6849f1b3`. The native command adds `timeoutMs: 30000`. Identity equality alone does not establish identical browser observer state.
- The fixture initializes `stuckClickPending = true` per document and resets it on a filter change; its first manual loader press changes status only, and the following press requests the batch (`apps/scenario-lab/src/scenarios/company-website/client/team-script.ts:26`, `:62`, `:77`). The final test explicitly resets/navigates before opening the team document. Earlier exploration priming carrying into that test is therefore unsupported. The test's pass3 next-page span (finalized49) is the only pager span between24 and28. Its compact replay receipt omits the individual transport attempts and physical click count. A successful same-span retry is a plausible explanation, **not a directly recorded fact**.
- The failed native receipt and diagnose context provide no closed observer-health, binding, pending-work, or settlement-suppression reason. `failedTargetUnknown` is true and repair candidates are empty. Page text lacks the DOM attributes needed to prove the originating list/control binding. Exact differing gate remains unmeasured. No machine-load, acquisition or permission cause is established.
- The generic verification failure correctly remains subject to lasting-act uncertainty protection. Do not reclassify all authored next-page commands or bypass that protection to obtain a replay pass.

## Existing installed, provider-free replay seam

Use the production **`lab replay`**, not the MAIN-only content harness and not a replacement Flow:

- `packages/test-runner/src/commands.ts:124`: accepts scenario, `--workspace`, `--flow`, `--project`, `--instruction-task`, `--seed`.
- `packages/test-runner/src/cli.ts:53`: forces `persistent-isolated` and delegates to `replaySavedFlow`.
- `packages/test-runner/src/saved-flow-replay/replay-saved-flow.ts:165`: refuses provider credentials before starting anything; `:203` starts Core with `modelProvidersEnabled: false`; `:210` selects the actual project; `:215` records saved Flow/graph hashes; `:235` opens the installed browser; `:238` resets the fixture; `:240` navigates to a fresh document; `:255` executes the exact persisted Flow with no model intent.
- `packages/test-runner/src/saved-flow-replay/replay-browser.ts:59`: uses the normal `launchExtensionSession`, installed unpacked extension, network guard, normal pairing, and active fixture tab. Its `openStart` performs a real navigation. This is the production installed path with the isolated content world and separate MAIN observer, unlike the earlier content harness.
- `packages/test-runner/src/flow-lane/replay/provider-free-replay-run.ts:30`: removes any model argument and waits for the terminal verdict/accounting. `replay-saved-flow.ts:261` checks explicit zero provider accounting; `:276` and `:278` compare both Flow content and executable graph before/after. Stored key identities are preserved (`:217`, final cleanup), not deleted.
- Disablement is real wiring: `coordinator.ts:148` carries the flag into `environment.ts:162` as `FLUXIQ_MODEL_PROVIDERS_ENABLED=false`. Core `packages/fluxiq/src/programs/_shared/runtime.ts:147`, `:150`, `:217`, `:237` omit result-check, session-provider and conversation model wiring when disabled.

Pinned source directory: `C:/Users/osrs_/FluxStuff/fxlab/t833-claude/lab-ext`. Existing instance: `t833-claude-company-website-slot-1`. Its runs directory is `test-runs/instances/<instance>` under that pinned source, **not the external finalized evidence directory**. The recorded scenario-port file exists and still matches49169. The replay must retain that address, because the saved native navigation contains its absolute address; replay reports whether it actually served at the saved address. Existing compiled replay and installed extension manifest both exist. No execution was performed by this worker.

The following exact launch recipe reads identities from the source evidence without printing or transcribing them. The lead owns execution and output capture. Run with an ignored log destination chosen by the lead:

```powershell
@'
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
const evidence = 'C:/Users/osrs_/FluxStuff/lab-runs/2026-10-31/run-mvx64gvn-6781507e';
const run = JSON.parse(fs.readFileSync(path.join(evidence, 'run.json'), 'utf8'));
const creation = JSON.parse(fs.readFileSync(path.join(evidence, 'snapshots/creation-context.json'), 'utf8'));
const repo = run.repositories.facility.path;
const instance = run.extension.path.replaceAll('\\', '/').split('/.lab-instances/')[1].split('/')[0];
const task = run.invocation.args[run.invocation.args.indexOf('--instruction-task') + 1];
const { withoutProviderSecrets } = await import(pathToFileURL(path.join(repo, 'scripts/provider-secret-environment.mjs')).href);
const environment = withoutProviderSecrets(process.env);
for (const name of ['TARGET', 'PERSISTENT_WORKSPACE', 'BASE_URL', 'GATEWAY_URL', 'PROJECT_ID', 'FLOW_ID', 'USERNAME', 'PASSWORD', 'PIN', 'TOTP']) {
  delete environment['FLUXIQ_TEST_' + name];
}
Object.assign(environment, {
  FLUXIQ_WEB_EXTENSION_ROOT: repo,
  FLUXIQ_CORE_ROOT: run.repositories.core.path,
  FLUXIQ_LAB_INSTANCE: instance,
  FLUXIQ_TEST_RUNS_DIR: path.join(repo, 'test-runs', 'instances', instance),
  FLUXIQ_TEST_ENV_FILES: 'none',
  FLUXIQ_PROVIDER_KEY_FILES: 'none',
  FLUXIQ_LAB_ALLOW_BEHIND_CORE: '1',
});
const child = spawnSync(process.execPath, [
  'scripts/lab/run-lab.mjs', 'replay', run.scenarioId,
  '--workspace', creation.workspace, '--flow', creation.flowId,
  '--project', creation.projectId, '--instruction-task', task,
  '--seed', String(run.seed),
], { cwd: repo, env: environment, stdio: 'inherit' });
process.exit(child.status ?? 1);
'@ | node --input-type=module
```

This keeps the existing pinned dedicated instance and generated run-owned account. `FLUXIQ_LAB_ALLOW_BEHIND_CORE=1` only permits this explicitly requested historical source baseline; it does not permit a stale build or alter the Flow. Normal launcher currency/build checks still apply. No model/live flags or recovery grants are supplied.

The lead should read the resulting ignored replay receipt and verify: original saved content hash before replay; content and graph hashes unchanged; served-at-saved-address true; no credential variables; model wiring disabled; zero provider accounting/interventions/harness activations; raw progress and final exact8×4/order dataset judgement. A reproduced failure with unchanged hashes and zero calls is a valid baseline observation, never a pass. It can then be compared with an installed observer-diagnostic probe while retaining this saved Flow and fresh-document state.

## Validation and limits

Validation: read-only Node projections of finalized JSON and page snapshots -> matching resolved pager hashes, two native scroll successes, third native loader failure, spinner-to-ended recovery, saved identity/storage/port existence confirmed. Source inspection -> genuine installed `lab replay`, provider wiring disabled before startup, no model intent, explicit accounting and immutable-graph checks confirmed.

No browser, provider, Lab control, build, test or git command was executed. No source/shared document was changed. Two low-level SQLite read-only opens returned `ERR_SQLITE_ERROR`/14; no migration-capable project-store API was invoked. Consequently the compact evidence was not expanded into per-dispatch trial receipts. The lead's provider-free replay will authoritatively read the saved graph and accounting through the normal runtime.

Changed: this report only.

Not verified: physical click/transport-attempt count of final authoring test; exact binding/observer gate which suppressed native NO_EFFECT; baseline replay result; current stored graph hash via runtime; fresh-browser observed8×4 success.
