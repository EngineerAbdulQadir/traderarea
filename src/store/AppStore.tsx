import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Account, AccountType, Note, NotesByAccount, Platform, Rules, Stage, Trade } from '@/lib/types'
import {
  effectivePhaseHistory,
  latestTradeKey,
  nextStageFor,
  titleFor,
  tradePhaseKey,
  tradesForPhase,
  createDemoAccount,
} from '@/lib/accounts'
import { fundedAccountSize, getFirm, rulesFor } from '@/data/firms'
import { getDemoTrades } from '@/lib/demo'
import { getStartingBalance } from '@/lib/stats'
import { mergeImportedTrades } from '@/lib/trades'
import { seedDemoNotes } from '@/lib/notes'
import {
  isDemoAccount,
  readAccounts,
  readActiveAccountId,
  readNotes,
  readTrades,
  realTradesForAccount,
  requestDashboardRangeReset,
  resolveTrades,
  STORAGE_KEYS,
  writeAccounts,
  writeActiveAccountId,
  writeNotes,
  writeTrades,
} from '@/lib/persistence'
import { readStorage, writeStorage } from '@/lib/storage'
import { isFirebaseConfigured } from '@/lib/firebase'
import {
  deleteCloudWorkspace,
  hasCloudWorkspace,
  markUserFreeSlotConsumed,
  notesForCache,
  pushWorkspaceToCloud,
  readUserFreeSlotConsumed,
  reviewCloudPartnerVerification,
  submitCloudPartnerVerification,
  subscribeAccounts,
  subscribeNotes,
  subscribeTrades,
  subscribeUserPartnerVerifications,
  syncAccounts,
  syncNotes,
  syncTrades,
} from '@/lib/cloud'
import {
  computePartnerSlotSummary,
  readFreeSlotConsumed,
  readLocalVerifications,
  writeFreeSlotConsumed,
  writeLocalVerifications,
  type PartnerSlotSummary,
  type PartnerVerificationRequest,
} from '@/lib/partner'
import { isAuthorizedOwner, hasDevOwnerSession } from '@/lib/access'
import { authErrorMessage, useAuth } from '@/store/AuthProvider'

export type SyncStatus = 'local' | 'checking' | 'migration' | 'syncing' | 'ready' | 'error'


export type ToastTone = 'success' | 'error' | 'info'

export interface ToastItem {
  id: string
  title: string
  message: string
  tone: ToastTone
}

interface TradeEditorState {
  trade: Trade | null
  accountId?: string
}

interface DayReviewState {
  date: string
  editNote?: boolean
}

export interface AccountUpdatePatch {
  name?: string
  firmId?: string
  type?: AccountType
  stage?: Stage
  platform?: Platform
  challengeSize?: number
  rules?: Rules
}

interface AppContextValue {
  accounts: Account[]
  activeAccount: Account | null
  activeAccountId: string
  viewingPhaseIndex: number | null
  setViewingPhase: (index: number | null) => void
  activeTrades: Trade[]
  activeIsDemo: boolean
  activeNotes: Record<string, Note>
  workspaceTrades: Trade[]
  storedTradeCount: number
  setActiveAccount: (id: string) => void
  addAccount: (account: Account) => void
  updateAccount: (id: string, patch: AccountUpdatePatch) => void
  advanceAccount: (id: string) => void
  removeAccount: (id: string) => void
  addDemoAccount: (tone?: 'profitable' | 'loss') => void
  getTradesForAccount: (account: Account) => Trade[]
  getAllTradesForAccount: (account: Account) => Trade[]
  isDemo: (account: Account | null | undefined) => boolean
  saveTrade: (trade: Trade) => void
  importTrades: (trades: Trade[]) => void
  deleteTrade: (id: string) => void
  saveNote: (accountId: string, date: string, text: string, images?: string[]) => void
  journalRevision: number
  challengeOpen: boolean
  editingAccount: Account | null
  openChallenge: () => void
  openEditChallenge: (account: Account) => void
  closeChallenge: () => void
  tradeEditor: TradeEditorState | null
  openTradeEditor: (options?: { trade?: Trade | null; accountId?: string }) => void
  closeTradeEditor: () => void
  dayReview: DayReviewState | null
  openDayReview: (date: string, options?: { editNote?: boolean }) => void
  closeDayReview: () => void
  commandOpen: boolean
  setCommandOpen: (open: boolean) => void
  settingsOpen: boolean
  openSettings: () => void
  closeSettings: () => void
  plansOpen: boolean
  plansReason: 'browse' | 'limit-reached'
  openPlans: (reason?: 'browse' | 'limit-reached') => void
  closePlans: () => void
  partnerSummary: PartnerSlotSummary
  partnerVerifications: PartnerVerificationRequest[]
  submitPartnerVerification: (input: {
    ezeEmail: string
    orderId: string
    challengeSize: number
  }) => Promise<PartnerVerificationRequest>
  reviewPartnerVerification: (id: string, status: 'approved' | 'rejected') => Promise<void>
  toasts: ToastItem[]
  showToast: (title: string, message: string, tone?: ToastTone) => void
  dismissToast: (id: string) => void
  /** Where the workspace currently syncs to. */
  syncStatus: SyncStatus
  cloudUserId: string | null
  migrating: boolean
  migrateWorkspace: () => Promise<void>
  skipMigration: () => void
  retrySync: () => void
  clearCloudWorkspace: () => Promise<void>
}

const AppContext = createContext<AppContextValue | null>(null)

let toastCounter = 0

export function AppProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const cloudUserId = isFirebaseConfigured ? user?.uid ?? null : null
  const [accounts, setAccounts] = useState<Account[]>(() => readAccounts())
  const [trades, setTrades] = useState<Trade[]>(() => readTrades())
  const [notes, setNotes] = useState<NotesByAccount>(() => readNotes())
  const [activeAccountId, setActiveAccountId] = useState<string>(() => readActiveAccountId())
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(isFirebaseConfigured ? 'checking' : 'local')
  const [migrating, setMigrating] = useState(false)
  const [connectionAttempt, setConnectionAttempt] = useState(0)
  const syncedAccounts = useRef<Account[] | null>(null)
  const syncedTrades = useRef<Trade[] | null>(null)
  const syncedNotes = useRef<NotesByAccount | null>(null)
  const bootstrapDone = useRef(false)
  const lastCloudUid = useRef<string | null>(null)
  const [challengeOpen, setChallengeOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [tradeEditor, setTradeEditor] = useState<TradeEditorState | null>(null)
  const [dayReview, setDayReview] = useState<DayReviewState | null>(null)
  const [commandOpen, setCommandOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [plansOpen, setPlansOpen] = useState(false)
  const [plansReason, setPlansReason] = useState<'browse' | 'limit-reached'>('browse')
  const [freeSlotConsumed, setFreeSlotConsumed] = useState<boolean>(() =>
    readFreeSlotConsumed(isFirebaseConfigured ? user?.uid ?? null : null),
  )
  const [partnerVerifications, setPartnerVerifications] = useState<PartnerVerificationRequest[]>(() =>
    readLocalVerifications(),
  )
  const [viewingPhaseIndex, setViewingPhaseIndex] = useState<number | null>(null)
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [journalRevision, setJournalRevision] = useState(0)
  const timers = useRef<Map<string, number>>(new Map())

  const baseAccount = useMemo(
    () => accounts.find((account) => account.id === activeAccountId) ?? accounts[0] ?? null,
    [accounts, activeAccountId],
  )

  const activeAccount = useMemo(() => {
    if (!baseAccount || viewingPhaseIndex === null) return baseAccount
    const history = effectivePhaseHistory(baseAccount)
    const views = [
      ...history.map((record) => ({
          stage: record.stage,
          startingBalance: record.startingBalance,
          rules: record.rules,
          endedAt: record.endedAt,
        })),
      {
        stage: baseAccount.stage,
        startingBalance: getStartingBalance(baseAccount),
        rules: baseAccount.rules,
        endedAt: '',
      },
    ]
    const phase = views[viewingPhaseIndex]
    if (!phase) return baseAccount
    return {
      ...baseAccount,
      stage: phase.stage,
      startingBalance: phase.startingBalance,
      rules: phase.rules,
      size: phase.startingBalance,
    }
  }, [baseAccount, trades, viewingPhaseIndex])

  const activeTrades = useMemo(() => {
    if (!baseAccount) return []
    const allTrades = resolveTrades(trades, baseAccount)
    if (viewingPhaseIndex === null) return tradesForPhase(baseAccount, allTrades)

    const history = effectivePhaseHistory(baseAccount)
    const views = [
      ...history.map((record, index) => {
        const previous = index > 0 ? history[index - 1] : null
        return { endedAt: record.endedAt, previousEndedAt: previous?.endedAt ?? '' }
      }),
      { endedAt: '', previousEndedAt: history.length ? history[history.length - 1].endedAt : '' },
    ]
    const phase = views[viewingPhaseIndex]
    if (!phase) return tradesForPhase(baseAccount, allTrades)
    return allTrades.filter((trade) => {
      const key = tradePhaseKey(trade)
      return (!phase.previousEndedAt || key > phase.previousEndedAt) && (!phase.endedAt || key <= phase.endedAt)
    })
  }, [baseAccount, trades, viewingPhaseIndex])

  const activeIsDemo = useMemo(() => isDemoAccount(trades, activeAccount), [trades, activeAccount])

  const activeNotes = useMemo(
    () => (activeAccount ? notes[activeAccount.id] ?? {} : {}),
    [notes, activeAccount],
  )

  const workspaceTrades = useMemo(
    () =>
      accounts
        .flatMap((account) => tradesForPhase(account, resolveTrades(trades, account)))
        .sort((a, b) => (a.date + a.openTime).localeCompare(b.date + b.openTime)),
    [accounts, trades],
  )

  useEffect(() => {
    writeAccounts(accounts)
  }, [accounts])

  useEffect(() => {
    writeTrades(trades)
  }, [trades])

  useEffect(() => {
    // Screenshots sync as separate Firestore docs, so never duplicate their
    // base64 payload into the localStorage cache.
    writeNotes(cloudUserId ? notesForCache(notes) : notes)
  }, [notes, cloudUserId])

  useEffect(() => {
    writeActiveAccountId(activeAccountId)
  }, [activeAccountId])

  useEffect(() => {
    if (!accounts.length) {
      if (activeAccountId) setActiveAccountId('')
      return
    }
    if (!accounts.some((account) => account.id === activeAccountId)) {
      setActiveAccountId(accounts[0].id)
    }
  }, [accounts, activeAccountId])

  // Seed a small notebook for sample accounts the first time they are opened.
  useEffect(() => {
    if (!activeAccount) return
    if (notes[activeAccount.id] !== undefined) return
    const resolved = resolveTrades(trades, activeAccount)
    const seeded = realTradesForAccount(trades, activeAccount.id).length ? {} : seedDemoNotes(resolved)
    setNotes((previous) => {
      if (previous[activeAccount.id] !== undefined) return previous
      return { ...previous, [activeAccount.id]: seeded }
    })
  }, [activeAccount, trades, notes])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (settingsOpen) return
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setCommandOpen((previous) => !previous)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [settingsOpen])

  const dismissToast = useCallback((id: string) => {
    setToasts((previous) => previous.filter((toast) => toast.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      window.clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const showToast = useCallback(
    (title: string, message: string, tone: ToastTone = 'success') => {
      const id = `toast-${Date.now().toString(36)}-${toastCounter++}`
      setToasts((previous) => [...previous.slice(-2), { id, title, message, tone }])
      const timer = window.setTimeout(() => {
        setToasts((previous) => previous.filter((toast) => toast.id !== id))
        timers.current.delete(id)
      }, 4600)
      timers.current.set(id, timer)
    },
    [],
  )

  useEffect(() => {
    const activeTimers = timers.current
    return () => {
      activeTimers.forEach((timer) => window.clearTimeout(timer))
    }
  }, [])

  /* ---------------------------------------------------------------- */
  /* Cloud sync (Firebase). Local storage still acts as an offline    */
  /* cache, so the app keeps working when the network drops.          */
  /* ---------------------------------------------------------------- */

  // Decide what to do for this user: pull cloud data, or offer a one-time
  // upload of the workspace that already lives in this browser.
  useEffect(() => {
    if (!isFirebaseConfigured) {
      setSyncStatus('local')
      return
    }
    if (authLoading) return
    if (!cloudUserId) {
      syncedAccounts.current = null
      syncedTrades.current = null
      syncedNotes.current = null
      setSyncStatus('local')
      return
    }

    let cancelled = false
    setSyncStatus('checking')
    const localHasData =
      accounts.length > 0 || trades.length > 0 || Object.keys(notes).length > 0

    hasCloudWorkspace(cloudUserId)
      .then((hasData) => {
        if (cancelled) return
        const choice = readStorage(`ta-cloud-choice-${cloudUserId}`, '')
        if (!hasData && localHasData && choice !== 'done' && choice !== 'skip') {
          setSyncStatus('migration')
          return
        }
        setSyncStatus('syncing')
      })
      .catch((error) => {
        if (cancelled) return
        setSyncStatus('error')
        showToast('Cloud unavailable', authErrorMessage(error), 'error')
      })

    return () => {
      cancelled = true
    }
    // Only the signed-in user, auth readiness or an explicit retry should re-run this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloudUserId, authLoading, connectionAttempt])

  const shouldSubscribe =
    Boolean(cloudUserId) && (syncStatus === 'syncing' || syncStatus === 'ready')

  // Signing out must never leave the previous account's journal in this browser
  // for whoever signs in next.
  useEffect(() => {
    if (!isFirebaseConfigured || authLoading) return
    if (!cloudUserId && lastCloudUid.current) {
      setAccounts([])
      setTrades([])
      setNotes({})
      setActiveAccountId('')
      ;[
        STORAGE_KEYS.accounts,
        STORAGE_KEYS.trades,
        STORAGE_KEYS.notes,
        STORAGE_KEYS.activeAccount,
      ].forEach((key) => {
        try {
          localStorage.removeItem(key)
        } catch {
          // Storage may be unavailable in private mode.
        }
      })
      bootstrapDone.current = false
    }
    lastCloudUid.current = cloudUserId
  }, [cloudUserId, authLoading])

  useEffect(() => {
    if (!cloudUserId || !shouldSubscribe) return
    let cancelled = false
    const seen = { accounts: false, trades: false, notes: false }

    const fail = (label: string) => (error: Error) => {
      if (cancelled) return
      setSyncStatus('error')
      showToast('Cloud sync failed', `${label}: ${authErrorMessage(error)}`, 'error')
    }

    const settle = (key: keyof typeof seen) => {
      if (cancelled) return
      seen[key] = true
      const loaded = Number(seen.accounts) + Number(seen.trades) + Number(seen.notes)
      if (loaded === 3) setSyncStatus('ready')
    }

    const unsubscribeAccounts = subscribeAccounts(
      cloudUserId,
      (list) => {
        syncedAccounts.current = list
        if (cancelled) return
        setAccounts(list)
        settle('accounts')
      },
      fail('accounts'),
    )
    const unsubscribeTrades = subscribeTrades(
      cloudUserId,
      (list) => {
        syncedTrades.current = list
        if (cancelled) return
        setTrades(list)
        settle('trades')
      },
      fail('trades'),
    )
    const unsubscribeNotes = subscribeNotes(
      cloudUserId,
      (list) => {
        syncedNotes.current = list
        if (cancelled) return
        setNotes(list)
        settle('notes')
      },
      fail('notes'),
    )

    return () => {
      cancelled = true
      unsubscribeAccounts()
      unsubscribeTrades()
      unsubscribeNotes()
    }
  }, [cloudUserId, shouldSubscribe, showToast])

  // Sync free-slot entitlement and partner verifications from Firestore (or local storage).
  useEffect(() => {
    const localConsumed = readFreeSlotConsumed(cloudUserId)
    const hasRealLocal = accounts.some((account) => account.source !== 'demo')
    if (localConsumed || hasRealLocal) {
      setFreeSlotConsumed(true)
      writeFreeSlotConsumed(cloudUserId, true)
    } else {
      setFreeSlotConsumed(false)
    }

    if (!isFirebaseConfigured || !cloudUserId) {
      setPartnerVerifications(readLocalVerifications())
      return
    }

    let cancelled = false
    readUserFreeSlotConsumed(cloudUserId)
      .then((consumed) => {
        if (cancelled) return
        if (consumed) {
          setFreeSlotConsumed(true)
          writeFreeSlotConsumed(cloudUserId, true)
        }
      })
      .catch(() => {
        // Keep local entitlement state if cloud read fails transiently.
      })

    const unsubscribeVerifications = subscribeUserPartnerVerifications(
      cloudUserId,
      (items) => {
        if (!cancelled) setPartnerVerifications(items)
      },
      () => {
        // Ignore transient verification listener errors.
      },
    )

    return () => {
      cancelled = true
      unsubscribeVerifications()
    }
  }, [cloudUserId, accounts])

  // Push only the documents that actually changed since the last snapshot.
  useEffect(() => {
    if (!cloudUserId || syncStatus !== 'ready') return
    const previous = syncedAccounts.current
    if (!previous || previous === accounts) return
    syncedAccounts.current = accounts
    syncAccounts(cloudUserId, previous, accounts).catch((error) => {
      showToast('Accounts not saved', authErrorMessage(error), 'error')
    })
  }, [accounts, cloudUserId, syncStatus, showToast])

  useEffect(() => {
    if (!cloudUserId || syncStatus !== 'ready') return
    const previous = syncedTrades.current
    if (!previous || previous === trades) return
    syncedTrades.current = trades
    syncTrades(cloudUserId, previous, trades).catch((error) => {
      showToast('Trade not saved', authErrorMessage(error), 'error')
    })
  }, [trades, cloudUserId, syncStatus, showToast])

  useEffect(() => {
    if (!cloudUserId || syncStatus !== 'ready') return
    const previous = syncedNotes.current
    if (!previous || previous === notes) return
    syncedNotes.current = notes
    syncNotes(cloudUserId, previous, notes).catch((error) => {
      showToast('Note not saved', authErrorMessage(error), 'error')
    })
  }, [notes, cloudUserId, syncStatus, showToast])

  // A fresh workspace still gets a friendly demo account, but only once,
  // and only after the cloud (or local) data has finished loading.
  useEffect(() => {
    if (bootstrapDone.current) return
    if (isFirebaseConfigured) {
      if (authLoading) return
      if (syncStatus !== 'local' && syncStatus !== 'ready') return
    }
    bootstrapDone.current = true
    if (accounts.length === 0) {
      const account = createDemoAccount()
      setAccounts([account])
      setActiveAccountId(account.id)
    }
  }, [accounts.length, authLoading, syncStatus])

  // Repair any previously advanced demo accounts that advanced before demo phase cutoffs were recorded.
  useEffect(() => {
    const broken = accounts.filter(
      (account) =>
        account.source === 'demo' &&
        (account.phaseHistory?.length ?? 0) > 0 &&
        !account.phaseStartedAt &&
        realTradesForAccount(trades, account.id).length === 0,
    )
    if (!broken.length) return

    const extraTrades: Trade[] = []
    const cutoffs = new Map<string, string>()

    broken.forEach((account) => {
      const history = account.phaseHistory ?? []
      const firstPhase = history[0]
      if (!firstPhase) return
      const snapshot: Account = {
        ...account,
        stage: firstPhase.stage,
        startingBalance: firstPhase.startingBalance,
        size: firstPhase.startingBalance,
        rules: firstPhase.rules,
      }
      const demoTrades = getDemoTrades(snapshot)
      const cutoff = latestTradeKey(demoTrades)
      if (!cutoff) return
      extraTrades.push(...demoTrades)
      cutoffs.set(account.id, cutoff)
    })

    if (!cutoffs.size) return

    if (extraTrades.length) {
      setTrades((previous) => {
        const existingIds = new Set(previous.map((item) => item.id))
        const added = extraTrades.filter((item) => !existingIds.has(item.id))
        if (!added.length) return previous
        return [...previous, ...added].sort((a, b) =>
          (a.date + a.openTime).localeCompare(b.date + b.openTime),
        )
      })
    }

    setAccounts((previous) =>
      previous.map((item) => {
        const cutoff = cutoffs.get(item.id)
        if (!cutoff) return item
        const updatedHistory = item.phaseHistory?.map((record) =>
          record.endedAt ? record : { ...record, endedAt: cutoff },
        )
        return {
          ...item,
          phaseStartedAt: cutoff,
          ...(updatedHistory ? { phaseHistory: updatedHistory } : {}),
        }
      }),
    )
  }, [accounts, trades])

  const migrateWorkspace = useCallback(async () => {
    if (!cloudUserId) return
    setMigrating(true)
    try {
      await pushWorkspaceToCloud(cloudUserId, accounts, trades, notes)
      writeStorage(`ta-cloud-choice-${cloudUserId}`, 'done')
      syncedAccounts.current = accounts
      syncedTrades.current = trades
      syncedNotes.current = notes
      setSyncStatus('syncing')
      showToast(
        'Workspace uploaded',
        `${accounts.length} account${accounts.length === 1 ? '' : 's'} and ${trades.length} trade${
          trades.length === 1 ? '' : 's'
        } now sync to your signed-in account.`,
      )
    } catch (error) {
      showToast('Upload failed', authErrorMessage(error), 'error')
    } finally {
      setMigrating(false)
    }
  }, [cloudUserId, accounts, trades, notes, showToast])

  const skipMigration = useCallback(() => {
    if (!cloudUserId) return
    writeStorage(`ta-cloud-choice-${cloudUserId}`, 'skip')
    setSyncStatus('syncing')
  }, [cloudUserId])

  const retrySync = useCallback(() => setConnectionAttempt((value) => value + 1), [])

  const clearCloudWorkspace = useCallback(async () => {
    if (!cloudUserId) return
    await deleteCloudWorkspace(cloudUserId)
  }, [cloudUserId])

  const setActiveAccount = useCallback((id: string) => {
    setActiveAccountId(id)
    setViewingPhaseIndex(null)
    setDayReview(null)
  }, [])

  const setViewingPhase = useCallback((index: number | null) => setViewingPhaseIndex(index), [])

  const addAccount = useCallback(
    (account: Account) => {
      setAccounts((previous) => [account, ...previous.filter((item) => item.id !== account.id)])
      setActiveAccountId(account.id)
      if (account.source !== 'demo') {
        setFreeSlotConsumed(true)
        writeFreeSlotConsumed(cloudUserId, true)
        if (cloudUserId && isFirebaseConfigured) {
          markUserFreeSlotConsumed(cloudUserId).catch(() => {
            // Local marker already persisted; cloud will sync on next write.
          })
        }
      }
    },
    [cloudUserId],
  )

  const updateAccount = useCallback(
    (id: string, patch: AccountUpdatePatch) => {
      setAccounts((previous) =>
        previous.map((item) => {
          if (item.id !== id) return item
          const next: Account = { ...item }
          if (patch.name !== undefined) {
            const trimmed = patch.name.trim()
            if (trimmed) next.name = trimmed
            else delete next.name
          }
          if (patch.firmId !== undefined) {
            const firm = getFirm(patch.firmId)
            next.firm = firm.name
            next.firmBadge = firm.badge
            next.firmGradient = firm.gradient
          }
          const nextType = patch.type ?? item.type
          const nextStage = patch.stage ?? item.stage
          const nextChallengeSize = patch.challengeSize ?? item.challengeSize ?? item.size
          if (patch.type !== undefined) next.type = patch.type
          if (patch.stage !== undefined) next.stage = patch.stage
          if (patch.platform !== undefined) next.platform = patch.platform
          if (patch.rules !== undefined) next.rules = patch.rules
          if (
            patch.challengeSize !== undefined ||
            patch.stage !== undefined ||
            patch.type !== undefined
          ) {
            const nextBalance =
              nextStage === 'Funded'
                ? fundedAccountSize(nextChallengeSize, nextType)
                : nextChallengeSize
            next.challengeSize = nextChallengeSize
            next.size = nextBalance
            next.startingBalance = nextBalance
          }
          return next
        }),
      )
    },
    [],
  )

  const advanceAccount = useCallback(
    (id: string) => {
      const account = accounts.find((item) => item.id === id)
      if (!account) return
      const nextStage = nextStageFor(account.type, account.stage)
      if (!nextStage) return

      const realTrades = realTradesForAccount(trades, id)
      const phaseTrades = tradesForPhase(account, resolveTrades(trades, account))
      const cutoff = latestTradeKey(phaseTrades)
      const funded = nextStage === 'Funded'
      const nextBalance = funded
        ? fundedAccountSize(account.challengeSize || account.size, account.type)
        : account.challengeSize || account.size
      const completedPhase = {
        stage: account.stage,
        startingBalance: account.startingBalance,
        rules: account.rules,
        endedAt: cutoff || account.phaseStartedAt || '',
        status: 'passed' as const,
      }

      if (realTrades.length === 0 && account.source === 'demo' && phaseTrades.length > 0) {
        setTrades((previous) => {
          const existingIds = new Set(previous.map((item) => item.id))
          const added = phaseTrades.filter((item) => !existingIds.has(item.id))
          if (!added.length) return previous
          return [...previous, ...added].sort((a, b) =>
            (a.date + a.openTime).localeCompare(b.date + b.openTime),
          )
        })
      }

      setAccounts((previous) =>
        previous.map((item) =>
          item.id === id
            ? {
                ...item,
                stage: nextStage,
                size: nextBalance,
                startingBalance: nextBalance,
                rules: rulesFor(item.type, nextStage) ?? item.rules,
                phaseStartedAt: cutoff || item.phaseStartedAt,
                phaseHistory: [...effectivePhaseHistory(item), completedPhase],
              }
            : item,
        ),
      )
      setActiveAccountId(id)
      showToast(
        funded ? 'Funded account unlocked' : 'Phase advanced',
        `${titleFor(account)} moved to ${nextStage} with ${nextBalance.toLocaleString('en-US', {
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: 0,
        })} in starting capital.`,
      )
    },
    [accounts, trades, showToast],
  )

  const removeAccount = useCallback(
    (id: string) => {
      setAccounts((previous) => {
        const next = previous.filter((account) => account.id !== id)
        if (activeAccountId === id) setActiveAccountId(next[0]?.id ?? '')
        return next
      })
      setNotes((previous) => {
        const next = { ...previous }
        delete next[id]
        return next
      })
      setTrades((previous) => previous.filter((trade) => trade.accountId !== id))
    },
    [activeAccountId],
  )

  const addDemoAccount = useCallback(
    (tone?: 'profitable' | 'loss') => {
      const account = createDemoAccount(tone)
      addAccount(account)
      const label =
        tone === 'profitable'
          ? 'Profitable demo ready'
          : tone === 'loss'
            ? 'Non-profitable demo ready'
            : 'Demo workspace ready'
      showToast(label, `${titleFor(account)} loaded with sample trades.`)
    },
    [addAccount, showToast],
  )

  const getTradesForAccount = useCallback(
    (account: Account) => tradesForPhase(account, resolveTrades(trades, account)),
    [trades],
  )

  const getAllTradesForAccount = useCallback(
    (account: Account) => resolveTrades(trades, account),
    [trades],
  )

  const isDemo = useCallback(
    (account: Account | null | undefined) => isDemoAccount(trades, account),
    [trades],
  )

  const saveTrade = useCallback(
    (trade: Trade) => {
      setTrades((previous) => {
        const index = previous.findIndex((item) => item.id === trade.id)
        const next = index >= 0 ? [...previous] : [...previous, trade]
        if (index >= 0) next[index] = trade
        return next.sort((a, b) => (a.date + a.openTime).localeCompare(b.date + b.openTime))
      })
      setActiveAccountId(trade.accountId)
      if (!accounts.some((account) => account.id === trade.accountId) && accounts.length) {
        setActiveAccountId(accounts[0].id)
      }
      setJournalRevision((value) => value + 1)
      requestDashboardRangeReset()
    },
    [accounts],
  )

  const deleteTrade = useCallback((id: string) => {
    setTrades((previous) => previous.filter((trade) => trade.id !== id))
    setJournalRevision((value) => value + 1)
    requestDashboardRangeReset()
  }, [])

  const importTrades = useCallback((incoming: Trade[]) => {
    if (!incoming.length) return
    setTrades((previous) => {
      const { next, added } = mergeImportedTrades(previous, incoming)
      return added.length ? next : previous
    })
    setJournalRevision((value) => value + 1)
    requestDashboardRangeReset()
  }, [])

  const saveNote = useCallback((accountId: string, date: string, text: string, images?: string[]) => {
    setNotes((previous) => {
      const accountNotes = { ...(previous[accountId] ?? {}) }
      const trimmed = text.trim()
      const existing = accountNotes[date]
      const noteImages = images !== undefined ? images : existing?.images
      if (trimmed || (noteImages && noteImages.length > 0)) {
        accountNotes[date] = {
          text: trimmed,
          updatedAt: new Date().toISOString(),
          images: noteImages && noteImages.length > 0 ? noteImages : undefined,
        }
      } else {
        delete accountNotes[date]
      }
      return { ...previous, [accountId]: accountNotes }
    })
  }, [])

  const partnerSummary = useMemo(
    () => computePartnerSlotSummary(accounts, freeSlotConsumed, partnerVerifications),
    [accounts, freeSlotConsumed, partnerVerifications],
  )

  const openPlans = useCallback((reason: 'browse' | 'limit-reached' = 'browse') => {
    setCommandOpen(false)
    setPlansReason(reason)
    setPlansOpen(true)
  }, [])

  const closePlans = useCallback(() => setPlansOpen(false), [])

  const submitPartnerVerification = useCallback(
    async (input: { ezeEmail: string; orderId: string; challengeSize: number }) => {
      const normalizedEzeEmail = input.ezeEmail.trim().toLowerCase()
      const cleanOrderId = input.orderId.trim()

      if (cloudUserId && isFirebaseConfigured) {
        const created = await submitCloudPartnerVerification({
          uid: cloudUserId,
          userEmail: user?.email ?? normalizedEzeEmail,
          ezeEmail: normalizedEzeEmail,
          orderId: cleanOrderId,
          challengeSize: input.challengeSize,
        })
        return created
      }

      const created: PartnerVerificationRequest = {
        id: `pv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
        uid: 'local',
        userEmail: user?.email ?? normalizedEzeEmail,
        ezeEmail: normalizedEzeEmail,
        orderId: cleanOrderId,
        challengeSize: input.challengeSize,
        status: 'pending',
        createdAt: new Date().toISOString(),
      }
      setPartnerVerifications((previous) => {
        const next = [created, ...previous]
        writeLocalVerifications(next)
        return next
      })
      return created
    },
    [cloudUserId, user?.email],
  )

  const reviewPartnerVerification = useCallback(
    async (id: string, status: 'approved' | 'rejected') => {
      const isOwner = isAuthorizedOwner(user) || hasDevOwnerSession()
      if (!isOwner) {
        throw new Error('Only authorized owners can review verification requests.')
      }
      const reviewer = user?.email ?? 'owner-local'

      if (cloudUserId && isFirebaseConfigured) {
        await reviewCloudPartnerVerification(id, status, reviewer)
        return
      }

      setPartnerVerifications((previous) => {
        const next = previous.map((item) =>
          item.id === id
            ? {
                ...item,
                status,
                reviewedAt: new Date().toISOString(),
                reviewedBy: reviewer,
              }
            : item,
        )
        writeLocalVerifications(next)
        return next
      })
    },
    [cloudUserId, user],
  )

  const openChallenge = useCallback(() => {
    setCommandOpen(false)
    setEditingAccount(null)
    if (!partnerSummary.canAddAccount) {
      setPlansReason('limit-reached')
      setPlansOpen(true)
      return
    }
    setChallengeOpen(true)
  }, [partnerSummary.canAddAccount])

  const openEditChallenge = useCallback((account: Account) => {
    setCommandOpen(false)
    setEditingAccount(account)
    setChallengeOpen(true)
  }, [])

  const closeChallenge = useCallback(() => {
    setChallengeOpen(false)
    setEditingAccount(null)
  }, [])

  const openSettings = useCallback(() => {
    setCommandOpen(false)
    setSettingsOpen(true)
  }, [])

  const closeSettings = useCallback(() => setSettingsOpen(false), [])

  const openTradeEditor = useCallback(
    (options?: { trade?: Trade | null; accountId?: string }) => {
      if (!accounts.length) {
        showToast('No account yet', 'Start a challenge first, then log trades to it.', 'info')
        return
      }
      setTradeEditor({ trade: options?.trade ?? null, accountId: options?.accountId })
    },
    [accounts.length, showToast],
  )

  const closeTradeEditor = useCallback(() => setTradeEditor(null), [])

  const openDayReview = useCallback(
    (date: string, options?: { editNote?: boolean }) => setDayReview({ date, editNote: options?.editNote }),
    [],
  )
  const closeDayReview = useCallback(() => setDayReview(null), [])

  const value = useMemo<AppContextValue>(
    () => ({
      accounts,
      activeAccount,
      activeAccountId: activeAccount?.id ?? '',
      viewingPhaseIndex,
      setViewingPhase,
      activeTrades,
      activeIsDemo,
      activeNotes,
      workspaceTrades,
      storedTradeCount: trades.length,
      setActiveAccount,
      addAccount,
      updateAccount,
      advanceAccount,
      removeAccount,
      addDemoAccount,
      getTradesForAccount,
      getAllTradesForAccount,
      isDemo,
      saveTrade,
      importTrades,
      deleteTrade,
      saveNote,
      journalRevision,
      challengeOpen,
      editingAccount,
      openChallenge,
      openEditChallenge,
      closeChallenge,
      tradeEditor,
      openTradeEditor,
      closeTradeEditor,
      dayReview,
      openDayReview,
      closeDayReview,
      commandOpen,
      setCommandOpen,
      settingsOpen,
      openSettings,
      closeSettings,
      plansOpen,
      plansReason,
      openPlans,
      closePlans,
      partnerSummary,
      partnerVerifications,
      submitPartnerVerification,
      reviewPartnerVerification,
      toasts,
      showToast,
      dismissToast,
      syncStatus,
      cloudUserId,
      migrating,
      migrateWorkspace,
      skipMigration,
      retrySync,
      clearCloudWorkspace,
    }),
    [
      accounts,
      activeAccount,
      viewingPhaseIndex,
      setViewingPhase,
      activeTrades,
      activeIsDemo,
      activeNotes,
      workspaceTrades,
      setActiveAccount,
      addAccount,
      updateAccount,
      advanceAccount,
      removeAccount,
      addDemoAccount,
      getTradesForAccount,
      getAllTradesForAccount,
      isDemo,
      saveTrade,
      importTrades,
      deleteTrade,
      saveNote,
      journalRevision,
      challengeOpen,
      editingAccount,
      openChallenge,
      openEditChallenge,
      closeChallenge,
      tradeEditor,
      openTradeEditor,
      closeTradeEditor,
      dayReview,
      openDayReview,
      closeDayReview,
      commandOpen,
      settingsOpen,
      openSettings,
      closeSettings,
      plansOpen,
      plansReason,
      openPlans,
      closePlans,
      partnerSummary,
      partnerVerifications,
      submitPartnerVerification,
      reviewPartnerVerification,
      toasts,
      showToast,
      dismissToast,
      syncStatus,
      cloudUserId,
      migrating,
      migrateWorkspace,
      skipMigration,
      retrySync,
      clearCloudWorkspace,
    ],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp must be used inside AppProvider')
  return context
}
