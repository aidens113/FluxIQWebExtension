/**
 * The notifications prompt as `reworded-prompt` draws it, appended to the
 * shared shell script (`shell-script.ts`), whose `el`, `CLS` and `IDS` it
 * uses and whose `openNotifications` calls it in place of the shipped prompt.
 *
 * A redesign moved the prompt onto a new sheet component -- new classes, a
 * new generated id, the buttons in the other order -- and rewrote its copy:
 * the decline reads "Not right now" now. The button's `aria-label` was written
 * for the old copy and nobody updated it, so its accessible name is still
 * "Not now" while the page shows other words. The heading, and so the
 * dialog's name, did not change.
 *
 * It returns the same shape as the shipped prompt: the scrim to open, and each
 * button with the answer it gives.
 */
export const REWORDED_PROMPT_BODY = String.raw`
function rewordedPrompt() {
  const scrim = el('div', CLS.scrim, {});
  const sheet = el('section', CLS.promptSheet, { id: IDS.notifySheet, role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': IDS.notifySheet + 'h' });
  const words = el('div', CLS.promptWords, {});
  words.append(
    el('h2', CLS.promptHead, { id: IDS.notifySheet + 'h' }, 'Never miss a deal'),
    el('p', '', {}, 'Get price drops, delivery updates and Lightning Deals the moment they happen.'),
  );
  const allow = el('button', CLS.promptAllow, { type: 'button' }, 'Allow notifications');
  const later = el('button', CLS.promptQuiet, { type: 'button', 'aria-label': 'Not now' }, 'Not right now');
  const actions = el('div', CLS.promptActions, {});
  actions.append(allow, later);
  sheet.append(words, actions);
  scrim.append(sheet);
  return { scrim, answers: [[allow, 'allow'], [later, 'later']] };
}
`;
