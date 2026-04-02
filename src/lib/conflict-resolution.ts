/**
 * Conflict resolution for null game_id items.
 * Shows a carousel-style modal letting users Import or Skip each conflicting item.
 */

import { getImageUrl } from './constants.js'
import { t } from './i18n.js'

export type ConflictDecision = 'import' | 'skip'

interface ConflictItem {
  game_id: string
  granblue_id?: string
  name: string
}

let conflictItems: ConflictItem[] = []
let decisions = new Map<string, ConflictDecision>()
let currentIndex = 0
let currentDataType: string | null = null
let onResolveCallback:
  | ((result: Map<string, ConflictDecision>) => void)
  | null = null

export function showConflictModal(
  conflicts: ConflictItem[],
  dataType: string,
  onResolve: (result: Map<string, ConflictDecision>) => void
): void {
  conflictItems = conflicts
  currentDataType = dataType
  onResolveCallback = onResolve
  currentIndex = 0
  decisions.clear()

  renderCurrentItem()
  updateNavState()

  const modal = document.getElementById('conflictModal')
  modal?.classList.remove('hidden')
}

export function hideConflictModal(): void {
  const modal = document.getElementById('conflictModal')
  modal?.classList.add('hidden')
  conflictItems = []
  decisions.clear()
  currentIndex = 0
  onResolveCallback = null
}

export function getConflictCount(): number {
  return conflictItems.length
}

export function initConflictListeners(): void {
  document
    .getElementById('conflictPrev')
    ?.addEventListener('click', () => navigateConflict(-1))
  document
    .getElementById('conflictNext')
    ?.addEventListener('click', () => navigateConflict(1))
  document
    .getElementById('conflictSkip')
    ?.addEventListener('click', () => decideItem('skip'))
  document
    .getElementById('conflictImport')
    ?.addEventListener('click', () => decideItem('import'))
  document.getElementById('conflictSkipAll')?.addEventListener('click', skipAll)
  document
    .getElementById('conflictImportAll')
    ?.addEventListener('click', importAll)
  document
    .getElementById('conflictFinish')
    ?.addEventListener('click', finishReview)

  document
    .querySelector('#conflictModal .modal-backdrop')
    ?.addEventListener('click', hideConflictModal)
}

// ==========================================
// INTERNAL FUNCTIONS
// ==========================================

function renderCurrentItem(): void {
  const display = document.getElementById('conflictItemDisplay')
  if (!display || conflictItems.length === 0) return

  const item = conflictItems[currentIndex]!
  const imageUrl = getConflictImageUrl(item.granblue_id)
  const decision = decisions.get(item.game_id)

  let decisionBadge = ''
  if (decision === 'import') {
    decisionBadge = `<span class="conflict-badge conflict-badge-import">${t('action_import')}</span>`
  } else if (decision === 'skip') {
    decisionBadge = `<span class="conflict-badge conflict-badge-skip">${t('conflict_skip')}</span>`
  }

  display.innerHTML = `
    <div class="conflict-item">
      <div class="conflict-item-image">
        <img src="${imageUrl}" alt="${item.name}">
        ${decisionBadge}
      </div>
      <p class="conflict-item-name">${item.name}</p>
    </div>
  `

  const counter = document.getElementById('conflictCounter')
  if (counter) {
    counter.textContent = `${currentIndex + 1} / ${conflictItems.length}`
  }

  const skipBtn = document.getElementById('conflictSkip')
  const importBtn = document.getElementById('conflictImport')
  if (skipBtn) {
    skipBtn.classList.toggle('active', decision === 'skip')
  }
  if (importBtn) {
    importBtn.classList.toggle('active', decision === 'import')
  }

  updateFinishButton()
}

function navigateConflict(direction: number): void {
  const newIndex = currentIndex + direction
  if (newIndex < 0 || newIndex >= conflictItems.length) return
  currentIndex = newIndex
  renderCurrentItem()
  updateNavState()
}

function updateNavState(): void {
  const prevBtn = document.getElementById(
    'conflictPrev'
  ) as HTMLButtonElement | null
  const nextBtn = document.getElementById(
    'conflictNext'
  ) as HTMLButtonElement | null
  if (prevBtn) prevBtn.disabled = currentIndex === 0
  if (nextBtn) nextBtn.disabled = currentIndex === conflictItems.length - 1
}

function decideItem(decision: ConflictDecision): void {
  const item = conflictItems[currentIndex]!
  decisions.set(item.game_id, decision)
  renderCurrentItem()

  const nextUndecided = findNextUndecided(currentIndex)
  if (nextUndecided !== -1) {
    currentIndex = nextUndecided
    renderCurrentItem()
    updateNavState()
  }
}

function findNextUndecided(fromIndex: number): number {
  for (let i = fromIndex + 1; i < conflictItems.length; i++) {
    if (!decisions.has(conflictItems[i]!.game_id)) return i
  }
  for (let i = 0; i < fromIndex; i++) {
    if (!decisions.has(conflictItems[i]!.game_id)) return i
  }
  return -1
}

function importAll(): void {
  for (const item of conflictItems) {
    decisions.set(item.game_id, 'import')
  }
  renderCurrentItem()
  updateFinishButton()
}

function skipAll(): void {
  for (const item of conflictItems) {
    decisions.set(item.game_id, 'skip')
  }
  renderCurrentItem()
  updateFinishButton()
}

function updateFinishButton(): void {
  const finishBtn = document.getElementById(
    'conflictFinish'
  ) as HTMLButtonElement | null
  if (!finishBtn) return

  const allDecided = conflictItems.every((item) => decisions.has(item.game_id))
  finishBtn.disabled = !allDecided

  const decidedCount = decisions.size
  finishBtn.textContent = allDecided
    ? t('action_done')
    : t('conflict_decided', {
        count: decidedCount,
        total: conflictItems.length
      })
}

function finishReview(): void {
  const allDecided = conflictItems.every((item) => decisions.has(item.game_id))
  if (!allDecided) return

  const result = new Map(decisions)
  const callback = onResolveCallback
  hideConflictModal()

  if (callback) {
    callback(result)
  }
}

function getConflictImageUrl(granblueId: string | undefined): string {
  if (!granblueId) return ''

  if (currentDataType?.includes('weapon')) {
    return getImageUrl(`weapon-square/${granblueId}.jpg`)
  }
  if (currentDataType?.includes('summon')) {
    return getImageUrl(`summon-square/${granblueId}.jpg`)
  }
  return ''
}
