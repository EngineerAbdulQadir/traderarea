import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Building2, ShieldCheck, Sparkles, Wallet } from 'lucide-react'
import { Modal, ModalClose } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Segmented } from '@/components/ui/Segmented'
import { AccountAvatar } from '@/components/ui/AccountAvatar'
import { useApp } from '@/store/AppStore'
import {
  CHALLENGE_SIZES,
  PLATFORMS,
  PROP_FIRMS,
  RULES_BY_TYPE,
  STAGES_BY_TYPE,
  TYPE_LABELS,
  fundedAccountSize,
  fundedMaxLossPct,
  rulesFor,
} from '@/data/firms'
import { createAccountFromDraft, titleFor } from '@/lib/accounts'
import { formatMoney, formatSize } from '@/lib/format'
import type { AccountType, Platform, Rules, Stage } from '@/lib/types'
import { cn } from '@/lib/cn'

const DEFAULT_SIZE = CHALLENGE_SIZES[0]
const DEFAULT_PLATFORM: Platform = PLATFORMS[0]
const FALLBACK_RULES: Rules = RULES_BY_TYPE.step1['Phase 1'] ?? { target: 10, daily: 5, max: 10, days: 5 }

function presetFor(type: AccountType, stage: Stage): Rules {
  const preset = rulesFor(type, stage)
  return preset ? { ...preset } : { ...FALLBACK_RULES }
}

export function ChallengeModal() {
  const { challengeOpen, closeChallenge, addAccount, showToast } = useApp()
  const navigate = useNavigate()

  const [firmId, setFirmId] = useState(PROP_FIRMS[0]?.id ?? 'eze')
  const [type, setType] = useState<AccountType>('step1')
  const [stage, setStage] = useState<Stage>('Phase 1')
  const [size, setSize] = useState(DEFAULT_SIZE)
  const [platform, setPlatform] = useState<Platform>(DEFAULT_PLATFORM)
  const [rules, setRules] = useState<Rules>(() => presetFor('step1', 'Phase 1'))
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!challengeOpen) return
    setFirmId(PROP_FIRMS[0]?.id ?? 'eze')
    setType('step1')
    setStage('Phase 1')
    setSize(DEFAULT_SIZE)
    setPlatform(DEFAULT_PLATFORM)
    setRules(presetFor('step1', 'Phase 1'))
    setSubmitting(false)
  }, [challengeOpen])

  const firm = PROP_FIRMS.find((item) => item.id === firmId) ?? PROP_FIRMS[0]
  const stages = STAGES_BY_TYPE[type]
  const funded = stage === 'Funded'
  const balance = funded ? fundedAccountSize(size) : size
  const targetAmount = funded ? 0 : balance * ((Number(rules.target) || 0) / 100)
  const maxLossAmount = balance * ((Number(rules.max) || 0) / 100)

  const typeOptions = useMemo(
    () =>
      (Object.keys(TYPE_LABELS) as AccountType[]).map((value) => ({
        value,
        label: TYPE_LABELS[value],
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
    setSubmitting(true)
    const account = createAccountFromDraft({ firmId: firm.id, type, stage, platform, size, rules })
    addAccount(account)
    closeChallenge()
    navigate('/portfolio')
    showToast(
      'Challenge created',
      `${titleFor(account)} is ready with ${formatMoney(account.startingBalance)} in starting capital.`,
    )
  }

  return (
    <Modal
      open={challengeOpen}
      onClose={closeChallenge}
      size="lg"
      className="challenge-modal"
      labelledBy="challenge-title"
      initialFocus="[data-autofocus]"
    >
      <form className="challenge-form" onSubmit={submit} noValidate>
        <header className="modal-head challenge-head">
          <div className="modal-head-copy">
            <h2 className="modal-title" id="challenge-title">
              Build your next workspace
            </h2>
            <p className="modal-sub">Pick the firm and phase. Rules stay editable so the journal matches your challenge.</p>
          </div>
          <ModalClose onClick={closeChallenge} />
        </header>

        <div className="modal-body challenge-body">
          <section className="challenge-section">
            <div className="challenge-section-head">
              <span className="field-label">
                <Building2 size={12} /> Prop firm
              </span>
              <span className="challenge-count">
                {PROP_FIRMS.length} available
              </span>
            </div>
            <div className="firm-grid" role="radiogroup" aria-label="Prop firm">
              {PROP_FIRMS.map((item, index) => {
                const selected = item.id === firmId
                return (
                  <button
                    key={item.id}
                    className={cn('firm-choice', selected && 'is-selected')}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    data-autofocus={index === 0 ? true : undefined}
                    onClick={() => setFirmId(item.id)}
                  >
                    <AccountAvatar badge={item.badge} gradient={item.gradient} size="md" />
                    <span className="firm-choice-copy">
                      <b>{item.name}</b>
                      <span>{item.meta}</span>
                    </span>
                    <span className="firm-choice-check" aria-hidden="true">
                      {selected ? '✓' : ''}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>

          <div className="challenge-columns">
            <section className="challenge-section">
              <span className="field-label">Account type</span>
              <Segmented<AccountType>
                label="Account type"
                value={type}
                options={typeOptions}
                onChange={chooseType}
                className="challenge-segment"
              />
              <p className="challenge-hint">
                {type === 'step1'
                  ? 'Single evaluation with a direct path to funded.'
                  : type === 'step2'
                    ? 'Two evaluation phases before the funded account.'
                    : 'Two phases with a higher funded drawdown allowance.'}
              </p>
            </section>

            <section className="challenge-section">
              <span className="field-label">Starting phase</span>
              <Segmented<Stage>
                label="Starting phase"
                value={stage}
                options={stageOptions}
                onChange={chooseStage}
                className="challenge-segment"
              />
              <p className="challenge-hint">
                {funded ? 'Funded accounts start at 10% of the challenge size.' : 'You can move phase later from the account card.'}
              </p>
            </section>
          </div>

          <div className="challenge-columns">
            <section className="challenge-section">
              <div className="challenge-section-head">
                <span className="field-label">Account size</span>
                <span className="challenge-balance">
                  Balance <b className="num">{formatMoney(balance)}</b>
                </span>
              </div>
              <div className="size-grid" role="group" aria-label="Account size">
                {CHALLENGE_SIZES.map((option) => (
                  <button
                    key={option}
                    className={cn('size-option', option === size && 'is-selected')}
                    type="button"
                    aria-pressed={option === size}
                    onClick={() => setSize(option)}
                  >
                    {formatSize(option)}
                  </button>
                ))}
              </div>
            </section>

            <section className="challenge-section">
              <span className="field-label">Platform</span>
              <Segmented<Platform>
                label="Trading platform"
                value={platform}
                options={PLATFORMS.map((value) => ({ value, label: value }))}
                onChange={setPlatform}
                className="challenge-segment platform-segment"
              />
              <p className="challenge-hint">Purely a label today — you can change it when importing trades later.</p>
            </section>
          </div>

          <section className="challenge-rules">
            <div className="challenge-section-head">
              <span className="field-label">
                <ShieldCheck size={12} /> Risk rules
              </span>
              <span className="challenge-rules-note">
                {funded ? 'Funded drawdown uses the funded balance.' : 'Percentages of the starting balance.'}
              </span>
            </div>

            <div className={cn('rule-grid', funded && 'is-funded')}>
              {!funded && (
                <>
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
                  <label className="rule-field">
                    <span className="rule-field-label">Max daily loss</span>
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
                </>
              )}
              <label className="rule-field">
                <span className="rule-field-label">{funded ? 'Max total loss' : 'Max total loss'}</span>
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

            <div className="rule-preview">
              <div>
                <span>Account</span>
                <b>{firm?.name ?? 'Prop firm'} · {TYPE_LABELS[type]} · {formatSize(size)}</b>
              </div>
              <div>
                <span>{funded ? 'Funded balance' : 'Profit target'}</span>
                <b className="num">{formatMoney(funded ? balance : targetAmount)}</b>
              </div>
              <div>
                <span>{funded ? 'Drawdown allowance' : 'Max loss buffer'}</span>
                <b className="num">{formatMoney(maxLossAmount)}</b>
              </div>
              <div>
                <span>{funded ? 'Rule source' : 'Profitable days'}</span>
                <b className="num">{funded ? `${fundedMaxLossPct(type)}% preset` : `${rules.days} days`}</b>
              </div>
            </div>

            {funded && (
              <div className="form-info">
                <Sparkles size={13} />
                <span>
                  Funded challenge sizes convert at 1:10. A {formatSize(size)} challenge opens a{' '}
                  <b>{formatMoney(fundedAccountSize(size))}</b> funded balance with a{' '}
                  <b>{formatMoney(maxLossAmount)}</b> max-loss buffer.
                </span>
              </div>
            )}
          </section>
        </div>

        <footer className="modal-foot challenge-foot">
          <div className="challenge-foot-summary">
            <Wallet size={13} />
            <span>
              {firm?.name ?? 'Prop firm'} · {stage} · {platform}
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
            Create challenge
          </Button>
        </footer>
      </form>
    </Modal>
  )
}
