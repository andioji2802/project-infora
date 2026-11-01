export interface SupabaseRow { [key: string]: any }

export function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL?.trim().replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return url && key ? { url, key } : null;
}

export async function supabaseRequest(
  path: string,
  options: { method?: string; body?: unknown; query?: Record<string, string> } = {}
): Promise<{ data: SupabaseRow[]; status: number }> {
  const config = getSupabaseConfig();
  if (!config) return { data: [], status: 503 };
  const params = new URLSearchParams(options.query || {});
  const url = `${config.url}/rest/v1/${path}${params.size ? `?${params}` : ''}`;
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const text = await response.text();
  let data: SupabaseRow[] = [];
  if (text) {
    const parsed = JSON.parse(text);
    data = Array.isArray(parsed) ? parsed : [parsed];
  }
  return { data, status: response.status };
}
