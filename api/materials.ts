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
  const profile = teacher(req);
  if (req.method === 'GET') return res.status(200).json(profile ? db.getMaterials() : db.getMaterials('published'));
  if (!profile) return res.status(401).json({ error: 'Sesi guru diperlukan.' });
  const body = req.body || {};
  const id = String(req.query?.id || body.id || '');
  if (req.method === 'DELETE') return db.deleteMaterial(id) ? res.status(200).json({ success: true }) : res.status(404).json({ error: 'Materi tidak ditemukan.' });
  if (req.method === 'POST') {
    if (!body.title || !body.category || !body.content) return res.status(400).json({ error: 'Judul, kategori, dan isi materi wajib diisi.' });
    const now = new Date().toISOString();
    return res.status(201).json(db.upsertMaterial({
      id: `mat-${Date.now()}`, owner_id: profile.id, teacher_name: profile.full_name,
      title: String(body.title).trim(), slug: String(body.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      category: body.category, grade_level: body.grade_level || 'Kelas X SMK',
      learning_objectives: body.learning_objectives, summary: body.summary, content: body.content,
      keywords: body.keywords, practice_steps: body.practice_steps, faq: body.faq, references: body.references,
      status: body.status || 'published', created_at: now, updated_at: now, chunk_count: 0
    }));
  }
  if (req.method === 'PUT') {
    const existing = db.getMaterialById(id);
    if (!existing) return res.status(404).json({ error: 'Materi tidak ditemukan.' });
    return res.status(200).json(db.upsertMaterial({
      ...existing, title: body.title?.trim() || existing.title, category: body.category || existing.category,
      grade_level: body.grade_level || existing.grade_level, content: body.content ?? existing.content,
      summary: body.summary ?? existing.summary, status: body.status || existing.status, updated_at: new Date().toISOString()
    }));
  }
  return res.status(405).json({ error: 'Method tidak diizinkan.' });
}
