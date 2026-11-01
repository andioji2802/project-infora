import { db } from '../server/db.js';

export default function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', req.headers?.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method tidak diizinkan.' });
  const auth = req.headers?.authorization || '';
  if (auth.startsWith('Bearer ')) db.deleteSession(auth.slice(7));
  return res.status(200).json({ success: true });
}
