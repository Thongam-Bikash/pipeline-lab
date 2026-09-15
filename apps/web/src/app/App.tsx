import { BrowserRouter, Route, Routes } from 'react-router'
import { AccountPage } from '@/features/account/AccountPage'
import { ForgotPasswordPage } from '@/features/account/ForgotPasswordPage'
import { ResetPasswordPage } from '@/features/account/ResetPasswordPage'
import { SignInPage } from '@/features/account/SignInPage'
import { SignUpPage } from '@/features/account/SignUpPage'
import { LessonPage } from '@/features/lessons/LessonPage'
import { ModulePage } from '@/features/lessons/ModulePage'
import { ModulesPage } from '@/features/lessons/ModulesPage'
import { PlaygroundPage } from '@/features/playground/PlaygroundPage'
import { ProgressPage } from '@/features/progress/ProgressPage'
import { ScenarioPage } from '@/features/scenarios/ScenarioPage'
import { AppShell } from './AppShell'
import { HomePage } from './HomePage'
import { NotFoundPage } from './NotFoundPage'
import { PrivacyPage } from './PrivacyPage'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="modules" element={<ModulesPage />} />
          <Route path="modules/:moduleSlug" element={<ModulePage />} />
          <Route path="modules/:moduleSlug/:lessonSlug" element={<LessonPage />} />
          <Route path="playground" element={<PlaygroundPage />} />
          <Route path="scenarios/:scenarioId" element={<ScenarioPage />} />
          <Route path="progress" element={<ProgressPage />} />
          <Route path="sign-in" element={<SignInPage />} />
          <Route path="sign-up" element={<SignUpPage />} />
          <Route path="forgot-password" element={<ForgotPasswordPage />} />
          <Route path="reset-password" element={<ResetPasswordPage />} />
          <Route path="account" element={<AccountPage />} />
          <Route path="privacy" element={<PrivacyPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
