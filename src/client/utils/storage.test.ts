import { describe, expect, it } from 'vitest';
import {
  booleanSerializer,
  enumSerializer,
  numberSerializer,
  stringSerializer
} from './storage';

describe('storage serializers', () => {
  it('string serializer uses fallback on null', () => {
    const serializer = stringSerializer('fallback');
    expect(serializer.parse(null)).toBe('fallback');
    expect(serializer.parse('value')).toBe('value');
    expect(serializer.serialize('x')).toBe('x');
  });

  it('boolean serializer parses and serializes booleans', () => {
    const serializer = booleanSerializer(true);
    expect(serializer.parse(null)).toBe(true);
    expect(serializer.parse('true')).toBe(true);
    expect(serializer.parse('false')).toBe(false);
    expect(serializer.serialize(false)).toBe('false');
  });

  it('number serializer rounds and clamps values', () => {
    const serializer = numberSerializer(2, { min: 1, max: 5, round: true });
    expect(serializer.parse(null)).toBe(2);
    expect(serializer.parse('3.6')).toBe(4);
    expect(serializer.parse('99')).toBe(5);
    expect(serializer.parse('-2')).toBe(1);
    expect(serializer.parse('abc')).toBe(2);
  });

  it('enum serializer accepts only allowed values', () => {
    const serializer = enumSerializer('system', ['system', 'light', 'dark'] as const);
    expect(serializer.parse('light')).toBe('light');
    expect(serializer.parse('weird')).toBe('system');
    expect(serializer.parse(null)).toBe('system');
    expect(serializer.serialize('dark')).toBe('dark');
  });
});
