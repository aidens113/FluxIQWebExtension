/**
 * The overlays: the row action menu, the edit dialog, the removal
 * confirmation, and the toast.
 *
 * All four are portalled to the end of `<body>`, which is where every design
 * system puts them and which has one consequence worth stating: the menu that
 * belongs to a row is not inside that row. Nothing in the menu's ancestry says
 * which of the 240 identical action buttons opened it, so a recording that
 * disambiguated the button by its row cannot disambiguate the menu item the
 * same way. Only one menu is ever open, which is what makes its items findable
 * at all.
 *
 * Both dialogs post their change through the fixture's mutation endpoint before
 * touching the page, so the moment the toast is readable the server oracle
 * already agrees with it.
 */
export function directoryDialogsScript(): string {
  return String.raw`
let menuNode = null;
let menuButton = null;
let scrimNode = null;

function closeMenu() {
  if (menuNode) menuNode.remove();
  if (menuButton) menuButton.setAttribute('aria-expanded', 'false');
  menuNode = null;
  menuButton = null;
}

function openMenu(button, title, label, items) {
  closeMenu();
  const rect = button.getBoundingClientRect();
  const node = el('div', css.menu, { role: 'menu', 'aria-label': label });
  node.style.top = (rect.bottom + window.scrollY + 4) + 'px';
  node.style.left = Math.max(8, rect.right + window.scrollX - 208) + 'px';
  node.append(el('p', css.menuHead, {}, title));
  for (const item of items) {
    const entry = el('button', item.danger ? css.menuItem + ' ' + css.menuDanger : css.menuItem, { type: 'button', role: 'menuitem' }, item.label);
    entry.addEventListener('click', () => { closeMenu(); item.run(); });
    node.append(entry);
  }
  document.body.append(node);
  button.setAttribute('aria-expanded', 'true');
  menuNode = node;
  menuButton = button;
}

function closeOverlay() {
  if (scrimNode) scrimNode.remove();
  scrimNode = null;
}

function openOverlay(html) {
  closeOverlay();
  const scrim = el('div', css.scrim);
  scrim.innerHTML = html;
  document.body.append(scrim);
  scrimNode = scrim;
  const cancel = scrim.querySelector('[data-action="cancel"]');
  if (cancel) cancel.addEventListener('click', closeOverlay);
  return scrim;
}

function fieldHtml(id, label, control) {
  return '<p><label class="' + css.fieldLabel + '" for="' + id + '">' + label + '</label><br>' + control + '</p>';
}

function selectHtml(id, name, options, selected) {
  const rendered = options.map((option) =>
    '<option value="' + option.toLowerCase().replaceAll(' ', '-') + '"' + (option === selected ? ' selected' : '') + '>' + esc(option) + '</option>').join('');
  return '<select class="' + css.select + '" id="' + id + '" name="' + name + '">' + rendered + '</select>';
}

function openEditDialog(record) {
  const scrim = openOverlay(
    '<div class="' + css.dialog + '" role="dialog" aria-modal="true" aria-labelledby="edit-heading" data-testid="edit-dialog">'
    + '<div class="' + css.dialogHead + '"><h2 id="edit-heading">Edit member</h2><p>' + esc(record.name) + ' · ' + esc(record.email) + '</p></div>'
    + '<form>'
    + '<div class="' + css.dialogBody + '">'
    + fieldHtml('field-role', 'Role', selectHtml('field-role', 'role', roleNames, roleOf(record)))
    + fieldHtml('field-team', 'Team', selectHtml('field-team', 'team', teamNames, teamOf(record)))
    + fieldHtml('field-title', 'Job title', '<input class="' + css.input + '" id="field-title" name="title" value="" autocomplete="off">')
    + '</div>'
    + '<div class="' + css.dialogFoot + '"><button class="' + css.button + '" type="button" data-action="cancel">Cancel</button>'
    + '<button class="' + css.button + ' ' + css.buttonPrimary + '" type="submit">Save</button></div>'
    + '</form></div>');
  const form = scrim.querySelector('form');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void saveMember(record, form.elements.role.selectedOptions[0].textContent, form.elements.team.selectedOptions[0].textContent);
  });
}

async function saveMember(record, role, team) {
  await mutate('update-role', { id: record.id, role });
  record.row.cells[2].textContent = role;
  record.row.cells[3].textContent = team;
  closeOverlay();
  refreshStats();
  apply();
  showToast(record.name + "'s role is now " + role);
}

function openRemoveDialog(ids) {
  const scrim = openOverlay(
    '<div class="' + css.dialog + '" role="alertdialog" aria-modal="true" aria-labelledby="confirm-heading" data-testid="confirm-dialog">'
    + '<div class="' + css.dialogHead + '"><h2 id="confirm-heading">Remove ' + ids.length + (ids.length === 1 ? ' member?' : ' members?') + '</h2></div>'
    + '<div class="' + css.dialogBody + '"><p>They lose access to ' + esc(workspaceName) + ' immediately. Their audit history stays in the workspace.</p></div>'
    + '<form><div class="' + css.dialogFoot + '"><button class="' + css.button + '" type="button" data-action="cancel">Cancel</button>'
    + '<button class="' + css.button + ' ' + css.buttonDanger + '" type="submit">Remove members</button></div></form></div>');
  scrim.querySelector('form').addEventListener('submit', (event) => {
    event.preventDefault();
    void removeMembers(ids);
  });
}

async function removeMembers(ids) {
  await mutate('remove-members', { ids });
  const removing = new Set(ids);
  for (const record of roster) {
    if (!removing.has(record.id)) continue;
    record.row.remove();
    selected.delete(record.id);
  }
  roster = roster.filter((record) => !removing.has(record.id));
  closeOverlay();
  refreshStats();
  apply();
  showToast(ids.length + (ids.length === 1 ? ' member removed' : ' members removed'));
}

function showToast(message) {
  const node = el('div', css.toast);
  node.innerHTML = '<p class="' + css.toastText + '" data-testid="toast" role="status">' + esc(message) + '</p>'
    + '<button class="' + css.iconButton + '" type="button" aria-label="Dismiss">' + crossGlyph + '</button>';
  node.querySelector('button').addEventListener('click', () => node.remove());
  toastRegion.replaceChildren(node);
}

function rowMenuItems(record) {
  const items = [{ label: 'Edit member', run: () => openEditDialog(record) }];
  if (statusOf(record) === 'Invited') items.push({ label: 'Resend invitation', run: () => showToast('Invitation resent to ' + record.email) });
  items.push({ label: 'Copy member ID', run: () => showToast('Member ID copied to the clipboard') });
  items.push({ label: 'Remove from workspace', danger: true, run: () => openRemoveDialog([record.id]) });
  return items;
}

tbody.addEventListener('click', (event) => {
  const button = event.target.closest('button[aria-haspopup="menu"]');
  if (!button) return;
  const record = recordFor(button.closest('tr'));
  if (record) openMenu(button, record.name, 'Actions for ' + record.name, rowMenuItems(record));
});

document.querySelector('[data-action="account"]').addEventListener('click', (event) => {
  openMenu(event.currentTarget, 'Avery Rowe', 'Account', [
    { label: 'Profile', run: () => showToast('Profile is managed by your identity provider') },
    { label: 'Preferences', run: () => showToast('Preferences saved') },
    { label: 'Sign out', run: () => showToast('Signing out') },
  ]);
});

document.addEventListener('click', (event) => {
  if (menuNode && !menuNode.contains(event.target) && event.target !== menuButton && !menuButton.contains(event.target)) closeMenu();
}, true);

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (menuNode) closeMenu();
  else closeOverlay();
});
`;
}
