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
    <div className="system-stats-card">
      <div className="system-stats-header">
        <div className="system-stats-title">
          <span>System Stats</span>
          {stats?.system && (
            <span className="system-stats-sub">
              Python {stats.system.python_version} · {stats.system.os}
            </span>
          )}
        </div>
        {updatedLabel && <span className="system-stats-time">{updatedLabel}</span>}
      </div>
      {error && <div className="system-stats-error">{error}</div>}
      {!error && !stats && <div className="system-stats-loading">Loading...</div>}
      {stats && stats.devices?.length > 0 && (
        <div className="system-stats-grid">
          {stats.devices.map((device) => {
            const total = device.torch_vram_total ?? device.vram_total;
            const free = device.torch_vram_free ?? device.vram_free;
            const used = Math.max(0, total - free);
            const percent = total > 0 ? Math.round((used / total) * 100) : 0;
            return (
              <div key={`${device.name}-${device.index}`} className="system-device-card">
                <div className="system-device-header">
                  <span className="system-device-name">
                    {device.name || `Device ${device.index}`}
                  </span>
                  <span className="system-device-type">{device.type}</span>
                </div>
                <div className="system-device-meta">
                  {formatBytes(used)} / {formatBytes(total)} VRAM
                </div>
                <div className="system-device-bar">
                  <span style={{ width: `${percent}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
      {stats && (!stats.devices || stats.devices.length === 0) && (
        <div className="system-stats-empty">No device stats available.</div>
      )}
    </div>
  );
}
