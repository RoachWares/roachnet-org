/* ===========================
   landing-script.js
   Scroll progress bar and reveal observer for the
   RoachNet Mission landing page.
   =========================== */

// Scroll progress bar
const progressBar = document.querySelector(".landing-scroll-progress");
const heroSignal = document.querySelector(".why-hero__signal");
const heroSignalCore = document.querySelector(".why-hero__signal-core");
const bottomMark = document.querySelector(".why-bottom-mark");
const root = document.documentElement;
// Decorative motion is opt-out: reduced motion turns it off, coarse pointers skip
// the pointer effects, and nothing loops while the tab is hidden.
const calmMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const finePointer = window.matchMedia("(pointer: fine)");
const decorativeMotion = () => !calmMotion.matches;
const pointerMotion = () => decorativeMotion() && finePointer.matches;
let landingScrollTimer = 0;
let lastScrollY = window.scrollY;

function syncScrollProgress() {
  const scrollable = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  const ratio = Math.min(1, Math.max(0, window.scrollY / scrollable));
  const pct = ratio * 100;

  root.style.setProperty("--landing-scroll-ratio", ratio.toFixed(4));
  root.style.setProperty("--landing-scroll-px", window.scrollY.toFixed(2));

  if (progressBar) {
    progressBar.style.width = pct.toFixed(2) + "%";
  }
}

function syncHeroScrollMotion() {
  if (!heroSignal) return;

  const rect = heroSignal.getBoundingClientRect();
  const viewport = Math.max(window.innerHeight, 1);
  const offset = ((rect.top + rect.height * 0.45) - viewport * 0.5) / viewport;
  const clamped = Math.max(-1, Math.min(1, offset));

  heroSignal.style.setProperty("--hero-scroll-shift", `${(-clamped * 18).toFixed(2)}px`);

  if (heroSignalCore) {
    heroSignalCore.style.setProperty("--hero-scroll-y", `${(-clamped * 10).toFixed(2)}px`);
  }
}

window.addEventListener("scroll", () => {
  const currentY = window.scrollY;
  const direction = currentY >= lastScrollY ? "down" : "up";
  document.body.classList.add("is-scrolling", `is-scrolling-${direction}`);
  document.body.classList.toggle("is-scrolling-down", direction === "down");
  document.body.classList.toggle("is-scrolling-up", direction === "up");
  lastScrollY = currentY;

  window.clearTimeout(landingScrollTimer);
  landingScrollTimer = window.setTimeout(() => {
    document.body.classList.remove("is-scrolling", "is-scrolling-down", "is-scrolling-up");
  }, 180);

  syncScrollProgress();
  syncHeroScrollMotion();
}, { passive: true });
window.addEventListener("resize", syncHeroScrollMotion, { passive: true });
syncScrollProgress();
syncHeroScrollMotion();

function burstGlitch(target) {
  if (!target) return;
  target.classList.remove("is-bursting");
  void target.offsetWidth;
  target.classList.add("is-bursting");
  window.setTimeout(() => target.classList.remove("is-bursting"), 320);
}

if (heroSignal && heroSignalCore && decorativeMotion()) {
  let heroX = 0;
  let heroY = 0;
  let rafId = 0;

  const syncHeroDrift = () => {
    rafId = 0;
    heroSignalCore.style.setProperty("--hero-core-x", `${heroX.toFixed(2)}px`);
    heroSignalCore.style.setProperty("--hero-core-y", `${heroY.toFixed(2)}px`);
    heroSignal.style.setProperty("--hero-rail-shift", `${(heroX * 0.45).toFixed(2)}px`);
  };

  const queueHeroDrift = () => {
    if (!rafId) {
      rafId = window.requestAnimationFrame(syncHeroDrift);
    }
  };

  heroSignal.addEventListener("pointermove", (event) => {
    const rect = heroSignal.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1;
    const y = ((event.clientY - rect.top) / Math.max(rect.height, 1)) * 2 - 1;
    heroX = x * 6;
    heroY = y * 3;
    queueHeroDrift();
  });

  heroSignal.addEventListener("pointerleave", () => {
    heroX = 0;
    heroY = 0;
    queueHeroDrift();
  });

  const queueBurst = () => {
    if (!document.hidden && decorativeMotion()) {
      burstGlitch(heroSignal);
      if (bottomMark) {
        burstGlitch(bottomMark);
      }
    }
    const nextDelay = 2600 + Math.round(Math.random() * 2800);
    window.setTimeout(queueBurst, nextDelay);
  };

  window.setTimeout(queueBurst, 1400);
}

// Reveal observer for data-reveal elements
const revealTargets = document.querySelectorAll("[data-reveal]");

if (revealTargets.length && "IntersectionObserver" in window) {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
  );

  revealTargets.forEach((el) => revealObserver.observe(el));
} else {
  revealTargets.forEach((el) => el.classList.add("is-visible"));
}

const navShell = document.querySelector(".site-nav, .rn-nav");

function syncNavShell() {
  if (!navShell) return;
  navShell.classList.toggle("is-scrolled", window.scrollY > 14);
}

window.addEventListener("scroll", syncNavShell, { passive: true });
syncNavShell();

function initLandingPointerField() {
  if (!pointerMotion()) return;
  let rafId = 0;
  let pointerLiveTimer = 0;
  let pointerX = 0.5;
  let pointerY = 0.24;

  const syncPointer = () => {
    rafId = 0;
    root.style.setProperty("--landing-pointer-x", `${(pointerX * 100).toFixed(2)}%`);
    root.style.setProperty("--landing-pointer-y", `${(pointerY * 100).toFixed(2)}%`);
  };

  window.addEventListener("pointermove", (event) => {
    pointerX = Math.max(0, Math.min(1, event.clientX / Math.max(window.innerWidth, 1)));
    pointerY = Math.max(0, Math.min(1, event.clientY / Math.max(window.innerHeight, 1)));
    document.body.classList.add("is-pointer-live");
    window.clearTimeout(pointerLiveTimer);
    pointerLiveTimer = window.setTimeout(() => {
      document.body.classList.remove("is-pointer-live");
    }, 900);
    if (!rafId) {
      rafId = window.requestAnimationFrame(syncPointer);
    }
  }, { passive: true });

  syncPointer();
}

function initLandingClickRipples() {
  if (!decorativeMotion()) return;
  const selector = [
    ".rn-nav a",
    ".rn-btn",
    ".why-cap-card",
    ".company-status__grid a",
    ".company-card",
    ".rn-release-chip",
  ].join(", ");

  document.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    const target = event.target.closest(selector);
    if (!target) return;

    const ripple = document.createElement("span");
    ripple.className = "rn-click-ripple rn-click-ripple--landing";
    ripple.style.left = `${event.clientX}px`;
    ripple.style.top = `${event.clientY}px`;
    document.body.appendChild(ripple);

    window.setTimeout(() => ripple.remove(), 620);
  }, { passive: true });
}

const microTargets = document.querySelectorAll(
  [
    ".cta",
    ".rn-btn",
    ".rn-nav-primary",
    ".rn-nav-ghost",
    ".rn-logo",
    ".site-header__action",
    ".app-store-card__action",
    ".app-detail-sheet__primary",
    ".app-detail-sheet__secondary",
    ".app-detail-sheet__close",
    ".feature-card",
    ".support-card",
    ".account-mini-card",
    ".app-store-card",
    ".app-store-featured",
    ".apps-toolbar",
    ".app-detail-sheet",
    ".apps-return-strip",
    ".feature-ledger__row",
    ".apps-hero-ledger__item",
    ".api-route-card",
    ".api-docs-hero__meta article",
    ".brew-card",
    ".ios-card",
    ".why-cap-card",
  ].join(", ")
);

if (pointerMotion()) microTargets.forEach((target) => {
  target.addEventListener("pointermove", (event) => {
    const rect = target.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(rect.width, 1)));
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / Math.max(rect.height, 1)));
    target.style.setProperty("--rn-hover-x", `${(x * 100).toFixed(2)}%`);
    target.style.setProperty("--rn-hover-y", `${(y * 100).toFixed(2)}%`);
  });

  target.addEventListener("pointerleave", () => {
    target.style.setProperty("--rn-hover-x", "50%");
    target.style.setProperty("--rn-hover-y", "50%");
  });
});

initLandingPointerField();
initLandingClickRipples();


// App showcase: tilts flat and brightens as it scrolls into view.
const showcase = document.querySelector("[data-why-showcase]");
if (showcase && decorativeMotion()) {
  let showcaseFrame = 0;
  const syncShowcase = () => {
    showcaseFrame = 0;
    const rect = showcase.getBoundingClientRect();
    const viewport = Math.max(window.innerHeight, 1);
    // 0 when the top edge enters the bottom of the viewport, 1 once it's 35% up.
    const progress = Math.min(1, Math.max(0, (viewport - rect.top) / (viewport * 0.65)));
    showcase.style.setProperty("--why-showcase-progress", progress.toFixed(3));
  };
  const queueShowcase = () => {
    if (!showcaseFrame) showcaseFrame = window.requestAnimationFrame(syncShowcase);
  };
  window.addEventListener("scroll", queueShowcase, { passive: true });
  window.addEventListener("resize", queueShowcase, { passive: true });
  syncShowcase();
}

// Footer release chip: show the latest GitHub release tag when the API answers.
;(async () => {
  const badge = document.getElementById('footer-release-badge')
  if (!badge) return
  try {
    const r = await fetch('https://api.github.com/repos/RoachWares/RoachNet/releases/latest', {
      headers: { Accept: 'application/vnd.github+json' }
    })
    if (!r.ok) return
    const d = await r.json()
    if (d.tag_name) {
      badge.textContent = d.tag_name
      badge.setAttribute('aria-label', `Latest RoachNet release ${d.tag_name}`)
    }
  } catch (_) {}
})()
