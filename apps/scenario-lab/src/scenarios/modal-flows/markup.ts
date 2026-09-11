import { escapeHtml } from "../../html.js";
import { pageLogic } from "./page-logic.js";
import type { ModalFlowsState } from "./state.js";

// The action bar and the taller consent banner are both fixed to the
// viewport bottom, so the banner covers Publish draft at any scroll position.
const STYLES = `<style>
  .toolbar, .consent-actions, .dialog-actions { display: flex; flex-wrap: wrap; gap: .75rem; }
  .dialog-actions { justify-content: flex-end; }
  main { padding-bottom: 12rem; }
  .action-bar { position: fixed; inset: auto 0 0 0; z-index: 10; display: flex; align-items: center; justify-content: flex-end; gap: 1rem; padding: .75rem 1.5rem; background: #f3f4f6; border-top: 1px solid #d1d5db; }
  .action-bar p { margin: 0; }
  .consent-banner { position: fixed; inset: auto 0 0 0; z-index: 20; min-height: 7rem; padding: 1rem 1.5rem; background: #111827; color: #f9fafb; }
  .consent-banner h2 { margin: 0 0 .25rem; font-size: 1.1rem; }
  .backdrop { position: fixed; inset: 0; z-index: 30; display: grid; place-items: center; background: rgb(17 24 39 / .55); }
  .backdrop[hidden] { display: none; }
  .backdrop.offer { z-index: 40; }
  .dialog { width: min(28rem, calc(100vw - 2rem)); padding: 1.5rem; border-radius: .5rem; background: #fff; }
  .dialog h2 { margin-top: 0; }
  [role="alert"]:empty { display: none; }
</style>`;

const CONSENT_BANNER = `<section class="consent-banner" aria-labelledby="consent-heading" data-testid="consent-banner">
    <h2 id="consent-heading">We use cookies</h2>
    <p>Essential cookies keep the editor working. Optional cookies help us improve it.</p>
    <div class="consent-actions">
      <button type="button" data-testid="consent-accept">Accept all cookies</button>
      <button type="button" data-testid="consent-reject">Essential only</button>
    </div>
  </section>`;

const INVITE_DIALOG = `<div class="backdrop" data-testid="invite-backdrop" hidden>
  <div class="dialog" id="invite-dialog" role="dialog" aria-modal="true" aria-labelledby="invite-heading" aria-describedby="invite-help" data-testid="invite-dialog">
    <h2 id="invite-heading">Invite a collaborator</h2>
    <p id="invite-help">They get access to this draft as soon as you confirm.</p>
    <form data-testid="invite-form" novalidate>
      <label>Email address <input type="email" name="email" autocomplete="off" required data-testid="invite-email"></label>
      <label>Role <select name="role" data-testid="invite-role"><option value="viewer">Viewer</option><option value="editor">Editor</option></select></label>
      <p role="alert" data-testid="invite-error"></p>
      <div class="dialog-actions">
        <button type="button" data-testid="invite-cancel">Cancel</button>
        <button type="submit" data-testid="invite-confirm">Confirm</button>
      </div>
    </form>
  </div>
</div>`;

/** Rendered while open; held in a template while armed so the page can show it after the first Add section. */
const INTERSTITIAL = `<div class="backdrop offer" data-testid="interstitial-backdrop">
  <section class="dialog" role="dialog" aria-modal="true" aria-labelledby="offer-heading" aria-describedby="offer-body" data-testid="interstitial">
    <h2 id="offer-heading">Unlock Premium templates</h2>
    <p id="offer-body">Save 50% on your first three months of Premium.</p>
    <div class="dialog-actions"><button type="button" data-testid="interstitial-close">No thanks</button></div>
  </section>
</div>`;

/** The page body for `state`: every value the client later updates is rendered from the same `pageLogic`. */
export function renderModalFlowsBody(state: ModalFlowsState): string {
  const blocked = state.interstitial === "open";
  const sections = Array.from({ length: state.sectionCount }, (_, index) => `<li data-testid="section-item">${pageLogic.sectionTitle(index + 1)}</li>`).join("");
  const offer = blocked ? INTERSTITIAL : state.interstitial === "armed" ? `<template id="interstitial-template">${INTERSTITIAL}</template>` : "";
  return `${STYLES}
<div class="shell" data-testid="page-shell"${blocked ? " inert" : ""}>
  <header>
    <h1>Draft editor</h1>
    <p>Editing <strong data-testid="draft-title">${escapeHtml(state.draftTitle)}</strong></p>
    <div class="toolbar">
      <button type="button" aria-haspopup="dialog" aria-controls="invite-dialog" data-testid="open-invite">Invite collaborator</button>
      <button type="button" data-testid="delete-draft"${state.draft === "deleted" ? " disabled" : ""}>Delete draft</button>
    </div>
    <p aria-live="polite" data-testid="invite-result">${escapeHtml(pageLogic.inviteResult(state.invites.at(-1)))}</p>
    <p aria-live="polite" data-testid="draft-status">${pageLogic.draftStatus(state.draft)}</p>
  </header>
  <main>
    <section aria-labelledby="sections-heading">
      <h2 id="sections-heading">Sections</h2>
      <button type="button" data-testid="add-section">Add section</button>
      <p aria-live="polite" data-testid="section-count">${pageLogic.sectionCount(state.sectionCount)}</p>
      <ol data-testid="section-list">${sections}</ol>
    </section>
  </main>
  <footer class="action-bar" aria-label="Draft actions">
    <p aria-live="polite" data-testid="publish-result">${pageLogic.publishResult(state.publishCount)}</p>
    <button type="button" data-testid="publish-draft">Publish draft</button>
  </footer>
  ${state.consent === "pending" ? CONSENT_BANNER : ""}
</div>
${INVITE_DIALOG}
${offer}`;
}
