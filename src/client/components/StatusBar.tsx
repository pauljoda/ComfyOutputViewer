type StatusBarProps = {
  loading: boolean;
  imageCount: number;
  status: string;
  error: string | null;
};

export default function StatusBar({ loading, imageCount, status, error }: StatusBarProps) {
  return (
    <div className="status-bar">
      <div>{loading ? 'Loading images…' : `${imageCount} images`}</div>
      <div className="status">
        {status}
        {error && <span className="error">{error}</span>}
      </div>
    </div>
  );
}
