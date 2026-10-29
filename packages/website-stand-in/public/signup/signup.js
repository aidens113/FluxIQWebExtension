// Progressive enhancement for the sign-up form. Server text is only ever
// written with textContent, never as HTML.
(function () {
  'use strict';
  var FIELDS = ['email', 'displayName', 'inviteCode', 'termsAccepted', 'termsVersion', 'humanToken'];
  var LABELS = {
    email: 'Enter a valid email address.',
    displayName: 'Enter a display name (1 to 80 characters).',
    inviteCode: 'Enter a valid invite code.',
    termsAccepted: 'You must accept the terms.',
    termsVersion: 'The terms changed, reload the page and accept again.',
    humanToken: 'Please complete the human check.'
  };
  var MESSAGES = {
    invalid: 'Please check the highlighted fields.',
    rate: 'Too many attempts. Please wait a bit and try again.',
    unavailable: 'Sign-up is unavailable, try again shortly.',
    origin: 'The request was refused. Reload the page and try again.'
  };
  var form = document.getElementById('signup-form');
  if (!form) return;
  var banner = document.getElementById('banner');
  var statusEl = document.getElementById('status');
  var submit = document.getElementById('submit');
  var tokenValue = '';

  function showBanner(text) {
    banner.textContent = text;
    banner.hidden = !text;
  }
  function clearErrors() {
    showBanner('');
    var nodes = form.querySelectorAll('[data-error-for]');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].textContent = '';
      nodes[i].hidden = true;
    }
  }
  function setFieldError(name, text) {
    var node = form.querySelector('[data-error-for="' + name + '"]');
    if (!node) return;
    node.textContent = text;
    node.hidden = false;
    var input = document.getElementById(name);
    if (input) input.setAttribute('aria-invalid', 'true');
  }
  function showFields(names, serverMessages) {
    var first = null;
    for (var i = 0; i < names.length; i++) {
      var n = names[i];
      if (FIELDS.indexOf(n) < 0) continue;
      var msg = serverMessages && typeof serverMessages[n] === 'string' ? serverMessages[n] : LABELS[n];
      setFieldError(n, msg);
      if (!first && document.getElementById(n)) first = document.getElementById(n);
    }
    if (first && first.focus) first.focus();
  }

  // continue= from this page's own query.
  var params = new URLSearchParams(window.location.search);
  var cont = params.get('continue');
  if (cont) document.getElementById('continue').value = cont;

  // Errors from the no-JS redirect (?error=...&fields=a,b).
  var err = params.get('error');
  if (err) {
    showBanner(MESSAGES[err] || MESSAGES.unavailable);
    var fields = (params.get('fields') || '').split(',').filter(Boolean);
    showFields(fields, null);
  }

  // Config: terms version, invite field, Turnstile.
  fetch('/api/signup/config', { headers: { Accept: 'application/json' } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (cfg) {
      if (!cfg) return;
      if (typeof cfg.termsVersion === 'string') document.getElementById('termsVersion').value = cfg.termsVersion;
      if (cfg.inviteRequired === true) document.getElementById('invite-field').hidden = false;
      if (cfg.signupOn === false) showBanner(MESSAGES.unavailable);
      if (cfg.humanCheck === 'turnstile' && typeof cfg.siteKey === 'string' && cfg.siteKey) loadTurnstile(cfg.siteKey);
    })
    .catch(function () { /* best-effort: the form works without the config */ });

  function loadTurnstile(siteKey) {
    window.__fluxiqTurnstileReady = function () {
      if (!window.turnstile) return;
      window.turnstile.render('#human-check', {
        sitekey: siteKey,
        callback: function (token) { tokenValue = token; },
        'expired-callback': function () { tokenValue = ''; }
      });
    };
    var s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=__fluxiqTurnstileReady';
    s.async = true;
    s.defer = true;
    document.head.appendChild(s);
  }

  form.addEventListener('submit', function (ev) {
    if (!window.fetch || !window.JSON) return; // fall back to a normal form post
    ev.preventDefault();
    clearErrors();
    statusEl.textContent = '';
    var body = {
      email: form.elements.email.value,
      displayName: form.elements.displayName.value,
      termsAccepted: form.elements.termsAccepted.checked,
      termsVersion: form.elements.termsVersion.value,
      inviteCode: form.elements.inviteCode.value,
      continue: form.elements['continue'].value,
      humanToken: tokenValue
    };
    submit.disabled = true;
    statusEl.textContent = 'Creating your account...';
    fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body)
    }).then(function (res) {
      if (res.status === 202) {
        try { sessionStorage.setItem('fluxiq-signup-email', String(body.email).trim()); } catch (e) { /* best-effort: storage may be blocked */ }
        window.location.assign('/check-email/');
        return;
      }
      submit.disabled = false;
      statusEl.textContent = '';
      if (res.status === 400) {
        return res.json().then(function (data) {
          var errors = data && data.errors && typeof data.errors === 'object' ? data.errors : {};
          showBanner(MESSAGES.invalid);
          showFields(Object.keys(errors), errors);
        }, function () { showBanner(MESSAGES.invalid); });
      }
      if (res.status === 429) return showBanner(MESSAGES.rate);
      if (res.status === 403) return showBanner(MESSAGES.origin);
      showBanner(MESSAGES.unavailable);
    }).catch(function () {
      /* best-effort: the failure is shown to the visitor */
      submit.disabled = false;
      statusEl.textContent = '';
      showBanner(MESSAGES.unavailable);
    });
  });
})();
