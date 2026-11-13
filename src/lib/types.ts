export type AccountType = 'step1' | 'step2' | 'step2prime'
export type Stage = 'Phase 1' | 'Phase 2' | 'Funded'
export type Platform = 'MT5' | 'cTrader' | 'TradeLocker'
export type Side = 'LONG' | 'SHORT'

export interface Rules {
  target: number
  daily: number
  max: number
  days: number
}

export interface PhaseRecord {
  stage: Stage
  startingBalance: number
  rules: Rules
  endedAt: string
  status: 'passed' | 'breached'
}

export interface Account {
  id: string
  firm: string
  firmBadge: string
  firmGradient: string
  type: AccountType
  size: number
  challengeSize: number
  stage: Stage
  platform: Platform
  startDate: string
  currency: string
  startingBalance: number
  rules: Rules
  source?: string
  createdAt: string
  /** Trades at or before this date-time belong to a completed phase. */
  phaseStartedAt?: string
  /** Completed phases, oldest first, so past results stay viewable. */
  phaseHistory?: PhaseRecord[]
}

export interface Trade {
  id: string
  accountId: string
  date: string
  openTime: string
  closeTime: string
  ticker: string
  instrument: string
  side: Side
  volume: number
  entry: number
  exit: number
  stopLoss?: number
  takeProfit?: number
  pnl: number
  gross: number
  fees: number
  roi: number
  rMultiple: number
  risk?: number
  playbook: string
  quality: number
  tags: string[]
  note: string
  manual: boolean
}

export interface Note {
  text: string
  updatedAt: string
  seeded?: boolean
  /** Data URLs resolved for display. In cloud mode these are fetched on demand. */
  images?: string[]
  /** Firestore ids of screenshot documents (cloud mode). */
  imageIds?: string[]
}

export type AccountNotes = Record<string, Note>
export type NotesByAccount = Record<string, AccountNotes>

export interface DayRow {
  date: string
  pnl: number
  count: number
  wins: number
  losses: number
}

export interface Stats {
  trades: Trade[]
  count: number
  wins: number
  losses: number
  be: number
  winRate: number
  grossProfit: number
  grossLoss: number
  net: number
  pf: number
  avgWin: number
  avgLoss: number
  avgWl: number
  avgTrade: number
  dayRows: DayRow[]
  dayMap: Map<string, DayRow>
  greenDays: number
  /** Days that cleared the 0.5% profitable-day threshold. */
  profitableDays: number
  /** Minimum P&L for one day to count as profitable. */
  profitDayThreshold: number
  redDays: number
  flatDays: number
  dayWinRate: number
  bestDay: DayRow | null
  worstDay: DayRow | null
  maxDrawdown: number
  maxDrawdownPct: number
  recovery: number
  consistency: number
  starting: number
}

export interface Insight {
  tone: 'pos' | 'neg' | 'warn'
  tag: string
  title: string
  text: string
}

export interface RuleRow {
  name: string
  tone: 'is-done' | 'is-info' | 'is-ok' | 'is-warn' | 'is-danger'
  value: string
  limit: string
  pct: number
  left: string
  right: string
}

export interface ScoreComponent {
  label: string
  score: number
  text: string
}

export interface EdgeScore {
  total: number
  grade: string
  components: ScoreComponent[]
  hasData: boolean
}

export interface PropFirm {
  id: string
  name: string
  short: string
  badge: string
  gradient: string
  meta: string
}

export interface ChallengeDraft {
  firmId: string
  type: AccountType
  stage: Stage
  platform: Platform
  size: number
}

export interface DayRowGroup {
  key: string | number
  count: number
  net: number
  wins: number
  losses: number
  gp: number
  gl: number
  r: number
  winRate: number
  pf: number
  avg: number
  avgR: number
}
