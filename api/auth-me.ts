import { db } from '../server/db.js';
import { getSupabaseConfig, supabaseRequest } from '../server/supabase.js';
export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', req.headers?.origin || '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  const auth = req.headers?.authorization || '';
  if (getSupabaseConfig()) {
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const sessions = await supabaseRequest('app_sessions', {
      query: { token: `eq.${token}`, expires_at: 'gte.now()', select: 'user_id' }
    });
    if (!sessions.data.length) return res.status(401).json({ error: 'Sesi login tidak valid.' });
    const profiles = await supabaseRequest('profiles', {
      query: { id: `eq.${sessions.data[0].user_id}`, select: '*' }
    });
    if (!profiles.data.length) return res.status(401).json({ error: 'Sesi login tidak valid.' });
    const { password_hash, password_salt, ...user } = profiles.data[0];
    return res.status(200).json({ user });
  }
  const profile = auth.startsWith('Bearer ') ? db.getUserFromSession(auth.slice(7)) : null;
  if (!profile) return res.status(401).json({ error: 'Sesi login tidak valid.' });
  const { password_hash, password_salt, ...user } = profile;
  return res.status(200).json({ user });
}
