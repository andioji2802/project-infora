import { db } from '../server/db.js';

function cors(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', req.headers?.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
}

function teacher(req: any) {
  const auth = req.headers?.authorization || '';
  return auth.startsWith('Bearer ') ? db.getUserFromSession(auth.slice(7)) : null;
}

export default function handler(req: any, res: any) {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      return res.status(200).json(teacher(req) ? db.getMaterials() : db.getMaterials('published'));
    }

    const profile = teacher(req);
    if (!profile) return res.status(401).json({ error: 'Akses ditolak. Sesi guru diperlukan.' });

    if (req.method === 'POST') {
      const body = req.body || {};
      if (!body.title || !body.category || !body.content) {
        return res.status(400).json({ error: 'Judul, kategori, dan isi materi wajib diisi.' });
      }
      const now = new Date().toISOString();
      const item = db.upsertMaterial({
        id: `mat-${Date.now()}`,
        owner_id: profile.id,
        teacher_name: profile.full_name,
        title: String(body.title).trim(),
        slug: String(body.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
        category: body.category,
        grade_level: body.grade_level || 'Kelas X SMK',
        learning_objectives: body.learning_objectives,
        summary: body.summary,
        content: body.content,
        keywords: body.keywords,
        practice_steps: body.practice_steps,
        faq: body.faq,
        references: body.references,
        status: body.status || 'published',
        created_at: now,
        updated_at: now,
        chunk_count: 0
      });
      return res.status(201).json(item);
    }

    return res.status(405).json({ error: 'Method tidak diizinkan.' });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Gagal memproses materi.' });
  }
}
