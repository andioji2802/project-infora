import { db } from '../server/db.js';
import { parseRequestBody } from '../server/http.js';
import { getSupabaseConfig, supabaseRequest } from '../server/supabase.js';
export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', req.headers?.origin || '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'PUT,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'PUT') return res.status(405).json({ error: 'Method tidak diizinkan.' });
  const auth = req.headers?.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const body = parseRequestBody(req);
  if (getSupabaseConfig()) {
    const sessions = await supabaseRequest('app_sessions', {
      query: { token: `eq.${token}`, expires_at: 'gte.now()', select: 'user_id' }
    });
    if (!sessions.data.length) return res.status(401).json({ error: 'Sesi login tidak valid.' });
    const userId = sessions.data[0].user_id;
    const update = await supabaseRequest('profiles', {
      method: 'PATCH',
      query: { id: `eq.${userId}` },
      body: {
        full_name: body.full_name,
        school_name: body.school_name,
        teacher_identifier: body.teacher_identifier
      }
    });
    if (update.error || update.status < 200 || update.status >= 300) {
      return res.status(update.status || 500).json({ error: update.error || 'Gagal menyimpan profil.' });
    }
    const profiles = await supabaseRequest('profiles', { query: { id: `eq.${userId}`, select: '*' } });
    if (!profiles.data.length) return res.status(404).json({ error: 'Profil tidak ditemukan.' });
    const { password_hash, password_salt, ...user } = profiles.data[0];
    return res.status(200).json({ user });
  }
  const profile = auth.startsWith('Bearer ') ? db.getUserFromSession(auth.slice(7)) : null;
  if (!profile) return res.status(401).json({ error: 'Sesi login tidak valid.' });
  const updated = db.updateProfile(profile.id, {
    full_name: body.full_name?.trim() || profile.full_name,
    school_name: body.school_name?.trim() || profile.school_name,
    teacher_identifier: body.teacher_identifier?.trim() || profile.teacher_identifier
  });
  if (!updated) return res.status(404).json({ error: 'Profil tidak ditemukan.' });
  const { password_hash, password_salt, ...user } = updated;
  return res.status(200).json({ user });
}
