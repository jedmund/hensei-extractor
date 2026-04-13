import type { FormattedCacheStatus } from '../types/cache.js'

interface AuthAvatar {
  picture?: string
  element?: string
}

export interface AuthData {
  access_token?: string
  role?: number
  language?: string
  username?: string
  avatar?: AuthAvatar
  displayName?: string
  defaultImportVisibility?: number
  hasCrew?: boolean
  simplePortraits?: boolean
  user?: {
    username?: string
  }
}

export interface RaidSelection {
  id?: string | number
  slug?: string
  name?: string | { en?: string; ja?: string }
  level?: number
  group?: unknown
}

interface PlaylistSelection {
  id: string
  title: string
}

class AppState {
  // Locale (reactive mirror of paraglide locale)
  locale = $state<'en' | 'ja'>('en')

  // Auth
  auth = $state<AuthData | null>(null)
  noticeAcknowledged = $state(false)

  // Navigation
  activeTab = $state<'party' | 'collection' | 'database'>('party')
  detailViewActive = $state(false)
  currentDetailDataType = $state<string | null>(null)

  // Cache
  cachedStatus = $state<Record<string, FormattedCacheStatus>>({})

  // Detail view data
  detailData = $state<unknown>(null)

  // Selection
  selectedItems = $state(new Set<number>())
  manuallyUnchecked = $state(new Set<number>())
  brokenImageIndices = $state(new Set<number>())

  // Filters
  activeRarityFilters = $state(new Set(['4']))
  excludeLv1Items = $state(true)
  enableFullSync = $state(false)

  // Party import meta
  selectedVisibility = $state(3)
  shareWithCrew = $state(false)
  partyName = $state('')
  selectedRaid = $state<RaidSelection | null>(null)
  selectedPlaylists = $state<PlaylistSelection[]>([])

  // Conflict resolution
  pendingConflicts = $state<unknown[] | null>(null)
  conflictResolutions = $state<Record<string, 'import' | 'skip'> | null>(null)

  // UI state
  showingDisclaimer = $state(false)
  profilePopoverOpen = $state(false)
  toastMessage = $state('')
  toastVisible = $state(false)

  // Picker visibility
  raidPickerOpen = $state(false)
  raidRefresh = $state(false)
  playlistPickerOpen = $state(false)
  playlistCreateFormOpen = $state(false)
  playlistCreateSubmit = $state(false)
  playlistCreateReady = $state(false)

  // Modal visibility
  syncModalOpen = $state(false)
  conflictModalOpen = $state(false)

  // Sync preview data
  syncPreview = $state<{
    count: number
    willDelete: Array<{ name?: string; granblue_id?: string }>
  } | null>(null)

  // Import button state
  importState = $state<
    'idle' | 'importing' | 'imported' | 'checking' | 'review'
  >('idle')

  // Toast timer
  private toastTimer: ReturnType<typeof setTimeout> | undefined

  resetDetailState() {
    this.detailViewActive = false
    this.currentDetailDataType = null
    this.detailData = null
    this.selectedItems = new Set()
    this.manuallyUnchecked = new Set()
    this.brokenImageIndices = new Set()
    this.enableFullSync = false
    this.partyName = ''
    this.selectedRaid = null
    this.selectedPlaylists = []
    this.pendingConflicts = null
    this.conflictResolutions = null
    this.importState = 'idle'
  }

  showToast(message: string, duration = 3000) {
    this.toastMessage = message
    this.toastVisible = true
    clearTimeout(this.toastTimer)
    this.toastTimer = setTimeout(() => {
      this.toastVisible = false
    }, duration)
  }
}

export const app = new AppState()
