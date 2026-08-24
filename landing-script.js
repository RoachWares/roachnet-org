const progressBar = document.querySelector('.landing-scroll-progress')
const downloadButton = document.querySelector('[data-landing-download-button]')
const downloadStatus = document.querySelector('[data-landing-download-status]')

function syncScrollProgress() {
  if (!progressBar) return
  const scrollable = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
  progressBar.style.width = `${Math.min(100, Math.max(0, (window.scrollY / scrollable) * 100)).toFixed(2)}%`
}

function startDownload() {
  window.location.assign('https://roachnet.org/home/')
}

window.addEventListener('scroll', syncScrollProgress, { passive: true })
syncScrollProgress()

if (downloadButton) downloadButton.addEventListener('click', startDownload)
window.addEventListener('keydown', (event) => {
  if (event.shiftKey && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'r') {
    event.preventDefault()
    if (downloadStatus) downloadStatus.textContent = 'Opening Home to start the macOS download.'
    startDownload()
  }
})
