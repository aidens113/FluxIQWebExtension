# Panel status read ordering

Status: Complete
Owner: Codex supervisor
Date: 2026-10-01

## Brief and source finding

Exact store.ts/existing tests/store.test.ts ownership and policy are in parent ledger. Initial and explicit getStatus replies currently publish even when newer pushes/command acknowledgement or later read have already arrived. Shell consumes store.current, and no caller change is needed. Read generation/observation revision will fence only stale read publication; all command replies/request results, listeners and transport remain unchanged.

Synthetic deferred tests pending. No actual status data/browser/provider/panel operations. Export recovery is separately source-complete; final combined gates await source freeze.

Original owning suite13tests10pass3fail/native1/156.86ms reproduces stale initial publication after a push, out-of-order status reads and old read overriding acknowledged command status. Narrow read-generation/observation fencing now passes13/13/native0/157.1158ms; fresh reads and original request result/command/listener contracts unchanged. No transport or protocol change, automatic reads or command ordering policy invented.

One initial patch comment anchor mismatched the exact source wording; no change occurred, and the corrected patch applied only released paths. Combined actual-config typing/full gates pending; no actual status/private data or browser/provider/panel operations.

Combined actual-config scoped types1135 native0/no diagnostics, six source/test roots for status/export. Both partitions source-frozen. Extension full50040/types90037/build15517/structure66791 are active through heavy wrapper; logs under TEMP/codex-t224-eighth-extension-*.log persist native exit. No broader success claimed yet.

Final actual full50040 native0,1833tests/114224.7451ms; types90037 native0/29248ms; build15517 native0,Chrome/Firefox/e2e22files each/24631ms; structure66791 native0,136warnings119baseline. Combined source unit verified; no browser behavior certified. Local checkpoint follows and Claude owns integration.
