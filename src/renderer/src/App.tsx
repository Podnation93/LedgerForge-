import { Suspense } from 'react'
import { Toaster } from 'sonner'
import type { Settings as AppSettings } from '@shared/types'
import { useAsyncData } from './hooks/useAsyncData'
import { AppShell } from './layout/AppShell'
import { AppRoutes } from './routes'

const defaultSettings: AppSettings = {
  businessName: 'LedgerForge',
  abn: '',
  gstRegistered: true,
  gstBasis: 'cash',
  basFrequency: 'quarterly',
  ollamaBaseUrl: 'http://localhost:11434',
  cloudAiEnabled: false,
}

function App() {
  const [settings, reloadSettings] = useAsyncData('settings:get', defaultSettings)

  return (
    <AppShell settings={settings}>
      <Suspense fallback={<section className="page"><p className="muted">Loading...</p></section>}>
        <AppRoutes settings={settings} onSettingsSaved={reloadSettings} />
      </Suspense>
      <Toaster closeButton richColors position="top-right" theme="dark" />
    </AppShell>
  )
}

export default App
