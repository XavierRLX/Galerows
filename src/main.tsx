import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { initializeI18n } from './i18n'
import './styles/globals.css'

async function bootstrap() {
  await initializeI18n()
  createRoot(document.getElementById('root')!).render(
    <StrictMode><App /></StrictMode>,
  )
}

void bootstrap()
