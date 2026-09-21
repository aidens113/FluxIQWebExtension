# w2-panel-isolated-port3000-host

Status: passed. The authorized manual panel is running against a brand-new isolated v2 root; the prior downstream `.fluxiq` remained untouched.

## Live topology

- Panel: `http://127.0.0.1:3000` (HTTP 200)
- Client gateway: `ws://127.0.0.1:4711/client` (listening)
- Owning process: hidden `node.exe`, PID `25940`
- Isolated importer/host root: `F:\fxlab-runs\t027-manual-panel-port3000-20260920\workspace\fluxiq-root`
- Isolated storage/database root: `F:\fxlab-runs\t027-manual-panel-port3000-20260920\workspace\fluxiq-root\.fluxiq`
- Downstream host module: `F:\fxwork\t027\!FluxIQWebExtension\domain\dist\host\web-panel-host.mjs`
- Published Core web build: key `0fb4baace28af52f9187b5b0`, build id `Rhp0aQU8IsC68sBU8RH0q`, outside the shared `apps/web/.next`
- Logs and non-sensitive process metadata: `F:\fxlab-runs\t027-manual-panel-port3000-20260920\logs` and `process.json`

The panel process owns both loopback listeners. It was started hidden and is intentionally retained after this worker exits.

## Verification

- Both requested ports were free before launch.
- Downstream setup created only the fresh root's v2 marker and registered the `web-automation` domain and recording domain.
- The cached production panel started without rebuilding or touching the shared development `.next` directory.
- The unauthenticated root page returned HTTP 200 and contained the normal sign-in/password UI.
- No synthetic identity, provider credential/call, browser profile, project, or session was created or imported.
- The fresh root now contains its own `config.json` and `global.sqlite`. Normal fresh-root access remains `admin` with temporary password `admin`; the UI's secure-first setup requires replacing it after sign-in.
- Before/after metadata inventories of `F:\fxwork\t027\!FluxIQWebExtension\.fluxiq` were identical (same top-level names, file sizes, directory flags, and UTC modification times). No existing account/project data was read or changed.

## Shutdown and cleanup boundary

To stop this isolated host, terminate PID `25940`, then verify loopback ports 3000 and 4711 are no longer listening. Only after the process is stopped may the exact disposable tree `F:\fxlab-runs\t027-manual-panel-port3000-20260920` be removed. The published Core build cache is shared generated infrastructure and is outside this cleanup boundary. The downstream checkout, especially its existing `.fluxiq`, must not be included in cleanup.

No source, test, browser data, provider state, git history, commit, or push was changed.
