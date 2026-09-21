/** How long the Post button spins after the press it swallows. */
export const FIRST_PRESS_BUSY_MS = 450;

/**
 * The composers: "What's on your mind, Maya?" on the home feed, and "Write
 * something..." (or, after the `regrouped` redesign, Create post and Create
 * poll) on a group's page. Both open the same dialog.
 *
 * Three things about it are what a real one does and a tidy fixture would not:
 *
 * - The editor is a content-editable region, not a text field.
 * - The form carries a trap field, "Website", positioned off screen and out of
 *   the tab order. A person never sees it. Whatever the server receives in it
 *   marks the post as spam, and the server then answers exactly as it answers
 *   a real post, so the page shows the same "submitted" message either way.
 * - The Post button swallows its first press. That press starts the audience
 *   check the dialog loads lazily; the button spins for a moment and then reads
 *   Post again, with nothing posted. The second press posts. A person sees
 *   nothing happen and presses again; a script that presses once and moves on
 *   has posted nothing.
 *
 * The home composer's audience starts at Friends. A group post goes to the
 * group's admins for approval, and the pending box is fetched again from the
 * server afterwards, so it shows what the server kept and nothing else.
 */
export function composerScript(): string {
  return `const FIRST_PRESS_BUSY_MS = ${FIRST_PRESS_BUSY_MS};
${COMPOSER}`;
}

const COMPOSER = String.raw`
const AUDIENCE_NOTES = { 'Public': 'Anyone on or off Circleway', 'Friends': 'Your friends on Circleway', 'Only me': 'Only you can see this' };
function openComposer(options) {
  const home = options.target === 'home';
  const poll = options.kind === 'poll';
  const title = poll ? 'Create poll' : 'Create post';
  const placeholder = home ? 'What\'s on your mind, Maya?' : poll ? 'Ask a question...' : 'Write something...';
  let audience = 'Friends';
  const audienceControl = home
    ? '<div class="' + C.audienceButton + '" role="button" tabindex="0" aria-label="Edit privacy. Sharing with Friends.">Friends &#x25BE;</div>'
    : '<span class="' + C.audienceButton + '">' + esc(CFG.groupName) + '</span>';
  const pollOptions = poll ? '<input class="' + C.searchInput + '" style="background:#f0f2f5;border-radius:6px;padding:8px" type="text" aria-label="Option 1" placeholder="Option 1"><input class="' + C.searchInput + '" style="background:#f0f2f5;border-radius:6px;padding:8px" type="text" aria-label="Option 2" placeholder="Option 2">' : '';
  const extras = ['Photo/video', 'Tag people', 'Feeling/activity', 'Check in', 'GIF', 'More'].map((label) => '<div class="' + C.unitHide + '" role="button" tabindex="0" aria-label="' + label + '"><svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.8"/></svg></div>').join('');
  const scrim = mount('<div class="' + C.scrim + '"><div class="' + C.dialog + '" role="dialog" aria-modal="true" data-lb="cmp-t"><div class="' + C.dialogHead + '"><h2 class="' + C.dialogTitle + '" data-uid="cmp-t">' + title + '</h2><div class="' + C.dialogClose + '" role="button" tabindex="0" aria-label="Close">&#x2715;</div></div><form class="' + C.dialogBody + '" autocomplete="off"><div class="' + C.composerRow + '"><span class="' + C.avatar + '" style="background:hsl(204 45% 55%)"></span><div><strong>Maya Lindqvist</strong><div>' + audienceControl + '</div></div></div><div class="' + C.editor + '" contenteditable="true" role="textbox" aria-multiline="true" aria-label="' + placeholder + '" aria-placeholder="' + placeholder + '"></div>' + pollOptions + '<label class="' + C.trapField + '">Website <input type="text" name="website" tabindex="-1" autocomplete="off"></label><div class="' + C.composerRow + '" style="border:1px solid #ced0d4;border-radius:8px;padding:8px 12px"><span style="flex:1;font-weight:600">Add to your post</span>' + extras + '</div></form><div class="' + C.dialogFoot + '"><div class="' + C.primaryButton + '" role="button" tabindex="0" aria-label="Post" aria-disabled="true" style="flex:1;opacity:.5">Post</div></div></div></div>');
  const dialog = q('dialog', scrim);
  const editor = q('editor', scrim);
  const trap = scrim.querySelector('input[name="website"]');
  const post = q('primaryButton', scrim);
  let primed = false;
  let busy = false;
  const refresh = () => {
    const empty = editor.textContent.trim() === '';
    post.setAttribute('aria-disabled', empty ? 'true' : 'false');
    post.style.opacity = empty ? '.5' : '';
  };
  editor.addEventListener('input', refresh);
  new MutationObserver(refresh).observe(editor, { childList: true, characterData: true, subtree: true });
  onPress(q('dialogClose', scrim), () => scrim.remove());
  if (home) onPress(q('audienceButton', scrim), () => chooseAudience(dialog, audience, (chosen) => {
    audience = chosen;
    const control = q('audienceButton', scrim);
    control.setAttribute('aria-label', 'Edit privacy. Sharing with ' + chosen + '.');
    control.innerHTML = esc(chosen) + ' &#x25BE;';
  }));
  onPress(post, async () => {
    if (busy || post.getAttribute('aria-disabled') === 'true') return;
    busy = true;
    post.setAttribute('aria-busy', 'true');
    post.innerHTML = '<span class="' + C.spinner + '"></span>';
    if (!primed) {
      primed = true;
      await wait(FIRST_PRESS_BUSY_MS);
      post.removeAttribute('aria-busy');
      post.textContent = 'Post';
      busy = false;
      return;
    }
    const text = editor.textContent;
    const website = trap.value;
    if (home) {
      const snapshot = await mutate('create-post', { text, audience, website });
      scrim.remove();
      const created = snapshot.state.created;
      const newest = created[created.length - 1];
      if (newest && newest.text === text.trim()) {
        const html = await fetch(CFG.root + 'unit/' + newest.id + '/').then((response) => response.text());
        const feed = document.querySelector('[role="feed"]');
        const nodes = fromHtml(html);
        if (feed) nodes.reverse().forEach((node) => feed.prepend(node));
      }
      return;
    }
    await mutate('group-post', { group: CFG.group, kind: poll ? 'poll' : 'post', text, website });
    scrim.remove();
    toast('Your post was submitted to the admins for approval.');
    const html = await fetch(CFG.root + 'groups/' + CFG.group + '/pending/').then((response) => response.text());
    const existing = document.querySelector('[data-testid="pending-posts"]');
    const [box] = fromHtml(html);
    if (existing) existing.remove();
    if (box) document.querySelector('[role="main"]').prepend(box);
  });
  editor.focus();
}
function chooseAudience(dialog, current, done) {
  dialog.hidden = true;
  const rows = ['Public', 'Friends', 'Only me'].map((name, index) => '<div class="' + C.radioRow + '" role="radio" tabindex="0" aria-checked="' + (name === current) + '" data-lb="aud-' + index + '"><span><strong data-uid="aud-' + index + '">' + name + '</strong><span class="' + C.menuNote + '">' + AUDIENCE_NOTES[name] + '</span></span></div>').join('');
  const scrim = mount(dialogHtml('Post audience', '<p style="margin:0;font-weight:600">Who can see your post?</p><p class="' + C.muted + '" style="margin:0">Your post will show up in Feed, on your profile and in search results.</p><div role="radiogroup">' + rows + '</div>', '<div class="' + C.secondaryButton + '" role="button" tabindex="0">Cancel</div><div class="' + C.primaryButton + '" role="button" tabindex="0">Done</div>'));
  let chosen = current;
  qa('radioRow', scrim).forEach((row, index) => onPress(row, () => {
    chosen = ['Public', 'Friends', 'Only me'][index];
    qa('radioRow', scrim).forEach((other) => other.setAttribute('aria-checked', String(other === row)));
  }));
  const close = () => { scrim.remove(); dialog.hidden = false; };
  onPress(q('secondaryButton', scrim), close);
  onPress(q('primaryButton', scrim), () => { close(); done(chosen); });
}
if (CFG.page === 'home') {
  const prompt = q('composerPrompt');
  if (prompt) onPress(prompt, () => openComposer({ target: 'home', kind: 'post' }));
}
if (CFG.page === 'group') {
  const prompt = q('composerPrompt');
  if (prompt) onPress(prompt, () => openComposer({ target: 'group', kind: 'post' }));
  qa('composerOption').forEach((option) => onPress(option, () => {
    const label = option.textContent.trim();
    if (label === 'Poll') openComposer({ target: 'group', kind: 'poll' });
    else if (label === 'Anonymous post') toast('Anonymous posting is turned off in this group.');
    else toast('Choose how you are feeling after you write your post.');
  }));
  const row = q('createRow');
  if (row) {
    const [createPost, createPoll, createEvent] = Array.from(row.children);
    onPress(createPost, () => openComposer({ target: 'group', kind: 'post' }));
    onPress(createPoll, () => openComposer({ target: 'group', kind: 'poll' }));
    onPress(createEvent, () => toast('Events are created from the Events tab.'));
  }
}
`;
