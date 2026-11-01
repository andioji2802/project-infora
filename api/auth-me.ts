import { db } from '../server/db.js';
export default function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', req.headers?.origin || '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  const auth = req.headers?.authorization || '';
  const profile = auth.startsWith('Bearer ') ? db.getUserFromSession(auth.slice(7)) : null;
  if (!profile) return res.status(401).json({ error: 'Sesi login tidak valid.' });
  const { password_hash, password_salt, ...user } = profile;
  return res.status(200).json({ user });
}
