# Quickstart: Your First Automation in Five Minutes

This guide assumes the runtime and the extension are installed. If they are
not, see [Install](install.md) first. Each step below says how you can tell it
worked.

## 1. Start FluxIQ (under 1 minute)

In the `!FluxIQWebExtension` folder, run:

```bash
pnpm dev
```

The first time, the terminal prints **FluxIQ first-time setup** with a link.
Open it, choose your name and password (at least 12 characters), and you are
signed in. The link works once; restart FluxIQ for a new one. After that, open
`http://127.0.0.1:3000` and sign in with the name and password you chose.

**It worked if** the FluxIQ web app opens on **Home**. You can already talk to
the assistant beside every page once you add your AI key (step 3); you do not
need a project first.

The extension's **Get started with FluxIQ** screen lists the steps in order
(**Start FluxIQ**, **Connect and approve**, **Add your AI key**), each marked
done, next, in progress or needing attention. The first step names the address
it checked ("FluxIQ found at 127.0.0.1:3000"), with **Change** to point it at
another FluxIQ. Only what the extension has really detected is marked done.

## 2. Pair your browser (about 1 minute)

1. Click the FluxIQ button in the browser toolbar. If you have not pinned it,
   it is in the **Extensions** menu (the puzzle-piece button). Chrome and Edge
   open the FluxIQ side panel, and Firefox opens the FluxIQ popup.
2. Once FluxIQ is found, the browser asks it for approval by itself: the step
   **Connect and approve** shows a six-digit code and an **Open FluxIQ**
   button. There is nothing to press first.
3. Switch to the FluxIQ web app (sign in if it asks). **A browser or app wants
   to connect** appears, naming your browser, with the same code. Check that
   the codes match, then choose **Confirm**. The request lasts five minutes;
   you do not need to hurry.

**It worked if** the panel's dot turns green, the chat appears, and
**Settings** (the gear button) says **Connected to FluxIQ** under
**Connection**.

If the extension says **FluxIQ isn't answering**, first check that `pnpm dev`
is still running, then choose **Try again**. If FluxIQ runs at another
address, choose **Change** on the first step and type its web address (for
example `http://127.0.0.1:3000`); the extension finds the rest by itself.

## 3. Add your AI key (about 1 minute)

FluxIQ uses your own AI key, from Anthropic (Claude) or DeepSeek, to build
automations and adapt them. FluxIQ adds no charge of its own: the provider
bills your account directly for the calls FluxIQ makes.

You add the key once, in the web app or in the extension, and both show it
straight away. In the web app open **Settings**: **AI keys** is at the top
(`/settings#ai-keys`); the assistant beside every page and **Home** show the same
card. In the extension, open **Settings** (the gear button) and find **Model**,
or use the card in the empty chat.

1. Choose **Add a key**.
2. Pick the provider (**Anthropic (Claude)** or **DeepSeek**), paste the key,
   and give it a name if you like. **Where do I get one?** opens the
   provider's key page.
3. Choose **Save and check**. FluxIQ checks the key with the provider, at no
   cost, and the card shows the answer in place.

**It worked if** the card says **Ready** and names your key. The key is never
shown again; to change it, choose **Replace key**. There is no password box and
no PIN, and a paired browser uses the key straight away.

The card always says where things stand, with the one thing to do next:

- **No key**: add one.
- **Can't open**: FluxIQ saved the key but cannot read it any more; paste it
  again.
- **Not accepted**: the provider turned the key down; check it was copied in
  full, then replace it.
- **Can't reach** the provider: FluxIQ tries again on your next message, or
  choose **Try now**.
- **Update FluxIQ**: this FluxIQ is too old for your key.

You can see which key and model a flow uses in that flow's **Settings**, under
**AI Provider**. The same section has the **Adaptation** switch:

- **On (the default).** When a page changes, FluxIQ may use AI to find a way
  through. It then saves what it learned, so later runs do not need AI there.
- **Off.** FluxIQ only replays steps it has already learned and never calls
  your AI provider. If a page has changed, the run stops instead.

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
page you have open and shows each step in the chat with its reasoning. While
it works, the header above the box shows the time and cost so far and a
**Stop** button. It ends with the result, and a line saying what it saved
for next time.

You can also create an automation in Automation Studio and
write what you want it to do in **Instructions**. Every automation needs a
written task, including a saved automation that has none before its next run.
Then choose any support you need:

- **Describe an automation.** Tell FluxIQ what you want done, in your own
  words. For example: "Search this store for a USB-C cable and add the
  cheapest one to the cart."
- **Show me how.** Choose **Show me how** beside the message box (or **Show
  FluxIQ how** under **New automation** on the **Automations** tab). The panel
  asks **What should FluxIQ learn from this?**; answer in a sentence and
  choose **Start described recording**. Do the task once in the tab, then
  choose **Stop recording**. The recording is attached to your next message
  as a chip you can remove with its **x**, and the cursor goes into the
  message box. If it did not attach, choose **+** beside the box.
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
