import { formatBytes } from './formatters';
import type { SystemStatsResponse } from './types';

type SystemStatsPanelProps = {
  stats: SystemStatsResponse | null;
  error: string | null;
  updatedAt: number | null;
};

export default function SystemStatsPanel({ stats, error, updatedAt }: SystemStatsPanelProps) {
  const updatedLabel = updatedAt ? new Date(updatedAt).toLocaleTimeString() : null;
  return (
    <div className="rounded-lg border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-medium">System Stats</span>
          {stats?.system && (
            <span className="ml-2 text-xs text-muted-foreground">
              Python {stats.system.python_version} · {stats.system.os}
            </span>
          )}
        </div>
        {updatedLabel && <span className="text-xs text-muted-foreground">{updatedLabel}</span>}
      </div>
      {error && <div className="text-xs text-destructive">{error}</div>}
      {!error && !stats && <div className="text-xs text-muted-foreground">Loading…</div>}
      {stats && stats.devices?.length > 0 && (
        <div className="space-y-2">
          {stats.devices.map((device) => {
            const total = device.torch_vram_total ?? device.vram_total;
            const free = device.torch_vram_free ?? device.vram_free;
            const used = Math.max(0, total - free);
            const percent = total > 0 ? Math.round((used / total) * 100) : 0;
            return (
              <div key={`${device.name}-${device.index}`} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">{device.name || `Device ${device.index}`}</span>
                  <span className="text-muted-foreground">{device.type}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatBytes(used)} / {formatBytes(total)} VRAM
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${percent}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
      {stats && (!stats.devices || stats.devices.length === 0) && (
        <div className="text-xs text-muted-foreground">No device stats available.</div>
      )}
    </div>
  );
}
