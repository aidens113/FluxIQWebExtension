import type { ShellKit } from "../shell/index.js";
import type { SentRowData } from "./rows.js";

type Input = { tab: "received" | "sent"; type: string; listId: string; moreId: string; rows: Record<string, SentRowData> };

/**
 * The invitation manager's behaviour. On Sent, a filter pill reloads the page
 * with that filter; Withdraw opens the shared dialog, and a confirmed
 * withdrawal fades its row out, leaves the counts alone, and pulls nothing up
 * to replace it. The first "Show more" after a page loads never finishes: its
 * spinner turns until a "Retry" appears under it a moment later, and only the
 * retry loads the rows. On Received, Accept and Ignore answer at once.
 */
export function managerClientScript(kit: ShellKit, input: Input): string {
  const j = JSON.stringify;
  const c = kit.css;
  return `const byId = (id) => document.getElementById(id);
const GL = window.GL;
const list = byId(${j(input.listId)});
const rows = ${j(input.rows)};
const fade = (row) => { row.style.transition = 'opacity .25s'; row.style.opacity = '0'; setTimeout(() => row.remove(), 250); };
if (${j(input.tab)} === 'sent') {
  for (const pill of document.querySelectorAll(${j(`.${c.pillBar} button`)})) {
    pill.addEventListener('click', () => location.assign(GL.root + 'mynetwork/invitation-manager/sent/' + (pill.value ? '?invitationType=' + pill.value : '')));
  }
  list.addEventListener('click', (event) => {
    const control = event.target.closest(${j(`.${c.textBtn}`)});
    if (!control || control.textContent.trim() !== 'Withdraw') return;
    const row = control.closest('li');
    const data = rows[row.getAttribute('data-entity-urn')];
    if (!data) return;
    GL.openWithdraw({ urn: data.urn, text: data.text, onDone: () => fade(row) });
  });
  const more = byId(${j(input.moreId)});
  let firstTry = true;
  let spinner = null;
  const fetchMore = async () => {
    const last = list.lastElementChild;
    const after = last ? last.getAttribute('data-entity-urn') : '';
    const response = await fetch(GL.root + 'mynetwork/invitation-manager/sent/fragment?invitationType=' + ${j(input.type)} + '&after=' + encodeURIComponent(after), { headers: { accept: 'application/json' } });
    const body = await response.json();
    Object.assign(rows, body.rows);
    list.insertAdjacentHTML('beforeend', body.html);
    if (spinner) { spinner.remove(); spinner = null; }
    more.hidden = body.done;
  };
  if (more) more.addEventListener('click', () => {
    if (spinner) return;
    spinner = document.createElement('div');
    spinner.innerHTML = '<div class=${j(c.spinner)} role="progressbar" aria-label="Loading"></div>';
    more.hidden = true;
    more.after(spinner);
    if (!firstTry) { setTimeout(fetchMore, 600); return; }
    firstTry = false;
    setTimeout(() => {
      const line = document.createElement('p');
      line.className = ${j(c.errorLine)};
      line.innerHTML = 'Something went wrong. <button type="button" class=${j(c.textBtn)}>Retry</button>';
      spinner.append(line);
      line.querySelector('button').addEventListener('click', () => { line.remove(); setTimeout(fetchMore, 600); }, { once: true });
    }, 1500);
  });
} else {
  list.addEventListener('click', async (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    const row = button.closest('li');
    const urn = row.getAttribute('data-entity-urn');
    const label = button.textContent.trim();
    if (label === 'Accept') { await GL.mutate('accept-invitation', { urn }); row.querySelector(${j(`.${c.inviteActions}`)}).textContent = 'Accepted'; }
    else if (label === 'Ignore') { await GL.mutate('ignore-invitation', { urn }); fade(row); GL.toast('Invitation ignored'); }
  });
}
`;
}
