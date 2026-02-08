export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers);
  const body = options?.body;
  const shouldSetJsonContentType =
    typeof body === 'string' &&
    body.length > 0 &&
    !headers.has('Content-Type');
  if (shouldSetJsonContentType) {
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
  if (res.status === 204 || res.status === 205) {
    return undefined as T;
  }
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return res.json() as Promise<T>;
  }
  const text = await res.text();
  if (!text) {
    return undefined as T;
  }
  return text as T;
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
