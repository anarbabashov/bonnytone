'use client'

import type { StreamStatus as StreamStatusType } from '@/store/playerStore'

interface StreamStatusProps {
  status: StreamStatusType
}

const STATUS_CONFIG: Record<StreamStatusType, { label: string; dotClass: string }> = {
  idle: { label: 'Offline', dotClass: 'bg-muted-foreground' },
  connecting: { label: 'Connecting', dotClass: 'bg-yellow-500 animate-pulse' },
  live: { label: 'LIVE', dotClass: 'bg-green-500' },
  offline: { label: 'Offline', dotClass: 'bg-muted-foreground' },
  error: { label: 'Error', dotClass: 'bg-red-500' },
}

export default function StreamStatus({ status }: StreamStatusProps) {
  const { label, dotClass } = STATUS_CONFIG[status]

  return (
    <div className="flex items-center gap-2 glass-subtle px-4 py-1.5 rounded-full">
      <span className={`w-2 h-2 rounded-full ${dotClass}`} />
      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
    </div>
  )
}
