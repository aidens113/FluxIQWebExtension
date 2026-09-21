import { fixtureClient } from "../../../html.js";

/** Everything the widget shows, computed by the server: labels are British, and each branch's slots already omit the run's bookings. */
export type WidgetData = {
  branches: Array<{ id: string; name: string; address: string }>;
  services: Array<{ id: string; service: string; variant: string; price: string }>;
  slots: Record<string, Array<{ date: string; time: string; free: boolean; engineer: string; day: string; long: string }>>;
  today: string;
  deposit: string;
  confirmedPath: string;
};

/**
 * The Slotwise widget: five steps, re-rendered whole on every change, so an
 * element found on one render is gone on the next. The calendar shows one
 * week at a time from the site's today; today itself takes no online
 * bookings and Sundays are closed. The last step posts the booking and the
 * deposit together and, once the server has it, tells the framing page.
 */
export function widgetScript(runToken: string, w: Record<string, string>, data: WidgetData): string {
  return `${fixtureClient(runToken, "company-website")}
const d = ${JSON.stringify(data)};
const w = ${JSON.stringify(w)};
const root = document.getElementById('slotwise-root');
const STEPS = ['Branch', 'Service', 'Date and time', 'Your details', 'Pay deposit'];
const s = { step: 0, branch: null, service: null, week: 0, slot: null, details: { fullName: '', email: '', phone: '', postcode: '' }, error: '', busy: false };
const esc = (text) => String(text).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const branchOf = (id) => d.branches.find((b) => b.id === id);
const serviceOf = (id) => d.services.find((x) => x.id === id);
const days = [];
for (let i = 0; i < 21; i += 1) { const t = new Date(d.today + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + i); days.push(t.toISOString().slice(0, 10)); }
const dayLabel = (iso) => { const t = new Date(iso + 'T00:00:00Z'); return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][t.getUTCDay()] + ' ' + String(t.getUTCDate()).padStart(2, '0') + '/' + String(t.getUTCMonth() + 1).padStart(2, '0'); };

function header() {
  return '<div class="' + w.brandBar + '"><strong>Slotwise</strong><span class="' + w.note + '">Booking for Kestrel Lane Heating &amp; Plumbing</span></div>'
    + '<div class="' + w.steps + '">' + STEPS.map((label, i) => '<span class="' + (i === s.step ? w.stepOn : '') + '">' + (i + 1) + ' ' + label + '</span>').join('') + '</div>';
}
function actions(nextLabel) {
  return '<div class="' + w.error + '">' + esc(s.error) + '</div><div class="' + w.actions + '">'
    + (s.step > 0 ? '<button type="button" class="' + w.secondary + '" data-go="back">Back</button>' : '<span></span>')
    + '<button type="button" class="' + w.primary + '" data-go="next">' + nextLabel + '</button></div>';
}
function stepBranch() {
  return '<h2>Where are you?</h2>' + d.branches.map((b) => '<div class="' + w.tile + (s.branch === b.id ? ' ' + w.tileOn : '') + '" data-branch="' + b.id + '"><strong>' + esc(b.name) + '</strong><div class="' + w.note + '">' + esc(b.address) + '</div></div>').join('') + actions('Next');
}
function stepService() {
  const groups = [];
  for (const x of d.services) { let g = groups.find((entry) => entry.name === x.service); if (!g) { g = { name: x.service, items: [] }; groups.push(g); } g.items.push(x); }
  return '<h2>What do you need?</h2>' + groups.map((g) => '<h3>' + esc(g.name) + '</h3><div>' + g.items.map((x) => '<div class="' + w.pill + (s.service === x.id ? ' ' + w.pillOn : '') + '" data-service="' + x.id + '">' + esc(x.variant) + ' &middot; ' + esc(x.price) + '</div>').join('') + '</div>').join('') + actions('Next');
}
function stepTime() {
  const slots = d.slots[s.branch] || [];
  const week = days.slice(s.week * 7, s.week * 7 + 7);
  const columns = week.map((iso) => {
    const mine = slots.filter((slot) => slot.date === iso);
    let inner;
    if (iso === d.today) inner = '<div class="' + w.note + '">Today: please call the branch</div>';
    else if (!mine.length) inner = '<div class="' + w.note + '">' + (new Date(iso + 'T00:00:00Z').getUTCDay() === 0 ? 'Closed' : 'No online slots') + '</div>';
    else inner = mine.map((slot) => '<div class="' + w.slot + (slot.free ? '' : ' ' + w.slotFull) + (s.slot && s.slot.date === slot.date && s.slot.time === slot.time ? ' ' + w.slotOn : '') + '" data-slot="' + slot.date + '|' + slot.time + '">' + slot.time + '</div>').join('');
    return '<div class="' + w.day + '"><div class="' + w.dayHead + '">' + dayLabel(iso) + '</div>' + inner + '</div>';
  }).join('');
  const chosen = s.slot ? '<p>' + esc(s.slot.long) + ' at ' + s.slot.time + ' with ' + esc(s.slot.engineer) + '</p>' : '<p class="' + w.note + '">Choose a time.</p>';
  const earlier = s.week > 0 ? '<div data-week="-1">&lsaquo; Earlier</div>' : '<span></span>';
  const later = s.week < 2 ? '<div data-week="1">Later &rsaquo;</div>' : '<span></span>';
  return '<h2>When suits you?</h2><div class="' + w.weekNav + '">' + earlier + '<span>' + dayLabel(week[0]) + ' to ' + dayLabel(week[6]) + '</span>' + later + '</div><div class="' + w.week + '">' + columns + '</div>' + chosen + actions('Next');
}
function stepDetails() {
  const field = (name, label, type, auto) => '<label class="' + w.field + '">' + label + '<input class="' + w.input + '" name="' + name + '" type="' + type + '" autocomplete="' + auto + '" value="' + esc(s.details[name]) + '"></label>';
  return '<h2>Your details</h2>' + field('fullName', 'Full name', 'text', 'name') + field('email', 'Email', 'email', 'email') + field('phone', 'Mobile number', 'tel', 'tel') + field('postcode', 'Postcode', 'text', 'postal-code') + actions('Next');
}
function stepPay() {
  const x = serviceOf(s.service);
  const row = (label, value) => '<div>' + label + '</div><div><strong>' + esc(value) + '</strong></div>';
  return '<h2>Check and pay your deposit</h2><div class="' + w.summary + '">'
    + row('Branch', branchOf(s.branch).name) + row('Service', x.service + ': ' + x.variant) + row('Date', s.slot.long) + row('Time', s.slot.time) + row('Engineer', s.slot.engineer)
    + row('Price', x.price + ', paid after your visit, less the deposit') + row('Deposit today', d.deposit) + row('Card', 'Visa ending 0000, saved on this device')
    + '</div><p class="' + w.note + '">By confirming you agree to Slotwise charging the deposit to this card now.</p>' + actions('Confirm and pay ' + d.deposit);
}
function render() {
  if (s.step === 5) { root.innerHTML = header() + '<div class="' + w.done + '"><h2>Booked</h2><p>Taking you to your confirmation&hellip;</p></div>'; return; }
  const body = [stepBranch, stepService, stepTime, stepDetails, stepPay][s.step]();
  root.innerHTML = header() + body;
}
function readDetails() { root.querySelectorAll('input[name]').forEach((input) => { s.details[input.name] = input.value.trim(); }); }
function validate() {
  if (s.step === 0 && !s.branch) return 'Choose a branch.';
  if (s.step === 1 && !s.service) return 'Choose a service.';
  if (s.step === 2 && !s.slot) return 'Choose a time.';
  if (s.step === 3) { readDetails(); if (Object.values(s.details).some((value) => !value)) return 'Fill in all your details.'; }
  return '';
}
async function pay() {
  if (s.busy) return;
  s.busy = true;
  const result = await mutate('book-slot', { branchId: s.branch, serviceId: s.service, date: s.slot.date, time: s.slot.time, fullName: s.details.fullName, email: s.details.email, phone: s.details.phone, postcode: s.details.postcode, payDeposit: true });
  s.busy = false;
  const booking = (result.state.bookings || []).find((b) => b.branchId === s.branch && b.date === s.slot.date && b.time === s.slot.time && b.serviceId === s.service);
  if (!booking) { s.error = 'Sorry, we could not take that booking. Check your details, or choose another time.'; render(); return; }
  s.step = 5;
  render();
  if (window.parent !== window) window.parent.postMessage({ type: 'slotwise:booked', reference: booking.reference }, '*');
  else location.href = d.confirmedPath + encodeURIComponent(booking.reference);
}
root.addEventListener('input', (event) => { if (event.target.name && event.target.name in s.details) s.details[event.target.name] = event.target.value.trim(); });
root.addEventListener('click', (event) => {
  const t = event.target;
  const branch = t.closest('[data-branch]');
  if (branch) { s.branch = branch.getAttribute('data-branch'); s.slot = null; s.error = ''; render(); return; }
  const service = t.closest('[data-service]');
  if (service) { s.service = service.getAttribute('data-service'); s.error = ''; render(); return; }
  const week = t.closest('[data-week]');
  if (week) { s.week = Math.max(0, Math.min(2, s.week + Number(week.getAttribute('data-week')))); render(); return; }
  const slotNode = t.closest('[data-slot]');
  if (slotNode) {
    const [date, time] = slotNode.getAttribute('data-slot').split('|');
    const slot = (d.slots[s.branch] || []).find((entry) => entry.date === date && entry.time === time);
    if (!slot || !slot.free) { s.error = 'That time is fully booked.'; render(); return; }
    s.slot = slot; s.error = ''; render(); return;
  }
  const go = t.closest('[data-go]');
  if (!go) return;
  if (go.getAttribute('data-go') === 'back') { if (s.step === 3) readDetails(); s.step -= 1; s.error = ''; render(); return; }
  if (s.step === 4) { pay(); return; }
  const problem = validate();
  s.error = problem;
  if (!problem) s.step += 1;
  render();
});
render();
`;
}
