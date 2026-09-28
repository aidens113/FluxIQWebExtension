# Audit: Phase 4 (evidence bundle) and Phase 11 (persistent self-recording demo)

Status: COMPLETE
Date: 2026-09-28
Scope: read-only audit of `docs/working/automated-testing-facility-plan.md`
Phases 4 and 11 against the code at `dev` b4fd477d. No source file was changed.

## Outcome

Four of the six answers are qualified rather than clean. The largest finding is
that the plan's headline evidence claim (Current State lines 76-78) is **no
longer true of the Lab scenario runner**: on 2026-09-25, commit `de790249`
removed screenshot capture from `run-scenario.ts` entirely. The claim survives
only on the demo / UI-E2E path, which is the Phase 11 path. The second finding
is that `test-runs/web-extension-demo` — the persistent workspace the whole of
Phase 11's live validation is recorded against — **does not exist on this
machine**. Everything else (the three demo scripts, their imports, the manifest
fields including `fluxiqExecution`, the redaction seam) is intact, type-checks
clean, and passes 63/63 + 17/17 tests with nothing skipped.

---

## Q1 — "strictly event-only ... timed sampling and deduplication are disabled"

Verdict: **CLAIM PARTLY FALSE.** True of the demo / UI-E2E evidence path
(Phase 11), false of the Lab scenario runner (Phase 4/5), which takes no
screenshots at all since 2026-09-25. Two smaller qualifications follow.

### Where the claim still holds — demo / UI-E2E path

`packages/test-runner/src/browser-evidence.ts:34-44` is the only production
construction of a capture controller with a real screenshot adapter:

```ts
this.capture = new EvidenceCaptureController(this.bundle, {
  screenshots: "events",
  trace: "off",
  video: "off",
  sampleFps,
  maxScreenshots: 10_000,
  maxBytes: 512 * 1024 * 1024,
  reviewRequired: true,
  minimumScreenshotIntervalMs: 0,
  deduplicateScreenshots: false,
}, {
```

- `screenshots: "events"` (`browser-evidence.ts:35`) meets
  `packages/test-evidence/src/capture.ts:8`
  `if (policy.screenshots === "events") return true;` — every trigger captures.
- `minimumScreenshotIntervalMs: 0` (`browser-evidence.ts:42`) defeats the rate
  limiter at `packages/test-evidence/src/capture.ts:31`
  (`this.nowMs() - this.lastCaptureAt < (this.policy.minimumScreenshotIntervalMs ?? 0)`).
- `deduplicateScreenshots: false` (`browser-evidence.ts:43`) defeats the dedup
  branch at `packages/test-evidence/src/capture.ts:40`
  (`if (priorPath && this.policy.deduplicateScreenshots !== false)`).
- Before/after pairing: `browser-evidence.ts:62-73` (`step.start` before the
  action, `step.complete` after) and `browser-evidence.ts:75-89`
  (`runtimeActionBoundary({ phase: "before" | "after" })`).
- The physical JPEG: `browser-evidence.ts:51`
  `const bytes = await page.locator("body").screenshot({ type: "jpeg", quality: 65, timeout: 10_000 });`

The Phase 11 demo lanes use exactly this recorder:
`packages/test-runner/src/demo-workspace/browser-session.ts:83-89` and
`:148-154`, both `new BrowserEvidenceRecorder({ ..., sampleFps: 0, redactionSecrets })`.

### Where the claim is now false — Lab scenario runner

`packages/test-runner/src/run-scenario.ts:163-179`:

```ts
  // **This facility takes no screenshots.** Removed on the user's instruction,
  // 2026-09-25, after measurement showed what they cost and what they were
  // worth: four Playwright captures per run, each waiting out the 30_000 ms
  // default and each returning nothing, which was 120 s of a 437 s run. They
  // could never succeed — the Lab drives a headed Chromium, which does not
  // composite a tab that is not in front ...
  //
  // The capture controller keeps its place and its events; only the picture is
  // gone, so a `runtime.dispatch`, a `runtime.settle` and an `error` are still
  // published, each recording that no visual was available.
  const screenshotAdapter = undefined;
  const capture = new EvidenceCaptureController(bundle, evidence.capture, screenshotAdapter);
```

With `adapter === undefined`, `packages/test-evidence/src/capture.ts:29` takes
`else if (!this.adapter) screenshot = { suppressed: "capture-unavailable" };`
for every event. "One physical JPEG immediately before and one immediately
after every test-issued state-changing action" is therefore **false for the Lab
runner**; the events remain, the pixels do not.

**Commit:** `de790249`, `2026-09-25 18:56:09 -0700`,
"Take no screenshots, and publish what became of the repair route".
Found with
`git log -S "This facility takes no screenshots" -- packages/test-runner/src/run-scenario.ts`.

Knock-on: `packages/test-evidence/src/report.ts:50` builds the contact sheet
from `events.filter((event) => event.screenshot?.path)`, so a Lab run's
`review/contact-sheet.html` is now empty and `report.html` prints the suppression
reason in the screenshot column (`report.ts:40`). Phase 4's acceptance line —
"`report.html` identifies the failing step and before/after state" — still holds
for the *step* identity (`report.ts:41`, error rows carry `class="failure"`) but
no longer for before/after *state* on that path.

### Qualification 1 — dedup is on by default on the runner's policy

`packages/test-runner/src/evidence-policy/effective-evidence-policy.ts:40-42`:

```ts
function capture(screenshots: ScenarioEvidencePolicy["screenshots"], reviewRequired: boolean): EffectiveEvidencePolicy["capture"] {
  return { screenshots, trace: "off", video: "off", sampleFps: 0, maxScreenshots: MAX_SCREENSHOTS, maxBytes: MAX_BYTES, reviewRequired };
}
```

It sets neither `deduplicateScreenshots: false` nor
`minimumScreenshotIntervalMs: 0`. Because `capture.ts:40` tests
`!== false`, an **undefined** value leaves dedup **enabled**. The runner's two
controllers (`run-scenario.ts:179` and `run-scenario.ts:330`) are built from
`evidence.capture` and so have dedup on. Inert today (no adapter), but live the
moment an adapter is restored there. This is not a regression from a commit:
`git log -S "deduplicateScreenshots" -- packages/test-evidence packages/test-runner`
returns only `488bb66f` and `dd963f79`, both original authorship.

### Qualification 2 — the demo path now skips one action class outright

`packages/test-runner/src/demo-workspace/browser-session.ts:293-296`:

```ts
    // Core's state snapshots are already durable runtime evidence. Capturing a
    // second Lab screenshot around each snapshot command only stalls the
    // command acknowledgement and adds no user-action boundary evidence.
    if (value.actionType === "web.dom.capture_snapshot") return;
```

Added by `ac357190`, `2026-09-20`, "Skip redundant snapshot evidence captures"
(task t027, worker `w2_panel_storage_layout`). `web.dom.capture_snapshot` is a
read, not a state change, so this is defensible against the plan's wording — but
"every test-issued ... action" is now literally "every action except
`web.dom.capture_snapshot`", and the per-run screenshot count the plan records
(37 pairs / 74 JPEGs) would no longer reproduce.

### Timed sampling

`sampleFps` is declared on the policy (`packages/test-evidence/src/types.ts:50`
via `CapturePolicy`; `packages/test-contracts/src/evidence.ts:19`) and is
**never read** by `packages/test-evidence/src/capture.ts` — a repository-wide
grep finds no consumer anywhere. Timed sampling is not merely disabled, it is
unimplemented. One manifest still declares a nonzero value,
`apps/scenario-lab/src/scenarios/reconnect/scenario.ts:23`
(`sampleFps: 0.5`), which is dead data: `effective-evidence-policy.ts:41`
hardcodes `sampleFps: 0` regardless of the manifest.

---

## Q2 — the three demo scripts

Verdict: **CLAIM TRUE.** All three exist, are wired in root `package.json`, and
every module specifier they import resolves on disk and exports the named
binding.

Root `package.json`:

- `"demo:setup-local": "pnpm --filter @fluxiq-web-extension/test-runner build && node scripts/setup-demo-local-env.mjs"`
- `"demo:record": "pnpm --filter @fluxiq-web-extension/scenario-lab build && pnpm --filter @fluxiq-web-extension/extension test:e2e:build && pnpm --filter @fluxiq-web-extension/test-runner... build && node scripts/record-demo-workspace.mjs"`
- `"demo:run": "... && node scripts/run-demo-workspace-flow.mjs"`

The files are 62, 14 and 14 lines. Every import:

| Script | Import | Resolves |
| --- | --- | --- |
| `scripts/record-demo-workspace.mjs:2` | `../packages/test-runner/dist/target-config.js` | yes |
| `scripts/record-demo-workspace.mjs:3` | `../packages/test-runner/dist/demo-workspace.js` | yes |
| `scripts/run-demo-workspace-flow.mjs:2` | `../packages/test-runner/dist/target-config.js` | yes |
| `scripts/run-demo-workspace-flow.mjs:3` | `../packages/test-runner/dist/demo-workspace.js` | yes |
| `scripts/setup-demo-local-env.mjs:5` | `../packages/test-runner/dist/windows-acl.js` | yes |
| `scripts/setup-demo-local-env.mjs:27-28` | `F:/!FluxIQ/packages/fluxiq/dist/index.js` (dynamic, `pathToFileURL`) | yes (468 bytes, 2026-09-26) |

Runtime check — `node -e` dynamic import of each dist module, observed output:

```
OK   ./packages/test-runner/dist/target-config.js -> loadTestEnvironment (function)
OK   ./packages/test-runner/dist/demo-workspace.js -> recordDemoWorkspace (function)
OK   ./packages/test-runner/dist/demo-workspace.js -> resolveDemoWorkspaceConfiguration (function)
OK   ./packages/test-runner/dist/demo-workspace.js -> runDemoWorkspaceFlow (function)
OK   ./packages/test-runner/dist/windows-acl.js -> hardenWindowsPrivatePath (function)
```

These are `dist/` (untracked build output; each script's `pnpm --filter ...
build` prefix regenerates it). The corresponding sources all exist:
`packages/test-runner/src/target-config.ts`, `src/demo-workspace.ts`,
`src/windows-acl.ts`.

`packages/test-runner/src/demo-workspace.ts` is now a 5-line facade —
`export * from "./demo-workspace/index.js";` (`demo-workspace.ts:5`) — over the
`demo-workspace/` directory introduced by `e8004995` (2026-09-11, "Decompose
demo-workspace.ts, the largest file in the repo"). Its own comment
(`demo-workspace.ts:1-3`) says the facade exists so importers keep their
specifier, and that is exactly what kept the two demo scripts working.

---

## Q3 — manifest fields including `fluxiqExecution` provenance

Verdict: **CLAIM TRUE.**
`packages/test-runner/src/run-manifest/create-run-manifest.ts:55-91` still
builds every field the plan names, and `fluxiqExecution` is produced for all
four target modes.

```ts
export async function createRunManifest(input: RunManifestInput): Promise<RunManifest> {
  const { topology, target } = input;
  const extensionManifest = JSON.parse(await readFile(path.join(input.extensionPath, "manifest.json"), "utf8")) as { version: string };
  const fluxiqExecution = target?.mode === "clone"
    ? cloneExecutionMetadata(input.cloneState, input.panelVerification)
    : topology?.targetMode === "existing" && target?.mode === "existing" && input.existingPreflight && input.existingExecution
      ? { targetMode: "existing" as const, origin: topology.fluxiqOrigin, projectId: target.projectId, flowId: target.flowId, flowContentHash: input.existingPreflight.flow.contentHash, runtimeRunId: input.existingExecution.runId, ...(input.existingPreflight.gateway.runtimeId ? { runtimeId: input.existingPreflight.gateway.runtimeId } : {}), sessionIdentityVerified: input.existingPreflight.sessionIdentityVerified, panelVerification: input.panelVerification?.status ?? "limited" }
      : topology?.targetMode === "persistent-isolated" && target?.mode === "persistent-isolated"
        ? { targetMode: "persistent-isolated" as const, workspace: target.workspace }
        : topology?.targetMode === "isolated" ? { targetMode: "isolated" as const } : undefined;
```

Emitted manifest (`create-run-manifest.ts:66-91`): `schemaVersion`, `runId`,
`scenarioId`, `scenarioRevision`, `seed`, `status`, `startedAt`, `finishedAt`,
`repositories` (facility + Core commit and dirty flag, via `revision()` at
`:120-125`), `compatibility`, `lockfiles`, `extension` (version, directory
sha256, repository-relative path), `environment`, `ports`, `processExits`,
`artifacts`, `redactionState`, `verdict`, optional `fluxiqExecution`,
`workflowId`, `variantId`, `automationFailure`, plus `steps` and `actions`.

Clone provenance remains the fullest, with three stages
`exported` / `imported` / `executed`, at `create-run-manifest.ts:112-118`.

Fields present that the plan does not name (additions, not regressions):
`redactionState` (`:83`), `workflowId` / `variantId` (`:86-87`),
`automationFailure` (`:88`).

Tests: `dist/run-manifest/tests/create-run-manifest.test.js` runs and passes as
part of the 63/63 below.

---

## Q4 — can the evidence path write secrets, cookies, pairing tokens or page data into a bundle?

Verdict: **CLAIM TRUE that a redaction seam exists and is enforced at every
write** — but it is a *literal-and-pattern* seam, not a semantic one, and there
are named categories it does not cover.

### The seam

`packages/test-evidence/src/redaction.ts` plus the three write methods of
`packages/test-evidence/src/bundle.ts`. Every path into a bundle goes through
one of four methods, and each redacts and then asserts:

| Method | Redacts | Asserts |
| --- | --- | --- |
| `bundle.ts:186-201` `appendEventSerialized` | `redactStructured(input, this.redaction)` (`:188`) | `assertNoSensitiveText(serialized, this.redaction.secrets)` (`:195`) **before** the journal write at `:197` |
| `bundle.ts:208-214` `writeStructured` | `redactStructured` (`:209`) | `assertNoSensitiveText` (`:211`) |
| `bundle.ts:216-221` `writeText` | `redactText` (`:217`) | `assertNoSensitiveText` (`:218`) |
| `bundle.ts:223-229` `writeVerifiedVisual` / `:231-236` `writeVerifiedArtifact` | nothing — the producer must set `redactionVerified: true` (`:224`, `:232`) | `assertBinaryContainsNoConfiguredSecret` (`:225`, `:233`), which at `:350-353` UTF-8-decodes the bytes and runs `assertNoSensitiveText` |

What it covers, exactly:

```ts
const DEFAULT_DENIED_KEYS = [
  "authorization", "cookie", "set-cookie", "password", "passwd",
  "pairingtoken", "pairing_token", "bearertoken", "bearer_token",
  "accesstoken", "access_token", "secret",
] as const;

const SENSITIVE_TEXT = [
  /\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi,
  /\b(?:password|passwd|pairing[_-]?token|access[_-]?token)\s*[=:]\s*[^\s,;&]+/gi,
] as const;
```
(`packages/test-evidence/src/redaction.ts:14-32`)

Key matching is normalized case- and separator-insensitively
(`redaction.ts:34-36`), so `Set-Cookie`, `set_cookie` and `SETCOOKIE` are all
denied. `redactStructured` (`:81-102`) walks the whole object graph, replacing a
denied key's *value* wholesale (`:94`) and running `redactText` over every
string (`:86`); configured run secrets are substring-replaced at `:41-44`.
Cycles become `[CIRCULAR]` rather than throwing (`:88`, and the long comment at
`:55-79` records that the previous visited-set implementation destroyed the
evidence of every Flow-lane structured failure).

Visual capture is fail-closed: `capture.ts:36` calls `assertVerifiedVisual`,
which throws `RedactionFailure` unless the adapter set `redactionVerified: true`
(`redaction.ts:114-118`).

### Second seam — the post-hoc leak attestation

`packages/test-runner/src/redaction-attestation/` + `secret-leak-attestation.ts`
scan for what the *pre-write* seam might have missed, and fail the run
`security.redaction` if they find it. Scopes are defined at
`redaction-attestation/run-redaction-scopes.ts:38-43`: the bundle's staging
directory, and the FluxIQ storage directory (`fluxiq-root/.fluxiq`) holding
persisted recordings, timelines, `snapshots/*.json` and Core's SQLite stores.
SQLite files are searched byte-for-byte in UTF-8 and UTF-16 and read cell by
cell (`secret-leak-attestation.ts:53-72`), with no size ceiling; an unreadable
store fails closed as `unscanned-store`.

### What it does NOT cover — stated plainly

1. **Recorded page data is not covered at all.** Nothing in the seam classifies
   page text, DOM snapshots, extracted records or screenshots pixels as
   sensitive. `writeVerifiedVisual` only checks the JPEG bytes for the run's
   *configured literals* (`bundle.ts:350-353`); a password typed into a form and
   rendered on screen is not a string in the file and will not be found. The
   plan's Phase 4 acceptance is narrower than "no page data" — it says "sensitive
   fixture values are absent" — and that is what is enforced.
2. **The browser profile is deliberately out of scope.**
   `run-redaction-scopes.ts:34-36`: "The browser profile is deliberately not a
   scope: the extension's storage there is LevelDB, whose binary `.log` files the
   text scan cannot read and would fail closed on every run." So extension-local
   storage — which is where pairing tokens live — is never scanned.
3. **A secret not declared by the scenario is invisible.**
   `redactText` (`:41-44`) and `assertNoSensitiveText` (`:104-112`) only know the
   literals the run passed in (`run-scenario.ts:139` `resolveRunSecrets`). The
   generic patterns catch `Bearer …`, `password=…`, `pairing_token=…` and
   `access_token=…`, and nothing else. A session cookie value appearing bare — not
   under a `cookie` key, not after `Bearer` — passes through.
4. **Credential-*syntax* findings do not fail a run.**
   `redaction-attestation/attest-run-redaction.ts:37-42`: the
   `credential-field`, `credential-assignment` and `authorization-material`
   categories "are recorded for review and do not fail the run".
5. **Binary artifacts are decoded as UTF-8 for the check** (`bundle.ts:352`),
   so a literal stored UTF-16 or compressed inside a binary artifact is not found
   by the pre-write assert — only by the later SQLite-aware scan, and only inside
   the two declared scopes.
6. **The demo path passes `redactionSecrets` explicitly**
   (`browser-session.ts:88`, `:153`); a demo lane that forgets to pass them gets
   a bundle with only the generic patterns applied.

---

## Q5 — `test-runs/web-extension-demo` on disk, and `test-runs/` ignored by git

Verdict: **half the claim is FALSE.**

- `test-runs/web-extension-demo` **does not exist.** `ls test-runs/web-extension-demo`
  printed `No such file or directory`. `test-runs/` itself exists with 154
  entries — `bench`, `campaigns`, `focused-checks`, `instances`,
  `interactive-sessions`, `persistent-isolated`, and ~148 `run-*` directories.
  The Phase 11 persistent workspace that the plan's Current State (lines 53-61)
  records all of Phase 11's live validation against is gone from this machine. It
  is regenerable — `scripts/setup-demo-local-env.mjs:24-25` derives
  `test-runs/web-extension-demo` and `.../fluxiq-root` — but the recording
  `client.extension-bbe5ab04-3eca-415f-b64c-d0c54e135ad2.1788718034927` and the
  runtime runs `8db01689-…` and `e23d811e-…` the plan cites are **not available
  to inspect**, and re-running `demo:setup-local` refuses unless `--force`
  (`setup-demo-local-env.mjs:19`).
- `test-runs/` **is** ignored. `.gitignore:15` is the single line `test-runs/`.
  `git check-ignore -v test-runs/ test-runs/web-extension-demo` printed:
  ```
  .gitignore:15:test-runs/	test-runs/
  .gitignore:15:test-runs/	test-runs/web-extension-demo
  ```

---

## Q6 — has this area rotted since 2026-09-10?

Verdict: **largely NO — it has been actively maintained, not abandoned.** The
one true rot is the drift between the plan's prose and the code (Q1), plus the
missing demo workspace (Q5). Mechanically the area is clean.

### Dead scripts referenced by root `package.json`

**None.** A scan of all 48 `scripts/…` and `packages/…` file references across
the 62 root scripts found 0 missing files.

### Broken imports

**None.** Type-checks are clean:

| Command | Observed |
| --- | --- |
| `npx tsc -p packages/test-evidence/tsconfig.json --noEmit` | exit 0, no output |
| `npx tsc -p packages/test-runner/tsconfig.json --noEmit` | exit 0, no output |

Runtime import resolution of all three demo scripts' specifiers also succeeded
(Q2 table).

### TODO / FIXME / HACK / XXX

**None** in any owned file. Grep over `packages/test-evidence/` and over
`packages/test-runner/src/{browser-evidence.ts, evidence-policy/, run-manifest/,
redaction-attestation/, secret-leak-attestation.ts, demo-workspace.ts,
demo-workspace/}` returned no matches.

Two `@deprecated` aliases remain, both unused by any consumer:

```ts
/** @deprecated Use CaptureCorrelation. */
export type Correlation = CaptureCorrelation;
/** @deprecated Use CaptureEvidenceEventInput. */
export type EvidenceEventInput = CaptureEvidenceEventInput;
```
(`packages/test-evidence/src/types.ts:45-48`)

### Skipped tests

**None.** Observed test output:

| Command | Observed |
| --- | --- |
| `node --test tests/*.test.mjs` in `packages/test-evidence` | `# tests 17 / # pass 17 / # fail 0 / # skipped 0 / # todo 0` |
| `node --test dist/{evidence-policy,run-manifest,redaction-attestation,demo-workspace}/tests/*.test.js dist/tests/browser-evidence.test.js` in `packages/test-runner` | `# tests 63 / # pass 63 / # fail 0 / # skipped 0 / # todo 0` |

Note the plan's Phase 4 row claims "pass 8/8 tests"; `test-evidence` now carries
17 and the owned `test-runner` slice 63. The counts in the plan are stale
*downward* — the area gained tests, it did not lose them.

### Dead data

`apps/scenario-lab/src/scenarios/reconnect/scenario.ts:23` declares
`sampleFps: 0.5`, which nothing reads (see Q1). This is the only dead
configuration found.

### Churn since 2026-09-10 (34 commits touching owned paths)

Selected, to show it is maintenance rather than rot:
`e8004995` (2026-09-11) decomposed `demo-workspace.ts`;
`ab741576` / `3c396b0b` / `39598232` / `ededbb4e` / `1aec39e7` (2026-09-13)
built the redaction attestation and the SQLite-aware leak scan;
`dbad82c1` / `1c1a16d6` (2026-09-18) removed the store size ceiling;
`ac357190` (2026-09-20) added the `capture_snapshot` skip (Q1);
`cdbc6851` / `1085f497` (2026-09-21) added the UI-E2E journeys that reuse
`BrowserEvidenceRecorder`.

---

## Not verified

- **No live run was executed.** Every claim about capture behaviour is read from
  the code and its unit tests. Whether a real demo run still produces balanced
  before/after pairs — and how many, given the `capture_snapshot` skip — was not
  measured, and could not be, because the persistent workspace is gone (Q5).
- **No bundle on disk was inspected for leakage.** The Q4 answer describes the
  seam, not an audit of the ~148 `run-*` bundles present under `test-runs/`.
  Whether any existing bundle actually contains a secret is unknown.
- **`pnpm check`, `pnpm test` and `pnpm build` were not run** repository-wide;
  only the two owned packages' `tsc --noEmit` and the owned test files.
- **The `de790249` screenshot removal was not traced to the user instruction it
  cites.** The commit message asserts it; I did not look for the conversation.
- **`packages/test-runner/dist/` was consumed as-is**, not rebuilt. It is current
  enough to import and run the owned tests, but a stale dist could in principle
  differ from `src/`; the `tsc --noEmit` pass over `src/` is the compensating
  check.

## Open questions or contradictions found

1. **The plan's Current State line 76-78 contradicts `run-scenario.ts`.** The
   plan should either be amended to scope the event-only claim to the demo path,
   or the Lab runner's screenshot capture restored against the tab the Flow
   actually drives — which is what `run-scenario.ts:177-178` itself suggests
   ("a run that wants pictures again wants a capture of the tab the Flow actually
   drove, which is a different thing from this one").
2. **The Phase 4 Execution Log row credits "deduplication" as a validated
   feature** while Current State says deduplication is disabled. Both are true of
   different code paths, which is precisely the ambiguity worth removing.
3. **`effectiveEvidencePolicy` omits `deduplicateScreenshots: false`.** If the
   event-only policy is meant to be facility-wide, that omission is a latent
   defect, not a preference — `browser-evidence.ts` sets it and
   `effective-evidence-policy.ts` does not, for no stated reason.
4. **Phase 11's live evidence is unreproducible from this machine.** The plan
   presents Phase 11 as "live validated"; the artifacts backing that claim are
   absent and `test-runs/` is ignored, so they were never recoverable from git.
   If that evidence matters, it needs a durable home outside `test-runs/`.
