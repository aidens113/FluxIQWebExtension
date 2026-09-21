# w2-panel-isolated-storage-recovery

Status: a fresh isolated importer/storage launch is safe and verified. It loads the downstream web-automation domain without reading, copying, adopting, or migrating the user's existing `.fluxiq` root.

## Verified topology

The disposable root was:

`F:\fxlab-runs\t027-panel-isolated-storage-recovery-20260920\workspace\fluxiq-root`

The probe used panel `http://127.0.0.1:3411` and gateway `ws://127.0.0.1:4981/client`. Both ports were closed by the launcher's normal cleanup. Port 3000 was never contacted or changed.

The launch set all storage-owner variables to the fresh importer root and its v2 storage directory:

```text
FLUXIQ_ROOT=<isolated importer root>
FLUXIQ_IMPORTER_ROOT=<isolated importer root>
FLUXIQ_HOST_ROOT=<isolated importer root>
FLUXIQ_DATA_DIR=<isolated importer root>\.fluxiq
FLUXIQ_DATABASES_DIR=<isolated importer root>\.fluxiq
FLUXIQ_HOST_MODULE=F:\fxwork\t027\!FluxIQWebExtension\domain\.script-build\web-panel-host.mjs
PORT=3411
FLUXIQ_CLIENT_GATEWAY_ENABLED=true
FLUXIQ_CLIENT_GATEWAY_HOST=127.0.0.1
FLUXIQ_CLIENT_GATEWAY_PORT=4981
FLUXIQ_CLIENT_GATEWAY_PATH=/client
```

The downstream setup command ran first with `FLUXIQ_WEB_AUTOMATION_ROOT=<isolated importer root>`. The panel was then served through the Lab's isolated production-build cache/workspace (`prepareCoreWebBuild` plus `coreWebServerProcessSpec`), not through the Core worktree's shared `apps/web/.next`. This distinction is required while the user-managed dev panel exists: running `next build` in the shared worktree can invalidate its dev artifacts even when the state root is isolated.

## Verification result

- downstream host module build completed;
- downstream setup metadata named the `web-automation` domain and its recording-domain registration;
- fresh storage had a v2 `config.json` marker before the panel used it;
- production panel returned HTTP 200;
- a fresh isolated synthetic administrator authenticated successfully;
- an authenticated Automation Studio project query scoped to `web-automation` succeeded and returned an empty list, which is the expected fresh state;
- the client gateway bound on the isolated port;
- no provider, browser profile, project creation, or existing user state was used.

This proves current root ownership does not prevent recovery by substitution: the panel can run against a completely separate importer root while loading the same downstream domain/runtime host.

## Login and bootstrap implications

Nothing from the existing root is available in the fresh root: no existing account, session, project, key, pairing, recording, or Flow is copied. A manual panel launch therefore needs one of two explicit fresh-root bootstrap paths:

1. use the panel's normal secure-first-setup flow and create new credentials in the isolated root; or
2. provision a new isolated test identity before launch, as the verified Lab topology did.

The verification used credentials already configured for the isolated Lab process only and did not print or persist them outside the disposable root/session cache. It did not read the user's login database. Provider keys would likewise need to be configured anew through the isolated panel if later live LLM testing were authorized; none were copied or called here.

## Port-3000 recovery application

After the supervisor stops the currently broken port-3000 process, the same topology may bind its isolated production server to port 3000 by changing only `PORT`/the panel origin. It must retain the fresh root variables and downstream host module above. Starting a second server on 3000 while the current listener exists is impossible, and this brief did not authorize stopping it.

For persistent manual use, keep the isolated importer root at a stable explicit path instead of an OS temporary directory. Do not point any variable back to `F:\fxwork\t027\!FluxIQWebExtension` unless the user later approves adoption or migration of that repository's existing state.

## Cleanup boundary

The exact disposable tree `F:\fxlab-runs\t027-panel-isolated-storage-recovery-20260920` may be removed only after confirming its panel/gateway processes are stopped. Removing it deletes only the synthetic identity, v2 marker/database, logs, session cache, and probe belonging to this verification. It must not recurse through the downstream checkout or its `.fluxiq` directory.

The Core web build cache is outside this run root and is shared, generated infrastructure; it is not part of this cleanup boundary and should be left to the repository's cache-pruning workflow. The disposable tree was intentionally retained for supervisor inspection. No source, test, git history, existing `.fluxiq`, browser profile, or user process was changed.
