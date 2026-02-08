export type StorageSerializer<T> = {
  parse: (value: string | null) => T;
  serialize: (value: T) => string;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const stringSerializer = (fallback: string): StorageSerializer<string> => ({
  parse: (value) => (value === null ? fallback : value),
  serialize: (value) => value
});

export const booleanSerializer = (fallback: boolean): StorageSerializer<boolean> => ({
  parse: (value) => {
    if (value === null) return fallback;
    return value === 'true';
  },
  serialize: (value) => (value ? 'true' : 'false')
});

export const numberSerializer = (
  fallback: number,
  options?: { min?: number; max?: number; round?: boolean }
): StorageSerializer<number> => ({
  parse: (value) => {
    if (value === null) return fallback;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    const rounded = options?.round ? Math.round(parsed) : parsed;
    const min = options?.min ?? -Infinity;
    const max = options?.max ?? Infinity;
    return clamp(rounded, min, max);
  },
  serialize: (value) => String(value)
});

export const enumSerializer = <T extends string>(
  fallback: T,
  allowed: readonly T[]
): StorageSerializer<T> => ({
  parse: (value) => {
    if (value === null) return fallback;
    return allowed.includes(value as T) ? (value as T) : fallback;
  },
  serialize: (value) => value
});
