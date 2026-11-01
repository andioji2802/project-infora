import { db } from '../server/db.js';
import { getSupabaseConfig, supabaseRequest } from '../server/supabase.js';
import { getSessionProfile } from '../server/auth.js';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', req.headers?.origin || '*');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (getSupabaseConfig()) {
    const profile = await getSessionProfile(req);
    if (!profile) return res.status(401).json({ error: 'Sesi guru diperlukan.' });
    const [materials, published, questions, quizzes, chunks] = await Promise.all([
      supabaseRequest('materials', { query: { owner_id: `eq.${profile.id}`, select: 'id' } }),
      supabaseRequest('materials', { query: { owner_id: `eq.${profile.id}`, status: 'eq.published', select: 'id' } }),
      supabaseRequest('questions', { query: { owner_id: `eq.${profile.id}`, select: 'id' } }),
      supabaseRequest('quizzes', { query: { owner_id: `eq.${profile.id}`, select: 'id' } }),
      supabaseRequest('material_chunks', { query: { select: 'id' } })
    ]);
    return res.status(200).json({
      totalMaterials: materials.data.length,
      publishedMaterials: published.data.length,
      totalQuestions: questions.data.length,
      totalQuizzes: quizzes.data.length,
      totalChunks: chunks.data.length
    });
  }
  return res.status(200).json({
    totalMaterials: db.getMaterials().length,
    publishedMaterials: db.getMaterials('published').length,
    totalQuestions: db.getQuestions().length,
    totalQuizzes: db.getQuizzes().length,
    totalChunks: db.getChunks().length
  });
}
