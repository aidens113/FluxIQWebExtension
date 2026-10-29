// Resend button. The answer is the same whatever the account state.
(function () {
  'use strict';
  var form = document.getElementById('resend-form');
  if (!form) return;
  form.hidden = false;
  var statusEl = document.getElementById('status');
  var emailField = document.getElementById('email-field');
  var emailInput = document.getElementById('email');
  var button = document.getElementById('resend');
  var stored = '';
  try { stored = sessionStorage.getItem('fluxiq-signup-email') || ''; } catch (e) { /* best-effort: storage may be blocked */ }
  if (!stored) emailField.hidden = false;

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var email = stored || emailInput.value.trim();
    if (!email) {
      statusEl.textContent = 'Enter your email address first.';
      emailField.hidden = false;
      emailInput.focus();
      return;
    }
    button.disabled = true;
    statusEl.textContent = 'Sending...';
    fetch('/api/signup/resend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email: email })
    }).then(function (res) {
      if (res.status === 202) statusEl.textContent = 'If the address can sign up, another email is on its way.';
      else if (res.status === 429) statusEl.textContent = 'Too many attempts. Please wait a bit and try again.';
      else if (res.status === 400) {
        statusEl.textContent = 'Enter a valid email address.';
        emailField.hidden = false;
      }
      else statusEl.textContent = 'Sign-up is unavailable, try again shortly.';
      setTimeout(function () { button.disabled = false; }, 15000);
    }).catch(function () {
      /* best-effort: the failure is shown to the visitor */
      statusEl.textContent = 'Sign-up is unavailable, try again shortly.';
      button.disabled = false;
    });
  });
})();
