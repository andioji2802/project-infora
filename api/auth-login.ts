import { db, verifyPassword } from '../server/db.js';
import { parseRequestBody } from '../server/http.js';
import { getSupabaseConfig, supabaseRequest } from '../server/supabase.js';
import crypto from 'node:crypto';
export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', req.headers?.origin || '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method tidak diizinkan.' });
  const body = parseRequestBody(req);
  const nip = String(body.nip || body.NIP || body.username || '').trim();
  const supabase = getSupabaseConfig();
  if (supabase) {
    const query = nip
      ? { teacher_identifier: `eq.${nip}`, select: '*' }
      : { email: `eq.${String(body.email || '').trim().toLowerCase()}`, select: '*' };
    const found = await supabaseRequest('profiles', { query });
    const profile = found.data[0];
    if (!profile || !verifyPassword(String(body.password || ''), profile.password_hash, profile.password_salt)) {
      return res.status(401).json({ error: 'NIP/ID guru atau kata sandi tidak cocok.' });
    }
    const token = crypto.randomBytes(32).toString('hex');
    await supabaseRequest('app_sessions', {
      method: 'POST',
      body: { token, user_id: profile.id, expires_at: new Date(Date.now() + 7 * 86400000).toISOString() }
    });
    const { password_hash, password_salt, ...user } = profile;
    return res.status(200).json({ token, user });
  }
  const profile = nip ? db.getProfileByNip(nip) : db.getProfileByEmail(String(body.email || '').trim());
  if (!profile || !verifyPassword(String(body.password || ''), profile.password_hash, profile.password_salt)) {
    return res.status(401).json({ error: 'NIP/ID guru atau kata sandi tidak cocok.' });
  }
  const { password_hash, password_salt, ...user } = profile;
  return res.status(200).json({ token: db.createSession(profile.id), user });
}
