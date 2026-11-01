import { db } from '../server/db.js';
import { getSupabaseConfig, supabaseRequest } from '../server/supabase.js';
import { getSessionProfile } from '../server/auth.js';
import { parseRequestBody } from '../server/http.js';

function teacher(req: any) {
  const auth = req.headers?.authorization || '';
  return auth.startsWith('Bearer ') ? db.getUserFromSession(auth.slice(7)) : null;
}
export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', req.headers?.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  const body = parseRequestBody(req);
  if (getSupabaseConfig()) {
    const profile = await getSessionProfile(req);
    if (req.method === 'GET') {
      const query = profile ? { select: '*', order: 'updated_at.desc' } : { status: 'eq.published', select: '*', order: 'updated_at.desc' };
      const result = await supabaseRequest('materials', { query });
      return res.status(result.status === 200 ? 200 : result.status).json(result.data);
    }
    if (!profile) return res.status(401).json({ error: 'Sesi guru diperlukan.' });
    const id = String(req.query?.id || body.id || '');
    if (req.method === 'DELETE') {
      await supabaseRequest('materials', { method: 'DELETE', query: { id: `eq.${id}`, owner_id: `eq.${profile.id}` } });
      return res.status(200).json({ success: true });
    }
    if (req.method === 'POST' || req.method === 'PUT') {
      if (!body.title || !body.category || !body.content) return res.status(400).json({ error: 'Judul, kategori, dan isi materi wajib diisi.' });
      const slug = String(body.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const payload = {
        owner_id: profile.id, teacher_name: profile.full_name || null,
        title: String(body.title).trim(), slug, category: body.category,
        grade_level: body.grade_level || 'Kelas X SMK', learning_objectives: body.learning_objectives || null,
        summary: body.summary || null, content: body.content, keywords: body.keywords || null,
        examples: body.examples || null, practice_steps: body.practice_steps || null,
        faq: body.faq || null, references: body.references || null, aliases: body.aliases || null,
        status: body.status || 'published'
      };
      if (req.method === 'PUT') {
        const result = await supabaseRequest('materials', { method: 'PATCH', query: { id: `eq.${id}`, owner_id: `eq.${profile.id}` }, body: payload });
        return res.status(result.status).json(result.data[0] || { error: 'Materi tidak ditemukan.' });
      }
      const result = await supabaseRequest('materials', { method: 'POST', body: payload });
      return res.status(result.status === 201 ? 201 : result.status).json(result.data[0] || { error: 'Gagal menyimpan materi.' });
    }
    return res.status(405).json({ error: 'Method tidak diizinkan.' });
  }
  const profile = teacher(req);
  if (req.method === 'GET') return res.status(200).json(profile ? db.getMaterials() : db.getMaterials('published'));
  if (!profile) return res.status(401).json({ error: 'Sesi guru diperlukan.' });
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
