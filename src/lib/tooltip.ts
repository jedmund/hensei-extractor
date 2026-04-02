/**
 * Portal tooltip system.
 * A single fixed-position div renders above all content,
 * avoiding overflow clipping and z-index issues.
 */

let tooltipEl: HTMLElement | null = null
let activeTarget: HTMLElement | null = null

export function initTooltip(): void {
  tooltipEl = document.getElementById('tooltip')
  if (!tooltipEl) return

  document.body.addEventListener('mouseover', onMouseOver)
  document.body.addEventListener('mouseout', onMouseOut)

  // Hide on scroll in any scrollable container
  document.addEventListener('scroll', hide, true)
}

function onMouseOver(e: MouseEvent): void {
  const target = (e.target as HTMLElement).closest<HTMLElement>(
    '[data-tooltip]'
  )
  if (!target?.dataset.tooltip) return

  activeTarget = target
  show(target)
}

function onMouseOut(e: MouseEvent): void {
  const related = e.relatedTarget as HTMLElement | null
  if (related?.closest?.('[data-tooltip]') === activeTarget) return
  const target = (e.target as HTMLElement).closest<HTMLElement>(
    '[data-tooltip]'
  )
  if (!target) return
  if (target === activeTarget) hide()
}

function show(target: HTMLElement): void {
  if (!tooltipEl) return

  tooltipEl.innerHTML = target.dataset.tooltip!

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

function hide(): void {
  if (!tooltipEl) return
  tooltipEl.classList.remove('visible')
  activeTarget = null
}
