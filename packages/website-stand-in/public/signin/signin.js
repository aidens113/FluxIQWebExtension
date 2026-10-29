// Links to Core's /login on the app origin. Needs the OPTIONAL `appOrigin`
// field of GET /api/signup/config; without it a short message is shown.
(function () {
  'use strict';
  var msg = document.getElementById('message');
  var link = document.getElementById('continue-link');
  function none() {
    msg.textContent = 'Sign-in is not available from this page right now. Please try again shortly.';
  }
  fetch('/api/signup/config', { headers: { Accept: 'application/json' } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (cfg) {
      var origin = cfg && typeof cfg.appOrigin === 'string' ? cfg.appOrigin : '';
      var url;
      try { url = new URL('/login', origin); } catch (e) { return none(); }
      if (url.protocol !== 'https:' && url.protocol !== 'http:') return none();
      link.href = url.href;
      link.hidden = false;
      msg.textContent = 'Continue to sign in with your account.';
    })
    .catch(none);
})();
