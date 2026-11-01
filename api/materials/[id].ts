import { db } from '../../server/db.js';

export default function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', req.headers?.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const id = String(req.query?.id || '').trim();
  if (!id) return res.status(400).json({ error: 'ID materi diperlukan.' });
  const auth = req.headers?.authorization || '';
  const profile = auth.startsWith('Bearer ') ? db.getUserFromSession(auth.slice(7)) : null;
  const item = db.getMaterialById(id);

  if (req.method === 'GET') return item ? res.status(200).json(item) : res.status(404).json({ error: 'Materi tidak ditemukan.' });
  if (!profile) return res.status(401).json({ error: 'Sesi guru diperlukan.' });
  if (req.method === 'DELETE') {
    return db.deleteMaterial(id)
      ? res.status(200).json({ success: true })
      : res.status(404).json({ error: 'Materi tidak ditemukan.' });
  }
  if (req.method !== 'PUT' || !item) return item ? res.status(405).json({ error: 'Method tidak diizinkan.' }) : res.status(404).json({ error: 'Materi tidak ditemukan.' });

  const body = req.body || {};
  const updated = db.upsertMaterial({
    ...item,
    title: body.title?.trim() || item.title,
    slug: body.title ? String(body.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') : item.slug,
    category: body.category || item.category,
    grade_level: body.grade_level || item.grade_level,
    learning_objectives: body.learning_objectives ?? item.learning_objectives,
    summary: body.summary ?? item.summary,
    content: body.content ?? item.content,
    keywords: body.keywords ?? item.keywords,
    practice_steps: body.practice_steps ?? item.practice_steps,
    faq: body.faq ?? item.faq,
    references: body.references ?? item.references,
    status: body.status || item.status,
    updated_at: new Date().toISOString()
  });
  return res.status(200).json(updated);
}
