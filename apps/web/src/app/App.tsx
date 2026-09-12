import { BrowserRouter, Route, Routes } from 'react-router'
import { PlaygroundPage } from '@/features/playground/PlaygroundPage'
import { ProgressPage } from '@/features/progress/ProgressPage'
import { AppShell } from './AppShell'
import { HomePage } from './HomePage'
import { NotFoundPage } from './NotFoundPage'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="playground" element={<PlaygroundPage />} />
          <Route path="progress" element={<ProgressPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
