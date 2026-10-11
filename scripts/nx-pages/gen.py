#!/usr/bin/env python3
"""Assembles the nx marketing pages from shared chrome + per-page bodies."""
import os, sys

NAV_ITEMS = [
    ("mission", "Mission", "https://roachnet.org/"),
    ("home", "Home", "https://roachnet.org/home/"),
    ("apps", "Apps", "https://apps.roachnet.org/"),
    ("claw", "Claw", "https://roachnet.org/roachclaw/"),
    ("brew", "Brew", "https://roachnet.org/brew/"),
    ("ios", "iOS", "https://roachnet.org/ios/"),
]

def head(title, description, canonical, image, rel, extra=""):
    return f'''<!doctype html>
<html lang="en" class="nx">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{title}</title>
    <meta name="description" content="{description}" />
    <meta name="theme-color" content="#05060a" />
    <link rel="canonical" href="{canonical}" />
    <link rel="icon" href="/favicon.ico" sizes="any" />
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
    <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="{title}" />
    <meta property="og:description" content="{description}" />
    <meta property="og:url" content="{canonical}" />
    <meta property="og:image" content="{image}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="{title}" />
    <meta name="twitter:description" content="{description}" />
    <meta name="twitter:image" content="{image}" />
    <link rel="preload" as="font" type="font/woff2" href="/fonts/inter-var.v1.woff2" crossorigin />
{extra}    <link rel="stylesheet" href="{rel}nx.css" />
    <script src="{rel}nx-halloween.js"></script>
  </head>
'''

def nav(current, sub):
    links = "\n".join(
        f'          <a class="nx-nav__link{" is-current" if key == current else ""}" href="{"#top" if key == current else href}"{" aria-current=\"page\"" if key == current else ""}>{label}</a>'
        for key, label, href in NAV_ITEMS
    )
    return f'''    <a class="rn-skip-link" href="#top">Skip to main content</a>
    <div class="nx-atmos" aria-hidden="true">
      <span class="nx-atmos__blob nx-atmos__blob--purple"></span>
      <span class="nx-atmos__blob nx-atmos__blob--blue"></span>
      <span class="nx-atmos__blob nx-atmos__blob--signal"></span>
      <span class="nx-atmos__scan"></span>
      <span class="nx-atmos__grain"></span>
      <span class="nx-atmos__vignette"></span>
    </div>
    <div class="nx-progress" aria-hidden="true"></div>

    <header class="nx-nav">
      <div class="nx-nav__bar">
        <a class="nx-nav__brand" href="https://roachnet.org/" aria-label="RoachNet landing page">
          <span class="nx-nav__dot" aria-hidden="true"></span>
          <span>RoachNet</span>
          <span class="nx-nav__sub">{sub}</span>
        </a>
        <button class="nx-nav__burger" type="button" aria-expanded="false" aria-controls="nx-primary-nav" aria-label="Open menu">
          <span aria-hidden="true"></span>
        </button>
        <nav class="nx-nav__links" id="nx-primary-nav" aria-label="Primary">
{links}
        </nav>
        <div class="nx-nav__actions" aria-label="Utility links">
          <a class="nx-nav__ghost" href="https://accounts.roachnet.org/">Account</a>
          <a class="nx-nav__ghost" href="https://roachnet.org/api/">API</a>
          <a class="nx-nav__cta" href="https://github.com/RoachWares/RoachNet" target="_blank" rel="noreferrer">GitHub</a>
        </div>
      </div>
    </header>
'''

def footer(home_href="https://roachnet.org/home/", extra_meta=""):
    return f'''    <footer class="nx-foot">
      <div class="nx-foot__mark" aria-hidden="true">
        <span class="nx-foot__word">RoachNet</span>
        <span class="nx-foot__tag">Offline on purpose</span>
      </div>
      <div class="nx-foot__grid">
        <div class="nx-foot__brand">
          <strong>RoachNet</strong>
          <span>Your hardware. Your intelligence. Your data. Your network. Your control.</span>
          <span>Made by <a class="nx-link" href="https://www.roachwares.org/">RoachWares LLC</a>.</span>
        </div>
        <div class="nx-foot__col">
          <h2>Product</h2>
          <nav aria-label="Footer: product">
            <a href="https://roachnet.org/">Mission</a>
            <a href="{home_href}">Home</a>
            <a href="https://apps.roachnet.org/">Apps</a>
            <a href="https://roachnet.org/roachclaw/">RoachClaw</a>
            <a href="https://roachnet.org/ios/">iOS</a>
          </nav>
        </div>
        <div class="nx-foot__col">
          <h2>Install</h2>
          <nav aria-label="Footer: install">
            <a href="https://roachnet.org/home/#downloads">Downloads</a>
            <a href="https://roachnet.org/brew/">Homebrew</a>
            <a href="https://roachnet.org/api/">API</a>
            <a href="https://github.com/RoachWares/RoachNet/releases/latest" target="_blank" rel="noreferrer">Changelog</a>
            <a href="https://github.com/RoachWares/RoachNet" target="_blank" rel="noreferrer">GitHub</a>
          </nav>
        </div>
        <div class="nx-foot__col">
          <h2>Company</h2>
          <nav aria-label="Footer: company">
            <a href="https://www.roachwares.org/">RoachWares</a>
            <a href="https://accounts.roachnet.org/">Account</a>
            <a href="https://roachnet.org/home/#support">Support</a>
            <a href="https://roachnet.org/sitemap/">Sitemap</a>
            <a href="mailto:contact@roachwares.org">contact<wbr>@roachwares.org</a>
          </nav>
        </div>
      </div>
      <div class="nx-foot__meta">
        <div class="nx-foot__meta-group">
          <a
            class="nx-release"
            id="footer-release-badge"
            href="https://github.com/RoachWares/RoachNet/releases/latest"
            target="_blank"
            rel="noreferrer"
            aria-label="Latest RoachNet release v1.0.6"
          >v1.0.6</a>
          <span>© 2026 RoachWares LLC</span>{extra_meta}
        </div>
        <a class="nx-netlify" href="https://www.netlify.com" target="_blank" rel="noreferrer" aria-label="Proudly powered by Netlify">
          <span>Hosted on</span>
          <img src="https://www.netlify.com/assets/badges/netlify-badge-color-accent.svg" alt="Netlify" width="114" height="51" loading="lazy" />
        </a>
      </div>
    </footer>
'''

def page(out, *, title, description, canonical, image, rel, current, sub, body, scripts, extra_head=""):
    html = head(title, description, canonical, image, rel, extra_head)
    html += '  <body data-page="%s">\n' % current
    html += nav(current, sub)
    html += body
    html += footer()
    html += "\n" + scripts + "  </body>\n</html>\n"
    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
    open(out, "w").write(html)
    print("wrote", out, len(html))

if __name__ == "__main__":
    import pages
    pages.build(page)
