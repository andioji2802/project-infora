import { db, verifyPassword } from '../server/db.js';
export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', req.headers?.origin || '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method tidak diizinkan.' });
  const profile = db.getProfileByEmail(String(req.body?.email || '').trim());
  if (!profile || !verifyPassword(String(req.body?.password || ''), profile.password_hash, profile.password_salt)) {
    return res.status(401).json({ error: 'Email atau kata sandi tidak cocok.' });
  }
  const { password_hash, password_salt, ...user } = profile;
  return res.status(200).json({ token: db.createSession(profile.id), user });
}
