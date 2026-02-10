import { useMemo, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import type { TagCount } from '../utils/tags';

type TagDrawerProps = {
  open: boolean;
  tags: TagCount[];
  selectedTags: string[];
  showUntagged: boolean;
  totalCount: number;
  untaggedCount: number;
  onToggleTag: (tag: string) => void;
  onSelectAll: () => void;
  onSelectUntagged: () => void;
  onClose: () => void;
  onSync: () => void;
};

export default function TagDrawer({
  open,
  tags,
  selectedTags,
  showUntagged,
  totalCount,
  untaggedCount,
  onToggleTag,
  onSelectAll,
  onSelectUntagged,
  onClose,
  onSync
}: TagDrawerProps) {
  const isAllSelected = !showUntagged && selectedTags.length === 0;
  const [query, setQuery] = useState('');
  const [sortMode, setSortMode] = useState<'count' | 'alpha'>('count');

  const visibleTags = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = normalizedQuery
      ? tags.filter((entry) => entry.tag.toLowerCase().includes(normalizedQuery))
      : tags;
    return [...filtered].sort((a, b) => {
      if (sortMode === 'alpha') return a.tag.localeCompare(b.tag);
      if (b.count !== a.count) return b.count - a.count;
      return a.tag.localeCompare(b.tag);
    });
  }, [query, sortMode, tags]);

  return (
    <>
      {/* Scrim */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r bg-background transition-transform ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        role="navigation"
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="text-sm font-semibold">Tags</span>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <button
            type="button"
            className={`flex w-full items-center justify-between px-4 py-2 text-sm hover:bg-accent ${
              isAllSelected ? 'bg-primary/10 text-primary font-medium' : ''
            }`}
            onClick={onSelectAll}
          >
            <span>All images</span>
            <Badge variant="secondary">{totalCount}</Badge>
          </button>
          <button
            type="button"
            className={`flex w-full items-center justify-between px-4 py-2 text-sm hover:bg-accent ${
              showUntagged ? 'bg-primary/10 text-primary font-medium' : ''
            }`}
            onClick={onSelectUntagged}
          >
            <span>Untagged</span>
            <Badge variant="secondary">{untaggedCount}</Badge>
          </button>

          <div className="px-4 py-2 space-y-2">
            <div className="flex items-center gap-2">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Find tag…"
                className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm"
                aria-label="Find tag"
              />
              <select
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value as 'count' | 'alpha')}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                aria-label="Sort tags"
              >
                <option value="count">By count</option>
                <option value="alpha">A-Z</option>
              </select>
            </div>
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Tags
            </div>
          </div>

          {visibleTags.length === 0 && (
            <div className="px-4 py-2 text-sm text-muted-foreground">No tags yet.</div>
          )}
          {visibleTags.map(({ tag, count }) => (
            <button
              key={tag}
              type="button"
              className={`flex w-full items-center justify-between px-4 py-2.5 text-sm hover:bg-accent ${
                selectedTags.includes(tag) ? 'bg-primary/10 text-primary font-medium ring-1 ring-primary/20' : ''
              }`}
              onClick={() => onToggleTag(tag)}
            >
              <span>{tag}</span>
              <Badge variant="secondary">{count}</Badge>
            </button>
          ))}
        </div>

        <div className="border-t p-3">
          <Button variant="outline" size="sm" className="w-full gap-2" onClick={onSync}>
            <RefreshCw className="h-3.5 w-3.5" />
            Sync
          </Button>
        </div>
      </aside>
    </>
  );
}
