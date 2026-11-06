import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './i18n'
import App from './App'
import './index.css'
import { setupGlobalErrorCapture } from '@/lib/logger'

// 在 React 挂载前注册全局错误与 Promise rejection 采集
setupGlobalErrorCapture()

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>,
)
