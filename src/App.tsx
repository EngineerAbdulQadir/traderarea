import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import {
  GuestOnly,
  RequireAuth,
  RootRedirect,
  SignupGate,
} from '@/components/layout/AuthGate'
import { CommandPalette } from '@/components/layout/CommandPalette'
import { ToastStack } from '@/components/layout/ToastStack'
import { ChallengeModal } from '@/components/modals/ChallengeModal'
import { DayReviewModal } from '@/components/modals/DayReviewModal'
import { MigrationModal } from '@/components/modals/MigrationModal'
import { TradeModal } from '@/components/modals/TradeModal'
import { SettingsModal } from '@/components/modals/SettingsModal'
import { AccountsPage } from '@/pages/Accounts'
import { AuthPage } from '@/pages/Auth'
import { DashboardPage } from '@/pages/Dashboard'
import { JournalPage } from '@/pages/Journal'
import { EntriesPage } from '@/pages/Entries'
import { NotesPage } from '@/pages/Notes'
import { ReportsPage } from '@/pages/Reports'
import { WaitlistPage } from '@/pages/Waitlist'
import { StatsPage } from '@/pages/Stats'
import { ownerLoginSlug } from '@/lib/access'

export default function App() {
  return (
    <>
      <Routes>
        <Route index element={<RootRedirect />} />
        <Route
          path="auth"
          element={
            <GuestOnly>
              <Navigate to="/auth/login" replace />
            </GuestOnly>
          }
        />
        <Route
          path="auth/login"
          element={
            <GuestOnly>
              <AuthPage mode="login" />
            </GuestOnly>
          }
        />
        <Route
          path="auth/signup"
          element={
            <SignupGate>
              <AuthPage mode="signup" />
            </SignupGate>
          }
        />
        <Route
          path="auth/forgot-password"
          element={
            <GuestOnly>
              <AuthPage mode="forgot" />
            </GuestOnly>
          }
        />
        <Route
          path={ownerLoginSlug}
          element={
            <GuestOnly allowSecretRoute>
              <AuthPage mode="login" />
            </GuestOnly>
          }
        />
        <Route
          path={`${ownerLoginSlug}/forgot-password`}
          element={
            <GuestOnly allowSecretRoute>
              <AuthPage mode="forgot" />
            </GuestOnly>
          }
        />
        <Route path="waitlist" element={<WaitlistPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
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
        </Route>
        <Route path="*" element={<RootRedirect />} />
      </Routes>
      <ChallengeModal />
      <TradeModal />
      <DayReviewModal />
      <SettingsModal />
      <MigrationModal />
      <CommandPalette />
      <ToastStack />
    </>
  )
}
