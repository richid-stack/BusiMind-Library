export async function apiFetch(input: RequestInfo | URL, init?: RequestInit, retries = 3): Promise<Response> {
  const adminPassword = localStorage.getItem('WEB_ADMIN_PASSWORD');
  
  let newInit = { ...(init || {}) } as RequestInit;
  if (typeof input === 'string' && input.startsWith('/api/')) {
    newInit.headers = {
      ...newInit.headers,
      ...(adminPassword ? { 'x-admin-password': adminPassword } : {})
    };
  }

  let lastError;
  for (let i = 0; i < retries; i++) {
    try {
      return await fetch(input, newInit);
    } catch (err) {
      lastError = err;
      // Wait for 1s, then 2s, before retrying.
      await new Promise(res => setTimeout(res, 1000 * (i + 1)));
    }
  }
  
  throw lastError;
}
