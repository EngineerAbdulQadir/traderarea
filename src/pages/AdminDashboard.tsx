import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  Download,
  ExternalLink,
  Layers,
  LayoutDashboard,
  RefreshCw,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  Users,
  X,
  XCircle,
} from 'lucide-react'
import logoDark from '../../assets/logodark.png'
import logoLight from '../../assets/logolight.png'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Segmented, type SegmentOption } from '@/components/ui/Segmented'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { useTheme } from '@/hooks/useTheme'
import { useApp } from '@/store/AppStore'
import { useAuth } from '@/store/AuthProvider'
import {
  hasDevOwnerSession,
  isAuthorizedOwner,
  isWaitlistOnly,
  ownerLoginPath,
} from '@/lib/access'
import { isFirebaseConfigured } from '@/lib/firebase'
import {
  listAllPartnerVerifications,
  listAllUserEntitlements,
  listWaitlistEntries,
  type WaitlistEntry,
} from '@/lib/cloud'
import {
  DEFAULT_ACCESS_POLICY,
  normalizeAccessPolicy,
  type AccessPolicyConfig,
  type PartnerVerificationRequest,
  type UserEntitlementRecord,
} from '@/lib/partner'
import { initialsFor } from '@/lib/profile'
import { cn } from '@/lib/cn'

type AdminTab = 'overview' | 'users' | 'verifications' | 'waitlist' | 'controls'
type VerificationFilter = 'all' | 'pending' | 'approved' | 'rejected'
type UserFilter = 'all' | 'trial' | 'expiring' | 'pending' | 'expired' | 'lifetime'

const STATUS_FILTERS: SegmentOption<VerificationFilter>[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Declined' },
]

const USER_FILTERS: SegmentOption<UserFilter>[] = [
  { value: 'all', label: 'All' },
  { value: 'trial', label: 'In Trial' },
  { value: 'expiring', label: 'Expiring ≤5d' },
  { value: 'pending', label: 'Pending Order' },
  { value: 'expired', label: 'Expired' },
  { value: 'lifetime', label: 'Lifetime' },
]

const DAY_MS = 86_400_000
const TRIAL_DAY_PRESETS = [7, 14, 30, 60]

function formatDate(iso?: string | null): string {
  if (!iso) return '—'
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return '—'
  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function statusLabel(status: PartnerVerificationRequest['status']): string {
  if (status === 'approved') return 'Approved · Lifetime +1'
  if (status === 'rejected') return 'Declined'
  return 'Pending'
}

function csvCell(value: string): string {
  const escaped = value.replace(/"/g, '""')
  return `"${escaped}"`
}

function policiesMatch(a: AccessPolicyConfig, b: AccessPolicyConfig): boolean {
  return (
    a.trialEnabled === b.trialEnabled &&
    a.freeTrialDays === b.freeTrialDays &&
    a.freeAccountSlots === b.freeAccountSlots &&
    a.requirePartnerAfterTrial === b.requirePartnerAfterTrial &&
    a.partnerUrl === b.partnerUrl &&
    a.partnerCode === b.partnerCode
  )
}

interface ComputedUserRow {
  record: UserEntitlementRecord
  approvedOrders: number
  pendingOrders: number
  rejectedOrders: number
  verifications: PartnerVerificationRequest[]
  latestVerification: PartnerVerificationRequest | null
  accountsUsed: number
  totalSlots: number
  trialEndsAt: string | null
  status: 'lifetime' | 'pending' | 'trial' | 'expired'
  statusText: string
  daysLeft: number
  trialPct: number
  expiringSoon: boolean
  canUseJournal: boolean
}

interface ActivityEvent {
  id: string
  uid?: string
  timestamp: string
  tone: 'pos' | 'warn' | 'neg' | 'info'
  title: string
  detail: string
}

export function AdminDashboardPage() {
  const navigate = useNavigate()
  const { isDark } = useTheme()
  const { user } = useAuth()
  const {
    accessPolicy,
    updateAccessPolicy,
    updateUserEntitlement,
    partnerSummary,
    partnerVerifications,
    reviewPartnerVerification,
    showToast,
  } = useApp()

  const isAdmin = isAuthorizedOwner(user) || hasDevOwnerSession()

  const [tab, setTab] = useState<AdminTab>('overview')
  const [statusFilter, setStatusFilter] = useState<VerificationFilter>('all')
  const [userFilter, setUserFilter] = useState<UserFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [userSearch, setUserSearch] = useState('')
  const [waitlistSearch, setWaitlistSearch] = useState('')

  const [cloudVerifications, setCloudVerifications] = useState<PartnerVerificationRequest[]>([])
  const [userRecords, setUserRecords] = useState<UserEntitlementRecord[]>([])
  const [waitlistEntries, setWaitlistEntries] = useState<WaitlistEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [decliningId, setDecliningId] = useState<string | null>(null)
  const [declineNote, setDeclineNote] = useState('')
  const [updatingUid, setUpdatingUid] = useState<string | null>(null)
  const [inspectedUid, setInspectedUid] = useState<string | null>(null)
  const [copiedKey, setCopiedKey] = useState<'partner' | 'admin' | null>(null)

  const [policyDraft, setPolicyDraft] = useState<AccessPolicyConfig>(accessPolicy)
  const [savingPolicy, setSavingPolicy] = useState(false)

  useEffect(() => {
    setPolicyDraft(accessPolicy)
  }, [accessPolicy])

  const loadAdminRecords = useCallback(async () => {
    if (!isAdmin) return
    if (!isFirebaseConfigured) {
      setCloudVerifications(partnerVerifications)
      setUserRecords([
        {
          uid: 'local',
          email: user?.email ?? 'local-trader@preview',
          name: user?.displayName ?? 'Local Workspace',
          accountsCount: partnerSummary.realAccountsCount,
          freeSlotConsumed: partnerSummary.usedSlots > 0,
          trialStartedAt: partnerSummary.trialStartedAt ?? new Date().toISOString(),
          trialBonusDays: partnerSummary.trialBonusDays,
          lifetimeGranted: partnerSummary.hasLifetimeAccess && partnerSummary.verifiedSlots === 0,
          lastActiveAt: new Date().toISOString(),
        },
      ])
      setWaitlistEntries([])
      setLoadError('')
      return
    }
    setLoading(true)
    setLoadError('')
    try {
      const [verificationsData, usersData, waitlistData] = await Promise.all([
        listAllPartnerVerifications(),
        listAllUserEntitlements(),
        listWaitlistEntries(),
      ])
      setCloudVerifications(verificationsData)
      setUserRecords(usersData)
      setWaitlistEntries(waitlistData)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load admin records.')
    } finally {
      setLoading(false)
    }
  }, [
    isAdmin,
    partnerVerifications,
    partnerSummary.realAccountsCount,
    partnerSummary.usedSlots,
    partnerSummary.trialStartedAt,
    partnerSummary.trialBonusDays,
    partnerSummary.hasLifetimeAccess,
    partnerSummary.verifiedSlots,
    user?.displayName,
    user?.email,
  ])

  useEffect(() => {
    loadAdminRecords()
  }, [loadAdminRecords])

  const verifications = useMemo(
    () => (isFirebaseConfigured ? cloudVerifications : partnerVerifications),
    [cloudVerifications, partnerVerifications],
  )

  const verificationsByUid = useMemo(() => {
    const map = new Map<string, PartnerVerificationRequest[]>()
    verifications.forEach((item) => {
      const existing = map.get(item.uid) ?? []
      existing.push(item)
      map.set(item.uid, existing)
    })
    map.forEach((items) =>
      items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
    )
    return map
  }, [verifications])

  const computedUsers = useMemo<ComputedUserRow[]>(() => {
    const now = Date.now()
    return userRecords.map((record) => {
      const userOrders = verificationsByUid.get(record.uid) ?? []
      const approvedOrders = userOrders.filter((item) => item.status === 'approved').length
      const pendingOrders = userOrders.filter((item) => item.status === 'pending').length
      const rejectedOrders = userOrders.filter((item) => item.status === 'rejected').length
      const latestVerification = userOrders[0] ?? null
      const accountsUsed = Math.max(record.accountsCount ?? 0, record.freeSlotConsumed ? 1 : 0)
      const totalSlots = accessPolicy.freeAccountSlots + approvedOrders

      const hasLifetime = Boolean(
        record.lifetimeGranted ||
          approvedOrders > 0 ||
          !accessPolicy.trialEnabled ||
          !accessPolicy.requirePartnerAfterTrial,
      )
      const totalDays = accessPolicy.freeTrialDays + (record.trialBonusDays ?? 0)
      const startMs = record.trialStartedAt ? Date.parse(record.trialStartedAt) : NaN
      const endMs = Number.isFinite(startMs) ? startMs + totalDays * DAY_MS : NaN
      const trialEndsAt = Number.isFinite(endMs) ? new Date(endMs).toISOString() : null
      const remainingMs = Number.isFinite(endMs) ? endMs - now : NaN
      const daysLeft = Number.isFinite(remainingMs)
        ? Math.max(0, Math.ceil(remainingMs / DAY_MS))
        : totalDays
      const expiredByTime = Number.isFinite(remainingMs) && remainingMs <= 0

      const trialPct = hasLifetime
        ? 100
        : totalDays > 0
          ? Math.max(0, Math.min(100, Math.round((daysLeft / totalDays) * 100)))
          : 0

      if (hasLifetime) {
        return {
          record,
          approvedOrders,
          pendingOrders,
          rejectedOrders,
          verifications: userOrders,
          latestVerification,
          accountsUsed,
          totalSlots,
          trialEndsAt,
          status: 'lifetime',
          statusText: approvedOrders > 0 ? 'Lifetime · Affiliate' : 'Lifetime · Granted',
          daysLeft: 0,
          trialPct: 100,
          expiringSoon: false,
          canUseJournal: true,
        }
      }

      if (pendingOrders > 0) {
        return {
          record,
          approvedOrders,
          pendingOrders,
          rejectedOrders,
          verifications: userOrders,
          latestVerification,
          accountsUsed,
          totalSlots,
          trialEndsAt,
          status: 'pending',
          statusText: expiredByTime ? 'Pending · Trial ended' : `Reviewing · ${daysLeft}d left`,
          daysLeft,
          trialPct,
          expiringSoon: !expiredByTime && daysLeft <= 5,
          canUseJournal: !expiredByTime,
        }
      }

      if (expiredByTime) {
        return {
          record,
          approvedOrders,
          pendingOrders,
          rejectedOrders,
          verifications: userOrders,
          latestVerification,
          accountsUsed,
          totalSlots,
          trialEndsAt,
          status: 'expired',
          statusText: 'Trial ended',
          daysLeft: 0,
          trialPct: 0,
          expiringSoon: false,
          canUseJournal: false,
        }
      }

      return {
        record,
        approvedOrders,
        pendingOrders,
        rejectedOrders,
        verifications: userOrders,
        latestVerification,
        accountsUsed,
        totalSlots,
        trialEndsAt,
        status: 'trial',
        statusText: `${daysLeft}d left`,
        daysLeft,
        trialPct,
        expiringSoon: daysLeft <= 5,
        canUseJournal: true,
      }
    })
  }, [userRecords, verificationsByUid, accessPolicy])

  const userByUid = useMemo(
    () => new Map(computedUsers.map((row) => [row.record.uid, row])),
    [computedUsers],
  )

  const inspectedUser = inspectedUid ? userByUid.get(inspectedUid) ?? null : null

  const counts = useMemo(() => {
    let pending = 0
    let approved = 0
    let rejected = 0
    verifications.forEach((item) => {
      if (item.status === 'pending') pending += 1
      else if (item.status === 'approved') approved += 1
      else if (item.status === 'rejected') rejected += 1
    })

    let inTrial = 0
    let expiringSoon = 0
    let pendingUsers = 0
    let expiredUsers = 0
    let lifetimeUsers = 0
    let affiliateLifetime = 0
    let grantedLifetime = 0

    computedUsers.forEach((row) => {
      if (row.status === 'lifetime') {
        lifetimeUsers += 1
        if (row.approvedOrders > 0) affiliateLifetime += 1
        else grantedLifetime += 1
      } else if (row.status === 'pending') {
        pendingUsers += 1
      } else if (row.status === 'expired') {
        expiredUsers += 1
      } else {
        inTrial += 1
        if (row.expiringSoon) expiringSoon += 1
      }
    })

    return {
      pending,
      approved,
      rejected,
      total: verifications.length,
      waitlist: waitlistEntries.length,
      totalUsers: computedUsers.length,
      inTrial,
      expiringSoon,
      pendingUsers,
      expiredUsers,
      lifetimeUsers,
      affiliateLifetime,
      grantedLifetime,
    }
  }, [verifications, waitlistEntries.length, computedUsers])

  const recentActivity = useMemo<ActivityEvent[]>(() => {
    const events: ActivityEvent[] = []
    verifications.forEach((item) => {
      events.push({
        id: `pv-${item.id}`,
        uid: item.uid,
        timestamp: item.reviewedAt || item.createdAt,
        tone: item.status === 'approved' ? 'pos' : item.status === 'rejected' ? 'neg' : 'warn',
        title:
          item.status === 'approved'
            ? `Order ${item.orderId} approved`
            : item.status === 'rejected'
              ? `Order ${item.orderId} declined`
              : `Order ${item.orderId} submitted`,
        detail: `${item.userEmail || item.ezeEmail} · Eze: ${item.ezeEmail}`,
      })
    })
    userRecords.forEach((record) => {
      if (record.lifetimeGrantedAt) {
        events.push({
          id: `grant-${record.uid}`,
          uid: record.uid,
          timestamp: record.lifetimeGrantedAt,
          tone: 'pos',
          title: 'Lifetime granted by admin',
          detail: `${record.email || record.name || record.uid}`,
        })
      } else if (record.trialStartedAt) {
        events.push({
          id: `signup-${record.uid}`,
          uid: record.uid,
          timestamp: record.trialStartedAt,
          tone: 'info',
          title: 'New user started trial',
          detail: `${record.email || record.name || record.uid}`,
        })
      }
    })
    return events
      .filter((e) => Boolean(e.timestamp))
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, 10)
  }, [verifications, userRecords])

  const filteredVerifications = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return verifications.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false
      if (!q) return true
      const haystack = `${item.orderId} ${item.userEmail} ${item.ezeEmail}`.toLowerCase()
      return haystack.includes(q)
    })
  }, [verifications, statusFilter, searchQuery])

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase()
    return computedUsers.filter((row) => {
      if (userFilter === 'trial' && row.status !== 'trial') return false
      if (userFilter === 'expiring' && !row.expiringSoon) return false
      if (userFilter === 'pending' && row.status !== 'pending') return false
      if (userFilter === 'expired' && row.status !== 'expired') return false
      if (userFilter === 'lifetime' && row.status !== 'lifetime') return false
      if (!q) return true
      const haystack = `${row.record.email ?? ''} ${row.record.name ?? ''} ${row.record.uid} ${row.latestVerification?.orderId ?? ''}`.toLowerCase()
      return haystack.includes(q)
    })
  }, [computedUsers, userFilter, userSearch])

  const filteredWaitlist = useMemo(() => {
    const q = waitlistSearch.trim().toLowerCase()
    if (!q) return waitlistEntries
    return waitlistEntries.filter(
      (entry) =>
        entry.email.toLowerCase().includes(q) ||
        (entry.source ?? 'web').toLowerCase().includes(q),
    )
  }, [waitlistEntries, waitlistSearch])

  const pendingQueue = useMemo(
    () => verifications.filter((item) => item.status === 'pending'),
    [verifications],
  )

  if (!isAdmin) {
    return <Navigate to="/metrics" replace />
  }

  const handleReview = async (id: string, nextStatus: 'approved' | 'rejected', note?: string) => {
    setReviewingId(id)
    try {
      await reviewPartnerVerification(id, nextStatus, note)
      const reviewer = user?.email ?? 'admin'
      const nowIso = new Date().toISOString()
      const cleanNote = note?.trim().slice(0, 280) || undefined
      setCloudVerifications((previous) =>
        previous.map((item) =>
          item.id === id
            ? {
                ...item,
                status: nextStatus,
                reviewedAt: nowIso,
                reviewedBy: reviewer,
                ...(cleanNote ? { note: cleanNote } : {}),
              }
            : item,
        ),
      )
      setDecliningId(null)
      setDeclineNote('')
      showToast(
        nextStatus === 'approved' ? 'Lifetime & slot unlocked' : 'Request declined',
        nextStatus === 'approved'
          ? 'Approved Eze Funded purchase (Lifetime journal access + 1 account slot).'
          : cleanNote || 'Verification request marked as declined.',
        nextStatus === 'approved' ? 'success' : 'info',
      )
    } catch (error) {
      showToast(
        'Review failed',
        error instanceof Error ? error.message : 'Could not update verification status.',
        'error',
      )
    } finally {
      setReviewingId(null)
    }
  }

  const handleUserAction = async (
    record: UserEntitlementRecord,
    action: 'grant-lifetime' | 'revoke-lifetime' | 'extend-7' | 'extend-30' | 'reset-trial',
  ) => {
    setUpdatingUid(record.uid)
    const nowIso = new Date().toISOString()
    const actor = user?.email ?? 'admin'
    const patch =
      action === 'grant-lifetime'
        ? {
            lifetimeGranted: true,
            lifetimeGrantedAt: nowIso,
            lifetimeGrantedBy: actor,
          }
        : action === 'revoke-lifetime'
          ? {
              lifetimeGranted: false,
            }
          : action === 'extend-7'
            ? {
                trialBonusDays: (record.trialBonusDays ?? 0) + 7,
              }
            : action === 'extend-30'
              ? {
                  trialBonusDays: (record.trialBonusDays ?? 0) + 30,
                }
              : {
                  trialStartedAt: nowIso,
                  trialBonusDays: 0,
                  lifetimeGranted: false,
                }

    try {
      await updateUserEntitlement(record.uid, patch)
      setUserRecords((previous) =>
        previous.map((item) => (item.uid === record.uid ? { ...item, ...patch } : item)),
      )
      showToast(
        action === 'grant-lifetime'
          ? 'Lifetime access granted'
          : action === 'revoke-lifetime'
            ? 'Lifetime override removed'
            : action === 'extend-7'
              ? 'Trial extended (+7 days)'
              : action === 'extend-30'
                ? 'Trial extended (+30 days)'
                : 'Trial reset',
        record.email ?? record.uid,
        'success',
      )
    } catch (error) {
      showToast(
        'Update failed',
        error instanceof Error ? error.message : 'Could not update user entitlement.',
        'error',
      )
    } finally {
      setUpdatingUid(null)
    }
  }

  const handleSavePolicy = async (event: FormEvent) => {
    event.preventDefault()
    setSavingPolicy(true)
    try {
      const saved = await updateAccessPolicy(normalizeAccessPolicy(policyDraft))
      setPolicyDraft(saved)
      showToast(
        'Access policy saved',
        saved.trialEnabled
          ? `${saved.freeAccountSlots} free account for ${saved.freeTrialDays} days · affiliate purchase unlocks lifetime.`
          : 'Free trial time limit disabled.',
        'success',
      )
    } catch (error) {
      showToast(
        'Save failed',
        error instanceof Error ? error.message : 'Could not save access policy.',
        'error',
      )
    } finally {
      setSavingPolicy(false)
    }
  }

  const handleResetPolicy = async () => {
    setSavingPolicy(true)
    try {
      const saved = await updateAccessPolicy(DEFAULT_ACCESS_POLICY)
      setPolicyDraft(saved)
      showToast(
        'Defaults restored',
        '1 free account for 30 days · affiliate purchase unlocks lifetime.',
        'info',
      )
    } catch (error) {
      showToast(
        'Reset failed',
        error instanceof Error ? error.message : 'Could not reset access policy.',
        'error',
      )
    } finally {
      setSavingPolicy(false)
    }
  }

  const handleExportWaitlist = () => {
    if (!filteredWaitlist.length) return
    const lines = [
      ['Email', 'Joined At', 'Source'].map(csvCell).join(','),
      ...filteredWaitlist.map((entry) =>
        [entry.email, entry.createdAt ?? '', entry.source ?? 'web'].map(csvCell).join(','),
      ),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `traders-area-waitlist-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    showToast('Waitlist exported', `${filteredWaitlist.length} records downloaded as CSV.`, 'success')
  }

  const handleCopy = async (kind: 'partner' | 'admin', value: string, toastTitle: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedKey(kind)
      showToast(toastTitle, value, 'info')
      window.setTimeout(() => setCopiedKey(null), 2000)
    } catch {
      showToast('Copy unavailable', value, 'info')
    }
  }

  const jumpToUsers = (filter: UserFilter) => {
    setUserFilter(filter)
    setTab('users')
  }

  const fullAdminUrl =
    typeof window !== 'undefined' ? `${window.location.origin}${ownerLoginPath}` : ownerLoginPath

  const normalizedDraft = normalizeAccessPolicy(policyDraft)
  const policyDirty = !policiesMatch(normalizedDraft, accessPolicy)

  const navItems: {
    id: AdminTab
    label: string
    icon: ReactNode
    count?: number
    warn?: boolean
  }[] = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={15} /> },
    { id: 'users', label: 'Users & Accounts', icon: <Users size={15} />, count: counts.totalUsers },
    {
      id: 'verifications',
      label: 'Verifications',
      icon: <ShieldCheck size={15} />,
      count: counts.pending,
      warn: counts.pending > 0,
    },
    { id: 'waitlist', label: 'Waitlist', icon: <Layers size={15} />, count: counts.waitlist },
    { id: 'controls', label: 'Access Policy', icon: <Settings2 size={15} /> },
  ]

  const totalFunnel = Math.max(1, counts.totalUsers)

  return (
    <div className="admin-shell">
      <header className="admin-topbar">
        <div className="admin-topbar-left">
          <button
            type="button"
            className="admin-brand-btn"
            onClick={() => navigate('/metrics')}
            aria-label="Return to Traders Area workspace"
          >
            <img
              className="admin-logo"
              src={isDark ? logoDark : logoLight}
              alt="Traders Area"
              draggable={false}
            />
          </button>
          <span className="admin-topbar-divider" aria-hidden="true" />
          <span className="admin-topbar-label">Admin Console</span>
        </div>

        <div className="admin-topbar-right">
          <span
            className={cn('admin-sync-chip', isFirebaseConfigured ? 'is-live' : 'is-local')}
            title={
              isFirebaseConfigured
                ? `Connected to Firebase Firestore (${user?.email ?? 'Admin'})`
                : 'Previewing local device storage'
            }
          >
            <i aria-hidden="true" />
            <span>{isFirebaseConfigured ? 'Firestore Live' : 'Local Mode'}</span>
          </span>
          <Button variant="ghost" size="sm" onClick={() => navigate('/metrics')}>
            <ArrowLeft size={14} />
            <span>Back to app</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate('/waitlist')}>
            <ExternalLink size={14} />
            <span>Waitlist</span>
          </Button>
          <Button variant="secondary" size="sm" loading={loading} onClick={loadAdminRecords}>
            <RefreshCw size={14} />
            <span>Refresh</span>
          </Button>
          <ThemeToggle />
        </div>
      </header>

      <div className="admin-workspace">
        <aside className="admin-rail" aria-label="Admin sections">
          <nav className="admin-rail-nav">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={cn('admin-rail-btn', tab === item.id && 'is-active')}
                onClick={() => setTab(item.id)}
              >
                <span className="admin-rail-left">
                  {item.icon}
                  <span>{item.label}</span>
                </span>
                {item.count !== undefined && (
                  <span className={cn('admin-rail-count num', item.warn && 'is-warn')}>
                    {item.count}
                  </span>
                )}
              </button>
            ))}
          </nav>

          <div className="admin-rail-policy">
            <span className="admin-rail-policy-kicker">Active Policy</span>
            <strong className="num">
              {accessPolicy.trialEnabled
                ? `${accessPolicy.freeAccountSlots} free · ${accessPolicy.freeTrialDays}d trial`
                : `${accessPolicy.freeAccountSlots} free · No expiry`}
            </strong>
            <span>
              {accessPolicy.trialEnabled && accessPolicy.requirePartnerAfterTrial
                ? 'Eze Funded order unlocks lifetime'
                : 'Trial gate disabled'}
            </span>
            <button
              type="button"
              className="admin-rail-policy-btn"
              onClick={() => setTab('controls')}
            >
              <span>Edit policy</span>
              <ArrowRight size={12} />
            </button>
          </div>
        </aside>

        <main className="admin-canvas">
          {loadError && (
            <div className="admin-alert" role="alert">
              <span>{loadError}</span>
              <Button variant="ghost" size="sm" onClick={loadAdminRecords}>
                Retry
              </Button>
            </div>
          )}

          {tab === 'overview' && (
            <div className="admin-section-stack">
              <div className="admin-head">
                <div className="admin-head-copy">
                  <span className="page-kicker">Operations</span>
                  <h1 className="page-title">Account &amp; Access Overview</h1>
                  <p className="page-subtitle">
                    Monitor trader trials, pending Eze Funded affiliate orders, and lifetime unlocks
                    in one view.
                  </p>
                </div>
              </div>

              <section className="admin-kpi-strip num" aria-label="Admin metrics overview">
                <div className="admin-kpi-cell">
                  <span className="admin-kpi-label">Registered traders</span>
                  <strong className="admin-kpi-value">{counts.totalUsers}</strong>
                  <span className="admin-kpi-meta">
                    {counts.inTrial} in free trial
                    {counts.expiringSoon > 0 ? ` · ${counts.expiringSoon} ending ≤5d` : ''}
                  </span>
                </div>
                <div className="admin-kpi-cell">
                  <span className="admin-kpi-label">Pending reviews</span>
                  <strong className={cn('admin-kpi-value', counts.pending > 0 && 'is-warn')}>
                    {counts.pending}
                  </strong>
                  <span className="admin-kpi-meta">
                    {counts.pending > 0 ? 'Awaiting order confirmation' : 'Queue clear'}
                  </span>
                </div>
                <div className="admin-kpi-cell">
                  <span className="admin-kpi-label">Lifetime active</span>
                  <strong className="admin-kpi-value is-pos">{counts.lifetimeUsers}</strong>
                  <span className="admin-kpi-meta">
                    {counts.affiliateLifetime} affiliate · {counts.grantedLifetime} granted
                  </span>
                </div>
                <div className="admin-kpi-cell">
                  <span className="admin-kpi-label">Trial expired</span>
                  <strong className={cn('admin-kpi-value', counts.expiredUsers > 0 && 'is-neg')}>
                    {counts.expiredUsers}
                  </strong>
                  <span className="admin-kpi-meta">Locked awaiting Eze purchase</span>
                </div>
              </section>

              <section className="admin-funnel-card" aria-label="Account lifecycle breakdown">
                <div className="admin-panel-head">
                  <div>
                    <h3>User Access Lifecycle</h3>
                    <p>Click any stage to filter and inspect those user accounts.</p>
                  </div>
                  <span className="admin-panel-meta num">{counts.totalUsers} total accounts</span>
                </div>

                <div className="admin-funnel-bar" role="presentation">
                  <span
                    className="admin-funnel-seg is-trial"
                    style={{ width: `${(counts.inTrial / totalFunnel) * 100}%` }}
                  />
                  <span
                    className="admin-funnel-seg is-pending"
                    style={{ width: `${(counts.pendingUsers / totalFunnel) * 100}%` }}
                  />
                  <span
                    className="admin-funnel-seg is-expired"
                    style={{ width: `${(counts.expiredUsers / totalFunnel) * 100}%` }}
                  />
                  <span
                    className="admin-funnel-seg is-lifetime"
                    style={{ width: `${(counts.lifetimeUsers / totalFunnel) * 100}%` }}
                  />
                </div>

                <div className="admin-funnel-stages">
                  <button
                    type="button"
                    className="admin-funnel-stage"
                    onClick={() => jumpToUsers('trial')}
                  >
                    <span className="admin-funnel-dot is-trial" />
                    <span className="admin-funnel-copy">
                      <b>Free trial active</b>
                      <span className="num">
                        {counts.inTrial} users · {Math.round((counts.inTrial / totalFunnel) * 100)}%
                      </span>
                    </span>
                    <ArrowRight size={13} />
                  </button>

                  <button
                    type="button"
                    className="admin-funnel-stage"
                    onClick={() => jumpToUsers('pending')}
                  >
                    <span className="admin-funnel-dot is-pending" />
                    <span className="admin-funnel-copy">
                      <b>Pending verification</b>
                      <span className="num">
                        {counts.pendingUsers} users ·{' '}
                        {Math.round((counts.pendingUsers / totalFunnel) * 100)}%
                      </span>
                    </span>
                    <ArrowRight size={13} />
                  </button>

                  <button
                    type="button"
                    className="admin-funnel-stage"
                    onClick={() => jumpToUsers('expired')}
                  >
                    <span className="admin-funnel-dot is-expired" />
                    <span className="admin-funnel-copy">
                      <b>Trial expired (locked)</b>
                      <span className="num">
                        {counts.expiredUsers} users ·{' '}
                        {Math.round((counts.expiredUsers / totalFunnel) * 100)}%
                      </span>
                    </span>
                    <ArrowRight size={13} />
                  </button>

                  <button
                    type="button"
                    className="admin-funnel-stage"
                    onClick={() => jumpToUsers('lifetime')}
                  >
                    <span className="admin-funnel-dot is-lifetime" />
                    <span className="admin-funnel-copy">
                      <b>Lifetime unlocked</b>
                      <span className="num">
                        {counts.lifetimeUsers} users ·{' '}
                        {Math.round((counts.lifetimeUsers / totalFunnel) * 100)}%
                      </span>
                    </span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </section>

              <section className="admin-policy-strip" aria-label="Current global access rule">
                <div className="admin-policy-strip-copy">
                  <span className="admin-rail-policy-kicker">Global Trial &amp; Affiliate Rule</span>
                  <p className="num">
                    {accessPolicy.trialEnabled
                      ? `${accessPolicy.freeAccountSlots} free account · ${accessPolicy.freeTrialDays}-day trial · Eze Funded verification (Code: ${accessPolicy.partnerCode}) unlocks lifetime access + 1 slot`
                      : `${accessPolicy.freeAccountSlots} free account · No trial lock · Eze Funded orders add +1 slot`}
                  </p>
                </div>
                <Button variant="secondary" size="sm" onClick={() => setTab('controls')}>
                  <span>Configure policy</span>
                  <ArrowRight size={13} />
                </Button>
              </section>

              <div className="admin-overview-grid">
                <section className="admin-control-panel" aria-label="Pending verification queue">
                  <div className="admin-panel-head">
                    <div>
                      <h3>Needs Review Now</h3>
                      <p>Confirm Eze Funded orders to grant lifetime access and +1 account slot.</p>
                    </div>
                    {pendingQueue.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setStatusFilter('pending')
                          setTab('verifications')
                        }}
                      >
                        View all ({pendingQueue.length})
                      </Button>
                    )}
                  </div>

                  {pendingQueue.length === 0 ? (
                    <div className="admin-inline-empty">
                      <CheckCircle2 size={16} />
                      <span>All submitted Eze Funded verifications have been reviewed.</span>
                    </div>
                  ) : (
                    <div className="admin-queue-list">
                      {pendingQueue.slice(0, 5).map((item) => {
                        const row = userByUid.get(item.uid)
                        const isDeclining = decliningId === item.id
                        return (
                          <div className="admin-queue-item" key={item.id}>
                            <div className="admin-queue-top">
                              <div className="admin-queue-identity">
                                <strong className="num">{item.orderId}</strong>
                                <span>
                                  {item.userEmail || item.ezeEmail}
                                  {row ? ` · ${row.statusText}` : ''}
                                </span>
                              </div>
                              <div className="admin-row-actions">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setInspectedUid(item.uid)}
                                >
                                  Inspect
                                </Button>
                                <Button
                                  variant="primary"
                                  size="sm"
                                  loading={reviewingId === item.id}
                                  onClick={() => handleReview(item.id, 'approved')}
                                >
                                  Approve +1
                                </Button>
                                {!isDeclining && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={reviewingId === item.id}
                                    onClick={() => {
                                      setDecliningId(item.id)
                                      setDeclineNote('')
                                    }}
                                  >
                                    Decline
                                  </Button>
                                )}
                              </div>
                            </div>

                            {isDeclining && (
                              <div className="admin-decline-box">
                                <input
                                  className="input"
                                  type="text"
                                  maxLength={280}
                                  placeholder="Reason shown to trader (optional)…"
                                  value={declineNote}
                                  onChange={(event) => setDeclineNote(event.target.value)}
                                />
                                <Button
                                  variant="danger"
                                  size="sm"
                                  loading={reviewingId === item.id}
                                  onClick={() => handleReview(item.id, 'rejected', declineNote)}
                                >
                                  Confirm decline
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setDecliningId(null)
                                    setDeclineNote('')
                                  }}
                                >
                                  Cancel
                                </Button>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </section>

                <section className="admin-control-panel" aria-label="Recent account activity">
                  <div className="admin-panel-head">
                    <div>
                      <h3>Recent Account Activity</h3>
                      <p>Latest signups, submissions, approvals, and lifetime overrides.</p>
                    </div>
                  </div>

                  {recentActivity.length === 0 ? (
                    <div className="admin-inline-empty">
                      <Activity size={16} />
                      <span>No recent account events recorded yet.</span>
                    </div>
                  ) : (
                    <div className="admin-activity-list">
                      {recentActivity.map((event) => (
                        <button
                          key={event.id}
                          type="button"
                          className="admin-activity-row"
                          onClick={() => {
                            if (event.uid && userByUid.has(event.uid)) {
                              setInspectedUid(event.uid)
                            }
                          }}
                        >
                          <span className={cn('admin-activity-dot', `is-${event.tone}`)} />
                          <span className="admin-activity-copy">
                            <b>{event.title}</b>
                            <span>{event.detail}</span>
                          </span>
                          <span className="admin-activity-date num">{formatDate(event.timestamp)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </div>
          )}

          {tab === 'users' && (
            <div className="admin-section-stack">
              <div className="admin-head">
                <div className="admin-head-copy">
                  <span className="page-kicker">Directory</span>
                  <h1 className="page-title">Users &amp; Account Status</h1>
                  <p className="page-subtitle">
                    Inspect every trader&apos;s trial window, account slot count, Eze Funded order,
                    and manage lifetime access.
                  </p>
                </div>
              </div>

              <section className="admin-surface" aria-label="Registered users and trial controls">
                <div className="admin-toolbar">
                  <label className="admin-search">
                    <Search size={14} aria-hidden="true" />
                    <input
                      type="search"
                      value={userSearch}
                      onChange={(event) => setUserSearch(event.target.value)}
                      placeholder="Search email, name, UID, or order ID…"
                      aria-label="Search registered users"
                    />
                  </label>

                  <div className="admin-toolbar-right">
                    <span className="admin-toolbar-meta num">
                      {filteredUsers.length} of {computedUsers.length}
                    </span>
                    <Segmented
                      size="sm"
                      value={userFilter}
                      options={USER_FILTERS}
                      onChange={setUserFilter}
                      label="Filter users by access status"
                    />
                  </div>
                </div>

                {loading && userRecords.length === 0 ? (
                  <div className="admin-loading">Loading user entitlements…</div>
                ) : filteredUsers.length === 0 ? (
                  <EmptyState
                    icon={<Users size={20} />}
                    title={userRecords.length === 0 ? 'No users recorded yet' : 'No matching users'}
                    description={
                      userRecords.length === 0
                        ? 'Users appear here as soon as they open their trading workspace.'
                        : 'Try clearing the search query or changing the access filter.'
                    }
                    actions={
                      (userSearch || userFilter !== 'all') && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setUserSearch('')
                            setUserFilter('all')
                          }}
                        >
                          Reset filters
                        </Button>
                      )
                    }
                  />
                ) : (
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Trader</th>
                          <th>Accounts</th>
                          <th>Trial Window</th>
                          <th>Latest Verification</th>
                          <th>Access Status</th>
                          <th className="text-right">Controls</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.map((row) => {
                          const { record } = row
                          const busy = updatingUid === record.uid
                          const displayLabel = record.name || record.email || 'Unnamed trader'
                          return (
                            <tr
                              key={record.uid}
                              className="is-clickable"
                              onClick={() => setInspectedUid(record.uid)}
                            >
                              <td>
                                <div className="admin-user-row">
                                  <span className="admin-user-avatar" aria-hidden="true">
                                    {initialsFor(displayLabel)}
                                  </span>
                                  <div className="admin-user-cell">
                                    <strong>{record.email || record.name || 'Unnamed trader'}</strong>
                                    <span className="admin-mono">
                                      {record.name && record.email ? `${record.name} · ` : ''}
                                      {record.uid.slice(0, 12)}
                                    </span>
                                  </div>
                                </div>
                              </td>
                              <td className="num">
                                {row.accountsUsed} / {row.totalSlots} slots
                              </td>
                              <td className="num">
                                <div className="admin-user-cell">
                                  <strong>{formatDate(record.trialStartedAt)}</strong>
                                  <span>
                                    {row.status === 'lifetime'
                                      ? 'No expiration'
                                      : `Ends ${formatDate(row.trialEndsAt)}`}
                                  </span>
                                  {(row.status === 'trial' || row.status === 'pending') && (
                                    <span className="admin-trial-bar" aria-hidden="true">
                                      <i
                                        className={row.expiringSoon ? 'is-warn' : 'is-info'}
                                        style={{ width: `${row.trialPct}%` }}
                                      />
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td>
                                {row.latestVerification ? (
                                  <div className="admin-user-cell">
                                    <strong className="admin-mono">
                                      {row.latestVerification.orderId}
                                    </strong>
                                    <span
                                      className={cn(
                                        'plans-status',
                                        `is-${row.latestVerification.status}`,
                                      )}
                                    >
                                      {row.latestVerification.status === 'approved'
                                        ? 'Approved'
                                        : row.latestVerification.status === 'rejected'
                                          ? 'Declined'
                                          : 'Pending review'}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="admin-muted-cell">Not submitted</span>
                                )}
                              </td>
                              <td>
                                <span
                                  className={cn(
                                    'plans-status num',
                                    row.status === 'lifetime'
                                      ? 'is-approved'
                                      : row.status === 'expired'
                                        ? 'is-rejected'
                                        : 'is-pending',
                                  )}
                                >
                                  {row.status === 'lifetime' ? (
                                    <CheckCircle2 size={12} aria-hidden="true" />
                                  ) : row.status === 'expired' ? (
                                    <XCircle size={12} aria-hidden="true" />
                                  ) : (
                                    <Clock3 size={12} aria-hidden="true" />
                                  )}
                                  <span>{row.statusText}</span>
                                </span>
                              </td>
                              <td onClick={(event) => event.stopPropagation()}>
                                <div className="admin-row-actions">
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => setInspectedUid(record.uid)}
                                  >
                                    Inspect
                                  </Button>
                                  {record.lifetimeGranted ? (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      disabled={busy}
                                      onClick={() => handleUserAction(record, 'revoke-lifetime')}
                                    >
                                      Revoke lifetime
                                    </Button>
                                  ) : (
                                    <Button
                                      variant="primary"
                                      size="sm"
                                      loading={busy}
                                      onClick={() => handleUserAction(record, 'grant-lifetime')}
                                    >
                                      Grant lifetime
                                    </Button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
          )}

          {tab === 'verifications' && (
            <div className="admin-section-stack">
              <div className="admin-head">
                <div className="admin-head-copy">
                  <span className="page-kicker">Affiliate Purchases</span>
                  <h1 className="page-title">Eze Funded Verifications</h1>
                  <p className="page-subtitle">
                    Review order IDs submitted by traders. Approving grants lifetime journal access
                    and +1 extra account slot.
                  </p>
                </div>
              </div>

              <section className="admin-surface" aria-label="Partner verification queue">
                <div className="admin-toolbar">
                  <label className="admin-search">
                    <Search size={14} aria-hidden="true" />
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Search order ID, user email, or Eze email…"
                      aria-label="Search partner verification requests"
                    />
                  </label>

                  <Segmented
                    size="sm"
                    value={statusFilter}
                    options={STATUS_FILTERS}
                    onChange={setStatusFilter}
                    label="Filter verifications by status"
                  />
                </div>

                {loading && verifications.length === 0 ? (
                  <div className="admin-loading">Loading partner verification queue…</div>
                ) : filteredVerifications.length === 0 ? (
                  <EmptyState
                    icon={<ShieldCheck size={20} />}
                    title={
                      verifications.length === 0
                        ? 'No verification requests yet'
                        : 'No matching verification requests'
                    }
                    description={
                      verifications.length === 0
                        ? 'When traders submit their Eze Funded order ID and email in Plans & Access, requests appear here.'
                        : 'Try clearing the search query or switching the status filter.'
                    }
                    actions={
                      (searchQuery || statusFilter !== 'all') && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setSearchQuery('')
                            setStatusFilter('all')
                          }}
                        >
                          Reset filters
                        </Button>
                      )
                    }
                  />
                ) : (
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Order ID</th>
                          <th>Trader Account</th>
                          <th>Eze Email</th>
                          <th>Submitted</th>
                          <th>Status &amp; Note</th>
                          <th className="text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredVerifications.map((item) => {
                          const row = userByUid.get(item.uid)
                          const isDeclining = decliningId === item.id
                          return (
                            <tr key={item.id}>
                              <td className="num admin-mono">{item.orderId}</td>
                              <td>
                                <div className="admin-user-cell">
                                  <strong>{item.userEmail || '—'}</strong>
                                  <span>{row ? row.statusText : item.uid.slice(0, 12)}</span>
                                </div>
                              </td>
                              <td>{item.ezeEmail}</td>
                              <td className="num">{formatDate(item.createdAt)}</td>
                              <td>
                                <div className="admin-user-cell">
                                  <span className={cn('plans-status', `is-${item.status}`)}>
                                    {item.status === 'approved' ? (
                                      <CheckCircle2 size={12} aria-hidden="true" />
                                    ) : item.status === 'rejected' ? (
                                      <XCircle size={12} aria-hidden="true" />
                                    ) : (
                                      <Clock3 size={12} aria-hidden="true" />
                                    )}
                                    <span>{statusLabel(item.status)}</span>
                                  </span>
                                  {item.note && <span className="admin-note-inline">{item.note}</span>}
                                </div>
                              </td>
                              <td>
                                {isDeclining ? (
                                  <div className="admin-decline-inline">
                                    <input
                                      className="input"
                                      type="text"
                                      maxLength={280}
                                      placeholder="Reason shown to trader…"
                                      value={declineNote}
                                      onChange={(event) => setDeclineNote(event.target.value)}
                                    />
                                    <Button
                                      variant="danger"
                                      size="sm"
                                      loading={reviewingId === item.id}
                                      onClick={() => handleReview(item.id, 'rejected', declineNote)}
                                    >
                                      Confirm
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setDecliningId(null)
                                        setDeclineNote('')
                                      }}
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="admin-row-actions">
                                    {userByUid.has(item.uid) && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setInspectedUid(item.uid)}
                                      >
                                        Inspect
                                      </Button>
                                    )}
                                    {item.status !== 'approved' && (
                                      <Button
                                        variant="primary"
                                        size="sm"
                                        loading={reviewingId === item.id}
                                        onClick={() => handleReview(item.id, 'approved')}
                                      >
                                        Approve +1
                                      </Button>
                                    )}
                                    {item.status !== 'rejected' && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        disabled={reviewingId === item.id}
                                        onClick={() => {
                                          setDecliningId(item.id)
                                          setDeclineNote('')
                                        }}
                                      >
                                        Decline
                                      </Button>
                                    )}
                                  </div>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
          )}

          {tab === 'waitlist' && (
            <div className="admin-section-stack">
              <div className="admin-head">
                <div className="admin-head-copy">
                  <span className="page-kicker">Early Access</span>
                  <h1 className="page-title">Waitlist Signups</h1>
                  <p className="page-subtitle">
                    Search and export traders registered on the pre-launch waitlist.
                  </p>
                </div>
              </div>

              <section className="admin-surface" aria-label="Waitlist signups">
                <div className="admin-toolbar">
                  <label className="admin-search">
                    <Search size={14} aria-hidden="true" />
                    <input
                      type="search"
                      value={waitlistSearch}
                      onChange={(event) => setWaitlistSearch(event.target.value)}
                      placeholder="Search waitlist emails…"
                      aria-label="Search waitlist signups"
                    />
                  </label>

                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={filteredWaitlist.length === 0}
                    onClick={handleExportWaitlist}
                  >
                    <Download size={14} />
                    <span>Export CSV</span>
                  </Button>
                </div>

                {loading && waitlistEntries.length === 0 ? (
                  <div className="admin-loading">Loading waitlist directory…</div>
                ) : filteredWaitlist.length === 0 ? (
                  <EmptyState
                    icon={<Users size={20} />}
                    title={
                      !isFirebaseConfigured
                        ? 'Waitlist directory requires Firebase'
                        : waitlistEntries.length === 0
                          ? 'No waitlist signups yet'
                          : 'No matching waitlist emails'
                    }
                    description={
                      !isFirebaseConfigured
                        ? 'Connect Firebase Firestore to inspect and export live waitlist registrations.'
                        : waitlistEntries.length === 0
                          ? 'New waitlist entries submitted on the landing page will list here.'
                          : 'Try adjusting your search query.'
                    }
                  />
                ) : (
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Email</th>
                          <th>Joined</th>
                          <th>Source</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredWaitlist.map((entry) => (
                          <tr key={entry.email}>
                            <td className="admin-mono">{entry.email}</td>
                            <td className="num">{formatDate(entry.createdAt)}</td>
                            <td>{entry.source ?? 'web'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
          )}

          {tab === 'controls' && (
            <div className="admin-section-stack">
              <div className="admin-head">
                <div className="admin-head-copy">
                  <span className="page-kicker">Configuration</span>
                  <h1 className="page-title">Trial &amp; Affiliate Access Policy</h1>
                  <p className="page-subtitle">
                    Define the free trial duration, free account allowance, and Eze Funded affiliate
                    requirements applied globally across every account.
                  </p>
                </div>
              </div>

              <section className="admin-controls-grid" aria-label="Workspace access and controls">
                <form className="admin-control-panel" onSubmit={handleSavePolicy}>
                  <div className="admin-control-head">
                    <h3>Trial &amp; Lifetime Rules</h3>
                    <p>
                      Configure how long new traders can use the journal for free before needing an
                      Eze Funded affiliate purchase.
                    </p>
                  </div>

                  <div className="admin-toggle-list">
                    <div className="admin-toggle-row">
                      <div className="admin-toggle-copy">
                        <b>Enforce free trial window</b>
                        <span>
                          New users get free access for the trial length below before requiring an
                          affiliate purchase.
                        </span>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={policyDraft.trialEnabled}
                        className={cn('admin-switch', policyDraft.trialEnabled && 'is-on')}
                        onClick={() =>
                          setPolicyDraft((prev) => ({ ...prev, trialEnabled: !prev.trialEnabled }))
                        }
                      >
                        <span className="admin-switch-thumb" />
                      </button>
                    </div>

                    <div className="admin-toggle-row">
                      <div className="admin-toggle-copy">
                        <b>Require Eze Funded purchase for lifetime</b>
                        <span>
                          Lock journal after trial ends until an Eze Funded order is verified for
                          lifetime access.
                        </span>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={policyDraft.requirePartnerAfterTrial}
                        disabled={!policyDraft.trialEnabled}
                        className={cn(
                          'admin-switch',
                          policyDraft.requirePartnerAfterTrial && policyDraft.trialEnabled && 'is-on',
                        )}
                        onClick={() =>
                          setPolicyDraft((prev) => ({
                            ...prev,
                            requirePartnerAfterTrial: !prev.requirePartnerAfterTrial,
                          }))
                        }
                      >
                        <span className="admin-switch-thumb" />
                      </button>
                    </div>
                  </div>

                  <div className="admin-policy-fields">
                    <div className="field">
                      <div className="admin-field-head">
                        <span className="field-label">Free trial length (days)</span>
                        <div className="admin-presets">
                          {TRIAL_DAY_PRESETS.map((days) => (
                            <button
                              key={days}
                              type="button"
                              className={cn(
                                'admin-preset-btn num',
                                policyDraft.freeTrialDays === days && 'is-active',
                              )}
                              onClick={() =>
                                setPolicyDraft((prev) => ({ ...prev, freeTrialDays: days }))
                              }
                            >
                              {days}d
                            </button>
                          ))}
                        </div>
                      </div>
                      <input
                        className="input num"
                        type="number"
                        min={1}
                        max={3650}
                        value={policyDraft.freeTrialDays}
                        onChange={(event) =>
                          setPolicyDraft((prev) => ({
                            ...prev,
                            freeTrialDays: Math.max(1, Number(event.target.value) || 30),
                          }))
                        }
                      />
                    </div>

                    <label className="field">
                      <span className="field-label">Free accounts per user</span>
                      <input
                        className="input num"
                        type="number"
                        min={0}
                        max={100}
                        value={policyDraft.freeAccountSlots}
                        onChange={(event) =>
                          setPolicyDraft((prev) => ({
                            ...prev,
                            freeAccountSlots: Math.max(0, Number(event.target.value) || 0),
                          }))
                        }
                      />
                    </label>

                    <label className="field">
                      <span className="field-label">Eze Funded affiliate URL</span>
                      <input
                        className="input admin-mono"
                        type="url"
                        value={policyDraft.partnerUrl}
                        onChange={(event) =>
                          setPolicyDraft((prev) => ({ ...prev, partnerUrl: event.target.value }))
                        }
                        placeholder="https://ezefunded.com/?ref=TRADERSAREA"
                      />
                    </label>

                    <label className="field">
                      <span className="field-label">Partner / affiliate code</span>
                      <input
                        className="input admin-mono"
                        type="text"
                        maxLength={48}
                        value={policyDraft.partnerCode}
                        onChange={(event) =>
                          setPolicyDraft((prev) => ({ ...prev, partnerCode: event.target.value }))
                        }
                        placeholder="TRADERSAREA"
                      />
                    </label>
                  </div>

                  <div className="admin-policy-summary">
                    {normalizedDraft.trialEnabled && normalizedDraft.requirePartnerAfterTrial
                      ? `Active rule: Every new user gets ${normalizedDraft.freeAccountSlots} free account for ${normalizedDraft.freeTrialDays} days. After ${normalizedDraft.freeTrialDays} days, buying an account via ${normalizedDraft.partnerUrl} unlocks lifetime journal access (+1 slot per verified order).`
                      : `Active rule: ${normalizedDraft.freeAccountSlots} free account included without a trial expiration lock. Additional slots unlock via ${normalizedDraft.partnerUrl}.`}
                  </div>

                  <div className="admin-policy-actions">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={savingPolicy}
                      onClick={handleResetPolicy}
                    >
                      <RotateCcw size={13} />
                      <span>Reset defaults</span>
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      size="sm"
                      loading={savingPolicy}
                      disabled={!policyDirty && !savingPolicy}
                    >
                      Save policy
                    </Button>
                  </div>
                </form>

                <div className="admin-control-panel">
                  <div className="admin-control-head">
                    <h3>Workspace Runtime &amp; Links</h3>
                    <p>Live gate configuration, storage backend, and shareable admin/affiliate URLs.</p>
                  </div>

                  <dl className="admin-spec-list">
                    <div className="admin-spec-row">
                      <dt>Public access gate</dt>
                      <dd>{isWaitlistOnly ? 'Waitlist-only mode' : 'Open registration'}</dd>
                    </div>
                    <div className="admin-spec-row">
                      <dt>Storage backend</dt>
                      <dd>{isFirebaseConfigured ? 'Firebase Cloud (Firestore)' : 'Local browser'}</dd>
                    </div>
                    <div className="admin-spec-row">
                      <dt>Active admin session</dt>
                      <dd className="admin-mono">{user?.email ?? 'Local dev admin'}</dd>
                    </div>
                    {accessPolicy.updatedAt && (
                      <div className="admin-spec-row">
                        <dt>Last policy update</dt>
                        <dd className="num">
                          {formatDate(accessPolicy.updatedAt)}
                          {accessPolicy.updatedBy ? ` · ${accessPolicy.updatedBy}` : ''}
                        </dd>
                      </div>
                    )}
                  </dl>

                  <div className="admin-link-stack">
                    <div className="admin-link-item">
                      <div className="admin-link-meta">
                        <span>Eze Funded affiliate link</span>
                        <strong className="num">Code: {accessPolicy.partnerCode}</strong>
                      </div>
                      <div className="plan-partner-url-row">
                        <code className="plan-partner-url">{accessPolicy.partnerUrl}</code>
                        <button
                          type="button"
                          className="plan-copy-btn"
                          onClick={() =>
                            handleCopy('partner', accessPolicy.partnerUrl, 'Affiliate link copied')
                          }
                        >
                          {copiedKey === 'partner' ? <Check size={13} /> : <Copy size={13} />}
                          <span>{copiedKey === 'partner' ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                    </div>

                    <div className="admin-link-item">
                      <div className="admin-link-meta">
                        <span>Private admin login URL</span>
                        <strong className="admin-mono">{ownerLoginPath}</strong>
                      </div>
                      <div className="plan-partner-url-row">
                        <code className="plan-partner-url">{fullAdminUrl}</code>
                        <button
                          type="button"
                          className="plan-copy-btn"
                          onClick={() =>
                            handleCopy('admin', fullAdminUrl, 'Admin login route copied')
                          }
                        >
                          {copiedKey === 'admin' ? <Check size={13} /> : <Copy size={13} />}
                          <span>{copiedKey === 'admin' ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          )}
        </main>
      </div>

      {inspectedUser && (
        <div
          className="admin-drawer-scrim"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-drawer-title"
          onClick={() => setInspectedUid(null)}
        >
          <aside className="admin-drawer" onClick={(event) => event.stopPropagation()}>
            <header className="admin-drawer-head">
              <div className="admin-drawer-identity">
                <span className="admin-user-avatar is-lg" aria-hidden="true">
                  {initialsFor(
                    inspectedUser.record.name || inspectedUser.record.email || 'Trader',
                  )}
                </span>
                <div>
                  <span className="page-kicker">Trader Inspector</span>
                  <h2 id="admin-drawer-title">
                    {inspectedUser.record.email || inspectedUser.record.name || 'Trader account'}
                  </h2>
                  <p className="admin-mono">{inspectedUser.record.uid}</p>
                </div>
              </div>
              <button
                type="button"
                className="icon-btn"
                aria-label="Close trader inspector"
                onClick={() => setInspectedUid(null)}
              >
                <X size={16} />
              </button>
            </header>

            <div className="admin-drawer-body">
              <div className="plans-summary-strip num">
                <div className="plans-summary-cell">
                  <span>Status</span>
                  <b
                    className={
                      inspectedUser.status === 'lifetime'
                        ? 'is-pos'
                        : inspectedUser.status === 'expired'
                          ? 'is-neg'
                          : 'is-warn'
                    }
                  >
                    {inspectedUser.statusText}
                  </b>
                </div>
                <div className="plans-summary-cell">
                  <span>Accounts</span>
                  <b>
                    {inspectedUser.accountsUsed} / {inspectedUser.totalSlots} slots
                  </b>
                </div>
                <div className="plans-summary-cell">
                  <span>Journal gate</span>
                  <b className={inspectedUser.canUseJournal ? 'is-pos' : 'is-neg'}>
                    {inspectedUser.canUseJournal ? 'Accessible' : 'Locked'}
                  </b>
                </div>
              </div>

              <div className="admin-drawer-section">
                <h3>Account Lifecycle</h3>
                <div className="plans-rail">
                  <div className="plans-rail-step is-done">
                    <span className="plans-rail-node num">
                      <Check size={10} strokeWidth={3} />
                    </span>
                    <div className="plans-rail-copy">
                      <b>Free Trial Started</b>
                      <span className="num">
                        {formatDate(inspectedUser.record.trialStartedAt)} ·{' '}
                        {inspectedUser.status === 'lifetime'
                          ? 'Upgraded'
                          : inspectedUser.status === 'expired'
                            ? 'Window ended'
                            : `${inspectedUser.daysLeft}d remaining`}
                      </span>
                    </div>
                  </div>
                  <div
                    className={cn(
                      'plans-rail-step',
                      inspectedUser.accountsUsed > 0 ? 'is-done' : 'is-current',
                    )}
                  >
                    <span className="plans-rail-node num">
                      {inspectedUser.accountsUsed > 0 ? <Check size={10} strokeWidth={3} /> : '02'}
                    </span>
                    <div className="plans-rail-copy">
                      <b>Free Account Slot</b>
                      <span className="num">
                        {inspectedUser.accountsUsed} of {inspectedUser.totalSlots} slots used
                      </span>
                    </div>
                  </div>
                  <div
                    className={cn(
                      'plans-rail-step',
                      inspectedUser.approvedOrders > 0
                        ? 'is-done'
                        : inspectedUser.pendingOrders > 0
                          ? 'is-current'
                          : '',
                    )}
                  >
                    <span className="plans-rail-node num">
                      {inspectedUser.approvedOrders > 0 ? <Check size={10} strokeWidth={3} /> : '03'}
                    </span>
                    <div className="plans-rail-copy">
                      <b>Eze Funded Verification</b>
                      <span>
                        {inspectedUser.approvedOrders > 0
                          ? `${inspectedUser.approvedOrders} verified order`
                          : inspectedUser.pendingOrders > 0
                            ? `${inspectedUser.pendingOrders} pending confirmation`
                            : inspectedUser.rejectedOrders > 0
                              ? `${inspectedUser.rejectedOrders} declined`
                              : 'Not submitted yet'}
                      </span>
                    </div>
                  </div>
                  <div
                    className={cn(
                      'plans-rail-step',
                      inspectedUser.status === 'lifetime' ? 'is-done' : '',
                    )}
                  >
                    <span className="plans-rail-node num">
                      {inspectedUser.status === 'lifetime' ? (
                        <Check size={10} strokeWidth={3} />
                      ) : (
                        '04'
                      )}
                    </span>
                    <div className="plans-rail-copy">
                      <b>Lifetime Journal Access</b>
                      <span>
                        {inspectedUser.status === 'lifetime'
                          ? 'Active forever'
                          : 'Unlocks upon order verification'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <dl className="admin-spec-list">
                <div className="admin-spec-row">
                  <dt>Display name</dt>
                  <dd>{inspectedUser.record.name || '—'}</dd>
                </div>
                <div className="admin-spec-row">
                  <dt>Trial started</dt>
                  <dd className="num">{formatDate(inspectedUser.record.trialStartedAt)}</dd>
                </div>
                <div className="admin-spec-row">
                  <dt>Trial expires</dt>
                  <dd className="num">
                    {inspectedUser.status === 'lifetime'
                      ? 'Never (Lifetime)'
                      : formatDate(inspectedUser.trialEndsAt)}
                  </dd>
                </div>
                <div className="admin-spec-row">
                  <dt>Bonus trial days</dt>
                  <dd className="num">{inspectedUser.record.trialBonusDays ?? 0} days</dd>
                </div>
                <div className="admin-spec-row">
                  <dt>Last active</dt>
                  <dd className="num">
                    {formatDate(inspectedUser.record.lastActiveAt ?? inspectedUser.record.updatedAt)}
                  </dd>
                </div>
              </dl>

              <div className="admin-drawer-section">
                <h3>Admin Overrides</h3>
                <div className="admin-drawer-actions">
                  {inspectedUser.record.lifetimeGranted ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={updatingUid === inspectedUser.record.uid}
                      onClick={() => handleUserAction(inspectedUser.record, 'revoke-lifetime')}
                    >
                      Revoke lifetime
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      size="sm"
                      loading={updatingUid === inspectedUser.record.uid}
                      onClick={() => handleUserAction(inspectedUser.record, 'grant-lifetime')}
                    >
                      Grant lifetime
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={updatingUid === inspectedUser.record.uid}
                    onClick={() => handleUserAction(inspectedUser.record, 'extend-7')}
                  >
                    +7d trial
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={updatingUid === inspectedUser.record.uid}
                    onClick={() => handleUserAction(inspectedUser.record, 'extend-30')}
                  >
                    +30d trial
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={updatingUid === inspectedUser.record.uid}
                    onClick={() => handleUserAction(inspectedUser.record, 'reset-trial')}
                  >
                    Reset 1m
                  </Button>
                </div>
              </div>

              <div className="admin-drawer-section">
                <h3>Eze Funded Submissions ({inspectedUser.verifications.length})</h3>
                {inspectedUser.verifications.length === 0 ? (
                  <div className="admin-inline-empty">
                    <AlertCircle size={15} />
                    <span>No Eze Funded orders submitted by this user yet.</span>
                  </div>
                ) : (
                  <div className="admin-queue-list">
                    {inspectedUser.verifications.map((order) => {
                      const isDeclining = decliningId === order.id
                      return (
                        <div className="admin-queue-item" key={order.id}>
                          <div className="admin-queue-top">
                            <div className="admin-queue-identity">
                              <strong className="num">{order.orderId}</strong>
                              <span>
                                {order.ezeEmail} · {formatDate(order.createdAt)}
                              </span>
                              {order.note && (
                                <span className="admin-note-inline">Note: {order.note}</span>
                              )}
                            </div>
                            <span className={cn('plans-status', `is-${order.status}`)}>
                              {statusLabel(order.status)}
                            </span>
                          </div>
                          {isDeclining ? (
                            <div className="admin-decline-box">
                              <input
                                className="input"
                                type="text"
                                maxLength={280}
                                placeholder="Reason shown to trader (optional)…"
                                value={declineNote}
                                onChange={(event) => setDeclineNote(event.target.value)}
                              />
                              <Button
                                variant="danger"
                                size="sm"
                                loading={reviewingId === order.id}
                                onClick={() => handleReview(order.id, 'rejected', declineNote)}
                              >
                                Confirm
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setDecliningId(null)
                                  setDeclineNote('')
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <div className="admin-row-actions">
                              {order.status !== 'approved' && (
                                <Button
                                  variant="primary"
                                  size="sm"
                                  loading={reviewingId === order.id}
                                  onClick={() => handleReview(order.id, 'approved')}
                                >
                                  Approve +1
                                </Button>
                              )}
                              {order.status !== 'rejected' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={reviewingId === order.id}
                                  onClick={() => {
                                    setDecliningId(order.id)
                                    setDeclineNote('')
                                  }}
                                >
                                  Decline
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
