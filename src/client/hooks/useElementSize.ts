import { useCallback, useEffect, useRef, useState } from 'react';

type ElementSize = {
  width: number;
  height: number;
};

export function useElementSize<T extends HTMLElement>() {
  const observerRef = useRef<ResizeObserver | null>(null);
  const [size, setSize] = useState<ElementSize>({ width: 0, height: 0 });
  const rafRef = useRef<number | null>(null);

  const updateSize = useCallback((width: number, height: number) => {
    setSize((prev) => {
      if (prev.width === width && prev.height === height) {
        return prev;
      }
      return { width, height };
    });
  }, []);

  const ref = useCallback((element: T | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (!element) return;

    const measure = () => {
      const rect = element.getBoundingClientRect();
      updateSize(Math.round(rect.width), Math.round(rect.height));
    };

    measure();
    rafRef.current = requestAnimationFrame(() => {
      measure();
      rafRef.current = null;
    });

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        updateSize(Math.round(width), Math.round(height));
      }
    });

    observer.observe(element);
    observerRef.current = observer;
  }, [updateSize]);

  useEffect(
    () => () => {
      observerRef.current?.disconnect();
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    },
    []
  );

  return { ref, width: size.width, height: size.height };
}
