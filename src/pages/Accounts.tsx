import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowUpRight,
  Plus,
  Sparkles,
  Trash2,
  Wallet,
} from 'lucide-react'
import { useApp } from '@/store/AppStore'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { AccountAvatar } from '@/components/ui/AccountAvatar'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ACCOUNT_PHASES } from '@/data/firms'
import { accountBadge, accountGradient, accountMeta, phaseState, titleFor } from '@/lib/accounts'
import { cn } from '@/lib/cn'
import type { Account } from '@/lib/types'

export function AccountsPage() {
  const {
    accounts,
    activeAccount,
    setActiveAccount,
    addDemoAccount,
    openChallenge,
    removeAccount,
    showToast,
  } = useApp()
  const navigate = useNavigate()
  const [pendingRemove, setPendingRemove] = useState<Account | null>(null)

  const openAccount = (account: Account) => {
    setActiveAccount(account.id)
    navigate('/')
  }

  const confirmRemove = () => {
    if (!pendingRemove) return
    const title = titleFor(pendingRemove)
    removeAccount(pendingRemove.id)
    showToast('Account removed', `${title} and its trades were removed from this device.`, 'info')
    setPendingRemove(null)
  }

  return (
    <div className="page accounts-page">
      <PageHeader
        className="page-head--actions-end"
        actions={
          <>
            <Button variant="secondary" size="sm" iconLeft={<Sparkles size={14} />} onClick={addDemoAccount}>
              Demo workspace
            </Button>
            <Button variant="primary" size="sm" iconLeft={<Plus size={14} />} onClick={openChallenge}>
              Start challenge
            </Button>
          </>
        }
      />

      {accounts.length === 0 ? (
        <EmptyState
          icon={<Wallet size={22} />}
          eyebrow="No accounts yet"
          title="Your capital starts here"
          description="Create a challenge to set the rules, phase and starting balance. Trader Area then tracks every trade against them."
          actions={
            <>
              <Button variant="primary" iconLeft={<Plus size={14} />} onClick={openChallenge}>
                Start a challenge
              </Button>
              <Button variant="secondary" iconLeft={<Sparkles size={14} />} onClick={addDemoAccount}>
                Load demo workspace
              </Button>
            </>
          }
        />
      ) : (
        <>
          <div className="accounts-grid">
            {accounts.map((account) => {
              const active = activeAccount?.id === account.id
              const phases = ACCOUNT_PHASES.map((stage, index) => ({
                stage,
                index,
                state: phaseState(account, index),
              })).filter((phase) => phase.state !== 'skipped')
              const currentIndex = phases.findIndex((phase) => phase.state === 'current')
              return (
                <Card className={cn('account-card', active && 'is-active')} key={account.id}>
                  <div className="account-card-head">
                    <AccountAvatar
                      badge={accountBadge(account)}
                      gradient={accountGradient(account)}
                      size="md"
                    />
                    <div className="account-card-copy">
                      <div className="account-card-title-row">
                        <h3>{titleFor(account)}</h3>
                      </div>
                      <p>{accountMeta(account)}</p>
                    </div>
                    <button
                      className="account-remove"
                      type="button"
                      onClick={() => setPendingRemove(account)}
                      aria-label={`Remove ${titleFor(account)}`}
                      title="Remove account"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  <div className="phase-block">
                    <div className="phase-head">
                      <span className="phase-label">Progress</span>
                      {currentIndex >= 0 && (
                        <span className="phase-step">{currentIndex + 1} of {phases.length}</span>
                      )}
                    </div>
                    <div
                      className="phase-track"
                      style={{ gridTemplateColumns: `repeat(${phases.length}, minmax(0, 1fr))` }}
                      aria-label="Account phases"
                    >
                      {phases.map(({ stage, index, state }) => (
                        <div className={cn('phase', state)} key={stage}>
                          <span className="phase-dot">
                            {state === 'done' ? <span aria-hidden="true">✓</span> : index + 1}
                          </span>
                          <span className="phase-name">{stage}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="account-card-foot">
                    <Button
                      variant={active ? 'soft' : 'secondary'}
                      size="sm"
                      iconRight={<ArrowUpRight size={13} />}
                      onClick={() => openAccount(account)}
                    >
                      {active ? 'Open metrics' : 'View metrics'}
                    </Button>
                  </div>
                </Card>
              )
            })}

            <button className="account-add" type="button" onClick={openChallenge}>
              <span className="account-add-icon"><Plus size={20} /></span>
              <b>Start a new challenge</b>
              <span>Define the firm, phase, size and rules. Your next workspace is one step away.</span>
            </button>
          </div>
        </>
      )}

      <ConfirmDialog
        open={!!pendingRemove}
        title="Remove this account?"
        description={
          pendingRemove ? (
            <>
              <b>{titleFor(pendingRemove)}</b> and all of its trades and notes will be deleted from this device.
              This cannot be undone.
            </>
          ) : null
        }
        confirmLabel="Remove account"
        onConfirm={confirmRemove}
        onClose={() => setPendingRemove(null)}
      />
    </div>
  )
}
