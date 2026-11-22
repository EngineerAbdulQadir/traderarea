import type { Broker, BrokerAccountType, BrokerMode, Platform } from '@/lib/types'

export const BROKERS: Broker[] = [
  {
    id: 'exness',
    name: 'Exness',
    short: 'Exness',
    badge: 'EX',
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)',
    meta: 'Forex, Metals & Crypto · Instant withdrawals',
  },
]

export const BROKER_TYPE_LABELS: Record<BrokerAccountType, string> = {
  standard: 'Standard',
  standard_cent: 'Standard Cent',
  raw_spread: 'Raw Spread',
  zero: 'Zero',
  pro: 'Pro',
}

export const BROKER_TYPE_META: Record<
  BrokerAccountType,
  { tag: string; summary: string }
> = {
  standard: {
    tag: 'No commission',
    summary: 'All-in-one account with spreads from 0.2 pips, zero commission, and $10 minimum deposit.',
  },
  standard_cent: {
    tag: 'Cent lots',
    summary: 'Trade micro cent lots for smaller position sizing with spreads from 0.3 pips and zero commission.',
  },
  raw_spread: {
    tag: '0.0 spreads',
    summary: 'Ultra-low spreads from 0.0 pips with fixed commission up to $3.50 per side per lot.',
  },
  zero: {
    tag: 'Top 30 zero',
    summary: '0.0 spreads for 95% of the day on top 30 instruments with commission from $0.05 per lot.',
  },
  pro: {
    tag: 'Instant exec',
    summary: 'Low spreads from 0.1 pips, zero trading commission, and instant or market execution.',
  },
}

export const BROKER_MODES: BrokerMode[] = ['Live', 'Demo']

export const BROKER_PLATFORMS: Platform[] = ['MT5', 'MT4', 'Exness Terminal']

export const BROKER_LEVERAGES = ['1:200', '1:500', '1:1000', '1:2000', '1:Unlimited'] as const

export const BROKER_CURRENCIES = ['USD', 'EUR', 'GBP'] as const

export const BROKER_BALANCES = [500, 1_000, 2_500, 5_000, 10_000, 25_000, 50_000, 100_000]

export function getBroker(id: string): Broker {
  return BROKERS.find((broker) => broker.id === id) ?? BROKERS[0]
}
