# FluxIQ Web Automation Client: Privacy Policy

Effective date: to be set on first publication. Applies to extension version
0.1.0 and later.

FluxIQ Web Automation Client ("the extension") is the browser half of FluxIQ.
It works only with a FluxIQ runtime that you run and pair it with. The
extension's developers operate no server that it reports to. They receive
none of your data.

## What the extension reads

The extension reads the following only while it is paired and connected to
your runtime:

- **Open tabs.** The address and title of your tabs, so your runtime knows
  where an automation can run.
- **Page content.** While you record, run or extract data, it reads the page's
  structure and text: elements, their labels and positions, and the frames
  they sit in. It also reads the addresses of navigations.
- **What you show it.** While you record, it reads your clicks, typing and
  navigation. It does not record what you type into password, one-time-code or
  card-number fields.
- **Screenshots.** It captures the visible part of the tab as evidence of what
  a step saw.
- **Downloads.** It reads the file names and completion status of downloads a
  step started. It never reads what a file contains.

## Where that data goes

- **To your FluxIQ runtime and nowhere else.** By default, that is
  `ws://127.0.0.1:4777/client` on your own computer. You can change the address
  in the extension's connection settings. If you do, the data goes to the
  address you set.
- **To the AI provider you configure, through your runtime.** When FluxIQ
  creates or adapts an automation, your runtime sends a bounded, sanitized
  description of the relevant page to that provider, using your own API key.
  In this release, the only provider is DeepSeek. DeepSeek's own privacy policy
  covers what it does with that data. You can turn adaptation off for a flow
  (see the [quickstart](quickstart.md)). A flow with adaptation off never calls
  the provider.
- **Nothing is sent to the extension's developers.** The extension has no
  analytics, telemetry, crash reporting or advertising, and it loads no remote
  code.

## What the extension stores

The extension stores only its connection address, its pairing with your
runtime, panel preferences, and any events not yet delivered to the runtime.
It stores them in the browser's extension storage, on your computer. Removing
the extension deletes them.

Your automations, recordings and results are stored by your runtime on your
computer, in its `.fluxiq/` folder. The extension does not keep them.

## Sharing and selling

The extension's developers do not collect your data, so they do not sell it,
share it or use it for advertising. The extension does not use your data for
anything except running the automations you create.

## Firefox data collection disclosure

For Firefox, the extension declares that it transmits:

- **website content** (page structure and text);
- **website activity** (your clicks and typing while recording);
- **browsing activity** (tab addresses and navigations).

It sends them to the runtime you pair it with, and does so only to provide
FluxIQ's function.

## Changes to this policy

The version history of this document records every change. A change to what
the extension reads or where it sends data will be stated here before a
release that makes it.

## Contact

Questions about this policy go to the FluxIQ maintainers through the project's
issue tracker.
