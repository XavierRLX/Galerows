import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { shouldRenderGameApp } from './app/appMode'
import './styles/globals.css'

async function bootstrap() {
  // The public website and the native game share assets, but initialize separately.
  // This keeps game services, privacy prompts and game bundles off the landing page.
  const Component = shouldRenderGameApp()
    ? await Promise.all([import('./app/App'), import('./i18n')]).then(async ([app, i18n]) => {
      await i18n.initializeI18n()
      return app.App
    })
    : (await import('./features/landing/LandingPage')).LandingPage
  createRoot(document.getElementById('root')!).render(
    <StrictMode><Component /></StrictMode>,
  )
}

void bootstrap()
