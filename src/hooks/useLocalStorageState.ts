import { useEffect, useState } from 'react';
import type { StorageSerializer } from '../utils/storage';

export function useLocalStorageState<T>(
  key: string,
  fallback: T,
  serializer: StorageSerializer<T>
) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return fallback;
    try {
      return serializer.parse(window.localStorage.getItem(key));
    } catch {
      return fallback;
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(key, serializer.serialize(value));
    } catch {
      // Ignore write failures (private mode, quota, etc.)
    }
  }, [key, value, serializer]);

  return [value, setValue] as const;
}
