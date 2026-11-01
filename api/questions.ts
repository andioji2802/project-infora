import { db } from '../server/db.js';
function teacher(req: any) {
  const auth = req.headers?.authorization || '';
  return auth.startsWith('Bearer ') ? db.getUserFromSession(auth.slice(7)) : null;
}
export default function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', req.headers?.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  const profile = teacher(req);
  if (req.method === 'GET') return res.status(200).json(db.getQuestions(!profile));
  if (!profile) return res.status(401).json({ error: 'Sesi guru diperlukan.' });
  const body = req.body || {};
  const id = String(req.query?.id || body.id || '');
  if (req.method === 'DELETE') return db.deleteQuestion(id) ? res.status(200).json({ success: true }) : res.status(404).json({ error: 'Soal tidak ditemukan.' });
  if (req.method === 'POST') {
    if (!body.question_text || !body.category) return res.status(400).json({ error: 'Teks pertanyaan dan kategori wajib diisi.' });
    const now = new Date().toISOString();
    return res.status(201).json(db.upsertQuestion({
      id: `q-${Date.now()}`, owner_id: profile.id, question_text: String(body.question_text).trim(),
      category: body.category, difficulty: body.difficulty || 'Sedang', question_type: body.question_type || 'multiple_choice',
      options: body.options || [], correct_answer: body.correct_answer, explanation: body.explanation || '',
      competency: body.competency || '', status: body.status || 'published', created_at: now, updated_at: now
    }));
  }
  if (req.method === 'PUT') {
    const existing = db.getQuestionById(id);
    if (!existing) return res.status(404).json({ error: 'Soal tidak ditemukan.' });
    return res.status(200).json(db.upsertQuestion({ ...existing, ...body, question_text: body.question_text?.trim() || existing.question_text, updated_at: new Date().toISOString() }));
  }
  return res.status(405).json({ error: 'Method tidak diizinkan.' });
}
