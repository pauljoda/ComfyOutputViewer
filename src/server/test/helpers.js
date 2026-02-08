export function makeIterable(rows = []) {
  return {
    iterate: vi.fn(() => rows)
  };
}

export function makeGet(fn = () => undefined) {
  return {
    get: vi.fn(fn)
  };
}

export function makeRun(fn = () => ({})) {
  return {
    run: vi.fn(fn)
  };
}
