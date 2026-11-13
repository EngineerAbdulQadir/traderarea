# Trader Area — Roadmap

> Goal: make Trader Area the most popular **free** trading journal among retail & funded traders, while building a sustainable revenue engine that funds "top notch" features — without ever paywalling the core journal.

**Positioning:** Free forever for logging, stats & analysis. Pay only for cloud, AI, and team features. Earn affiliate revenue from prop firms/brokers so the free tier stays genuinely free.

---

## North Star Metrics

| Metric | Target (6 mo) | Target (12 mo) |
|---|---|---|
| Monthly active traders | 5,000 | 25,000 |
| Shared PnL cards / month | 500 | 5,000 |
| Affiliate revenue / month | $200 | $2,000 |
| Pro (paid) subscribers | 50 | 500 |
| MRR | $250 | $3,500 |

**Viral KPI:** shares per active user ≥ 0.1/month.

---

## Phase 0 — Foundation (Week 1–2) ✅ mostly done
- [x] Core journal, stats, charts (heatmap, profit factor, radar, donut, day strip)
- [x] Accounts, phases, funded-account sizes (`src/data/firms.ts`)
- [x] CSV/XLSX import & export (`src/lib/csv.ts`, `src/lib/xlsx.ts`)
- [x] MT4/MT5 import (`src/lib/mtImport.ts`)
- [x] Demo account with seeded notes
- [x] Dark/light themes
- [ ] Add `src/lib/telemetry.ts` (UTM capture, share-card, referral tracking)
- [ ] Add `isPro` feature flag plumbing in `AppStore` (gates future paid features only)

## Phase 1 — Viral & Free Growth (Week 2–4)
**Theme: make every user a marketer.**
- [ ] **Shareable PnL card** (PNG export, branded, watermark "Made with Trader Area — free")
  - Trigger from Dashboard/Stats: monthly PnL, win rate, profit factor, streak
  - Web Share API + download fallback
- [ ] **Referral links** — `traderarea.app/?ref=CODE` → "Invited by X" banner + bonus
- [ ] **First-run "wow"** — demo account loads instantly with full beautiful journal (already seeded; polish empty states)
- [ ] **Empty-state CTAs** → "Import your MT4/MT5 history" one click
- [ ] **UTM tracking** on all outbound affiliate links
- [ ] Public read-only "my month" page (optional, SEO + social proof)

## Phase 2 — Zero-Budget Acquisition (Month 1–2)
**Theme: go where traders are.**
- [ ] Reddit value posts (r/Daytrading, r/Forex, r/propfirm, r/Futures, r/Trading) — process content + screenshots
- [ ] X/Twitter daily trade-review screenshots, heatmaps (#trading #propfirm #fundedtrader)
- [ ] Discord presence in FTMO/Topstep/Apex/prop-firm servers — help first, link when asked
- [ ] YouTube/TikTok Shorts: "how I review my trades" (30–60s screen recordings)
- [ ] IndieHackers + "Show HN" launch posts
- [ ] Product Hunt launch (Tue/Wed)
- [ ] Micro-influencer outreach: 10 creators (5k–50k) → free Pro + affiliate code for a review video

## Phase 3 — Revenue Engine (Month 1–3)
**Theme: fund the free tier without charging for the core.**

### 3a. Affiliate revenue (no cost, immediate)
- [ ] **Prop firm section** (leverage existing `src/data/firms.ts` + `fundedAccountSize`) with affiliate links: FTMO, Topstep, Apex, MFF, etc.
- [ ] "Recommended tools" (TradingView, brokers) with referral links in Settings/Onboarding
- [ ] Co-branded landing pages: "Trader Area + [Firm]" → higher conversion, mutual benefit
- [ ] Track affiliate clicks → revenue per channel (UTM)

### 3b. Donations / sponsors (low effort)
- [ ] "Support Trader Area" button (Buy Me a Coffee / GitHub Sponsors) in nav + footer
- [ ] Sponsor section in README / about page

### 3c. Pro tier (freemium, paid)
- [ ] Waitlist + email capture for "Trader Area Pro" (measure demand before building backend)
- [ ] Pro features (gated by `isPro`):
  - Cloud sync across devices
  - Auto broker import (MT4/MT5/cTrader)
  - AI trade review / coach
  - Advanced reports & exports
  - Team / mentor sharing
- [ ] Pricing: $5–$9/mo or $49/yr (annual discount)
- [ ] Backend: Supabase/Firebase (auth + DB + storage) — only when waitlist validates demand

## Phase 4 — SEO & Content (Month 2–4)
**Theme: free traffic that compounds.**
- [ ] Host 5–10 help/blog pages on the domain targeting long-tail keywords:
  - "free trading journal"
  - "prop firm challenge tracker"
  - "futures trading journal (Excel alternative)"
  - "how to review trades"
  - "trading journal template"
- [ ] In-app help/docs that double as SEO landing pages
- [ ] Schema markup + sitemap for the marketing pages

## Phase 5 — Partnerships & Community (Month 3–6)
- [ ] Prop firm / broker co-marketing (tool for their traders ↔ affiliate revenue)
- [ ] Trading educators: free Pro + affiliate code in exchange for review content
- [ ] "Community dashboard" feature for Discord servers (group stats) → their members become users
- [ ] Public roadmap + changelog (build-in-public, drives retention & trust)

## Phase 6 — Scale & Polish (Month 6–12)
- [ ] Mobile/PWA polish (traders check on phone)
- [ ] Multi-broker auto-sync
- [ ] AI coach v2 (pattern detection, "your worst setup is X")
- [ ] Team/mentor tier for prop firms & coaches (B2B)
- [ ] Localization (Spanish/Portuguese — huge trading markets)

---

## What NOT to do
- ❌ Ads in the journal — kills the pro feel, low CPM
- ❌ Hard paywall on core logging — destroys the free/popular goal & word-of-mouth
- ❌ Lifetime deals early — undervalues ongoing work (use as launch promo later)
- ❌ Building backend before validating demand with a waitlist

---

## 30-Day Action Plan
1. **Build the shareable PnL card** (biggest viral lever) — Day 1–3
2. **Add affiliate links + UTM tracking** — Day 3–5
3. **Add "Support" button + Pro waitlist/email capture** — Day 5–7
4. **Post 3 Reddit/X value posts** with screenshots — Week 2
5. **DM 10 micro-influencers** — Week 2–3
6. **Product Hunt + Show HN launch** — Week 3–4
7. **Measure:** shares/user, signups by channel, affiliate clicks — end of Month 1

---

## Decision Gates
- **Build backend only if** waitlist ≥ 200 emails OR affiliate revenue ≥ $500/mo.
- **Add AI coach only if** Pro subscribers ≥ 100.
- **Pivot to B2B (prop firms/coaches)** if consumer MRR stalls below $1k at month 6.

---

## Open questions to resolve
1. Do you already have prop-firm affiliate accounts? (If not, apply to FTMO/Topstep/Apex first — free, takes 1–2 weeks.)
2. Hosting budget for backend later? (Supabase free tier covers early stage.)
3. Brand assets: final logo + domain confirmed for shared cards/watermark?
4. Email provider for waitlist (Buttondown / Resend / Mailchimp free tier)?
5. Which broker integrations matter most to your users (MT4/MT5/cTrader/TradeLocker)?