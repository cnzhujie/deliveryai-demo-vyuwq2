/**
 * 轻量结构化日志工具。
 *
 * 在浏览器 console 中输出带时间戳、日志级别、会话 ID、模块标签的结构化日志，
 * 便于演示场景下追踪业务流程和排查问题。不引入外部依赖。
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}

// 生产环境（vite build）下 Vite 注入 import.meta.env.PROD = true，提升最低级别到 info
const MIN_LEVEL: LogLevel = import.meta.env.PROD ? 'info' : 'debug'

// 会话 ID：一次页面加载周期内唯一，便于区分不同用户的日志流
const SESSION_ID = generateSessionId()

function generateSessionId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID().slice(0, 8)
    }
  } catch {
    // 安全上下文不可用时降级
  }
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

function formatTimestamp(): string {
  return new Date().toISOString().slice(11, 23) // HH:mm:ss.SSS
}

interface LogEntry {
  level: LogLevel
  module: string
  message: string
  data?: Record<string, unknown>
}

function emit(entry: LogEntry): void {
  if (LEVEL_PRIORITY[entry.level] < LEVEL_PRIORITY[MIN_LEVEL]) return

  const ts = formatTimestamp()
  const tag = `[${entry.level.toUpperCase()}] ${ts} [${SESSION_ID}] [${entry.module}]`

  switch (entry.level) {
    case 'debug':
      console.debug(tag, entry.message, entry.data ?? '')
      break
    case 'info':
      console.info(tag, entry.message, entry.data ?? '')
      break
    case 'warn':
      console.warn(tag, entry.message, entry.data ?? '')
      break
    case 'error':
      console.error(tag, entry.message, entry.data ?? '')
      break
  }
}

export const logger = {
  debug(module: string, message: string, data?: Record<string, unknown>): void {
    emit({ level: 'debug', module, message, data })
  },
  info(module: string, message: string, data?: Record<string, unknown>): void {
    emit({ level: 'info', module, message, data })
  },
  warn(module: string, message: string, data?: Record<string, unknown>): void {
    emit({ level: 'warn', module, message, data })
  },
  error(module: string, message: string, data?: Record<string, unknown>): void {
    emit({ level: 'error', module, message, data })
  },
  /** 获取当前会话 ID */
  get sessionId(): string {
    return SESSION_ID
  },
}
