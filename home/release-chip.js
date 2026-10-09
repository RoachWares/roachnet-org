// Live release badge: fetch latest tag from GitHub and update chip
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
      const age = d.published_at
        ? (() => {
            const days = Math.floor((Date.now() - new Date(d.published_at)) / 86_400_000)
            return days === 0 ? 'today' : days === 1 ? '1 day ago' : `${days} days ago`
          })()
        : ''
      badge.textContent = d.tag_name + (age ? ` · ${age}` : '')
      badge.setAttribute('aria-label', `Latest RoachNet release ${d.tag_name}`)
    }
  } catch (_) {}
})()
