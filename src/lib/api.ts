export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(path, {
    ...options,
    headers
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

type JsonRequestOptions = Omit<RequestInit, 'body' | 'headers' | 'method'> & {
  method?: string;
  body?: unknown;
  headers?: HeadersInit;
};

export function apiJson<T>(path: string, options: JsonRequestOptions = {}) {
  const { body, method = 'POST', headers, ...rest } = options;
  return api<T>(path, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers,
    ...rest
  });
}
