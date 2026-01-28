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

  return (
    <>
      <div className={open ? 'drawer-scrim open' : 'drawer-scrim'} onClick={onClose} />
      <aside className={open ? 'drawer open' : 'drawer'} role="navigation">
        <div className="drawer-header">
          <div>Tags</div>
          <button className="ghost" type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="drawer-actions">
          <button className="button" type="button" onClick={onSync}>
            Sync
          </button>
        </div>
        <div className="drawer-content">
          <button
            type="button"
            className={isAllSelected ? 'drawer-item active' : 'drawer-item'}
            onClick={onSelectAll}
          >
            <span>All images</span>
            <span className="drawer-count">{totalCount}</span>
          </button>
          <button
            type="button"
            className={showUntagged ? 'drawer-item active' : 'drawer-item'}
            onClick={onSelectUntagged}
          >
            <span>Untagged</span>
            <span className="drawer-count">{untaggedCount}</span>
          </button>
          <div className="drawer-section">Tags</div>
          {tags.length === 0 && <div className="drawer-empty">No tags yet.</div>}
          {tags.map(({ tag, count }) => (
            <button
              key={tag}
              type="button"
              className={selectedTags.includes(tag) ? 'drawer-item active' : 'drawer-item'}
              onClick={() => onToggleTag(tag)}
            >
              <span>{tag}</span>
              <span className="drawer-count">{count}</span>
            </button>
          ))}
        </div>
      </aside>
    </>
  );
}
