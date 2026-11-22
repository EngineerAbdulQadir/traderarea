import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Check, RotateCcw, ShieldCheck, Wallet } from 'lucide-react'
import { Modal, ModalClose } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Segmented } from '@/components/ui/Segmented'
import { useApp } from '@/store/AppStore'
import {
  CHALLENGE_SIZES,
  PLATFORMS,
  PROP_FIRMS,
  RULES_BY_TYPE,
  STAGES_BY_TYPE,
  TYPE_LABELS,
  fundedAccountSize,
  rulesFor,
  sizesForType,
} from '@/data/firms'
import { createAccountFromDraft, titleFor } from '@/lib/accounts'
import { formatMoney, formatSize, formatUsd2 } from '@/lib/format'
import type { AccountType, Platform, Rules, Stage } from '@/lib/types'
import { cn } from '@/lib/cn'

const DEFAULT_SIZE = CHALLENGE_SIZES[0]
const DEFAULT_PLATFORM: Platform = PLATFORMS[0]
const FALLBACK_RULES: Rules = RULES_BY_TYPE.step1['Phase 1'] ?? { target: 12, daily: 4, max: 8, days: 5 }

const PROGRAM_META: Record<AccountType, { cadence: string; summary: string }> = {
  step1: {
    cadence: '1 phase',
    summary: 'Single evaluation (12% target, 4% daily, 8% max) · 45% funded max loss.',
  },
  step1pro: {
    cadence: '1 phase',
    summary: 'Single evaluation (12% target, 3% daily, 6% max) · 60% funded max loss.',
  },
  step2: {
    cadence: '2 phases',
    summary: 'Two phases (10% / 5% target, 5% daily, 10% max) · 35% funded max loss.',
  },
  step2prime: {
    cadence: '2 phases',
    summary: 'Two phases (10% / 5% target, 5% daily, 10% max) · 50% funded max loss.',
  },
  step2pro: {
    cadence: '2 phases',
    summary: 'Two phases (5% / 8% target, 5% daily, 8% max) · 60% funded max loss.',
  },
  step3: {
    cadence: '3 phases',
    summary: 'Three phases (4% / 5% / 8% target, 3% daily, 8% max) · 80% funded max loss.',
  },
  instant: {
    cadence: 'Direct',
    summary: 'Direct live funded account with 1:1 balance, 10% max loss, no evaluation.',
  },
  exclusive: {
    cadence: '2 phases',
    summary: 'Two phases (4% / 8% target, 3% daily, 8% max) · 30% daily / 80% funded.',
  },
}

function presetFor(type: AccountType, stage: Stage): Rules {
  const preset = rulesFor(type, stage)
  return preset ? { ...preset } : { ...FALLBACK_RULES }
}

function rulesEqual(a: Rules, b: Rules): boolean {
  return (
    Number(a.target) === Number(b.target) &&
    Number(a.daily) === Number(b.daily) &&
    Number(a.max) === Number(b.max) &&
    Number(a.days) === Number(b.days)
  )
}

function stepSubLabel(type: AccountType, item: Stage): string {
  const preset = rulesFor(type, item)
  if (!preset) return ''
  if (item === 'Funded') {
    return preset.daily > 0 ? `${preset.daily}% / ${preset.max}%` : `${preset.max}% max`
  }
  return `${preset.target}% target`
}

export function ChallengeModal() {
  const {
    challengeOpen,
    editingAccount,
    closeChallenge,
    addAccount,
    updateAccount,
    showToast,
  } = useApp()
  const navigate = useNavigate()

  const isEditing = !!editingAccount

  const [name, setName] = useState('')
  const [firmId, setFirmId] = useState(PROP_FIRMS[0]?.id ?? 'eze')
  const [type, setType] = useState<AccountType>('step1')
  const [stage, setStage] = useState<Stage>('Phase 1')
  const [size, setSize] = useState(DEFAULT_SIZE)
  const [rules, setRules] = useState<Rules>(() => presetFor('step1', 'Phase 1'))
  const [nameError, setNameError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!challengeOpen) return
    if (editingAccount) {
      const matchedFirm =
        PROP_FIRMS.find(
          (item) => item.name === editingAccount.firm || item.id === editingAccount.firm,
        ) ?? PROP_FIRMS[0]
      const nextType = editingAccount.type ?? 'step2'
      const validStages = STAGES_BY_TYPE[nextType]
      const nextStage = validStages.includes(editingAccount.stage)
        ? editingAccount.stage
        : validStages[0]
      setName(editingAccount.name ?? '')
      setFirmId(matchedFirm?.id ?? 'eze')
      setType(nextType)
      setStage(nextStage)
      setSize(editingAccount.challengeSize || editingAccount.size || sizesForType(nextType)[0])
      setRules({ ...editingAccount.rules })
      setNameError('')
      setSubmitting(false)
      return
    }
    setName('')
    setFirmId(PROP_FIRMS[0]?.id ?? 'eze')
    setType('step1')
    setStage('Phase 1')
    setSize(DEFAULT_SIZE)
    setRules(presetFor('step1', 'Phase 1'))
    setNameError('')
    setSubmitting(false)
  }, [challengeOpen, editingAccount])

  const firm = PROP_FIRMS.find((item) => item.id === firmId) ?? PROP_FIRMS[0]
  const stages = STAGES_BY_TYPE[type]
  const availableSizes = useMemo(() => {
    const base = sizesForType(type)
    if (isEditing && size > 0 && !base.includes(size)) {
      return [...base, size].sort((a, b) => a - b)
    }
    return base
  }, [type, isEditing, size])

  const funded = stage === 'Funded'
  const balance = funded ? fundedAccountSize(size, type) : size
  const targetPct = funded ? 0 : Number(rules.target) || 0
  const dailyPct = Number(rules.daily) || 0
  const maxPct = Number(rules.max) || 0
  const minDays = funded ? 0 : Math.max(0, Math.round(Number(rules.days) || 0))

  const targetAmount = balance * (targetPct / 100)
  const dailyAmount = balance * (dailyPct / 100)
  const maxLossAmount = balance * (maxPct / 100)
  const floorEquity = Math.max(0, balance - maxLossAmount)

  const officialPreset = presetFor(type, stage)
  const isCustomRules = !rulesEqual(rules, officialPreset)

  const typeOptions = useMemo(
    () =>
      (Object.keys(TYPE_LABELS) as AccountType[]).map((value) => ({
        value,
        label: TYPE_LABELS[value],
        cadence: PROGRAM_META[value].cadence,
      })),
    [],
  )

  const stageOptions = useMemo(
    () => stages.map((value) => ({ value, label: value })),
    [stages],
  )

  const chooseType = (next: AccountType) => {
    setType(next)
    const nextStages = STAGES_BY_TYPE[next]
    const nextStage = nextStages.includes(stage) ? stage : nextStages[0]
    const nextSizes = sizesForType(next)
    if (!nextSizes.includes(size)) {
      setSize(nextSizes[0])
    }
    setStage(nextStage)
    setRules(presetFor(next, nextStage))
  }

  const chooseStage = (next: Stage) => {
    setStage(next)
    setRules(presetFor(type, next))
  }

  const updateRule = (key: keyof Rules, raw: string) => {
    const value = raw === '' ? 0 : Math.max(0, Number(raw) || 0)
    setRules((previous) => ({ ...previous, [key]: value }))
  }

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting || !firm || !(size > 0)) return

    const trimmedName = name.trim()
    if (!trimmedName) {
      setNameError('Enter an account name.')
      nameInputRef.current?.focus()
      return
    }
    setNameError('')

    const normalizedRules: Rules = funded
      ? { target: 0, daily: dailyPct, max: maxPct, days: 0 }
      : { target: targetPct, daily: dailyPct, max: maxPct, days: minDays }

    if (editingAccount) {
      setSubmitting(true)
      updateAccount(editingAccount.id, {
        name: trimmedName,
        firmId: firm.id,
        type,
        stage,
        challengeSize: size,
        rules: normalizedRules,
      })
      closeChallenge()
      showToast('Account updated', `${trimmedName} settings have been saved.`)
      return
    }

    setSubmitting(true)
    const account = createAccountFromDraft({
      name: trimmedName,
      firmId: firm.id,
      type,
      stage,
      platform: DEFAULT_PLATFORM,
      size,
      rules: normalizedRules,
    })
    addAccount(account)
    closeChallenge()
    navigate('/accounts')
    showToast(
      'Challenge created',
      `${titleFor(account)} is ready with ${formatMoney(account.startingBalance)} in starting capital.`,
    )
  }

  const defaultLabel = `${firm?.name ?? 'Eze Funded'} ${formatSize(size)}`
  const resolvedLabel = name.trim() || defaultLabel
  const stageIdx = Math.max(0, stages.indexOf(stage))
  const sizeColsClass =
    availableSizes.length <= 2
      ? 'is-cols-2'
      : availableSizes.length === 3 || availableSizes.length === 6
        ? 'is-cols-3'
        : 'is-cols-4'

  return (
    <Modal
      open={challengeOpen}
      onClose={closeChallenge}
      size="xl"
      className="challenge-modal"
      labelledBy="challenge-title"
      initialFocus="[data-autofocus]"
    >
      <form className="challenge-form" onSubmit={submit} noValidate>
        <header className="modal-head challenge-head">
          <div className="modal-head-copy">
            <h2 className="modal-title" id="challenge-title">
              {isEditing ? `Edit ${titleFor(editingAccount)}` : 'Start new challenge'}
            </h2>
            <p className="modal-sub">
              {isEditing
                ? 'Update any account setting or risk limit. Trades and phase history remain untouched.'
                : 'Select your program, capital tier, and risk parameters.'}
            </p>
          </div>
          <ModalClose onClick={closeChallenge} />
        </header>

        <div className="modal-body challenge-layout">
          {/* Left column: account configuration */}
          <div className="challenge-config">
            <div className="challenge-identity-row">
              <section className="challenge-block">
                <div className="challenge-section-head">
                  <label className="field-label" htmlFor="challenge-account-name">
                    Account name
                  </label>
                  <span className="challenge-meta-note">Required</span>
                </div>
                <input
                  ref={nameInputRef}
                  id="challenge-account-name"
                  className={cn('input challenge-name-input', nameError && 'is-error')}
                  type="text"
                  maxLength={48}
                  data-autofocus
                  placeholder="e.g. Main 10K Challenge"
                  value={name}
                  required
                  aria-invalid={!!nameError}
                  aria-describedby={nameError ? 'challenge-account-name-error' : undefined}
                  onChange={(event) => {
                    setName(event.target.value)
                    if (nameError && event.target.value.trim()) {
                      setNameError('')
                    }
                  }}
                />
                {nameError && (
                  <p id="challenge-account-name-error" className="challenge-field-error" role="alert">
                    {nameError}
                  </p>
                )}
              </section>

              <section className="challenge-block">
                <span className="field-label">Prop firm</span>
                <div className="firm-strip" role="radiogroup" aria-label="Prop firm">
                  {PROP_FIRMS.map((item) => {
                    const selected = item.id === firmId
                    return (
                      <button
                        key={item.id}
                        className={cn('firm-row', selected && 'is-selected')}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setFirmId(item.id)}
                      >
                        <span className="firm-monogram" aria-hidden="true">
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

            <section className="challenge-block">
              <div className="challenge-section-head">
                <span className="field-label">Program type</span>
                <span className="challenge-meta-note">{typeOptions.length} programs</span>
              </div>
              <div className="type-grid" role="radiogroup" aria-label="Account type">
                {typeOptions.map((option) => {
                  const selected = option.value === type
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      className={cn('program-option', selected && 'is-selected')}
                      onClick={() => chooseType(option.value)}
                    >
                      <span className="program-option-name">{option.label}</span>
                      <span className="program-option-cadence">{option.cadence}</span>
                    </button>
                  )
                })}
              </div>
              <p className="challenge-hint">{PROGRAM_META[type].summary}</p>
            </section>

            <section className="challenge-block">
              <div className="challenge-section-head">
                <span className="field-label">Account size</span>
                <span className="challenge-meta-note num">
                  {funded && type !== 'instant' ? 'Challenge tier' : 'Capital'} · {formatMoney(size)}
                </span>
              </div>
              <div className={cn('size-grid', sizeColsClass)} role="group" aria-label="Account size">
                {availableSizes.map((option) => (
                  <button
                    key={option}
                    className={cn('size-option num', option === size && 'is-selected')}
                    type="button"
                    aria-pressed={option === size}
                    onClick={() => setSize(option)}
                  >
                    ${option.toLocaleString('en-US')}
                  </button>
                ))}
              </div>
            </section>

            <section className="challenge-block">
              <div className="challenge-section-head">
                <span className="field-label">{isEditing ? 'Current phase' : 'Starting phase'}</span>
                <span className="challenge-meta-note">
                  {stages.length === 1 ? 'Direct funded · no evaluation' : `${stages.length} stages`}
                </span>
              </div>
              {stages.length > 1 ? (
                <Segmented<Stage>
                  label={isEditing ? 'Current phase' : 'Starting phase'}
                  value={stage}
                  options={stageOptions}
                  onChange={chooseStage}
                  className="challenge-segment"
                />
              ) : (
                <div className="challenge-single-stage">
                  <span>Funded</span>
                  <small>Live immediately with full balance</small>
                </div>
              )}
            </section>
          </div>

          {/* Right column: live specification + editable rules */}
          <aside className="challenge-blueprint" aria-label="Account specification">
            <div className="blueprint-hero">
              <div className="blueprint-hero-top">
                <span className="blueprint-eyebrow">
                  {funded ? 'Live funded capital' : 'Starting capital'}
                </span>
                <span className="blueprint-mode-note">
                  {funded
                    ? type === 'instant'
                      ? '1:1 direct'
                      : '1:10 funded'
                    : 'Evaluation'}
                </span>
              </div>
              <strong className="blueprint-capital num">{formatMoney(balance)}</strong>
              <p className="blueprint-meta">
                <span>{resolvedLabel}</span>
                <span aria-hidden="true">·</span>
                <span>{TYPE_LABELS[type]}</span>
                <span aria-hidden="true">·</span>
                <span>{stage}</span>
              </p>
              {funded && type !== 'instant' && (
                <p className="blueprint-conversion">
                  Converted at 1:10 from {formatMoney(size)} challenge size.
                </p>
              )}
            </div>

            <div className="blueprint-track" aria-label="Program stages">
              {stages.map((item, idx) => {
                const isActive = idx === stageIdx
                const isDone = idx < stageIdx
                return (
                  <button
                    key={item}
                    type="button"
                    className={cn(
                      'blueprint-step',
                      isActive && 'is-active',
                      isDone && 'is-done',
                    )}
                    onClick={() => chooseStage(item)}
                  >
                    <span className="blueprint-step-bar" aria-hidden="true" />
                    <span className="blueprint-step-label">{item}</span>
                    <span className="blueprint-step-sub num">{stepSubLabel(type, item)}</span>
                  </button>
                )
              })}
            </div>

            <section className="blueprint-rules">
              <div className="challenge-section-head">
                <span className="field-label">
                  <ShieldCheck size={12} /> Risk rules
                </span>
                {isCustomRules ? (
                  <button
                    type="button"
                    className="challenge-reset-btn"
                    onClick={() => setRules(officialPreset)}
                  >
                    <RotateCcw size={11} />
                    <span>Reset preset</span>
                  </button>
                ) : (
                  <span className="challenge-meta-note">Official preset</span>
                )}
              </div>

              <div className={cn('rule-grid', funded && 'is-funded')}>
                {!funded && (
                  <label className="rule-field">
                    <span className="rule-field-label">Profit target</span>
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
                )}

                <label className="rule-field">
                  <span className="rule-field-label">
                    Max daily loss{funded ? ' (0 = None)' : ''}
                  </span>
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
                  <span className="rule-field-label">Max total loss</span>
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

                {!funded && (
                  <label className="rule-field">
                    <span className="rule-field-label">Profitable days</span>
                    <span className="rule-box">
                      <input
                        className="input num"
                        type="number"
                        min="0"
                        step="1"
                        value={rules.days}
                        onChange={(event) => updateRule('days', event.target.value)}
                      />
                      <span className="rule-suffix">days</span>
                    </span>
                  </label>
                )}
              </div>
            </section>

            <dl className="blueprint-ledger">
              <div className="blueprint-row">
                <dt>Profit target</dt>
                <dd className="num">
                  {funded || targetPct <= 0 ? (
                    <span className="is-none">None</span>
                  ) : (
                    <>
                      <b>{formatUsd2(targetAmount)}</b>
                      <small>{targetPct}%</small>
                    </>
                  )}
                </dd>
              </div>
              <div className="blueprint-row">
                <dt>Max daily loss</dt>
                <dd className="num">
                  {dailyPct <= 0 ? (
                    <span className="is-none">None</span>
                  ) : (
                    <>
                      <b>{formatUsd2(dailyAmount)}</b>
                      <small>{dailyPct}%</small>
                    </>
                  )}
                </dd>
              </div>
              <div className="blueprint-row">
                <dt>Max total loss</dt>
                <dd className="num">
                  {maxPct <= 0 ? (
                    <span className="is-none">None</span>
                  ) : (
                    <>
                      <b>{formatUsd2(maxLossAmount)}</b>
                      <small>{maxPct}%</small>
                    </>
                  )}
                </dd>
              </div>
              <div className="blueprint-row">
                <dt>Account floor</dt>
                <dd className="num">
                  {maxPct <= 0 ? (
                    <span className="is-none">None</span>
                  ) : (
                    <b>{formatUsd2(floorEquity)}</b>
                  )}
                </dd>
              </div>
              <div className="blueprint-row">
                <dt>Min trading days</dt>
                <dd className="num">
                  {funded || minDays <= 0 ? (
                    <span className="is-none">None</span>
                  ) : (
                    <b>
                      {minDays} profitable {minDays === 1 ? 'day' : 'days'}
                    </b>
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
                ? `Editing ${titleFor(editingAccount)} · trades & phase history preserved`
                : `${firm?.name ?? 'Eze Funded'} · ${TYPE_LABELS[type]} · ${stage}`}
            </span>
          </div>
          <span className="spacer" />
          <Button variant="ghost" type="button" onClick={closeChallenge}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            loading={submitting}
            iconRight={!submitting ? <ArrowRight size={14} /> : undefined}
          >
            {isEditing ? 'Save changes' : 'Create challenge'}
          </Button>
        </footer>
      </form>
    </Modal>
  )
}
