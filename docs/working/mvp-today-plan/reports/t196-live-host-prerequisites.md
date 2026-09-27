# t196 -- Live host prerequisites

Status: Complete
Repository scope: `F:\!FluxIQWebExtension`, read-only except this report
Date: 2026-09-26

## Verdict

**GO within the non-provider host-prerequisite scope.** At the audit snapshot,
the installed Playwright Chromium executable was present, the isolated
allocator's three loopback sockets could be bound simultaneously, no matching
Lab/build process or build lock existed, required paths were present, and the
host had the pinned package manager plus ample free space.

There is no host-prerequisite no-go cause in this snapshot. This is not overall
authorization for a live run: it does not supersede t192's separate build-
freshness gate, t178's immediate pre-run checks, or provider credential
handling. Process, lock, and port availability are transient and must be
rechecked immediately before the command.

## Snapshot

| Prerequisite | Evidence | Result |
| --- | --- | --- |
| Browser installation | The same `@playwright/test` resolution used by `test-runner` returned `C:\Users\mrjoh\AppData\Local\ms-playwright\chromium-1161\chrome-win\chrome.exe`. It exists as a regular file (3,194,368 bytes); file version is `134.0.6998.35`. | **GO for installation.** The browser was not launched, so headed startup and extension loading remain unexercised here. |
| Interactive Windows session | `SESSIONNAME` was `Console`. | **GO as a headed-session prerequisite**, without claiming a browser launch. |
| Loopback allocation | Three `node:net` servers were held open together on `127.0.0.1` using port `0`, exactly the isolated allocator's mechanism. The kernel assigned distinct ports 54704, 54705 and 54706; all three servers then closed successfully. | **GO.** Three distinct scenario/web/gateway ports were simultaneously bindable and were released. |
| Process collision | The t178 command-line pattern found zero other matching processes. Only process names and PIDs would have been reported; none existed. | **GO at snapshot time.** |
| Build lock | `.lab-locks/build.lock` did not exist. It was not created, removed, or modified. | **GO at snapshot time.** |
| Required local paths | Runner CLI, domain output, extension E2E manifest, Scenario Lab server, and sibling `F:\!FluxIQ` checkout all existed. | **GO for presence only.** Freshness is a separate audit. |
| Toolchain | Node `v22.11.0`; pnpm `9.15.0`. | **GO.** pnpm matches the repository pin and Node satisfies the Node 22 requirement. |
| Capacity | Drive `F:` reported 926,153,953,280 free bytes (about 862.5 GiB). | **GO.** No capacity blocker is visible. |

## Why these checks match the isolated target

`allocateRun` creates a disposable run root and holds three `node:net` servers
on `127.0.0.1` until it has distinct scenario, web, and gateway ports. The
probe used that same bind address, ephemeral-port request, simultaneous hold,
and clean release without creating a run directory.

`launchBrowser` uses Playwright Chromium's installed executable through
`launchPersistentContext`, headed, with an isolated profile and the E2E
extension loaded. Querying `chromium.executablePath()` and checking that file
establishes installation without starting the executable. Actual launch is
deliberately not claimed.

The isolated target does not reuse a persistent workspace port or workspace
lock. Its relevant shared collision guards are the single-Lab process rule and
`.lab-locks/build.lock`, both checked using t178's definitions.

## Immediate recheck before a live command

Repeat the following facts immediately before the run, without deleting a
lock or terminating another owner's process:

1. No matching Lab/build process exists.
2. `.lab-locks/build.lock` is absent.
3. The required generated files still exist and the separate freshness audit
   is green.
4. Playwright's configured Chromium executable still exists.
5. The supervisor has exclusive permission to start the one live Lab run.

Provider credential presence and safe loading belong to t178 and were neither
queried nor printed by this audit.

## Files and limits

Read only t178's go/no-go section, the isolated allocation/topology code, and
the installed-browser lookup/launch code. No prior run artifact was inspected.
No source, shared document, generated output, existing artifact, browser,
provider, Lab process, build, test, commit, or push was touched. The temporary
loopback listeners were diagnostic sockets only and were all released.
