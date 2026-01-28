type FolderDrawerProps = {
  open: boolean;
  folders: string[];
  selectedFolder: string;
  onSelectFolder: (folder: string) => void;
  onClose: () => void;
  onSync: () => void;
  onCreateFolder: () => void;
};

export default function FolderDrawer({
  open,
  folders,
  selectedFolder,
  onSelectFolder,
  onClose,
  onSync,
  onCreateFolder
}: FolderDrawerProps) {
  return (
    <>
      <div
        className={open ? 'drawer-scrim open' : 'drawer-scrim'}
        onClick={onClose}
      />
      <aside className={open ? 'drawer open' : 'drawer'} role="navigation">
        <div className="drawer-header">
          <div>Folders</div>
          <button className="ghost" type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="drawer-actions">
          <button className="button" type="button" onClick={onSync}>
            Sync
          </button>
          <button className="ghost" type="button" onClick={onCreateFolder}>
            New Folder
          </button>
        </div>
        <div className="drawer-content">
          <button
            type="button"
            className={selectedFolder ? 'drawer-item' : 'drawer-item active'}
            onClick={() => onSelectFolder('')}
          >
            Home
          </button>
          {folders.map((folder) => (
            <button
              key={folder}
              type="button"
              className={selectedFolder === folder ? 'drawer-item active' : 'drawer-item'}
              onClick={() => onSelectFolder(folder)}
            >
              {folder}
            </button>
          ))}
        </div>
      </aside>
    </>
  );
}
