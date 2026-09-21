/**
 * The browser side of a results page.
 *
 * - The cards arrive as skeletons and are filled in from the data the page
 *   was served with, six hundred milliseconds after it runs, as a hydrating
 *   front end does. The results list is `aria-busy` until then.
 * - The sort button ignores its first press: its handler arms itself on the
 *   first click instead of opening the menu, so the menu opens from the
 *   second press on, and a person presses it twice.
 * - The Model and Type filters collapse and expand on their headers.
 * - The price range submits from its round arrow, which is a div; with two
 *   text boxes and no submit button, Enter in a box submits nothing, as the
 *   HTML form rules say.
 * - The page size is a select that navigates on change.
 * - The survey, where the rendering has one, appears shortly after load.
 */
export function resultsClientScript(): string {
  return RESULTS_CORE;
}

const RESULTS_CORE = String.raw`
const resultsList = document.querySelector('ul[aria-busy]');
const hydrationData = JSON.parse(document.querySelector('script[type="application/json"]').textContent);
const gridLayout = resultsList.classList.contains(css.grid);
const SLOT_ROLES = ['cardPrice', 'cardMuted', 'cardStrong', 'cardMuted', 'cardStrong', 'cardMuted', 'cardStrong', 'cardMuted'];
const SLOT_ORDER = gridLayout ? [6, 7, 4, 5, 2, 3, 0, 1] : [0, 1, 2, 3, 4, 5, 6, 7];
setTimeout(() => {
  for (const card of Array.from(resultsList.children)) {
    const values = hydrationData[card.getAttribute('data-listingid') || card.getAttribute('data-adid')];
    if (!values) continue;
    Array.from(card.querySelectorAll('.' + css.skeleton)).forEach((slot, index) => {
      const valueIndex = SLOT_ORDER[index];
      slot.className = values[valueIndex] ? css[SLOT_ROLES[valueIndex]] : '';
      slot.textContent = values[valueIndex];
    });
  }
  resultsList.setAttribute('aria-busy', 'false');
}, 600);

const sortButton = byClass('sortButton');
const sortMenu = byClass('sortMenu');
let sortPrimed = false;
sortButton.addEventListener('click', (event) => {
  event.stopPropagation();
  if (!sortPrimed) {
    sortPrimed = true;
    return;
  }
  sortMenu.hidden = !sortMenu.hidden;
  sortButton.setAttribute('aria-expanded', String(!sortMenu.hidden));
});
document.addEventListener('click', (event) => {
  if (event.target instanceof Element && event.target.closest('.' + css.sortWrap)) return;
  sortMenu.hidden = true;
  sortButton.setAttribute('aria-expanded', 'false');
});

for (const head of document.querySelectorAll('div.' + css.railHead)) {
  head.addEventListener('click', () => {
    const list = head.nextElementSibling;
    list.hidden = !list.hidden;
    head.setAttribute('aria-expanded', String(!list.hidden));
  });
}

const priceGo = byClass('railGo');
if (priceGo) priceGo.addEventListener('click', () => priceGo.closest('form').requestSubmit());

const perPage = document.querySelector('select[aria-label="Items per page"]');
if (perPage) perPage.addEventListener('change', () => { location.href = perPage.value; });

const survey = byClass('survey');
if (survey) {
  const closeSurvey = async () => { survey.remove(); await mutate('dismiss-survey'); };
  survey.querySelector('button').addEventListener('click', closeSurvey);
  byClass('notNow', survey).addEventListener('click', closeSurvey);
  setTimeout(() => { if (survey.isConnected) survey.hidden = false; }, 800);
}
`;
