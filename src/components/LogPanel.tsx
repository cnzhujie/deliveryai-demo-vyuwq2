import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle, AlertTriangle, Info, ScrollText, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { useLogger } from '@/hooks/useLogger'
import { logger, type LogEntry, type LogLevel } from '@/lib/logger'

interface LogPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const levelConfig: Record<LogLevel, { icon: typeof Info; color: string; bg: string }> = {
  info: { icon: Info, color: 'text-charcoal-500', bg: 'bg-rice-100' },
  warn: { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-100/60' },
  error: { icon: AlertCircle, color: 'text-chili-500', bg: 'bg-chili-50' },
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function LogRow({ entry }: { entry: LogEntry }) {
  const cfg = levelConfig[entry.level]
  const Icon = cfg.icon
  return (
    <div className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${cfg.bg}`}>
      <Icon size={14} className={`mt-0.5 shrink-0 ${cfg.color}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="shrink-0 font-mono text-charcoal-500">{formatTime(entry.timestamp)}</span>
          <span className="shrink-0 rounded px-1.5 py-0.5 bg-white/70 font-semibold text-charcoal-700">{entry.category}</span>
        </div>
        <p className="mt-1 break-words text-charcoal-900">{entry.message}</p>
        {entry.data && (
          <pre className="mt-1 overflow-x-auto rounded bg-charcoal-900/5 p-1.5 font-mono text-[10px] text-charcoal-500">{JSON.stringify(entry.data)}</pre>
        )}
      </div>
    </div>
  )
}

export function LogPanel({ open, onOpenChange }: LogPanelProps) {
  const { t } = useTranslation()
  const entries = useLogger()

  const counts = useMemo(() => {
    let info = 0
    let warn = 0
    let error = 0
    for (const e of entries) {
      if (e.level === 'info') info++
      else if (e.level === 'warn') warn++
      else error++
    }
    return { info, warn, error }
  }, [entries])

  // 最新在顶部
  const reversed = useMemo(() => [...entries].reverse(), [entries])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={t('log.title')} className="md:max-w-2xl">
        <p className="mt-2 text-sm text-charcoal-500">{t('log.desc')}</p>

        <div className="mt-4 flex items-center gap-3">
          <span className="flex items-center gap-1 rounded-full bg-rice-100 px-3 py-1 text-xs font-bold text-charcoal-500">
            <Info size={13} />{t('log.count_info', { count: counts.info })}
          </span>
          <span className="flex items-center gap-1 rounded-full bg-amber-100/60 px-3 py-1 text-xs font-bold text-amber-500">
            <AlertTriangle size={13} />{t('log.count_warn', { count: counts.warn })}
          </span>
          <span className="flex items-center gap-1 rounded-full bg-chili-50 px-3 py-1 text-xs font-bold text-chili-500">
            <AlertCircle size={13} />{t('log.count_error', { count: counts.error })}
          </span>
          <Button variant="outline" size="sm" className="ml-auto" onClick={() => logger.clear()}>
            <Trash2 size={15} />{t('log.clear')}
          </Button>
        </div>

        <div className="scrollbar-thin mt-4 max-h-[50vh] space-y-1.5 overflow-y-auto">
          {reversed.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-charcoal-500">
              <ScrollText size={32} className="text-charcoal-900/20" />
              <p className="text-sm">{t('log.empty')}</p>
            </div>
          ) : (
            reversed.map((entry) => <LogRow key={entry.id} entry={entry} />)
          )}
        </div>

        <div className="mt-5 flex justify-end">
          <Button onClick={() => onOpenChange(false)}>{t('console.done')}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
