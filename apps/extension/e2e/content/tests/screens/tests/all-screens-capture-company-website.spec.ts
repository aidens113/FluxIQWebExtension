// Headed, provider-free capture of every panel screen for a brand review, on the company-website scenario: the
// side panel at 400 px (Chrome) and the popup at 380 x 580 (Firefox), dark and, for chat and settings, light. The
// panel is the real one (`mountPanel`) over a scripted background, so nothing reaches FluxIQ, a provider or a key.
// Pictures go to FLUXIQ_CAPTURE_DIR (a folder of the caller's choosing), else to the run's output folder.
import { expect, test } from "../../../index.js";
import type { TestInfo } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { allScreensEntry } from "../all-screens-entry.js";
import { bundlePanel, mountPanelFrame, type PanelBundle } from "../panel-frame.js";


let sidepanel: PanelBundle;
let popup: PanelBundle;
test.beforeAll(async () => {
  sidepanel = await bundlePanel(allScreensEntry("sidepanel"));
  popup = await bundlePanel(allScreensEntry("popup"));
});

const OUT = process.env.FLUXIQ_CAPTURE_DIR;
const problems: string[] = [];

async function attempt(label: string, work: () => Promise<void>): Promise<void> {
  try {
    await work();
  } catch (error) {
    problems.push(`${label}: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
    console.log(`CAPTURE-PROBLEM ${label}`);
  }
}

for (const surface of [{ browser: "chrome", bundle: () => sidepanel, width: 400, height: 900 }, { browser: "firefox", bundle: () => popup, width: 380, height: 580 }]) {
  test(`company-website: every panel screen as ${surface.browser === "chrome" ? "the side panel (400 px)" : "the popup (380 x 580)"}`, async ({ openHarness, page }, testInfo: TestInfo) => {
    test.setTimeout(240_000);
    if (OUT) mkdirSync(OUT, { recursive: true });
    await page.setViewportSize({ width: 1280, height: Math.max(720, surface.height) });
    await openHarness("company-website");
    const { frame, child } = await mountPanelFrame(page, surface.bundle(), { width: surface.width, height: surface.height });
    const app = frame.locator("#app");
    const theme = (name: "dark" | "light") => child.evaluate((value) => {
      if (value === "light") document.documentElement.dataset.theme = "light";
      else delete document.documentElement.dataset.theme;
    }, name);
    const shot = async (screen: string, mode: "dark" | "light" = "dark") => {
      await page.waitForTimeout(500);
      const path = OUT ? `${OUT}/${surface.browser}-${screen}-${mode}.png` : testInfo.outputPath(`${surface.browser}-${screen}-${mode}.png`);
      await app.screenshot({ path });
    };
    const both = async (screen: string) => {
      await shot(screen, "dark");
      await theme("light");
      await shot(screen, "light");
      await theme("dark");
    };
    const show = (name: string) => child.evaluate((value) => (window as any).__show(value), name);
    const thread = (name: string) => child.evaluate((value) => (window as any).__thread(value), name);
    const settle = () => page.waitForTimeout(1200);

    // Getting started (not connected).
    await attempt("getting-started", async () => {
      await show("start");
      await settle();
      await both("getting-started");
    });

    let live = { frame, child };
    const themeL = (name: "dark" | "light") => live.child.evaluate((value) => {
      if (value === "light") document.documentElement.dataset.theme = "light";
      else delete document.documentElement.dataset.theme;
    }, name);
    const shot2 = async (screen: string, mode: "dark" | "light" = "dark") => {
      await page.waitForTimeout(500);
      await live.frame.locator("#app").screenshot({ path: OUT ? `${OUT}/${surface.browser}-${screen}-${mode}.png` : testInfo.outputPath(`${surface.browser}-${screen}-${mode}.png`) });
    };
    const both2 = async (screen: string) => {
      await shot2(screen, "dark");
      await themeL("light");
      await shot2(screen, "light");
      await themeL("dark");
    };
    const open = async (mode: string) => {
      await page.evaluate((value) => {
        (window as any).__mode = value;
        document.getElementById('panel-frame')?.remove();
      }, mode);
      live = await mountPanelFrame(page, surface.bundle(), { width: surface.width, height: surface.height });
      await live.child.evaluate(() => (window as any).__show('connected'));
      await page.waitForTimeout(2000);
    };
    await attempt('chat-empty', async () => {
      await open('empty');
      await both2('chat-empty');
    });
    await attempt('chat-thread', async () => {
      await open('thread');
      await both2('chat-thread');
    });
    
    // Conversation drawer.
    let f = live.frame;
    const fresh = async () => {
      await open("thread");
      f = live.frame;
    };
    await attempt("drawer", async () => {
      await f.getByRole("button", { name: /Chats/ }).first().click();
      await page.waitForTimeout(1200);
      await both2("drawer");
    });
    await attempt("drawer-search", async () => {
      await f.getByRole("searchbox", { name: "Search chats" }).fill("hours");
      await page.waitForTimeout(500);
      await shot2("drawer-search");
      await f.getByRole("searchbox", { name: "Search chats" }).fill("");
    });
    await attempt("drawer-rename", async () => {
      await f.getByRole("button", { name: "Rename Branch opening hours" }).click();
      await page.waitForTimeout(400);
      await shot2("drawer-rename");
      await f.getByRole("textbox", { name: /New name for/ }).press("Escape");
    });
    await attempt("drawer-delete", async () => {
      await f.getByRole("button", { name: "Delete Nightly listings run" }).click();
      await page.waitForTimeout(400);
      await shot2("drawer-delete-confirm");
      await f.getByRole("button", { name: "Cancel" }).first().click();
    });

    // Recording: the question, the bar, the chip.
    await attempt("recording", async () => {
      await fresh();
      await shot2("composer-idle");
      await f.getByRole("button", { name: "Start recording" }).click();
      await expect(f.getByRole("heading", { name: "What should FluxIQ learn from this?" })).toBeVisible();
      await shot2("recording-question");
      await f.getByLabel("Recording description").fill("Open the team page and read each person");
      await f.getByRole("button", { name: "Start described recording" }).click();
      await expect(f.locator("#stopRecordingButton")).toBeVisible();
      await shot2("recording-running");
      await f.locator("#stopRecordingButton").click();
      await expect(f.locator(".composer-chip")).toBeVisible({ timeout: 15_000 });
      await shot2("recording-review-chip");
    });

    // Settings, dark and light, every section by scrolling the screen.
    await attempt("settings", async () => {
      await fresh();
      await f.locator("#settingsButton").click();
      await page.waitForTimeout(1000);
      const screen = f.locator(".settings-screen");
      const total = await screen.evaluate((node) => ({ h: node.scrollHeight, c: node.clientHeight }));
      console.log("settings-scroll", surface.browser, JSON.stringify(total));
      for (const mode of ["dark", "light"] as const) {
        await themeL(mode);
        await screen.evaluate((node) => node.scrollTo(0, 0));
        await shot2("settings-1-top", mode);
        const steps = Math.max(1, Math.ceil((total.h - total.c) / Math.max(1, total.c - 80)));
        for (let i = 1; i <= steps; i++) {
          await screen.evaluate((node, y) => node.scrollTo(0, y), Math.min(total.h - total.c, i * (total.c - 80)));
          await shot2(`settings-${i + 1}-scrolled`, mode);
        }
      }
      await themeL("dark");
      await f.locator(".settings-advanced > summary").click();
      await f.locator(".settings-screen").evaluate((node) => node.scrollTo(0, node.scrollHeight));
      await shot2("settings-advanced-open");
    });

    // Automations tab, then the extraction panel from its New automation card.
    await attempt("automations", async () => {
      await fresh();
      await f.locator("#panelTab-automations").click();
      await page.waitForTimeout(1200);
      await shot2("automations");
    });
    // Extraction: while a recording runs, its bar offers "Extract Data From This Page"; the pick then comes back as a proposal.
    await attempt("extraction", async () => {
      await fresh();
      await f.getByRole("button", { name: "Start recording" }).click();
      await f.getByLabel("Recording description").fill("Read each person on the team page");
      await f.getByRole("button", { name: "Start described recording" }).click();
      await expect(f.locator("#stopRecordingButton")).toBeVisible();
      await f.locator(".recording-bar").getByRole("button", { name: /Extract Data From This Page/i }).click();
      await page.waitForTimeout(2500);
      await shot2("extraction");
    });

    console.log(`CAPTURE-DONE ${surface.browser} problems=${JSON.stringify(problems)}`);
  });
}
