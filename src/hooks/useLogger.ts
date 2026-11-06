import { useSyncExternalStore } from 'react'
import { logger, type LogEntry } from '@/lib/logger'

/**
 * 订阅 logger 更新的 React hook。
 * 基于 useSyncExternalStore 实现，避免 tearing。
 */
export function useLogger(): LogEntry[] {
  return useSyncExternalStore(
    (callback) => logger.subscribe(callback),
    () => logger.getEntries(),
    () => logger.getEntries(),
  )
}

export { logger }
