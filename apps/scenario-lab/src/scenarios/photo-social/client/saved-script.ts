/**
 * Saved posts. "New collection" names a collection and then picks its posts
 * from what is saved; "Add from saved" on a collection picks more. Picked posts
 * are divs acting as checkboxes, each named by nothing but its photo's alt text.
 */
export const SAVED_SCRIPT = String.raw`
function picker(title, codes, confirmLabel, onDone) {
  const shade = scrim('<div class="' + C.dialog + '" role="dialog" aria-modal="true" aria-labelledby="' + FL.ids.dialog + '"></div>');
  const dialog = shade.firstElementChild;
  const choices = FL.savedPosts.filter((post) => codes.includes(post.code));
  const picked = new Set();
  dialog.innerHTML = '<div class="' + C.dialogHead + '"><h2 id="' + FL.ids.dialog + '" style="margin:0;font-size:16px">' + esc(title) + '</h2><div role="button" tabindex="0" style="position:absolute;right:12px;top:12px">' + icon('close', C.navIcon, 'Close') + '</div></div>' +
    '<div class="' + C.grid + '" style="padding:4px">' + choices.map((post) => '<div role="checkbox" aria-checked="false" tabindex="0" style="position:relative"><img alt="' + esc(post.alt) + '" src="' + post.src + '" style="width:100%;aspect-ratio:1;object-fit:cover;display:block"></div>').join('') + '</div>' +
    '<div class="' + C.dialogBody + '"><div role="button" tabindex="0" class="' + C.primary + '" aria-disabled="true">' + confirmLabel + '</div></div>';
  const done = dialog.querySelector('.' + H.dialogBody + ' [role="button"]');
  dialog.querySelector('.' + H.dialogHead + ' [role="button"]').addEventListener('click', () => shade.remove());
  dialog.querySelectorAll('[role="checkbox"]').forEach((box, index) => box.addEventListener('click', () => {
    const code = choices[index].code;
    if (picked.has(code)) picked.delete(code); else picked.add(code);
    box.setAttribute('aria-checked', String(picked.has(code)));
    box.style.outline = picked.has(code) ? '3px solid #0095f6' : '';
    done.setAttribute('aria-disabled', String(picked.size === 0));
  }));
  done.addEventListener('click', () => { if (picked.size > 0) onDone(Array.from(picked), shade); });
}

document.addEventListener('click', (event) => {
  const control = event.target.closest('.' + H.saved + ' [role="button"]');
  if (!control) return;
  const text = textOf(control);
  if (text === 'New collection') {
    const shade = scrim('<div class="' + C.dialog + '" role="dialog" aria-modal="true" aria-labelledby="' + FL.ids.dialog + '"><div class="' + C.dialogHead + '"><h2 id="' + FL.ids.dialog + '" style="margin:0;font-size:16px">New collection</h2></div><div class="' + C.dialogBody + '"><input class="' + C.input + '" type="text" placeholder="Collection name" maxlength="50" autocomplete="off"><p role="alert" class="' + C.meta + '" hidden></p><div role="button" tabindex="0" class="' + C.primary + '" aria-disabled="true">Next</div></div></div>');
    const input = shade.querySelector('input');
    const next = shade.querySelector('.' + H.dialogBody + ' [role="button"]');
    shade.addEventListener('click', (inner) => { if (inner.target === shade) shade.remove(); });
    input.addEventListener('input', () => next.setAttribute('aria-disabled', String(input.value.trim() === '')));
    next.addEventListener('click', () => {
      const name = input.value.trim();
      if (name === '') return;
      if (live.collections.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
        const alert = shade.querySelector('[role="alert"]');
        alert.textContent = 'You already have a collection with that name.';
        alert.hidden = false;
        return;
      }
      shade.remove();
      picker('Add from saved', Array.from(live.saved), 'Done', async (codes, pickerShade) => {
        const before = new Set(live.collections.map((c) => c.slug));
        await act('collection-create', { name, codes });
        const made = live.collections.find((c) => !before.has(c.slug));
        pickerShade.remove();
        if (made) location.href = ROOT + FL.viewer + '/saved/' + made.slug + '/';
      });
    });
    input.focus();
  } else if (text === 'Add from saved' && FL.page.kind === 'collection') {
    const collection = live.collections.find((c) => c.slug === FL.page.slug);
    const codes = Array.from(live.saved).filter((code) => !collection.codes.includes(code));
    picker('Add from saved', codes, 'Done', async (picked) => {
      await act('collection-add', { slug: FL.page.slug, codes: picked });
      location.href = ROOT + FL.viewer + '/saved/' + FL.page.slug + '/?added=' + picked.length;
    });
  }
});
`;
