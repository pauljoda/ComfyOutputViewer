import { useEffect, useRef, useState } from 'react';

type ElementSize = {
  width: number;
  height: number;
};

export function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState<ElementSize>({ width: 0, height: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setSize({ width: Math.round(width), height: Math.round(height) });
      }
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, width: size.width, height: size.height };
}
