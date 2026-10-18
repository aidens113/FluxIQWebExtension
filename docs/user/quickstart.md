# Quickstart: Your First Automation in Five Minutes

This guide assumes the runtime and the extension are installed. If they are
not, see [Install](install.md) first. Each step below says how you can tell it
worked.

## 1. Start FluxIQ (under 1 minute)

In the `!FluxIQWebExtension` folder, run:

```bash
pnpm dev
```

Then open `http://127.0.0.1:3000` and sign in. The first time, sign in with
the username `admin` and the temporary password `admin`. FluxIQ then asks you
to replace the temporary password with one of at least 12 characters. Keep
that password: FluxIQ asks for it again before it stores an API key.

**It worked if** the FluxIQ web app loads and shows **Programs**.

Open `http://127.0.0.1:3000/get-started` for a live checklist of the next
steps. It shows each step as done, current, or waiting on an earlier step, and
updates as you go.

## 2. Pair your browser (about 1 minute)

1. Click the FluxIQ button in the browser toolbar. If you have not pinned it,
   it is in the **Extensions** menu (the puzzle-piece button). Chrome and Edge
   open the FluxIQ side panel, and Firefox opens the FluxIQ popup.
2. Under **Connect this browser**, choose **Connect**. The panel says
   **Approve this browser in FluxIQ** and shows a six-digit code.
3. Switch to the FluxIQ web app. A **Client pairing request** appears with the
   same code. Check that the codes match, then choose **Confirm pairing**. The
   request lasts five minutes; you do not need to hurry.

**It worked if** the panel's dot turns green, and **Settings** (the gear
button) says **Connected to FluxIQ** under **Connection**.

If the panel says **Can't reach FluxIQ**, first check that `pnpm dev` is still
running. If it is, open **Settings** (the gear button) and look under
**Connection**. **FluxIQ connection address** should be
`ws://127.0.0.1:4777/client` and **FluxIQ web address** should be
`http://127.0.0.1:3000`. Choose **Save** after changing either.

## 3. Add your DeepSeek API key (about 1 minute)

FluxIQ uses your own DeepSeek API key to create automations and adapt them.
DeepSeek is the only provider in this release. FluxIQ adds no charge of its
own: DeepSeek bills your account directly for the calls FluxIQ makes.

1. In the FluxIQ web app, open **Secret Keys** (`/programs/secret-keys`) and
   choose **Add Key**.
2. Fill in the form:
   - Name: any name, for example **DeepSeek**
   - Secret value: your DeepSeek API key
   - Type: **LLM**
   - Provider: **DeepSeek** (the form starts on OpenAI, so change it)
   - Scope: **Global**
3. Choose **Continue**. Under **Authorize New Key**, enter your FluxIQ
   password (and your PIN, if you set one), then choose **Save Key**.
**It worked if** the key is listed as enabled. The key's value is not shown
again. The key works at once in your current sign-in. After FluxIQ itself
restarts, your keys stay locked until you sign in again; the panel's chat then
says "your model key is locked" and asks you to sign out and in.

You can see which key and model a flow uses in that flow's **Settings**, under
**AI Provider**. The same section has the **Adaptation** switch:

- **On (the default).** When a page changes, FluxIQ may use AI to find a way
  through. It then saves what it learned, so later runs do not need AI there.
- **Off.** FluxIQ only replays steps it has already learned and never calls
  DeepSeek. If a page has changed, the run stops instead.

## 4. Create an automation (about 2 minutes)

Automations live in a web automation project, and the extension only works
with that kind of project. Create one first:

- From **Get started**, choose **Describe an automation** (or another start
  button). Get started works in the installed web automation domain, so the
  project it creates is a web automation project.
- Or, on the FluxIQ home page, under **Domains**, open **Web Automation**,
  then **Automation Studio**, choose **Create project**, give it a name, and
  choose **Create project**.

A project created from the plain **Automation Studio** entry on the home page
is not a web automation project. With one of those open, the panel's chat says
"this project is not one".

Then open the page you want to automate in a normal tab, and keep that tab
in front. The quickest way to build is the panel's **Chat**: describe what
you want in your own words and send it. FluxIQ works the steps out on the
page you have open, shows each one in the chat, test-runs the whole
automation once from the start, and says when it is ready or why it is not.
You can stop a build with **Stop build**.

You can also create an automation in Automation Studio and
write what you want it to do in **Instructions**. Every automation needs a
written task, including a saved automation that has none before its next run.
Then choose any support you need:

- **Describe an automation.** Tell FluxIQ what you want done, in your own
  words. For example: "Search this store for a USB-C cable and add the
  cheapest one to the cart."
- **Show FluxIQ how.** Start a recording in the panel and describe what the
  demonstration shows. Do the task once, then stop. Attach the finished
  recording in **Instructions** as optional evidence for your written task.
- **Extract data from this page.** Describe which data the automation should
  collect. Use the extension to pick a list and inspect the rows and columns.
  A described recording can supplement the instructions for the scraper.

Select a model in the automation's **Settings**, then build and test it in
**Steps**. When it does what you want, save it. The written task defines the
automation; recording titles, descriptions and captured actions do not replace it.

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
