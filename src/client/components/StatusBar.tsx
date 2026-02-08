type StatusBarProps = {
  loading: boolean;
  imageCount: number;
  status: string;
  error: string | null;
};

export default function StatusBar({ loading, imageCount, status, error }: StatusBarProps) {
  return (
    <div className="flex items-center justify-between border-t px-3 py-1.5 text-xs text-muted-foreground" aria-live="polite">
      <div>{loading ? 'Loading images…' : `${imageCount} images`}</div>
      <div className="flex items-center gap-2">
        {status}
        {error && <span className="text-destructive">{error}</span>}
      </div>
    </div>
  );
}
