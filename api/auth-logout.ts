import { db } from '../server/db.js';
import { getSupabaseConfig, supabaseRequest } from '../server/supabase.js';
export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', req.headers?.origin || '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  const auth = req.headers?.authorization || '';
  if (getSupabaseConfig() && auth.startsWith('Bearer ')) {
    await supabaseRequest('app_sessions', { method: 'DELETE', query: { token: `eq.${auth.slice(7)}` } });
    return res.status(200).json({ success: true });
  }
  if (auth.startsWith('Bearer ')) db.deleteSession(auth.slice(7));
  return res.status(200).json({ success: true });
}
