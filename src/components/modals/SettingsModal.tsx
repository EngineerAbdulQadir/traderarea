import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import {
  Cloud,
  Database,
  Download,
  LogOut,
  Moon,
  Palette,
  Save,
  Search,
  ShieldCheck,
  Sun,
  Trash2,
  UserRound,
  Monitor,
} from 'lucide-react'
import { Modal, ModalClose } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Segmented } from '@/components/ui/Segmented'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useApp } from '@/store/AppStore'
import { useAuth } from '@/store/AuthProvider'
import { useProfile } from '@/hooks/useProfile'
import { useTheme } from '@/hooks/useTheme'
import { initialsFor, saveProfile } from '@/lib/profile'
import { STORAGE_KEYS } from '@/lib/persistence'
import { clearThemePreference, type Theme } from '@/lib/theme'
import { exportWorkspaceBackup } from '@/lib/backup'
import { cn } from '@/lib/cn'

type SectionId = 'profile' | 'appearance' | 'data'

const NAV_GROUPS: { label: string; items: { id: SectionId; label: string; icon: ReactNode }[] }[] = [
  {
    label: 'Account',
    items: [
      { id: 'profile', label: 'Profile', icon: <UserRound size={15} /> },
      { id: 'appearance', label: 'Appearance', icon: <Palette size={15} /> },
    ],
  },
  {
    label: 'Workspace',
    items: [
      { id: 'data', label: 'Data & storage', icon: <Database size={15} /> },
    ],
  },
]

const THEME_OPTIONS: { value: Theme; label: string; icon: ReactNode }[] = [
  { value: 'light', label: 'Light', icon: <Sun size={13} /> },
  { value: 'dark', label: 'Dark', icon: <Moon size={13} /> },
]

export function SettingsModal() {
  const {
    settingsOpen,
    closeSettings,
    accounts,
    workspaceTrades,
    showToast,
    syncStatus,
    cloudUserId,
    clearCloudWorkspace,
  } = useApp()
  const { user, signOut } = useAuth()
  const cloudActive = syncStatus === 'ready' && Boolean(cloudUserId)
  const profile = useProfile()
  const { theme, setTheme } = useTheme()

  const [section, setSection] = useState<SectionId>('profile')
  const [query, setQuery] = useState('')
  const [name, setName] = useState(profile.name)
  const [email, setEmail] = useState(profile.email)
  const [resetOpen, setResetOpen] = useState(false)

  const initials = initialsFor(name || profile.name)
  const dirty = name.trim() !== profile.name || email.trim() !== profile.email

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return NAV_GROUPS
    return NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) => item.label.toLowerCase().includes(q)),
    })).filter((group) => group.items.length > 0)
  }, [query])

  const handleSave = (event: FormEvent) => {
    event.preventDefault()
    const next = saveProfile({ name, email })
    setName(next.name)
    setEmail(next.email)
    showToast('Profile updated', 'Your display name and email were saved on this device.')
  }

  const handleExport = () => {
    exportWorkspaceBackup()
    showToast('Backup exported', 'Your workspace data was downloaded as a JSON file.')
  }

  const handleReset = async () => {
    if (cloudUserId) {
      try {
        await clearCloudWorkspace()
      } catch {
        showToast('Cloud reset failed', 'Your local copy was cleared, but Firebase still has data.', 'error')
      }
    }
    ;[
      STORAGE_KEYS.accounts,
      STORAGE_KEYS.trades,
      STORAGE_KEYS.notes,
      STORAGE_KEYS.activeAccount,
    ].forEach((key) => {
      try {
        localStorage.removeItem(key)
      } catch {
        // Storage can be unavailable in private mode.
      }
    })
    setResetOpen(false)
    window.location.reload()
  }

  return (
    <>
      <Modal
        open={settingsOpen}
        onClose={closeSettings}
        size="wide"
        className="settings-modal"
        labelledBy="settings-modal-title"
        initialFocus=".settings-nav-item.is-active"
      >
        <header className="settings-modal-head">
          <div className="settings-modal-heading">
            <h2 className="settings-modal-title" id="settings-modal-title">
              Settings
            </h2>
            <p>Manage your profile, appearance and local workspace data.</p>
          </div>
          <ModalClose onClick={closeSettings} />
        </header>

        <div className="settings-modal-body">
          <aside className="settings-nav" aria-label="Settings sections">
            <label className="settings-search">
              <Search size={14} />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search settings"
                aria-label="Search settings"
              />
            </label>

            <div className="settings-nav-groups">
              {groups.map((group) => (
                <div className="settings-nav-group" key={group.label}>
                  <span className="settings-nav-label">{group.label}</span>
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={cn('settings-nav-item', section === item.id && 'is-active')}
                      aria-current={section === item.id ? 'page' : undefined}
                      onClick={() => setSection(item.id)}
                    >
                      <span className="settings-nav-icon">{item.icon}</span>
                      {item.label}
                    </button>
                  ))}
                </div>
              ))}
              {groups.length === 0 && <p className="settings-nav-empty">No settings found.</p>}
            </div>
          </aside>

          <section className="settings-content" aria-live="polite">
            {section === 'profile' && (
              <div className="settings-panel">
                <h3 className="settings-panel-title">Profile</h3>
                <p className="settings-panel-sub">This is how you appear across your workspace.</p>

                <div className="settings-field-row">
                  <div className="settings-field-copy">
                    <b>Profile photo</b>
                    <span>Your initials are used as the workspace avatar.</span>
                  </div>
                  <span className="settings-avatar">{initials}</span>
                </div>

                <form className="settings-profile-form" onSubmit={handleSave}>
                  <label className="settings-field-row">
                    <span className="settings-field-copy">
                      <b>Full name</b>
                      <span>Shown in the sidebar and profile menu.</span>
                    </span>
                    <input
                      className="input settings-inline-input"
                      type="text"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Alex Morgan"
                      autoComplete="name"
                      required
                    />
                  </label>

                  <label className="settings-field-row">
                    <span className="settings-field-copy">
                      <b>Email address</b>
                      <span>Stored only on this device.</span>
                    </span>
                    <input
                      className="input settings-inline-input"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@example.com"
                      autoComplete="email"
                      required
                    />
                  </label>

                  <div className="settings-panel-foot">
                    <span className="settings-hint">
                      {dirty ? 'You have unsaved profile changes.' : 'Profile is up to date.'}
                    </span>
                    <Button
                      type="submit"
                      variant="primary"
                      size="sm"
                      iconLeft={<Save size={14} />}
                      disabled={!dirty}
                    >
                      Save changes
                    </Button>
                  </div>
                </form>
              </div>
            )}

            {section === 'appearance' && (
              <div className="settings-panel">
                <h3 className="settings-panel-title">Appearance</h3>
                <p className="settings-panel-sub">Choose how the dashboard looks on this device.</p>

                <div className="settings-field-row">
                  <div className="settings-field-copy">
                    <b>Theme</b>
                    <span>Switch between the light and dark interface.</span>
                  </div>
                  <Segmented
                    value={theme}
                    options={THEME_OPTIONS}
                    onChange={setTheme}
                    label="Dashboard theme"
                  />
                </div>

                <div className="settings-field-row">
                  <div className="settings-field-copy">
                    <b>Match system</b>
                    <span>Follow your operating system instead of a fixed theme.</span>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    iconLeft={<Monitor size={14} />}
                    onClick={() => {
                      clearThemePreference()
                      showToast('Theme follows system', 'The dashboard now matches your device appearance.', 'info')
                    }}
                  >
                    Use system
                  </Button>
                </div>

                <p className="settings-panel-note">
                  Theme changes apply instantly and are remembered in this browser. The auth screens
                  keep their own light palette.
                </p>
              </div>
            )}

            {section === 'data' && (
              <div className="settings-panel">
                <div className="settings-panel-head">
                  <div>
                    <h3 className="settings-panel-title">Data &amp; storage</h3>
                    <p className="settings-panel-sub">
                      {cloudActive
                        ? 'Synced to Firebase and cached in this browser for offline use.'
                        : 'Everything lives in this browser. Export a backup before clearing it.'}
                    </p>
                  </div>
                  <Badge tone={cloudActive ? 'accent' : 'neutral'} dot>
                    {cloudActive ? 'Cloud sync' : 'Local only'}
                  </Badge>
                </div>

                <div className="settings-data-stats">
                  <div className="settings-stat">
                    <span>Accounts</span>
                    <b>{accounts.length}</b>
                  </div>
                  <div className="settings-stat">
                    <span>Trades</span>
                    <b>{workspaceTrades.length}</b>
                  </div>
                  <div className="settings-stat">
                    <span>Storage</span>
                    <b>{cloudActive ? 'Firebase' : 'Browser'}</b>
                  </div>
                </div>

                <div className="settings-field-row">
                  <div className="settings-field-copy">
                    <b>Signed in as</b>
                    <span>{user?.email ?? 'Not signed in — data stays on this device.'}</span>
                  </div>
                  {user ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      iconLeft={<LogOut size={14} />}
                      onClick={async () => {
                        closeSettings()
                        await signOut()
                      }}
                    >
                      Sign out
                    </Button>
                  ) : (
                    <Badge tone="neutral">
                      <Cloud size={12} /> Local
                    </Badge>
                  )}
                </div>

                <div className="settings-field-row">
                  <div className="settings-field-copy">
                    <b>Export workspace</b>
                    <span>Download accounts, trades, notes and your profile as JSON.</span>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    iconLeft={<Download size={14} />}
                    onClick={handleExport}
                  >
                    Export backup
                  </Button>
                </div>

                <div className="settings-field-row">
                  <div className="settings-field-copy">
                    <b>Reset workspace</b>
                    <span>Permanently remove all accounts, trades and notes from this device.</span>
                  </div>
                  <Button
                    variant="danger"
                    size="sm"
                    iconLeft={<Trash2 size={14} />}
                    onClick={() => setResetOpen(true)}
                  >
                    Reset data
                  </Button>
                </div>

                <div className="settings-privacy">
                  <ShieldCheck size={14} />
                  <span>
                    {cloudActive
                      ? 'Your journal syncs through Firebase and is readable only by your account.'
                      : 'Nothing is uploaded. Clearing browser storage also removes this data.'}
                  </span>
                </div>
              </div>
            )}
          </section>
        </div>
      </Modal>

      <ConfirmDialog
        open={resetOpen}
        title="Reset workspace data?"
        description={
          <>
            This removes <strong>{accounts.length}</strong> account
            {accounts.length === 1 ? '' : 's'}, <strong>{workspaceTrades.length}</strong> trade
            {workspaceTrades.length === 1 ? '' : 's'} and every journal note
            {cloudActive ? ' in your Firebase account and this browser' : ' stored in this browser'}.
            Your profile and theme are kept. This cannot be undone.
          </>
        }
        confirmLabel="Reset workspace"
        onConfirm={handleReset}
        onClose={() => setResetOpen(false)}
      />
    </>
  )
}
