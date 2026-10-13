"""Per-page bodies for the nx marketing pages (roachnet.org)."""

IOS_BODY = '''
    <main id="top" class="nx-main" tabindex="-1">
      <section class="nx-hero" aria-labelledby="hero-title">
        <div class="nx-hero__copy">
          <p class="nx-overline">RoachNet iOS 0.3.1 · iPhone &amp; iPad</p>
          <h1 class="nx-display nx-display--xl" id="hero-title">RoachNet <span class="nx-accent">in your pocket.</span></h1>
          <p class="nx-lede">
            Your Mac's RoachClaw, library and vault on your iPhone or iPad. The Mac does the heavy lifting; the phone keeps you in the loop, even when the Mac is asleep.
          </p>
          <div class="nx-actions">
            <a class="nx-btn nx-btn--primary" data-ipa-download href="https://github.com/RoachWares/RoachNet-iOS/releases/download/v0.3.1/RoachNetiOS-v0.3.1-unsigned.ipa">Download RoachNet iOS 0.3.1</a>
            <a class="nx-btn" href="#install">Install with SideStore or AltStore</a>
          </div>
          <p class="nx-hero__meta">
            <span>v0.3.1</span><span aria-hidden="true">·</span><span>iOS 17 or later</span><span aria-hidden="true">·</span><span>pairs with RoachNet 1.1 for Mac</span>
          </p>
          <p class="nx-prose">An unsigned IPA that SideStore or AltStore signs with your own Apple ID. No App Store, no RoachNet account, nobody in the middle.</p>
          <ul class="nx-chips" aria-label="What's in the app">
            <li class="nx-chip nx-chip--mono">Home</li>
            <li class="nx-chip nx-chip--mono">RoachClaw</li>
            <li class="nx-chip nx-chip--mono">Org</li>
            <li class="nx-chip nx-chip--mono">Apps</li>
            <li class="nx-chip nx-chip--mono">Vault</li>
            <li class="nx-chip nx-chip--mono">Runtime</li>
          </ul>
        </div>

        <div class="nx-hero__visual nx-phone-stage" aria-hidden="true">
          <div class="nx-screen nx-screen--phone ios-hero-shot app-screen-shot">
            <span class="nx-screen__glow"></span>
            <img src="../assets/screens/roachnet-ios-020-home.webp" width="1206" height="2622" alt="RoachNet iOS Home screen" fetchpriority="high" decoding="async" />
          </div>
          <div class="nx-floats">
            <div class="nx-float nx-float--tl"><span>Paired</span><strong>Over your own RoachTail link</strong></div>
            <div class="nx-float nx-float--br"><span>Thinks on the Mac</span><strong>Your models, your replies</strong></div>
          </div>
        </div>
      </section>

      <div class="nx-ticker" aria-hidden="true">
        <div class="nx-ticker__track">
          <span class="nx-ticker__item">Pairs in one tap</span>
          <span class="nx-ticker__item">Every phone gets its own key</span>
          <span class="nx-ticker__item">No RoachNet server</span>
          <span class="nx-ticker__item">Useful when the Mac is asleep</span>
          <span class="nx-ticker__item">SideStore and AltStore</span>
          <span class="nx-ticker__item">Approve agents from the couch</span>
        </div>
      </div>

      <section class="nx-section" id="screens" aria-labelledby="screens-title">
        <div class="nx-section__head">
          <p class="nx-overline">Screens</p>
          <h2 class="nx-h2" id="screens-title">Everything the Mac knows, one thumb away.</h2>
          <p class="nx-lede">Six tabs and one sheet, each doing one job. Pocket-sized, not toy-sized.</p>
        </div>
        <div class="nx-grid nx-grid--3 nx-phones" role="list">
          <article class="nx-card nx-phone-card nx-reveal" role="listitem">
            <div class="nx-screen nx-screen--phone app-screen-shot app-screen-shot--dark">
              <img src="../assets/screens/roachnet-ios-020-home.webp" width="1206" height="2622" alt="RoachNet iOS Home: vital signs for the paired Mac" loading="lazy" decoding="async" />
            </div>
            <p class="nx-card__eyebrow">Home · new</p>
            <h3 class="nx-card__title">Your Mac's vital signs at a glance.</h3>
            <p class="nx-card__body">Which brain is loaded, what's on the shelves, whether RoachTail is up and what your agents are waiting on. One look before you put the phone back.</p>
          </article>
          <article class="nx-card nx-phone-card nx-reveal" role="listitem">
            <div class="nx-screen nx-screen--phone app-screen-shot app-screen-shot--dark">
              <img src="../assets/screens/roachnet-ios-020-roachclaw.webp" width="1206" height="2622" alt="RoachNet iOS RoachClaw chat" loading="lazy" decoding="async" />
            </div>
            <p class="nx-card__eyebrow nx-card__eyebrow--cyan">RoachClaw</p>
            <h3 class="nx-card__title">Ask from here. It thinks on the Mac.</h3>
            <p class="nx-card__body">Type, dictate or attach a photo. The reply comes from the model on your Mac, and the thread is there next time you open the laptop.</p>
          </article>
          <article class="nx-card nx-phone-card nx-reveal" role="listitem">
            <div class="nx-screen nx-screen--phone app-screen-shot app-screen-shot--dark">
              <img src="../assets/screens/roachnet-ios-020-org.webp" width="1206" height="2622" alt="RoachNet iOS Org approvals" loading="lazy" decoding="async" />
            </div>
            <p class="nx-card__eyebrow nx-card__eyebrow--purple">Org · with RoachNet 1.1</p>
            <h3 class="nx-card__title">Sign off on your agents from the couch.</h3>
            <p class="nx-card__body">RoachClaw Org asks before it hires an agent or changes the plan. Approve, send it back with a note, or say no. Pause an agent that's wandering.</p>
          </article>
          <article class="nx-card nx-phone-card nx-reveal" role="listitem">
            <div class="nx-screen nx-screen--phone app-screen-shot app-screen-shot--dark">
              <img src="../assets/screens/roachnet-ios-020-apps.webp" width="1206" height="2622" alt="RoachNet iOS Apps" loading="lazy" decoding="async" />
            </div>
            <p class="nx-card__eyebrow">Apps</p>
            <h3 class="nx-card__title">Queue installs from anywhere.</h3>
            <p class="nx-card__body">Pick maps, courses, models and packs; they install on the Mac as soon as it's reachable. If the web catalog is offline, the shelf you last loaded stays put.</p>
          </article>
          <article class="nx-card nx-phone-card nx-reveal" role="listitem">
            <div class="nx-screen nx-screen--phone app-screen-shot app-screen-shot--dark">
              <img src="../assets/screens/roachnet-ios-020-vault.webp" width="1206" height="2622" alt="RoachNet iOS Vault" loading="lazy" decoding="async" />
            </div>
            <p class="nx-card__eyebrow">Vault</p>
            <h3 class="nx-card__title">Your library, without the laptop.</h3>
            <p class="nx-card__body">Maps, courses, saved pages, media and documents, readable on the phone and still there after the Mac drops off.</p>
          </article>
          <article class="nx-card nx-phone-card nx-reveal" role="listitem">
            <div class="nx-screen nx-screen--phone app-screen-shot app-screen-shot--dark">
              <img src="../assets/screens/roachnet-ios-020-runtime.webp" width="1206" height="2622" alt="RoachNet iOS Runtime" loading="lazy" decoding="async" />
            </div>
            <p class="nx-card__eyebrow nx-card__eyebrow--amber">Runtime</p>
            <h3 class="nx-card__title">See what the Mac is up to.</h3>
            <p class="nx-card__body">Services, downloads, RoachTail, RoachSync and RoachAtlas GPS, with the controls to start, stop or retry right there.</p>
          </article>
        </div>
      </section>

      <section class="nx-section" id="features" aria-labelledby="features-title">
        <div class="nx-section__head">
          <p class="nx-overline">What's in 0.3.1</p>
          <h2 class="nx-h2" id="features-title">Your Mac's colors, and a token that stays home.</h2>
          <p class="nx-lede">0.3.1 wears the theme you picked on the Mac with RoachNet 1.1. It still works with 1.0.7, minus the theme.</p>
        </div>
        <div class="nx-grid nx-grid--3" role="list">
          <article class="nx-card nx-card--feature nx-reveal" role="listitem">
            <p class="nx-card__eyebrow">Themes</p>
            <h3 class="nx-card__title">The phone follows the Mac's theme.</h3>
            <p class="nx-card__body">Pick one of the 31 themes in RoachNet 1.1, or one from a theme pack, and the phone wears it too, light ones included. Switch it off under Connection › Appearance.</p>
          </article>
          <article class="nx-card nx-reveal" role="listitem">
            <p class="nx-card__eyebrow nx-card__eyebrow--amber">Pairing changed</p>
            <h3 class="nx-card__title">The token stays off shared Wi-Fi.</h3>
            <p class="nx-card__body">It travels only over HTTPS, inside your tailnet, or to this device. A plain <code>http://</code> link to a Wi-Fi address or a <code>.local</code> name is refused with a note that says why. Use the RoachTail alias or your tailnet address.</p>
          </article>
          <article class="nx-card nx-reveal" role="listitem">
            <p class="nx-card__eyebrow nx-card__eyebrow--purple">Face ID</p>
            <h3 class="nx-card__title">Your face or passcode before the big buttons.</h3>
            <p class="nx-card__body">Org decisions, a new token and forgetting the Mac ask for Face ID, Touch ID or your passcode first.</p>
          </article>
          <article class="nx-card nx-reveal" role="listitem">
            <p class="nx-card__eyebrow nx-card__eyebrow--purple">RoachClaw Org</p>
            <h3 class="nx-card__title">Approve, send back or reject with a note.</h3>
            <p class="nx-card__body">Pause and resume agents. Join an Org from an invite link. Needs RoachNet 1.1 on the Mac.</p>
          </article>
          <article class="nx-card nx-reveal" role="listitem">
            <p class="nx-card__eyebrow">RoachTail</p>
            <h3 class="nx-card__title">Each phone gets its own key.</h3>
            <p class="nx-card__body">The Mac can remove one phone without touching the rest, and with 1.1 a key nobody used for 90 days stops working on its own. The join code stays hidden until you tap it.</p>
          </article>
          <article class="nx-card nx-reveal" role="listitem">
            <p class="nx-card__eyebrow nx-card__eyebrow--cyan">RoachAtlas GPS</p>
            <h3 class="nx-card__title">Share your location with RoachAtlas on your own Mac.</h3>
            <p class="nx-card__body">Only while the app is open, and only when you say so.</p>
          </article>
          <article class="nx-card nx-reveal" role="listitem">
            <p class="nx-card__eyebrow">Useful offline</p>
            <h3 class="nx-card__title">Answers from what it already has.</h3>
            <p class="nx-card__body">When the Mac is out of reach, recent chats, files and status stay on the phone until it comes back.</p>
          </article>
          <article class="nx-card nx-reveal" role="listitem">
            <p class="nx-card__eyebrow">Nobody in the middle</p>
            <h3 class="nx-card__title">Phone and Mac talk over your own network.</h3>
            <p class="nx-card__body">No RoachNet server, no account, no relay.</p>
          </article>
        </div>
      </section>

      <section class="nx-section" id="install" aria-labelledby="install-title">
        <div class="nx-section__head">
          <p class="nx-overline">Install</p>
          <h2 class="nx-h2" id="install-title">Install with SideStore or AltStore.</h2>
          <p class="nx-lede">Add the RoachNet source once and updates show up on their own, or grab the IPA directly. Same build either way.</p>
        </div>
        <div class="nx-grid nx-grid--2">
          <article class="nx-card nx-card--feature nx-reveal">
            <p class="nx-card__eyebrow">SideStore</p>
            <h3 class="nx-card__title">Add the source, or hand SideStore the IPA directly.</h3>
            <p class="nx-card__body">The source keeps you on the latest build without hunting for files. The IPA is there when you want the file itself.</p>
            <div class="nx-actions nx-mt-16">
              <a class="nx-btn nx-btn--primary" data-sidestore-source href="sidestore://source?url=https://raw.githubusercontent.com/RoachWares/RoachNet-SideStore/main/apps.json">Add source to SideStore</a>
              <a class="nx-btn" data-ipa-download href="https://github.com/RoachWares/RoachNet-iOS/releases/download/v0.3.1/RoachNetiOS-v0.3.1-unsigned.ipa">Download IPA</a>
              <a class="nx-link nx-link--arrow" href="https://docs.sidestore.io/" target="_blank" rel="noreferrer">First time with SideStore?</a>
            </div>
            <p class="nx-card__body" data-sidestore-note>Opens SideStore with the RoachNet source ready to add. Or download the IPA and share it to SideStore.</p>
            <p class="nx-card__body" data-sidestore-desktop hidden>Open this page on your iPhone or iPad, or AirDrop the IPA first.</p>
            <ol class="nx-steps nx-mt-16">
              <li class="nx-step"><strong>Add the RoachNet source to SideStore.</strong></li>
              <li class="nx-step"><strong>Install RoachNetiOS from the source, or fall back to the IPA.</strong></li>
              <li class="nx-step"><strong>Sign and install. Open RoachNetiOS and pair your Mac.</strong></li>
            </ol>
          </article>
          <article class="nx-card nx-card--feature nx-reveal">
            <p class="nx-card__eyebrow">AltStore</p>
            <h3 class="nx-card__title">Use the same RoachNet source in AltStore.</h3>
            <p class="nx-card__body">The same source works in AltStore and always points at the current IPA.</p>
            <div class="nx-actions nx-mt-16">
              <a class="nx-btn nx-btn--primary" data-altstore-source href="altstore://source?url=https://raw.githubusercontent.com/RoachWares/RoachNet-SideStore/main/apps.json">Add source to AltStore</a>
              <a class="nx-btn" href="https://github.com/RoachWares/RoachNet-iOS/releases/download/v0.3.1/RoachNetiOS-v0.3.1-unsigned.ipa">Download IPA</a>
              <a class="nx-link nx-link--arrow" href="https://altstore.io/" target="_blank" rel="noreferrer">First time with AltStore?</a>
            </div>
            <p class="nx-card__body" data-altstore-note>Opens AltStore with the same source ready to add. Or download the IPA and import it from Files.</p>
            <p class="nx-card__body" data-altstore-desktop hidden>Open this page on your iPhone or iPad, or AirDrop the IPA first.</p>
            <ol class="nx-steps nx-mt-16">
              <li class="nx-step"><strong>Install AltStore and keep AltServer available on your Mac.</strong></li>
              <li class="nx-step"><strong>Add the RoachNet source URL, then install RoachNetiOS from AltStore.</strong></li>
              <li class="nx-step"><strong>Pair your Mac on first launch. Refresh before the 7-day signature runs out.</strong></li>
            </ol>
          </article>
        </div>
      </section>

      <section class="nx-section" id="pairing" aria-labelledby="pairing-title">
        <div class="nx-section__head">
          <p class="nx-overline">Pairing</p>
          <h2 class="nx-h2" id="pairing-title">Pair once. The phone stays useful.</h2>
          <p class="nx-lede">Your Mac keeps the models, the vault and the installs. The phone is fast because it isn't trying to be a second desktop.</p>
        </div>
        <div class="nx-grid nx-grid--3" role="list">
          <article class="nx-card nx-card--signal nx-reveal" role="listitem">
            <p class="nx-card__eyebrow">Connecting</p>
            <h3 class="nx-card__title">Scan the code on your Mac, or open its pair link.</h3>
            <p class="nx-card__body">RoachNet on the Mac shows a QR code and a pair link. Either one fills in the details; press Pair with RoachTail and the phone gets its own key.</p>
          </article>
          <article class="nx-card nx-reveal" role="listitem">
            <p class="nx-card__eyebrow">Alias</p>
            <h3 class="nx-card__title"><code>https://roachnet.roachtail</code> is the front door.</h3>
            <p class="nx-card__body">Type it in if you'd rather not scan the code.</p>
          </article>
          <article class="nx-card nx-reveal" role="listitem">
            <p class="nx-card__eyebrow">Fallback</p>
            <h3 class="nx-card__title">Mac offline? What you already loaded keeps working.</h3>
            <p class="nx-card__body">Recent chats, files and status stay on the phone until the Mac reappears.</p>
          </article>
        </div>
        <div class="nx-actions nx-mt-32">
          <a class="nx-btn" href="https://roachnet.org/api/">Read the API</a>
          <a class="nx-btn" href="https://roachnet.org/home/">RoachNet for Mac</a>
        </div>
      </section>
    </main>
'''

BREW_BODY = '''
    <main id="top" class="nx-main" tabindex="-1">
      <section class="nx-hero" aria-labelledby="hero-title">
        <div class="nx-hero__copy">
          <p class="nx-overline">RoachNet Brew · Homebrew cask</p>
          <h1 class="nx-display" id="hero-title">Terminal type? Three commands to <span class="nx-accent">~/RoachNet.</span></h1>
          <p class="nx-lede">
            Same app, same folder, same easy goodbye if you change your mind. This route skips the setup window and lets Homebrew do the walking.
          </p>
          <div class="nx-actions">
            <button class="nx-btn nx-btn--primary" data-homebrew-install type="button">Install with Homebrew</button>
            <button class="nx-btn" data-homebrew-copy type="button">Copy brew command</button>
          </div>
          <p class="nx-hero__meta">
            <span>RoachNet 1.1.0</span><span aria-hidden="true">·</span><span>Apple Silicon</span><span aria-hidden="true">·</span><span>needs <a class="nx-link" href="https://brew.sh" target="_blank" rel="noreferrer">Homebrew</a></span>
          </p>
          <p class="nx-prose" id="homebrew-note">
            RoachNet v1.1.0 is not Apple-notarized yet, so the cask clears only the macOS flags that would block launch, then runs the same native installer the Setup app uses. It brings its own tools instead of borrowing yours.
          </p>
        </div>
        <div class="nx-hero__visual" aria-hidden="true">
          <div class="nx-console nx-console--hero">
            <div class="nx-console__bar"><i></i><i></i><i></i> zsh · ~</div>
            <div class="nx-console__body">
              <span class="nx-console__line" id="brew-command" data-type>brew update &amp;&amp; brew tap --force RoachWares/roachnet &amp;&amp; brew install --cask roachnet</span>
              <span class="nx-console__line nx-console__line--out">==&gt; Tapping roachwares/roachnet</span>
              <span class="nx-console__line nx-console__line--out">==&gt; Downloading RoachNet-Setup-macOS.dmg (221 MB)</span>
              <span class="nx-console__line nx-console__line--out">==&gt; Verifying SHA-256 … ok</span>
              <span class="nx-console__line nx-console__line--out">==&gt; RoachNet installed to ~/RoachNet/app/RoachNet.app</span>
              <span class="nx-console__line">open ~/RoachNet/app/RoachNet.app</span>
            </div>
            <div class="nx-console__copy">
              <button class="nx-btn nx-btn--sm nx-btn--mono" data-homebrew-copy type="button">Copy</button>
            </div>
          </div>
          <div class="nx-screen screen-frame nx-mt-24 nx-brew-shot">
            <img src="../assets/screens/roachnet-native-home.webp" width="1568" height="1032" alt="RoachNet home screen" loading="lazy" decoding="async" />
            <span class="nx-screen__chip">What opens</span>
          </div>
        </div>
      </section>

      <section class="nx-section" id="install" aria-labelledby="install-title">
        <div class="nx-section__head">
          <p class="nx-overline">Install</p>
          <h2 class="nx-h2" id="install-title">Three steps. Same destination.</h2>
        </div>
        <ol class="nx-steps nx-steps--row">
          <li class="nx-step nx-reveal" data-install-step="1">
            <strong>Add the tap.</strong>
            <p><code>brew update &amp;&amp; brew tap --force RoachWares/roachnet</code></p>
          </li>
          <li class="nx-step nx-reveal" data-install-step="2">
            <strong>Install the cask.</strong>
            <p><code>brew install --cask roachnet</code></p>
          </li>
          <li class="nx-step nx-reveal" data-install-step="3">
            <strong>Launch.</strong>
            <p><code>open ~/RoachNet/app/RoachNet.app</code></p>
          </li>
        </ol>
        <div class="nx-actions nx-mt-32">
          <button class="nx-btn nx-btn--primary" data-homebrew-install type="button">Install with Homebrew</button>
          <a class="nx-btn" href="https://github.com/RoachWares/RoachNet/releases/latest/download/RoachNet-Setup-macOS.dmg">Download RoachNet Setup instead</a>
        </div>
      </section>

      <section class="nx-section" id="layout" aria-labelledby="layout-title">
        <div class="nx-section__head">
          <p class="nx-overline">What it installs</p>
          <h2 class="nx-h2" id="layout-title">What lands on disk.</h2>
        </div>
        <div class="nx-grid nx-grid--4" role="list">
          <article class="nx-card nx-reveal" role="listitem">
            <p class="nx-card__eyebrow">App bundle</p>
            <h3 class="nx-card__title"><code>~/RoachNet/app/RoachNet.app</code></h3>
            <p class="nx-card__body">The same app the Setup app installs, cleared so macOS opens it without a fight. The Setup app itself stays in <code>~/RoachNet/setup</code> for repairs.</p>
          </article>
          <article class="nx-card nx-reveal" role="listitem">
            <p class="nx-card__eyebrow">Storage root</p>
            <h3 class="nx-card__title"><code>~/RoachNet/storage</code></h3>
            <p class="nx-card__body">Models, logs, the vault and everything else live here. Nothing gets scattered into <code>/usr/local</code>, <code>/tmp</code>, or some staging folder you'll never find again.</p>
          </article>
          <article class="nx-card nx-reveal" role="listitem">
            <p class="nx-card__eyebrow">Local tools</p>
            <h3 class="nx-card__title"><code>~/RoachNet/bin</code></h3>
            <p class="nx-card__body">Helper tools sit next to the app. Clean install, clean uninstall, nothing left behind for future-you to curse at.</p>
          </article>
          <article class="nx-card nx-reveal" role="listitem">
            <p class="nx-card__eyebrow">Config writes</p>
            <h3 class="nx-card__title"><code>~/Library/Application Support/roachnet</code></h3>
            <p class="nx-card__body">A small settings file so the app knows where everything is the first time it opens. No scavenger hunt.</p>
          </article>
        </div>
      </section>

      <section class="nx-section" id="runtime" aria-labelledby="runtime-title">
        <div class="nx-section__head">
          <p class="nx-overline nx-overline--amber">Homebrew runtime</p>
          <h2 class="nx-h2" id="runtime-title">More than a <code>brew install</code> in a trenchcoat.</h2>
        </div>
        <div class="nx-grid nx-grid--3" role="list">
          <article class="nx-card nx-reveal" role="listitem">
            <p class="nx-card__eyebrow">Native installer</p>
            <h3 class="nx-card__title">The cask runs RoachNet's own Swift installer.</h3>
            <p class="nx-card__body">Preflight checks, a smoke test and a swap that keeps your storage. No Node, no source tree, nothing global.</p>
          </article>
          <article class="nx-card nx-reveal" role="listitem">
            <p class="nx-card__eyebrow">Launch-safe</p>
            <h3 class="nx-card__title">Clears only the quarantine flags that block a fresh download.</h3>
            <p class="nx-card__body">Nothing else gets touched.</p>
          </article>
          <article class="nx-card nx-reveal" role="listitem">
            <p class="nx-card__eyebrow">Cache that stays put</p>
            <h3 class="nx-card__title">Cache lives in <code>~/RoachNet/storage/state/runtime-cache</code>.</h3>
            <p class="nx-card__body">Not <code>/tmp</code>. It won't vanish on reboot and act surprised next launch.</p>
          </article>
          <article class="nx-card nx-reveal" role="listitem">
            <p class="nx-card__eyebrow">Safer first boot</p>
            <h3 class="nx-card__title">The phone bridge stays off until you turn it on.</h3>
            <p class="nx-card__body">If the first launch goes sideways, RoachNet tries to fix itself once before it bothers you.</p>
          </article>
          <article class="nx-card nx-reveal" role="listitem">
            <p class="nx-card__eyebrow">Logs in one place</p>
            <h3 class="nx-card__title">All logs live in <code>~/RoachNet/storage/logs</code>.</h3>
            <p class="nx-card__body">When something breaks, you know exactly where to look.</p>
          </article>
          <article class="nx-card nx-reveal" role="listitem">
            <p class="nx-card__eyebrow">Identical either way</p>
            <h3 class="nx-card__title">Same API and same behavior as the Setup app install.</h3>
            <p class="nx-card__body">Only the route is different.</p>
          </article>
        </div>
        <div class="nx-console nx-mt-24 nx-reveal">
          <div class="nx-console__bar"><i></i><i></i><i></i> Checksum · RoachNet-Setup-macOS.dmg</div>
          <div class="nx-console__body">
            <span class="nx-console__line">shasum -a 256 ~/Downloads/RoachNet-Setup-macOS.dmg</span>
            <span class="nx-console__line nx-console__line--out" id="dmg-sha">d7854ac9960ed8969e24db9f7e95d18df8b80c2d2333eaa7f164bb1c4a6f66bd</span>
          </div>
          <div class="nx-console__copy">
            <button class="nx-btn nx-btn--sm nx-btn--mono" data-nx-copy-target="#dmg-sha" data-nx-copied="Checksum copied" type="button">Copy</button>
          </div>
        </div>
        <p class="nx-prose nx-mt-16">The Setup app and Homebrew pull the exact same file from the public release, and the published <a class="nx-link" href="https://github.com/RoachWares/RoachNet/releases/download/v1.1.0/RoachNet-Setup-macOS.dmg.sha256" target="_blank" rel="noreferrer">checksum sidecar</a> is what the cask verifies against. Check it yourself.</p>
        <div class="nx-actions nx-mt-24">
          <a class="nx-btn" href="https://roachnet.org/api/">Read the API docs</a>
          <a class="nx-btn" href="https://github.com/RoachWares/homebrew-roachnet" target="_blank" rel="noreferrer">Read the cask</a>
        </div>
      </section>
    </main>
'''

SITEMAP_BODY = '''
    <main id="top" class="nx-main" tabindex="-1">
      <section class="nx-hero nx-hero--center nx-section--tight" aria-labelledby="hero-title">
        <div class="nx-hero__copy">
          <p class="nx-overline">Sitemap</p>
          <h1 class="nx-display" id="hero-title">Everything, <span class="nx-accent">one page.</span></h1>
          <p class="nx-lede">Pages, downloads, docs, release notes, all of it laid out flat. Nobody needs another little maze dressed up as navigation.</p>
          <ul class="nx-status" aria-label="Current versions">
            <li data-state="online">macOS v1.1.0</li>
            <li data-state="online">iOS v0.3.1</li>
          </ul>
        </div>
      </section>

      <section class="nx-section nx-section--tight" aria-label="RoachNet pages">
        <div class="nx-grid nx-grid--2 nx-sitemap">
          <article class="nx-card nx-reveal">
            <p class="nx-card__eyebrow">Core product</p>
            <h2 class="nx-card__title">RoachNet</h2>
            <ul class="nx-sitemap__list">
              <li><a class="nx-link nx-link--arrow" href="https://roachnet.org/">Mission</a><p>Why this whole thing exists.</p></li>
              <li><a class="nx-link nx-link--arrow" href="https://roachnet.org/home/">Home</a><p>The Mac tour: screenshots, downloads and a quick read on what RoachNet does.</p></li>
              <li><a class="nx-link nx-link--arrow" href="https://apps.roachnet.org/">Apps</a><p>Maps, libraries, courses, field guides, voice packs and models that land straight in the app.</p></li>
              <li><a class="nx-link nx-link--arrow" href="https://roachnet.org/roachclaw/">RoachClaw</a><p>AI chat in the browser, or on your own machine when the question is nobody else's business.</p></li>
            </ul>
          </article>
          <article class="nx-card nx-reveal">
            <p class="nx-card__eyebrow">Downloads</p>
            <h2 class="nx-card__title">Get the app</h2>
            <ul class="nx-sitemap__list">
              <li><a class="nx-link nx-link--arrow" href="https://github.com/RoachWares/RoachNet/releases/latest/download/RoachNet-Setup-macOS.dmg">macOS installer</a><p>Start here. Built for Apple Silicon.</p></li>
              <li><a class="nx-link nx-link--arrow" href="https://roachnet.org/brew/">Homebrew</a><p>Same app, same <code>~/RoachNet</code> folder, one command in Terminal.</p></li>
              <li><a class="nx-link nx-link--arrow" href="https://roachnet.org/ios/">RoachNet iOS</a><p>The iPhone and iPad companion, via SideStore or AltStore.</p></li>
              <li><a class="nx-link nx-link--arrow" href="https://raw.githubusercontent.com/RoachWares/RoachNet-SideStore/main/apps.json">Shared iOS source</a><p>The AltSource feed used by SideStore and AltStore.</p></li>
            </ul>
          </article>
          <article class="nx-card nx-reveal">
            <p class="nx-card__eyebrow">On the web</p>
            <h2 class="nx-card__title">Accounts and services</h2>
            <ul class="nx-sitemap__list">
              <li><a class="nx-link nx-link--arrow" href="https://accounts.roachnet.org/">Account</a><p>Optional. Holds your web RoachClaw chats, saved apps and a device list. The rest stays home.</p></li>
              <li><a class="nx-link nx-link--arrow" href="https://roachnet.org/api/">API</a><p>The v1.1 reference for setup, runtime, RoachTail, RoachClaw, Org and feature packs.</p></li>
              <li><a class="nx-link nx-link--arrow" href="https://www.roachwares.org/">RoachWares</a><p>The company behind the software.</p></li>
              <li><a class="nx-link nx-link--arrow" href="https://www.roachwares.org/about/">About RoachWares</a><p>Who builds it, and the rules it is built by.</p></li>
            </ul>
          </article>
          <article class="nx-card nx-reveal">
            <p class="nx-card__eyebrow">Out in the open</p>
            <h2 class="nx-card__title">Source and docs</h2>
            <ul class="nx-sitemap__list">
              <li><a class="nx-link nx-link--arrow" href="https://github.com/RoachWares/RoachNet" target="_blank" rel="noreferrer">Source code and releases</a><p>Code, checksums, releases and docs, all readable before you trust any of it.</p></li>
              <li><a class="nx-link nx-link--arrow" href="https://github.com/RoachWares/RoachNet/releases/latest" target="_blank" rel="noreferrer">Latest release</a><p>What shipped, and when.</p></li>
              <li><a class="nx-link nx-link--arrow" href="https://github.com/RoachWares/RoachNet/wiki" target="_blank" rel="noreferrer">Wiki</a><p>Install notes, setup docs and fixes for when things go sideways.</p></li>
              <li><a class="nx-link nx-link--arrow" href="https://github.com/RoachWares/homebrew-roachnet" target="_blank" rel="noreferrer">Homebrew tap</a><p>The cask, if you'd rather read it than run it.</p></li>
              <li><a class="nx-link nx-link--arrow" href="https://github.com/RoachWares/RoachNet-Maps/releases/tag/maps-2026-10" target="_blank" rel="noreferrer">Map packs</a><p>Offline maps for every state, DC and territory, each with its checksum.</p></li>
            </ul>
          </article>
        </div>
      </section>
    </main>
'''

def build(page):
    page(
        "ios/index.html",
        title="RoachNet iOS: RoachNet in your pocket",
        description="RoachNet iOS 0.3.1 puts your Mac's RoachClaw, library and vault on your iPhone or iPad. Sideload with SideStore or AltStore and pair over your own RoachTail link.",
        canonical="https://roachnet.org/ios/",
        image="https://roachnet.org/assets/screens/roachnet-ios-020-home.webp",
        rel="../",
        current="ios",
        sub="iOS · v0.3.1",
        body=IOS_BODY,
        scripts='    <script src="../app.js" type="module"></script>\n    <script src="../nx.js" type="module"></script>\n    <script src="./ios-install.js"></script>\n',
        extra_head='    <link rel="preload" as="image" href="../assets/screens/roachnet-ios-020-home.webp" />\n',
    )
    page(
        "brew/index.html",
        title="RoachNet Brew: Three commands to ~/RoachNet",
        description="Install RoachNet 1.1.0 with Homebrew. Same app, same ~/RoachNet folder, same checksum as the Setup app, no setup window.",
        canonical="https://roachnet.org/brew/",
        image="https://roachnet.org/assets/screens/roachnet-native-home.webp",
        rel="../",
        current="brew",
        sub="Brew · v1.1.0",
        body=BREW_BODY,
        scripts='    <script src="../site-config.js"></script>\n    <script src="../app.js" type="module"></script>\n    <script src="../nx.js" type="module"></script>\n',
    )
    page(
        "sitemap/index.html",
        title="RoachNet Sitemap",
        description="Every RoachNet page, download, doc and release note on one page.",
        canonical="https://roachnet.org/sitemap/",
        image="https://roachnet.org/assets/screens/roachnet-native-home.webp",
        rel="../",
        current="sitemap",
        sub="Sitemap",
        body=SITEMAP_BODY,
        scripts='    <script src="../site-config.js"></script>\n    <script src="../app.js" type="module"></script>\n    <script src="../nx.js" type="module"></script>\n',
    )
