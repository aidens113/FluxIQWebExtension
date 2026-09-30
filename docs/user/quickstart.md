# Quickstart: Your First Automation in Five Minutes

This guide assumes the runtime and the extension are installed. If they are
not, see [Install](install.md) first. Each step below says how you can tell it
worked.

## 1. Start FluxIQ (under 1 minute)

In the `!FluxIQWebExtension` folder, run:

```bash
pnpm dev
```

Then open `http://127.0.0.1:3000`, and sign in or create the local account
FluxIQ asks for.

**It worked if** the FluxIQ web app loads.

Open `http://127.0.0.1:3000/get-started` for a live checklist of the next
steps. It shows each step as done, current, or waiting on an earlier step, and
updates as you go.

## 2. Pair your browser (about 1 minute)

1. Click the FluxIQ button in the browser toolbar. Chrome and Edge open the
   FluxIQ side panel, and Firefox opens the FluxIQ popup.
2. Choose **Connect**. The panel says **Approve this browser in FluxIQ** and
   shows a short code.
3. Switch to the FluxIQ web app. A **Client pairing request** appears with the
   same code. Check that the codes match, then approve it.

**It worked if** the panel's dot turns green and it says **Connected to
FluxIQ**.

If the panel says **Can't reach FluxIQ**, first check that `pnpm dev` is still
running. If it is, open the panel's advanced connection settings. The address
should be `ws://127.0.0.1:4777/client`.

## 3. Add your DeepSeek API key (about 1 minute)

FluxIQ uses your own DeepSeek API key to create automations and adapt them.
DeepSeek is the only provider in this release. FluxIQ adds no charge of its
own: DeepSeek bills your account directly for the calls FluxIQ makes.

1. In the FluxIQ web app, open **Secret Keys** (`/programs/secret-keys`).
2. Add a key with these settings:
   - kind: **LLM**
   - provider: **DeepSeek**
   - scope: **Global**
   - value: your DeepSeek API key
3. FluxIQ asks you to confirm your identity before it stores the key.

**It worked if** the key is listed as enabled. The key's value is not shown
again.

You can see which key and model a flow uses in that flow's **Settings**, under
**AI Provider**. The same section has the **Adaptation** switch:

- **On (the default).** When a page changes, FluxIQ may use AI to find a way
  through. It then saves what it learned, so later runs do not need AI there.
- **Off.** FluxIQ only replays steps it has already learned and never calls
  DeepSeek. If a page has changed, the run stops instead.

## 4. Create an automation (about 2 minutes)

Open the page you want to automate in a normal tab. Then pick one of three
ways to start:

- **Describe an automation.** Tell FluxIQ what you want done, in your own
  words. For example: "Search this store for a USB-C cable and add the
  cheapest one to the cart."
- **Show FluxIQ how.** Start a recording in the panel, do the task once
  yourself, then stop. FluxIQ turns what you did into steps.
- **Extract data from this page.** Pick the rows and columns you want, and
  FluxIQ builds a scraper that collects them.

Test the automation while you create it. When it does what you want, save it.

**It worked if** the automation runs from start to finish and ends in the
result you expected.

## 5. Run it again

Run the saved automation again. FluxIQ replays the steps it learned, and
routine runs do not call AI at all. You can pause, stop or take over a run
from the panel at any time.

Sometimes a site changes, and a step can no longer find its target. With
adaptation on, FluxIQ first works out why the step failed, then looks for
another way to reach the same result. It checks that the new way works and
saves it as part of the automation. The next run reuses the saved step, with
no AI call.

## Where next

- [Permissions](permissions.md) explains what each browser permission is for.
- [Privacy policy](privacy-policy.md) says what the extension reads and where
  that data goes.
- If something goes wrong, see [Diagnostics and reporting a
  problem](install.md#diagnostics-and-reporting-a-problem).
