import { db } from '../server/db.js';
export const config = { api: { bodyParser: false } };
function teacher(req: any) {
  const auth = req.headers?.authorization || '';
  return auth.startsWith('Bearer ') ? db.getUserFromSession(auth.slice(7)) : null;
}
export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', req.headers?.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!req.body && ['POST', 'PUT', 'DELETE'].includes(req.method) && typeof req[Symbol.asyncIterator] === 'function') {
    let raw = '';
    for await (const chunk of req) raw += Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
    if (raw.trim()) {
      try { req.body = JSON.parse(raw); } catch { return res.status(400).json({ error: 'Format JSON tidak valid.' }); }
    }
  }
  const body = req.body || {};
  if (req.method === 'GET') {
    const id = String(req.query?.id || '');
    if (!id) return res.status(200).json(db.getQuizzes(true));
    const quiz = db.getQuizById(id);
    return quiz ? res.status(200).json(quiz) : res.status(404).json({ error: 'Kuis tidak ditemukan.' });
  }
  if (req.method === 'POST' && req.query?.grade === 'true') {
    const quiz = db.getQuizById(String(req.query?.id || body.quizId || ''));
    if (!quiz) return res.status(404).json({ error: 'Kuis tidak ditemukan.' });
    const answers = body.answers || {};
    let correct = 0;
    for (const questionId of quiz.question_ids) {
      const question = db.getQuestionById(questionId);
      if (question && String(answers[questionId]) === String(question.correct_answer)) correct++;
    }
    const score = quiz.question_ids.length ? Math.round((correct / quiz.question_ids.length) * 100) : 0;
    return res.status(200).json({ score, correct, total: quiz.question_ids.length });
  }
  const profile = teacher(req);
  if (!profile) return res.status(401).json({ error: 'Sesi guru diperlukan.' });
  const id = String(req.query?.id || body.id || '');
  if (req.method === 'DELETE') return db.deleteQuiz(id) ? res.status(200).json({ success: true }) : res.status(404).json({ error: 'Kuis tidak ditemukan.' });
  if (req.method === 'POST') {
    if (!body.title || !body.category || !Array.isArray(body.question_ids)) return res.status(400).json({ error: 'Judul, kategori, dan soal kuis wajib diisi.' });
    const now = new Date().toISOString();
    return res.status(201).json(db.upsertQuiz({
      id: `quiz-${Date.now()}`, owner_id: profile.id, title: String(body.title).trim(),
      description: body.description || '', category: body.category, difficulty: body.difficulty || 'Sedang',
      status: body.status || 'published', question_ids: body.question_ids, created_at: now, updated_at: now
    }));
  }
  if (req.method === 'PUT') {
    const existing = db.getQuizById(id);
    if (!existing) return res.status(404).json({ error: 'Kuis tidak ditemukan.' });
    return res.status(200).json(db.upsertQuiz({ ...existing, ...body, title: body.title?.trim() || existing.title, updated_at: new Date().toISOString() }));
  }
  return res.status(405).json({ error: 'Method tidak diizinkan.' });
}
