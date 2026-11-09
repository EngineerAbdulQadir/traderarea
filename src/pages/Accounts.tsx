import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  ArrowUpRight,
  History,
  Layers,
  Plus,
  Trash2,
} from 'lucide-react'
import { useApp } from '@/store/AppStore'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { AccountAvatar } from '@/components/ui/AccountAvatar'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { PhaseHistoryModal } from '@/components/modals/PhaseHistoryModal'
import { ACCOUNT_PHASES } from '@/data/firms'
import {
  accountBadge,
  accountGradient,
  accountMeta,
  nextStageFor,
  phaseState,
  titleFor,
} from '@/lib/accounts'
import { computeStats, evaluateAccount, getStartingBalance, type AccountEvaluation } from '@/lib/stats'
import { cn } from '@/lib/cn'
import type { Account } from '@/lib/types'

export function AccountsPage() {
  const {
    accounts,
    activeAccount,
    setActiveAccount,
    advanceAccount,
    getTradesForAccount,
    openChallenge,
    removeAccount,
    showToast,
    viewingPhaseIndex,
    setViewingPhase,
  } = useApp()
  const navigate = useNavigate()
  const [pendingRemove, setPendingRemove] = useState<Account | null>(null)
  const [historyAccount, setHistoryAccount] = useState<Account | null>(null)

  const evaluations = useMemo(() => {
    const map = new Map<string, AccountEvaluation>()
    accounts.forEach((account) => {
      const stats = computeStats(getTradesForAccount(account), getStartingBalance(account))
      map.set(account.id, evaluateAccount(account, stats))
    })
    return map
  }, [accounts, getTradesForAccount])

  const openAccount = (account: Account) => {
    setActiveAccount(account.id)
    navigate('/metrics')
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
      <PageHeader />

      {viewingPhaseIndex !== null && (
        <div className="phase-view-banner">
          <span>
            Reviewing {activeAccount?.stage ?? 'previous phase'} history for{' '}
            {activeAccount ? titleFor(activeAccount) : 'this account'}.
          </span>
          <Button variant="ghost" size="sm" onClick={() => setViewingPhase(null)}>
            Back to current phase
          </Button>
        </div>
      )}

      {accounts.length === 0 ? (
        <EmptyState
          icon={<Layers size={22} />}
          title="Your capital starts here"
          description="Create a challenge to set the rules, phase and starting balance. Trader Area then tracks every trade against them."
          actions={
            <Button variant="primary" iconLeft={<Plus size={14} />} onClick={openChallenge}>
              Start a challenge
            </Button>
          }
        />
      ) : (
        <>
          <div className="accounts-grid">
            {accounts.map((account) => {
              const active = activeAccount?.id === account.id
              const evaluation = evaluations.get(account.id)
              const passed = evaluation?.status === 'passed'
              const breached = evaluation?.status === 'breached'
              const nextStage = nextStageFor(account.type, account.stage)
              const canAdvance = passed && !!nextStage
              const phases = ACCOUNT_PHASES.map((stage, index) => ({
                stage,
                index,
                state: phaseState(account, index),
              })).filter((phase) => phase.state !== 'skipped')
              const currentIndex = phases.findIndex((phase) => phase.state === 'current')
              return (
                <Card className={cn('account-card', active && 'is-active', passed && 'is-passed', breached && 'is-breached')} key={account.id}>
                  <div className="account-card-head">
                    <AccountAvatar
                      badge={accountBadge(account)}
                      gradient={accountGradient(account)}
                      size="md"
                    />
                    <div className="account-card-copy">
                      <div className="account-card-title-row">
                        <h3>{titleFor(account)}</h3>
                        {passed && <Badge tone="pos" dot>Passed</Badge>}
                        {breached && <Badge tone="neg" dot>Breached</Badge>}
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

                  {(passed || breached) && evaluation && (
                    <p className={cn('account-status-line', passed ? 'is-pos' : 'is-neg')}>
                      {evaluation.reason}
                    </p>
                  )}

                  <div className="phase-block">
                    <div className="phase-head">
                      <span className="phase-label">Progress</span>
                      <div className="phase-head-right">
                        {currentIndex >= 0 && (
                          <span className="phase-step">{currentIndex + 1} of {phases.length}</span>
                        )}
                        {(account.phaseHistory?.length || account.phaseStartedAt) && (
                          <button
                            className="phase-history-btn"
                            type="button"
                            onClick={() => setHistoryAccount(account)}
                          >
                            <History size={11} />
                            History
                          </button>
                        )}
                      </div>
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
                    {canAdvance && (
                      <Button
                        variant="primary"
                        size="sm"
                        iconRight={<ArrowRight size={13} />}
                        onClick={() => advanceAccount(account.id)}
                      >
                        Move to {nextStage}
                      </Button>
                    )}
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

      <PhaseHistoryModal
        open={!!historyAccount}
        account={historyAccount}
        onClose={() => setHistoryAccount(null)}
      />
    </div>
  )
}
