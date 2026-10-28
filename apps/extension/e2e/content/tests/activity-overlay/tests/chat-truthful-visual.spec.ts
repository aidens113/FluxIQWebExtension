// Provider-free rendering acceptance: real chat renderer and content overlay,
// scripted build events, realistic pages. This does not exercise gateway routing.
import { build } from "esbuild";
import { expect, test } from "../../../index.js";

let script: string;
let css: string;
let profileScript: string;
test.beforeAll(async () => {
  const bundled = await build({
    stdin: {
      resolveDir: process.cwd(), loader: "ts",
      contents: `
        import { createChatPanel } from "./src/panel/chat";
        import { createTopBar } from "./src/panel/shell";
        import { targetCore } from "./src/panel/chat/conversation/tests/target-core";
        import { ACTIVITY_MESSAGES } from "./src/shared/activity";
        import { RUNTIME_MESSAGES } from "./src/shared/constants";
        import "./src/panel/theme/tokens.css";
        import "./src/panel/shell/shell.css";
        const event = (sequence, detail, final = false) => ({ activityId: "build-visual", sequence,
          subject: { kind: "build", id: "build-visual", projectId: "project-1" }, conversationId: "conv-visual", phase: final ? "failed" : "building",
          label: detail.title, at: new Date(2026, 0, 1, 0, 0, sequence).toISOString(), detail, final });
        const events = [
          event(1, { kind: "note", title: "Planning the Flow", project: { kind: "plan",
            parts: [{ id: "p", words: "Read the page" }], subflows: [{ key: "read_page", name: "Read the page", purpose: "Collect the visible information", parts: ["p"] }] } }),
          event(2, { kind: "tool", title: "Putting the site back: clicking \u201cChange\u201d", status: "failed", ref: "core.run_node",
            text: "Result: candidate.undo_unproved \u00b7 Declined: FluxIQ could not show that this would put the site back, so it was not done" }),
          event(3, { kind: "thought", title: "Trying the step again", text: "The page was busy, so FluxIQ is trying the step again.", status: "succeeded", ref: "n3" }),
          event(4, { kind: "tool", title: "Clicking \u201cSave the job\u201d", status: "succeeded", ref: "core.run_node", text: "Result: tool.ok" }),
          event(5, { kind: "note", title: "FluxIQ stopped with the Flow only partly built.", text: "The judged test run of the whole Flow from its start ran all 13 of its steps, counting each pass of a repeat, and was judged not to do what was asked. It was tried 6 times.\\n\\nThe build left no change on the site that it knows of. What it wrote is kept as a draft.", status: "failed" }, true)
        ];
        const core = targetCore([{ conversationId: "conv-visual", subjectKind: "project", subjectId: "project-1", turns: [
          { turnId: "asked", author: "person", text: "Read the page", createdAt: new Date(2026, 0, 1).getTime() }
        ] }]);
        const state = { current: events.at(-1), display: null, recent: events, history: events, overlay: "expanded", live: true };
        const request = async (message) => message.type === ACTIVITY_MESSAGES.read
          ? { ok: true, value: { ok: true, state } } : core.request(message);
        window.chrome = { runtime: { onMessage: { addListener() {}, removeListener() {} } } };
        const chat = createChatPanel(request, () => ({ element: document.createElement("a"), observe() {} }));
        const status = { connectionState: "connected", projectId: "project-1", paired: true };
        const bar = createTopBar({ onTab() {}, onGear() {}, record: document.createElement("span"), openFluxIQ: document.createElement("span") });
        bar.showScreen("chat");
        bar.render(status);
        document.documentElement.dataset.surface = innerWidth === 380 ? "popup" : "sidepanel";
        const shell = document.createElement("div");
        shell.className = "shell";
        shell.append(bar.element, chat.element);
        document.querySelector("#app").append(shell);
        chat.render(status);
        chat.setActive(true);
        window.__visualSent = () => core.sent.filter((message) => message.type === RUNTIME_MESSAGES.panelConversationSend).length;
        window.__visualStop = () => chat.setActive(false);
      `
    }, bundle: true, write: false, platform: "browser", format: "iife", outfile: "chat-preview.js"
  });
  script = bundled.outputFiles.find((file) => file.path.endsWith(".js"))!.text;
  css = bundled.outputFiles.find((file) => file.path.endsWith(".css"))!.text;
  const profile = await build({
    stdin: { resolveDir: process.cwd(), loader: "ts", contents: `
      import { choosePlacement, pageProbe } from "./src/content/activity-overlay/placement";
      window.__placementCost = () => {
        let calls = 0;
        const probe = pageProbe();
        const started = performance.now();
        const placement = choosePlacement({ viewport: { width: document.documentElement.clientWidth, height: document.documentElement.clientHeight },
          box: { width: 384, height: 84 }, narrow: { width: 280, height: 84 }, margin: 16,
          probe: (x, y) => {
            calls++;
            return probe(x, y);
          } });
        return { calls, ms: performance.now() - started, placement };
      };
    ` }, bundle: true, write: false, platform: "browser", format: "iife"
  });
  profileScript = profile.outputFiles[0]!.text;
});

for (const scenario of ["company-website", "job-board"]) {
  test(`${scenario}: truthful chat and a stable overlay with and without a bottom banner`, async ({ openHarness, page }, testInfo) => {
    const harness = await openHarness(scenario);
    await page.evaluate((popup) => {
      const rail = document.createElement("iframe");
      rail.id = "visual-chat";
      rail.name = "visual-chat";
      rail.title = "FluxIQ chat rendering";
      Object.assign(rail.style, { position: "fixed", right: "0", top: "0", width: popup ? "380px" : "400px", height: popup ? "580px" : "100vh", border: "0", zIndex: "2147483646", background: "white" });
      rail.srcdoc = '<!doctype html><html><body><div id="app" style="height:100vh"></div></body></html>';
      document.documentElement.append(rail);
    }, scenario === "job-board");
    const frame = page.frameLocator("#visual-chat");
    await expect(frame.locator("#app")).toBeVisible();
    const child = page.frame({ name: "visual-chat" })!;
    await child.addStyleTag({ content: css });
    await child.addScriptTag({ content: script });
    await harness.deliver({ type: "fluxiq.activity.overlay", activity: null, overlay: "expanded", topFrameOnly: true,
      display: { activityId: "build-visual", subjectKind: "build", phase: "failed", headline: "Build failed", detail: "Build failed: The page needs a sign-in", working: false, outcome: "failed", step: null, sequence: 1 } });
    await expect(frame.getByText("FluxIQ stopped with the Flow only partly built.", { exact: true })).toBeVisible();
    await frame.locator("#app").screenshot({ path: testInfo.outputPath(`${scenario}-chat.png`) });
    expect(await child.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "chat fits its panel or popup width").toBe(true);
    const composer = frame.locator("#conversationInput");
    await expect(composer).toBeVisible();
    await expect(composer).toBeEnabled();
    await expect(composer).toBeInViewport();
    const pill = page.locator("fluxiq-activity-overlay");
    await expect(pill).toBeVisible();
    // The fixture ships its own consent banner. Take it away so the first picture is a plain page, bottom-left.
    await page.evaluate(() => {
      for (const el of Array.from(document.body.querySelectorAll<HTMLElement>("*"))) {
        if (el.id === "visual-chat") continue;
        if (getComputedStyle(el).position === "fixed") el.style.display = "none";
      }
    });
    await page.waitForTimeout(8_000);
    const before = await pill.boundingBox();
    expect(before!.y + before!.height, "plain page: the pill is in the bottom band, clear of the page text").toBeGreaterThan(500);
    await page.screenshot({ path: testInfo.outputPath(`${scenario}-overlay-without-banner.png`) });
    // A cookie banner arrives across the bottom mid-run: one move, then stable.
    const banner = await page.evaluate(() => {
      const el = document.createElement("div");
      el.id = "visual-banner";
      el.textContent = "We use cookies. Accept all / Reject all";
      Object.assign(el.style, { position: "fixed", left: "0", right: "0", bottom: "0", height: "150px", background: "#222", color: "#fff", zIndex: "2147483000", padding: "24px" });
      document.body.append(el);
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    });
    await page.waitForTimeout(8_000);
    const moved = await pill.boundingBox();
    await page.screenshot({ path: testInfo.outputPath(`${scenario}-overlay-with-banner.png`) });
    await page.waitForTimeout(4_000);
    const later = await pill.boundingBox();
    console.log("overlay-positions", scenario, JSON.stringify({ before, moved, later, banner }));
    expect(later, "stable after the one move").toEqual(moved);
    const overlapsBanner = moved!.y + moved!.height > banner.top && moved!.y < banner.bottom && moved!.x < banner.right && moved!.x + moved!.width > banner.left;
    expect(overlapsBanner, "the pill is not over the banner").toBe(false);
    await composer.fill("Continue with the next page");
    await frame.locator("#conversationSendButton").click();
    await expect.poll(() => child.evaluate(() => (window as unknown as { __visualSent(): number }).__visualSent())).toBe(1);
    await child.evaluate(() => (window as unknown as { __visualStop(): void }).__visualStop());
  });
}
