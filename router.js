/**
 * router.js — accounts.roachnet.org used to host a second copy of RoachClaw at
 * /roachclaw behind a client-side view switch. RoachClaw now lives in one place,
 * roachnet.org/roachclaw/, so old links on the accounts host are sent there.
 * The account page itself needs no routing.
 */

;(function () {
  var path = window.location.pathname.replace(/\/+$/, '')
  var onMainSite = window.location.hostname === 'roachnet.org' || window.location.hostname === 'www.roachnet.org'
  if (!onMainSite && (path === '/roachclaw' || path.indexOf('/roachclaw/') === 0)) {
    window.location.replace('https://roachnet.org/roachclaw/' + window.location.search + window.location.hash)
  }
})()
