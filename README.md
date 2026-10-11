# roachnet.org

Public site, account lane, and Apps catalog for RoachNet.

This repo ships the landing page, the iOS page, the API docs, the separate account surface at `accounts.roachnet.org`, and the separate Apps surface at `apps.roachnet.org`.

## What Lives Here

- `index.html`
  Main RoachNet landing page
- `ios/index.html`
  RoachNet iOS page
- `api/`
  Public API docs shell
- `account/`
  Account lane shell for `accounts.roachnet.org`
- `app-store.html`
  Apps storefront UI
- `app-store-catalog.json`
  Generated install catalog consumed by the Apps UI
- `collections/`
  Source manifests for maps, education packs, Wikipedia bundles, and course shelves
- `assets/`
  Logos, screenshots, app icons, and branded storefront art
- `scripts/build-app-store-catalog.mjs`
  Rebuilds the Apps catalog from the collection manifests
- `scripts/build-accounts-site.mjs`
  Builds the standalone Accounts-site publish directory into `website-accounts-dist/`
- `scripts/build-apps-site.mjs`
  Builds the standalone Apps-site publish directory into `website-apps-dist/`

## Commands

```bash
npm run build:catalog
npm run build:accounts
npm run build:apps
npm run verify:local          # every check, including browser outcomes and links
npm run build:main:prebuilt   # website-main-deploy/, then its checks
```

## Hosting

Netlify owns roachnet.org and its subdomains (DNS and hosting). Three Netlify
projects serve this repo: `roachnet-setup` (roachnet.org), `roachnet-apps`
(apps.roachnet.org) and `roachnet-accounts` (accounts.roachnet.org).

Netlify's own dependency install fails for this repo, so roachnet.org ships as
a prebuilt upload: `npm run build:main:prebuilt` writes `website-main-deploy/`
with the static site in `site/`, the two functions bundled with esbuild, and
the native ONNX runtime the hosted RoachClaw model needs (Linux x64 only) in
`roachbrain-runtime/`. Upload that folder. Apps and Accounts upload their
`website-*-dist/` folders.

The Save button in the store talks to `saved-apps-bridge.html` on
accounts.roachnet.org through a hidden frame, so the account session stays on
that origin. That is why the accounts CSP allows `frame-ancestors
https://apps.roachnet.org`.
