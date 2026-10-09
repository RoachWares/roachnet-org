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
  const ipaURL = 'https://github.com/RoachWares/RoachNet-iOS/releases/latest/download/RoachNetiOS-v0.1.5-unsigned.ipa'

  if (downloadCTA) {
    downloadCTA.href = ipaURL
  }

  if (isIOS) {
    if (sideStoreSourceCTA) {
      sideStoreSourceCTA.textContent = 'Add Source to SideStore'
      sideStoreSourceCTA.href = sourceURL
    }
    if (sideStoreInstallCTA) {
      sideStoreInstallCTA.textContent = 'Install with SideStore'
      sideStoreInstallCTA.href = ipaURL
    }
    if (sideStoreNote) sideStoreNote.textContent = 'Add the RoachNet source in SideStore, or download the IPA and share it to SideStore to install.'
    if (sideStoreDesktopHint) sideStoreDesktopHint.hidden = true

    if (altStoreSourceCTA) {
      altStoreSourceCTA.textContent = 'Add Source to AltStore'
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
    sideStoreSourceCTA.textContent = 'Open Shared Source JSON'
    sideStoreSourceCTA.href = sourceURL
  }
  if (sideStoreInstallCTA) {
    sideStoreInstallCTA.textContent = 'Download IPA (for SideStore)'
    sideStoreInstallCTA.href = ipaURL
  }
  if (sideStoreNote) sideStoreNote.textContent = 'Use the shared source in SideStore, or use this IPA with SideStore or AltStore on your iPhone or iPad.'
  if (sideStoreDesktopHint) sideStoreDesktopHint.hidden = false

  if (altStoreSourceCTA) {
    altStoreSourceCTA.textContent = 'Open Shared Source JSON'
    altStoreSourceCTA.href = sourceURL
  }
  if (altStoreInstallCTA) {
    altStoreInstallCTA.textContent = 'Download IPA (for AltStore)'
    altStoreInstallCTA.href = ipaURL
  }
  if (altStoreNote) altStoreNote.textContent = 'Use the same source URL in AltStore, or download the IPA and import it through AltStore on-device.'
  if (altStoreDesktopHint) altStoreDesktopHint.hidden = false
})()
