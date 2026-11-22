import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Check, RotateCcw, ShieldCheck, Wallet } from 'lucide-react'
import { Modal, ModalClose } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Segmented } from '@/components/ui/Segmented'
import { useApp } from '@/store/AppStore'
import {
  BROKERS,
  BROKER_BALANCES,
  BROKER_CURRENCIES,
  BROKER_LEVERAGES,
  BROKER_MODES,
  BROKER_PLATFORMS,
  BROKER_TYPE_LABELS,
  BROKER_TYPE_META,
} from '@/data/brokers'
import { createBrokerAccountFromDraft, titleFor } from '@/lib/accounts'
import { formatMoney, formatUsd2 } from '@/lib/format'
import type { BrokerAccountType, BrokerMode, Platform, Rules } from '@/lib/types'
import { cn } from '@/lib/cn'

const DEFAULT_RULES: Rules = { target: 0, daily: 0, max: 0, days: 0 }

export function BrokerModal() {
  const {
    brokerChallengeOpen,
    editingBrokerAccount,
    closeBrokerChallenge,
    addBrokerAccount,
    updateBrokerAccount,
    showToast,
  } = useApp()
  const navigate = useNavigate()

  const isEditing = !!editingBrokerAccount

  const [name, setName] = useState('')
  const [brokerId, setBrokerId] = useState(BROKERS[0]?.id ?? 'exness')
  const [brokerType, setBrokerType] = useState<BrokerAccountType>('raw_spread')
  const [brokerMode, setBrokerMode] = useState<BrokerMode>('Live')
  const [platform, setPlatform] = useState<Platform>('MT5')
  const [leverage, setLeverage] = useState<string>('1:1000')
  const [currency, setCurrency] = useState<string>('USD')
  const [balanceInput, setBalanceInput] = useState('10000')
  const [rules, setRules] = useState<Rules>(DEFAULT_RULES)
  const [nameError, setNameError] = useState('')
  const [balanceError, setBalanceError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const balanceInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!brokerChallengeOpen) return
    if (editingBrokerAccount) {
      const matchedBroker =
        BROKERS.find(
          (item) => item.name === editingBrokerAccount.firm || item.id === editingBrokerAccount.firm,
        ) ?? BROKERS[0]
      const starting = editingBrokerAccount.startingBalance || editingBrokerAccount.size || 10_000
      setName(editingBrokerAccount.name ?? '')
      setBrokerId(matchedBroker?.id ?? 'exness')
      setBrokerType(editingBrokerAccount.brokerType ?? 'raw_spread')
      setBrokerMode(editingBrokerAccount.brokerMode ?? 'Live')
      setPlatform(editingBrokerAccount.platform ?? 'MT5')
      setLeverage(editingBrokerAccount.leverage ?? '1:1000')
      setCurrency(editingBrokerAccount.currency || 'USD')
      setBalanceInput(String(starting))
      setRules({
        target: Number(editingBrokerAccount.rules?.target) || 0,
        daily: Number(editingBrokerAccount.rules?.daily) || 0,
        max: Number(editingBrokerAccount.rules?.max) || 0,
        days: 0,
      })
      setNameError('')
      setBalanceError('')
      setSubmitting(false)
      return
    }
    setName('')
    setBrokerId(BROKERS[0]?.id ?? 'exness')
    setBrokerType('raw_spread')
    setBrokerMode('Live')
    setPlatform('MT5')
    setLeverage('1:1000')
    setCurrency('USD')
    setBalanceInput('10000')
    setRules({ ...DEFAULT_RULES })
    setNameError('')
    setBalanceError('')
    setSubmitting(false)
  }, [brokerChallengeOpen, editingBrokerAccount])

  const broker = BROKERS.find((item) => item.id === brokerId) ?? BROKERS[0]
  const parsedBalance = Number.parseFloat(balanceInput)
  const balance = Number.isFinite(parsedBalance) && parsedBalance > 0 ? parsedBalance : 0

  const targetPct = Number(rules.target) || 0
  const dailyPct = Number(rules.daily) || 0
  const maxPct = Number(rules.max) || 0

  const targetAmount = balance * (targetPct / 100)
  const dailyAmount = balance * (dailyPct / 100)
  const maxLossAmount = balance * (maxPct / 100)
  const floorEquity = Math.max(0, balance - maxLossAmount)

  const hasGuardrails = targetPct > 0 || dailyPct > 0 || maxPct > 0

  const typeOptions = useMemo(
    () =>
      (Object.keys(BROKER_TYPE_LABELS) as BrokerAccountType[]).map((value) => ({
        value,
        label: BROKER_TYPE_LABELS[value],
        tag: BROKER_TYPE_META[value].tag,
      })),
    [],
  )

  const modeOptions = useMemo(
    () => BROKER_MODES.map((value) => ({ value, label: value })),
    [],
  )

  const platformOptions = useMemo(
    () => BROKER_PLATFORMS.map((value) => ({ value, label: value })),
    [],
  )

  const updateRule = (key: 'target' | 'daily' | 'max', raw: string) => {
    const value = raw === '' ? 0 : Math.max(0, Number(raw) || 0)
    setRules((previous) => ({ ...previous, [key]: value, days: 0 }))
  }

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting || !broker) return

    const trimmedName = name.trim()
    if (!trimmedName) {
      setNameError('Enter an account name.')
      nameInputRef.current?.focus()
      return
    }
    setNameError('')

    if (!(balance > 0)) {
      setBalanceError('Enter a starting deposit greater than zero.')
      balanceInputRef.current?.focus()
      return
    }
    setBalanceError('')

    const normalizedRules: Rules = {
      target: targetPct,
      daily: dailyPct,
      max: maxPct,
      days: 0,
    }

    if (editingBrokerAccount) {
      setSubmitting(true)
      updateBrokerAccount(editingBrokerAccount.id, {
        name: trimmedName,
        brokerId: broker.id,
        brokerType,
        brokerMode,
        platform,
        leverage,
        currency,
        balance,
        rules: normalizedRules,
      })
      closeBrokerChallenge()
      showToast('Broker account updated', `${trimmedName} settings have been saved.`)
      return
    }

    setSubmitting(true)
    const account = createBrokerAccountFromDraft({
      name: trimmedName,
      brokerId: broker.id,
      brokerType,
      brokerMode,
      platform,
      leverage,
      currency,
      balance,
      rules: normalizedRules,
    })
    addBrokerAccount(account)
    closeBrokerChallenge()
    navigate('/brokers')
    showToast(
      'Broker account added',
      `${titleFor(account)} (${broker.name} · ${BROKER_TYPE_LABELS[brokerType]}) is ready with ${formatMoney(account.startingBalance, account.currency)}.`,
    )
  }

  const resolvedLabel = name.trim() || `${broker.name} ${BROKER_TYPE_LABELS[brokerType]}`

  return (
    <Modal
      open={brokerChallengeOpen}
      onClose={closeBrokerChallenge}
      size="xl"
      className="challenge-modal broker-modal"
      labelledBy="broker-modal-title"
      initialFocus="[data-autofocus]"
    >
      <form className="challenge-form" onSubmit={submit} noValidate>
        <header className="modal-head challenge-head">
          <div className="modal-head-copy">
            <h2 className="modal-title" id="broker-modal-title">
              {isEditing ? `Edit ${titleFor(editingBrokerAccount!)}` : 'Add broker account'}
            </h2>
            <p className="modal-sub">
              {isEditing
                ? 'Update your broker settings, starting capital, or personal risk guardrails.'
                : 'Configure your Exness live or demo account, leverage, and personal risk limits.'}
            </p>
          </div>
          <ModalClose onClick={closeBrokerChallenge} />
        </header>

        <div className="modal-body challenge-layout">
          {/* Left column: broker configuration */}
          <div className="challenge-config">
            <div className="challenge-identity-row">
              <section className="challenge-block">
                <div className="challenge-section-head">
                  <label className="field-label" htmlFor="broker-account-name">
                    Account name
                  </label>
                  <span className="challenge-meta-note">Required</span>
                </div>
                <input
                  ref={nameInputRef}
                  id="broker-account-name"
                  className={cn('input challenge-name-input', nameError && 'is-error')}
                  type="text"
                  maxLength={48}
                  data-autofocus
                  placeholder="e.g. Exness Raw Live"
                  value={name}
                  required
                  aria-invalid={!!nameError}
                  aria-describedby={nameError ? 'broker-account-name-error' : undefined}
                  onChange={(event) => {
                    setName(event.target.value)
                    if (nameError && event.target.value.trim()) {
                      setNameError('')
                    }
                  }}
                />
                {nameError && (
                  <p id="broker-account-name-error" className="challenge-field-error" role="alert">
                    {nameError}
                  </p>
                )}
              </section>

              <section className="challenge-block">
                <span className="field-label">Broker</span>
                <div className="firm-strip" role="radiogroup" aria-label="Broker">
                  {BROKERS.map((item) => {
                    const selected = item.id === brokerId
                    return (
                      <button
                        key={item.id}
                        className={cn('firm-row', selected && 'is-selected')}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setBrokerId(item.id)}
                      >
                        <span className="firm-monogram broker-monogram" aria-hidden="true">
                          {item.badge}
                        </span>
                        <span className="firm-row-copy">
                          <b>{item.name}</b>
                          <span>{item.meta}</span>
                        </span>
                        <span className="firm-row-check" aria-hidden="true">
                          {selected && <Check size={11} strokeWidth={2.5} />}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </section>
            </div>

            <div className="challenge-identity-row">
              <section className="challenge-block">
                <div className="challenge-section-head">
                  <span className="field-label">Account mode</span>
                  <span className="challenge-meta-note">{brokerMode === 'Live' ? 'Real funds' : 'Practice'}</span>
                </div>
                <Segmented<BrokerMode>
                  label="Broker account mode"
                  value={brokerMode}
                  options={modeOptions}
                  onChange={setBrokerMode}
                  className="challenge-segment"
                />
              </section>

              <section className="challenge-block">
                <div className="challenge-section-head">
                  <span className="field-label">Terminal</span>
                  <span className="challenge-meta-note">{platform}</span>
                </div>
                <Segmented<Platform>
                  label="Trading platform"
                  value={platform}
                  options={platformOptions}
                  onChange={setPlatform}
                  className="challenge-segment"
                />
              </section>
            </div>

            <section className="challenge-block">
              <div className="challenge-section-head">
                <span className="field-label">{broker.name} account type</span>
                <span className="challenge-meta-note">{typeOptions.length} tiers</span>
              </div>
              <div className="type-grid" role="radiogroup" aria-label="Broker account type">
                {typeOptions.map((option) => {
                  const selected = option.value === brokerType
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      className={cn('program-option', selected && 'is-selected')}
                      onClick={() => setBrokerType(option.value)}
                    >
                      <span className="program-option-name">{option.label}</span>
                      <span className="program-option-cadence">{option.tag}</span>
                    </button>
                  )
                })}
              </div>
              <p className="challenge-hint">{BROKER_TYPE_META[brokerType].summary}</p>
            </section>

            <section className="challenge-block">
              <div className="challenge-section-head">
                <span className="field-label">Starting balance</span>
                <span className="challenge-meta-note num">
                  {currency} · {balance > 0 ? formatMoney(balance, currency) : 'Enter amount'}
                </span>
              </div>
              <div className="size-grid is-cols-4" role="group" aria-label="Starting balance presets">
                {BROKER_BALANCES.map((preset) => (
                  <button
                    key={preset}
                    className={cn('size-option num', balance === preset && 'is-selected')}
                    type="button"
                    aria-pressed={balance === preset}
                    onClick={() => {
                      setBalanceInput(String(preset))
                      if (balanceError) setBalanceError('')
                    }}
                  >
                    ${preset.toLocaleString('en-US')}
                  </button>
                ))}
              </div>
              <div className="broker-balance-custom">
                <label className="field">
                  <span className="rule-field-label">Custom deposit amount</span>
                  <div className="input-wrap has-prefix">
                    <span className="prefix">{currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$'}</span>
                    <input
                      ref={balanceInputRef}
                      className={cn('input num', balanceError && 'is-error')}
                      type="number"
                      min="1"
                      step="any"
                      placeholder="10000"
                      value={balanceInput}
                      onChange={(event) => {
                        setBalanceInput(event.target.value)
                        if (balanceError && Number(event.target.value) > 0) setBalanceError('')
                      }}
                    />
                  </div>
                </label>
                <label className="field">
                  <span className="rule-field-label">Currency</span>
                  <select
                    className="select"
                    value={currency}
                    onChange={(event) => setCurrency(event.target.value)}
                    aria-label="Account currency"
                  >
                    {BROKER_CURRENCIES.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="rule-field-label">Max leverage</span>
                  <select
                    className="select num"
                    value={leverage}
                    onChange={(event) => setLeverage(event.target.value)}
                    aria-label="Account leverage"
                  >
                    {BROKER_LEVERAGES.map((ratio) => (
                      <option key={ratio} value={ratio}>
                        {ratio}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {balanceError && (
                <p className="challenge-field-error" role="alert">
                  {balanceError}
                </p>
              )}
            </section>
          </div>

          {/* Right column: live specification + personal risk guardrails */}
          <aside className="challenge-blueprint" aria-label="Broker account summary">
            <div className="blueprint-hero">
              <div className="blueprint-hero-top">
                <span className="blueprint-eyebrow">Starting deposit</span>
                <span className="blueprint-mode-note">{brokerMode}</span>
              </div>
              <strong className="blueprint-capital num">
                {balance > 0 ? formatMoney(balance, currency) : '—'}
              </strong>
              <p className="blueprint-meta">
                <span>{resolvedLabel}</span>
                <span aria-hidden="true">·</span>
                <span>{broker.name}</span>
                <span aria-hidden="true">·</span>
                <span>{BROKER_TYPE_LABELS[brokerType]}</span>
              </p>
            </div>

            <div className="broker-blueprint-specs" aria-label="Broker execution specs">
              <div className="broker-blueprint-spec">
                <span>Terminal</span>
                <b>{platform}</b>
              </div>
              <div className="broker-blueprint-spec">
                <span>Leverage</span>
                <b className="num">{leverage}</b>
              </div>
              <div className="broker-blueprint-spec">
                <span>Currency</span>
                <b>{currency}</b>
              </div>
            </div>

            <section className="blueprint-rules">
              <div className="challenge-section-head">
                <span className="field-label">
                  <ShieldCheck size={12} /> Personal risk guardrails
                </span>
                {hasGuardrails ? (
                  <button
                    type="button"
                    className="challenge-reset-btn"
                    onClick={() => setRules({ ...DEFAULT_RULES })}
                  >
                    <RotateCcw size={11} />
                    <span>Clear limits</span>
                  </button>
                ) : (
                  <span className="challenge-meta-note">Optional · 0 = Off</span>
                )}
              </div>

              <div className="broker-rules-grid">
                <label className="rule-field">
                  <span className="rule-field-label">Daily loss limit</span>
                  <span className="rule-box">
                    <input
                      className="input num"
                      type="number"
                      min="0"
                      step="0.1"
                      value={rules.daily}
                      onChange={(event) => updateRule('daily', event.target.value)}
                    />
                    <span className="rule-suffix">%</span>
                  </span>
                </label>

                <label className="rule-field">
                  <span className="rule-field-label">Max drawdown</span>
                  <span className="rule-box">
                    <input
                      className="input num"
                      type="number"
                      min="0"
                      step="0.1"
                      value={rules.max}
                      onChange={(event) => updateRule('max', event.target.value)}
                    />
                    <span className="rule-suffix">%</span>
                  </span>
                </label>

                <label className="rule-field">
                  <span className="rule-field-label">Profit goal</span>
                  <span className="rule-box">
                    <input
                      className="input num"
                      type="number"
                      min="0"
                      step="0.1"
                      value={rules.target}
                      onChange={(event) => updateRule('target', event.target.value)}
                    />
                    <span className="rule-suffix">%</span>
                  </span>
                </label>
              </div>
            </section>

            <dl className="blueprint-ledger">
              <div className="blueprint-row">
                <dt>Daily loss limit</dt>
                <dd className="num">
                  {dailyPct <= 0 || balance <= 0 ? (
                    <span className="is-none">Off</span>
                  ) : (
                    <>
                      <b>{formatUsd2(dailyAmount, currency)}</b>
                      <small>{dailyPct}%</small>
                    </>
                  )}
                </dd>
              </div>
              <div className="blueprint-row">
                <dt>Max drawdown</dt>
                <dd className="num">
                  {maxPct <= 0 || balance <= 0 ? (
                    <span className="is-none">Off</span>
                  ) : (
                    <>
                      <b>{formatUsd2(maxLossAmount, currency)}</b>
                      <small>{maxPct}%</small>
                    </>
                  )}
                </dd>
              </div>
              <div className="blueprint-row">
                <dt>Equity floor</dt>
                <dd className="num">
                  {maxPct <= 0 || balance <= 0 ? (
                    <span className="is-none">Off</span>
                  ) : (
                    <b>{formatUsd2(floorEquity, currency)}</b>
                  )}
                </dd>
              </div>
              <div className="blueprint-row">
                <dt>Profit goal</dt>
                <dd className="num">
                  {targetPct <= 0 || balance <= 0 ? (
                    <span className="is-none">Off</span>
                  ) : (
                    <>
                      <b>{formatUsd2(targetAmount, currency)}</b>
                      <small>{targetPct}%</small>
                    </>
                  )}
                </dd>
              </div>
            </dl>
          </aside>
        </div>

        <footer className="modal-foot challenge-foot">
          <div className="challenge-foot-summary">
            <Wallet size={13} />
            <span>
              {isEditing
                ? `Editing ${titleFor(editingBrokerAccount!)} · recorded trades preserved`
                : `${broker.name} · ${BROKER_TYPE_LABELS[brokerType]} · ${brokerMode} · ${leverage}`}
            </span>
          </div>
          <span className="spacer" />
          <Button variant="ghost" type="button" onClick={closeBrokerChallenge}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            loading={submitting}
            iconRight={!submitting ? <ArrowRight size={14} /> : undefined}
          >
            {isEditing ? 'Save changes' : 'Add broker account'}
          </Button>
        </footer>
      </form>
    </Modal>
  )
}
