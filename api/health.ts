import { getSupabaseConfig, supabaseRequest } from '../server/supabase.js';
import { db } from '../server/db.js';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', req.headers?.origin || '*');
  if (req.method === 'OPTIONS') return res.status(204).end();
  const configured = process.env.GEMINI_MODEL_NAME?.trim();
  const model = configured || 'gemini-2.5-flash';
  let totalChunks = db.getChunks().length;
  if (getSupabaseConfig()) {
    const chunks = await supabaseRequest('material_chunks', { query: { select: 'id' } });
    if (chunks.status === 200) totalChunks = chunks.data.length;
  }
  res.status(200).json({
    status: 'ok',
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY?.trim() || process.env.GEMINI_API_INFORA?.trim()),
    hasSupabase: Boolean(process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
    model,
    embeddingModel: 'gemini-embedding-2-preview',
    totalChunks
  });
}
