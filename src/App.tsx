import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { CommandPalette } from '@/components/layout/CommandPalette'
import { ToastStack } from '@/components/layout/ToastStack'
import { ChallengeModal } from '@/components/modals/ChallengeModal'
import { DayReviewModal } from '@/components/modals/DayReviewModal'
import { TradeModal } from '@/components/modals/TradeModal'
import { SettingsModal } from '@/components/modals/SettingsModal'
import { AccountsPage } from '@/pages/Accounts'
import { AuthPage } from '@/pages/Auth'
import { DashboardPage } from '@/pages/Dashboard'
import { JournalPage } from '@/pages/Journal'
import { EntriesPage } from '@/pages/Entries'
import { NotesPage } from '@/pages/Notes'
import { ReportsPage } from '@/pages/Reports'
import { StatsPage } from '@/pages/Stats'

export default function App() {
  return (
    <>
      <Routes>
        <Route path="auth" element={<Navigate to="/auth/login" replace />} />
        <Route path="auth/login" element={<AuthPage mode="login" />} />
        <Route path="auth/signup" element={<AuthPage mode="signup" />} />
        <Route path="auth/forgot-password" element={<AuthPage mode="forgot" />} />
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/metrics" replace />} />
          <Route path="metrics" element={<DashboardPage />} />
          <Route path="journal" element={<JournalPage />} />
          <Route path="portfolio" element={<AccountsPage />} />
          <Route path="accounts" element={<Navigate to="/portfolio" replace />} />
          <Route path="stats" element={<StatsPage />} />
          <Route path="entries" element={<EntriesPage />} />
          <Route path="notes" element={<NotesPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="*" element={<Navigate to="/metrics" replace />} />
        </Route>
      </Routes>
      <ChallengeModal />
      <TradeModal />
      <DayReviewModal />
      <SettingsModal />
      <CommandPalette />
      <ToastStack />
    </>
  )
}
