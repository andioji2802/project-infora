import { db, verifyPassword } from '../server/db.js';
import { parseRequestBody } from '../server/http.js';
export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', req.headers?.origin || '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method tidak diizinkan.' });
  const body = parseRequestBody(req);
  const nip = String(body.nip || body.NIP || body.username || '').trim();
  const profile = nip ? db.getProfileByNip(nip) : db.getProfileByEmail(String(body.email || '').trim());
  if (!profile || !verifyPassword(String(body.password || ''), profile.password_hash, profile.password_salt)) {
    return res.status(401).json({ error: 'NIP/ID guru atau kata sandi tidak cocok.' });
  }
  const { password_hash, password_salt, ...user } = profile;
  return res.status(200).json({ token: db.createSession(profile.id), user });
}
