import { uid } from '@/lib/utils'

export type LogLevel = 'info' | 'warn' | 'error'

export interface LogEntry {
  id: string
  timestamp: number
  level: LogLevel
  category: string
  message: string
  data?: Record<string, unknown>
}

const MAX_ENTRIES = 200
const STORAGE_KEY = 'app-logs'
const PERSIST_COUNT = 50

type Listener = () => void

/**
 * 轻量前端日志采集器。
 * - 环形缓冲（最多 MAX_ENTRIES 条），超限自动裁剪旧条目
 * - localStorage 持久化最近 PERSIST_COUNT 条（try/catch 降级内存态）
 * - 发布/订阅模式，React 组件可通过 useLogger hook 响应更新
 * - 同时输出到 console，便于开发调试
 */
class Logger {
  private entries: LogEntry[] = []
  private listeners: Set<Listener> = new Set()

  constructor() {
    this.loadFromStorage()
  }

  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          this.entries = parsed.slice(-MAX_ENTRIES)
        }
      }
    } catch {
      // localStorage 不可用或数据损坏，降级为内存态
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.entries.slice(-PERSIST_COUNT)))
    } catch {
      // 写入失败（配额满 / 隐私模式），忽略不阻塞
    }
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn())
  }

  log(level: LogLevel, category: string, message: string, data?: Record<string, unknown>): void {
    const entry: LogEntry = {
      id: uid(),
      timestamp: Date.now(),
      level,
      category,
      message,
      data,
    }
    this.entries.push(entry)
    if (this.entries.length > MAX_ENTRIES) {
      this.entries = this.entries.slice(-MAX_ENTRIES)
    }
    this.persist()
    this.notify()

    // 同步输出到 console
    const tag = `[${category}]`
    const consoleFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
    if (data) {
      consoleFn(tag, message, data)
    } else {
      consoleFn(tag, message)
    }
  }

  info(category: string, message: string, data?: Record<string, unknown>): void {
    this.log('info', category, message, data)
  }

  warn(category: string, message: string, data?: Record<string, unknown>): void {
    this.log('warn', category, message, data)
  }

  error(category: string, message: string, data?: Record<string, unknown>): void {
    this.log('error', category, message, data)
  }

  getEntries(): LogEntry[] {
    return [...this.entries]
  }

  clear(): void {
    this.entries = []
    this.persist()
    this.notify()
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
}

export const logger = new Logger()

/**
 * 注册全局未捕获错误与 Promise rejection 的采集。
 * 应在应用挂载前调用（main.tsx 入口）。
 */
export function setupGlobalErrorCapture(): void {
  window.addEventListener('error', (event: ErrorEvent) => {
    logger.error('global', `未捕获异常: ${event.message}`, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    })
  })

  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    const reason = event.reason
    const message = reason instanceof Error ? reason.message : String(reason)
    logger.error('global', `未处理的 Promise 拒绝: ${message}`)
  })
}
