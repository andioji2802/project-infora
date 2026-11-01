export interface SupabaseRow { [key: string]: any }

export interface SupabaseResult {
  data: SupabaseRow[];
  status: number;
  error?: string;
}

export function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL?.trim().replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return url && key ? { url, key } : null;
}

export async function supabaseRequest(
  path: string,
  options: { method?: string; body?: unknown; query?: Record<string, string> } = {}
): Promise<SupabaseResult> {
  const config = getSupabaseConfig();
  if (!config) return { data: [], status: 503, error: 'Supabase belum dikonfigurasi.' };

  const params = new URLSearchParams(options.query || {});
  const url = `${config.url}/rest/v1/${path}${params.size ? `?${params}` : ''}`;

  try {
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
    let error: string | undefined;

    if (text) {
      try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          data = parsed;
        } else if (parsed && parsed.code) {
          error = parsed.message || parsed.details || parsed.error_description || parsed.error || 'Permintaan Supabase gagal.';
        } else if (parsed) {
          data = [parsed];
        }
      } catch {
        error = text.slice(0, 500);
      }
    }

    if (!response.ok && !error) {
      error = `Permintaan Supabase gagal (${response.status}).`;
    }
    return { data, status: response.status, error };
  } catch (error) {
    return {
      data: [],
      status: 502,
      error: error instanceof Error ? error.message : 'Tidak dapat menghubungi Supabase.'
    };
  }
}
