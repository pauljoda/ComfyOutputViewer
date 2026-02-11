import React from 'react';
import Gallery from '../Gallery';
import GalleryModalController, { type GalleryModalControllerProps } from './GalleryModalController';

type GalleryActionsControllerProps = {
  galleryRef: React.Ref<HTMLElement>;
  galleryProps: React.ComponentPropsWithoutRef<typeof Gallery>;
  modalProps: GalleryModalControllerProps;
};

export default function GalleryActionsController({
  galleryRef,
  galleryProps,
  modalProps
}: GalleryActionsControllerProps) {
  return (
    <>
      <Gallery ref={galleryRef} {...galleryProps} />
      <GalleryModalController {...modalProps} />
    </>
  );
}
