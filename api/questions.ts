import { db } from '../server/db.js';

export default function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', req.headers?.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const auth = req.headers?.authorization || '';
  const profile = auth.startsWith('Bearer ') ? db.getUserFromSession(auth.slice(7)) : null;
  if (req.method === 'GET') return res.status(200).json(db.getQuestions(!profile));
  if (req.method !== 'POST' || !profile) return res.status(profile ? 405 : 401).json({ error: profile ? 'Method tidak diizinkan.' : 'Sesi guru diperlukan.' });

  const body = req.body || {};
  if (!body.question_text || !body.category) return res.status(400).json({ error: 'Teks pertanyaan dan kategori wajib diisi.' });
  const now = new Date().toISOString();
  const item = db.upsertQuestion({
    id: `q-${Date.now()}`,
    owner_id: profile.id,
    question_text: String(body.question_text).trim(),
    category: body.category,
    difficulty: body.difficulty || 'Sedang',
    question_type: body.question_type || 'multiple_choice',
    options: body.options || [],
    correct_answer: body.correct_answer,
    explanation: body.explanation || '',
    competency: body.competency || '',
    status: 'published',
    created_at: now,
    updated_at: now
  });
  return res.status(201).json(item);
}
