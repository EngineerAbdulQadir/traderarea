import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowUpRight,
  Layers3,
  Plus,
  Sparkles,
  Trash2,
  Wallet,
} from 'lucide-react'
import { useApp } from '@/store/AppStore'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { AccountAvatar } from '@/components/ui/AccountAvatar'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Sparkline } from '@/components/charts/Sparkline'
import { ACCOUNT_PHASES } from '@/data/firms'
import { accountBadge, accountGradient, accountMeta, phaseState, titleFor } from '@/lib/accounts'
import { buildCumulativeSeries, computeStats, getStartingBalance } from '@/lib/stats'
import { formatMoney, plainPercent, signedMoney, signedPercent } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { Account } from '@/lib/types'

export function AccountsPage() {
  const {
    accounts,
    activeAccount,
    setActiveAccount,
    getTradesForAccount,
    isDemo,
    addDemoAccount,
    openChallenge,
    removeAccount,
    showToast,
  } = useApp()
  const navigate = useNavigate()
  const [pendingRemove, setPendingRemove] = useState<Account | null>(null)

  const cards = useMemo(
    () =>
      accounts.map((account) => {
        const trades = getTradesForAccount(account)
        const starting = getStartingBalance(account)
        const stats = computeStats(trades, starting)
        const series = buildCumulativeSeries(stats)
        const targetAmount = starting * ((Number(account.rules?.target) || 0) / 100)
        const rawProgress = targetAmount ? (stats.net / targetAmount) * 100 : 0
        return {
          account,
          trades,
          starting,
          stats,
          series,
          demo: isDemo(account),
          progress: Math.min(100, Math.max(0, rawProgress)),
          rawProgress,
          targetAmount,
        }
      }),
    [accounts, getTradesForAccount, isDemo],
  )

  const totals = useMemo(() => {
    const starting = cards.reduce((sum, card) => sum + card.starting, 0)
    const net = cards.reduce((sum, card) => sum + card.stats.net, 0)
    const funded = cards.filter((card) => card.account.stage === 'Funded').length
    const demos = cards.filter((card) => card.demo).length
    return { starting, net, funded, demos, current: starting + net }
  }, [cards])

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
        kicker="Challenges & capital"
        title="Portfolio"
        subtitle="Every challenge, phase and funded account in one portfolio. Open a workspace to work its journal."
        actions={
          <>
            <Button variant="secondary" iconLeft={<Sparkles size={14} />} onClick={addDemoAccount}>
              Demo workspace
            </Button>
            <Button variant="primary" iconLeft={<Plus size={14} />} onClick={openChallenge}>
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
          <section className="accounts-summary">
            <div className="summary-lead">
              <span className="summary-kicker"><Layers3 size={11} /> Workspace overview</span>
              <span className="summary-label">Combined net P&amp;L</span>
              <strong className={cn('summary-value num', totals.net > 0 && 'is-pos', totals.net < 0 && 'is-neg')}>
                {signedMoney(totals.net)}
              </strong>
              <span className="summary-caption">
                {accounts.length} account{accounts.length === 1 ? '' : 's'}
                {totals.demos ? ` · ${totals.demos} sample` : ''}
              </span>
            </div>
            <div className="summary-tile">
              <span>Capital tracked</span>
              <b className="num">{formatMoney(totals.starting)}</b>
              <em>starting balances</em>
            </div>
            <div className="summary-tile">
              <span>Current equity</span>
              <b className="num">{formatMoney(totals.current)}</b>
              <em className={cn(totals.net > 0 ? 'is-pos' : totals.net < 0 ? 'is-neg' : '')}>
                {signedPercent(totals.starting ? (totals.net / totals.starting) * 100 : 0)} return
              </em>
            </div>
            <div className="summary-tile">
              <span>Funded</span>
              <b className="num">{totals.funded}</b>
              <em>{accounts.length - totals.funded} in evaluation</em>
            </div>
          </section>

          <div className="accounts-grid">
            {cards.map(({ account, stats, series, starting, demo, progress, rawProgress, targetAmount }) => {
              const active = activeAccount?.id === account.id
              return (
                <Card className={cn('account-card', active && 'is-active')} key={account.id}>
                  <div className="account-card-head">
                    <AccountAvatar
                      badge={accountBadge(account)}
                      gradient={accountGradient(account)}
                      size="lg"
                    />
                    <div className="account-card-copy">
                      <div className="account-card-title-row">
                        <h3>{titleFor(account)}</h3>
                        {active && <Badge tone="accent" dot>Active</Badge>}
                      </div>
                      <p>{accountMeta(account)}</p>
                      <div className="account-card-badges">
                        <Badge tone={account.stage === 'Funded' ? 'pos' : 'neutral'}>{account.stage}</Badge>
                        {demo && <Badge tone="violet">Sample data</Badge>}
                      </div>
                    </div>
                  </div>

                  <div className="phase-track" aria-label="Account phases">
                    {ACCOUNT_PHASES.map((stage, index) => {
                      const state = phaseState(account, index)
                      return (
                        <div className={cn('phase', state)} key={stage}>
                          <span className="phase-dot">
                            {state === 'done' ? <span aria-hidden="true">✓</span> : index + 1}
                          </span>
                          <span className="phase-name">{stage}</span>
                        </div>
                      )
                    })}
                  </div>

                  <div className="account-metrics">
                    <div>
                      <span>Net P&amp;L</span>
                      <b className={cn('num', stats.net > 0 && 'is-pos', stats.net < 0 && 'is-neg')}>
                        {signedMoney(stats.net)}
                      </b>
                    </div>
                    <div>
                      <span>Win rate</span>
                      <b className="num">{stats.count ? `${plainPercent(stats.winRate, 0)}%` : '—'}</b>
                    </div>
                    <div>
                      <span>Trades</span>
                      <b className="num">{stats.count}</b>
                    </div>
                  </div>

                  <div className="account-wealth">
                    <div>
                      <span>Balance</span>
                      <b className="num">{formatMoney(starting + stats.net)}</b>
                    </div>
                    <div className="account-spark">
                      <Sparkline
                        data={series.length ? [0, ...series.map((point) => point.value)] : []}
                        positive={stats.net >= 0}
                        height={44}
                        strokeWidth={1.5}
                      />
                    </div>
                    <span className={cn('account-return num', stats.net >= 0 ? 'is-pos' : 'is-neg')}>
                      {signedPercent(starting ? (stats.net / starting) * 100 : 0)}
                    </span>
                  </div>

                  <div className="account-target">
                    <div className="account-target-labels">
                      <span>{targetAmount > 0 ? 'Profit target' : '10% milestone'}</span>
                      <b className="num">
                        {rawProgress >= 100 ? 'Reached' : `${Math.round(Math.max(0, rawProgress))}%`}
                      </b>
                    </div>
                    <div className="account-target-track">
                      <i style={{ width: `${progress}%` }} />
                    </div>
                  </div>

                  <div className="account-card-foot">
                    <Button variant={active ? 'soft' : 'secondary'} size="sm" iconRight={<ArrowUpRight size={13} />} onClick={() => openAccount(account)}>
                      {active ? 'Open dashboard' : 'Open workspace'}
                    </Button>
                    <button
                      className="account-remove"
                      type="button"
                      onClick={() => setPendingRemove(account)}
                      aria-label={`Remove ${titleFor(account)}`}
                      title="Remove account"
                    >
                      <Trash2 size={14} />
                    </button>
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

          {totals.demos > 0 && (
            <p className="accounts-note">
              <Sparkles size={12} />
              Balances and trades from sample accounts are generated locally and included in the overview.
            </p>
          )}
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
