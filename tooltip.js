/**
 * @fileoverview Portal tooltip system.
 * A single fixed-position div renders above all content,
 * avoiding overflow clipping and z-index issues.
 */

let tooltipEl = null
let activeTarget = null

export function initTooltip() {
  tooltipEl = document.getElementById('tooltip')
  if (!tooltipEl) return

  document.body.addEventListener('mouseover', onMouseOver)
  document.body.addEventListener('mouseout', onMouseOut)

  // Hide on scroll in any scrollable container
  document.addEventListener('scroll', hide, true)
}

function onMouseOver(e) {
  const target = e.target.closest('[data-tooltip]')
  if (!target || !target.dataset.tooltip) return

  activeTarget = target
  show(target)
}

function onMouseOut(e) {
  const related = e.relatedTarget
  if (
    related &&
    related.closest &&
    related.closest('[data-tooltip]') === activeTarget
  )
    return
  const target = e.target.closest('[data-tooltip]')
  if (!target) return
  if (target === activeTarget) hide()
}

function show(target) {
  tooltipEl.innerHTML = target.dataset.tooltip

  // Position off-screen to measure
  tooltipEl.style.left = '-9999px'
  tooltipEl.style.top = '-9999px'
  tooltipEl.classList.add('visible')

  // Force layout so we can measure
  const tipRect = tooltipEl.getBoundingClientRect()
  const rect = target.getBoundingClientRect()
  const gap = 6

  // Center horizontally on the target
  let left = rect.left + (rect.width - tipRect.width) / 2
  left = Math.max(4, Math.min(left, window.innerWidth - tipRect.width - 4))

  // Prefer above; fall back to below if not enough room
  let top = rect.top - tipRect.height - gap
  let placement = 'above'
  if (top < 4) {
    top = rect.bottom + gap
    placement = 'below'
  }

  tooltipEl.style.left = `${left}px`
  tooltipEl.style.top = `${top}px`
  tooltipEl.dataset.placement = placement
}

function hide() {
  if (!tooltipEl) return
  tooltipEl.classList.remove('visible')
  activeTarget = null
}
