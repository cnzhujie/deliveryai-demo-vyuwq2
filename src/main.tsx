import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './i18n'
import App from './App'
import './index.css'
import { logger } from '@/lib/logger'

logger.info('app', '应用启动', { env: import.meta.env.PROD ? 'production' : 'development', sessionId: logger.sessionId })

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>,
)
