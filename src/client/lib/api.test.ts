import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, apiJson } from './api';

describe('api helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sets json content type automatically for string bodies', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await api('/api/test', { method: 'POST', body: JSON.stringify({ a: 1 }) });

    const options = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = new Headers(options.headers);
    expect(headers.get('content-type')).toBe('application/json');
  });

  it('throws response text for failed requests', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('Nope', { status: 500 }))
    );

    await expect(api('/api/fail')).rejects.toThrow('Nope');
  });

  it('returns undefined for 204 responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 204 }))
    );

    const result = await api('/api/empty');
    expect(result).toBeUndefined();
  });

  it('returns plain text when content-type is not json', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('hello', { status: 200 }))
    );

    const result = await api<string>('/api/text');
    expect(result).toBe('hello');
  });

  it('apiJson serializes body and defaults to POST', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await apiJson('/api/json', { body: { value: 2 } });

    const options = fetchMock.mock.calls[0][1] as RequestInit;
    expect(options.method).toBe('POST');
    expect(options.body).toBe(JSON.stringify({ value: 2 }));
  });
});
