// Points the SideStore / AltStore buttons at the right thing for this device.
(() => {
  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

  const sideStoreSourceCTA = document.querySelector('[data-sidestore-source]')
  const sideStoreInstallCTA = document.querySelector('[data-sidestore-cta]')
  const downloadCTA = document.querySelector('[data-ipa-download]')
  const sideStoreNote = document.querySelector('[data-sidestore-note]')
  const sideStoreDesktopHint = document.querySelector('[data-sidestore-desktop]')
  const altStoreSourceCTA = document.querySelector('[data-altstore-source]')
  const altStoreInstallCTA = document.querySelector('[data-altstore-cta]')
  const altStoreNote = document.querySelector('[data-altstore-note]')
  const altStoreDesktopHint = document.querySelector('[data-altstore-desktop]')
  const sourceURL = 'https://raw.githubusercontent.com/RoachWares/RoachNet-SideStore/main/apps.json'
  // The page's own download link is the source of truth for the IPA URL.
  const ipaURL =
    downloadCTA?.getAttribute('href') ||
    'https://github.com/RoachWares/RoachNet-iOS/releases/latest/download/RoachNetiOS-v0.2.0-unsigned.ipa'

  if (isIOS) {
    if (sideStoreSourceCTA) {
      sideStoreSourceCTA.textContent = 'Add source to SideStore'
      sideStoreSourceCTA.href = sourceURL
    }
    if (sideStoreInstallCTA) {
      sideStoreInstallCTA.textContent = 'Install with SideStore'
      sideStoreInstallCTA.href = ipaURL
    }
    if (sideStoreNote) sideStoreNote.textContent = 'Add the RoachNet source in SideStore, or download the IPA and share it to SideStore to install.'
    if (sideStoreDesktopHint) sideStoreDesktopHint.hidden = true

    if (altStoreSourceCTA) {
      altStoreSourceCTA.textContent = 'Add source to AltStore'
      altStoreSourceCTA.href = sourceURL
    }
    if (altStoreInstallCTA) {
      altStoreInstallCTA.textContent = 'Install with AltStore'
      altStoreInstallCTA.href = ipaURL
    }
    if (altStoreNote) altStoreNote.textContent = 'Add the same RoachNet source in AltStore, or download the IPA and import it from Files.'
    if (altStoreDesktopHint) altStoreDesktopHint.hidden = true
    return
  }

  if (sideStoreSourceCTA) {
    sideStoreSourceCTA.textContent = 'View the source JSON'
    sideStoreSourceCTA.href = sourceURL
  }
  if (sideStoreInstallCTA) {
    sideStoreInstallCTA.textContent = 'Download IPA (for SideStore)'
    sideStoreInstallCTA.href = ipaURL
  }
  if (sideStoreNote) sideStoreNote.textContent = 'Add the source in SideStore, or get the IPA onto your iPhone or iPad and share it to SideStore.'
  if (sideStoreDesktopHint) sideStoreDesktopHint.hidden = false

  if (altStoreSourceCTA) {
    altStoreSourceCTA.textContent = 'View the source JSON'
    altStoreSourceCTA.href = sourceURL
  }
  if (altStoreInstallCTA) {
    altStoreInstallCTA.textContent = 'Download IPA (for AltStore)'
    altStoreInstallCTA.href = ipaURL
  }
  if (altStoreNote) altStoreNote.textContent = 'Add the same source in AltStore, or get the IPA onto your iPhone or iPad and import it from Files.'
  if (altStoreDesktopHint) altStoreDesktopHint.hidden = false
})()
