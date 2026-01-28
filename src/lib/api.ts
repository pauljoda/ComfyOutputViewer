export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: {
      'Content-Type': 'application/json'
    },
    ...options
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}
