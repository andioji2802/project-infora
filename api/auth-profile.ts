import { db } from '../server/db.js';
export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', req.headers?.origin || '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'PUT') return res.status(405).json({ error: 'Method tidak diizinkan.' });
  const auth = req.headers?.authorization || '';
  const profile = auth.startsWith('Bearer ') ? db.getUserFromSession(auth.slice(7)) : null;
  if (!profile) return res.status(401).json({ error: 'Sesi login tidak valid.' });
  const body = req.body || {};
  const updated = db.updateProfile(profile.id, {
    full_name: body.full_name?.trim() || profile.full_name,
    school_name: body.school_name?.trim() || profile.school_name,
    teacher_identifier: body.teacher_identifier?.trim() || profile.teacher_identifier
  });
  if (!updated) return res.status(404).json({ error: 'Profil tidak ditemukan.' });
  const { password_hash, password_salt, ...user } = updated;
  return res.status(200).json({ user });
}
