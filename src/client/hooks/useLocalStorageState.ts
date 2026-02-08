import { useEffect, useState } from 'react';
import type { StorageSerializer } from '../utils/storage';

export function useLocalStorageState<T>(
  key: string,
  fallback: T,
  serializer: StorageSerializer<T>
) {
  const readStoredValue = () => {
    if (typeof window === 'undefined') return fallback;
    try {
      return serializer.parse(window.localStorage.getItem(key));
    } catch {
      return fallback;
    }
  };

  const [value, setValue] = useState<T>(() => {
    return readStoredValue();
  });

  useEffect(() => {
    setValue((prev) => {
      const next = readStoredValue();
      return Object.is(prev, next) ? prev : next;
    });
  }, [key, serializer, fallback]);

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
