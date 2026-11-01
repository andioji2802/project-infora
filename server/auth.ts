import { getSupabaseConfig, supabaseRequest } from './supabase.js';

export async function getSessionProfile(req: any): Promise<any | null> {
  if (!getSupabaseConfig()) return null;
  const auth = req.headers?.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return null;
  const sessions = await supabaseRequest('app_sessions', {
    query: { token: `eq.${token}`, expires_at: 'gte.now()', select: 'user_id' }
  });
  if (!sessions.data.length) return null;
  const profiles = await supabaseRequest('profiles', {
    query: { id: `eq.${sessions.data[0].user_id}`, select: '*' }
  });
  return profiles.data[0] || null;
}
