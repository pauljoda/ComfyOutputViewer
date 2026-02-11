import React from 'react';
import type { ActiveTool } from '../../types';
import TagDrawer from '../TagDrawer';
import TopBar from '../TopBar';

type GalleryFiltersControllerProps = {
  topBarRef: React.Ref<HTMLElement>;
  topBarProps: React.ComponentPropsWithoutRef<typeof TopBar>;
  activeTool: ActiveTool;
  setActiveTool: React.Dispatch<React.SetStateAction<ActiveTool>>;
  drawerOpen: boolean;
  setDrawerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  tagDrawerProps: Omit<React.ComponentPropsWithoutRef<typeof TagDrawer>, 'open' | 'onClose'>;
};

export default function GalleryFiltersController({
  topBarRef,
  topBarProps,
  activeTool,
  setActiveTool,
  drawerOpen,
  setDrawerOpen,
  tagDrawerProps
}: GalleryFiltersControllerProps) {
  return (
    <>
      <TopBar ref={topBarRef} {...topBarProps} />

      {activeTool && (
        <div className="fixed inset-0 z-30 bg-black/20" aria-hidden="true" onClick={() => setActiveTool(null)} />
      )}

      <TagDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} {...tagDrawerProps} />
    </>
  );
}
