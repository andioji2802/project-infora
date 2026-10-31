import { db, hashPassword, verifyPassword } from '../server/db.ts';

function headers(origin?: string) {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };
}

function safeUser(profile: any) {
  return {
    id: profile.id,
    email: profile.email,
    full_name: profile.full_name,
    school_name: profile.school_name,
    teacher_identifier: profile.teacher_identifier,
    role: profile.role
  };
}

export default async function handler(req: any, res: any) {
  const origin = req.headers?.origin;
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();

  const url = new URL(req.url || '/', 'https://project-infora.vercel.app');
  const path = url.pathname.replace(/\/$/, '');
  const method = req.method || 'GET';
  const body = req.body || {};

  try {
    if (path === '/api/health' && method === 'GET') {
      return res.status(200).json({
        status: 'ok',
        database: 'connected',
        totalChunks: db.getChunks().length,
        hasGeminiKey: Boolean(process.env.GEMINI_API_KEY?.trim() || process.env.GEMINI_API_INFORA?.trim())
      });
    }

    if (path === '/api/auth/register' && method === 'POST') {
      const { fullName, email, password, schoolName, teacherIdentifier } = body;
      if (!fullName || !email || !password) return res.status(400).json({ error: 'Nama, email, dan kata sandi wajib diisi.' });
      if (db.getProfileByEmail(email.toLowerCase().trim())) return res.status(409).json({ error: 'Email sudah terdaftar.' });
      const { hash, salt } = hashPassword(password);
      const profile = db.createProfile({
        email: email.toLowerCase().trim(),
        full_name: fullName.trim(),
        school_name: schoolName?.trim(),
        teacher_identifier: teacherIdentifier?.trim(),
        password_hash: hash,
        password_salt: salt,
        role: 'teacher'
      });
      const token = db.createSession(profile.id);
      return res.status(201).json({ token, user: safeUser(profile) });
    }

    if (path === '/api/auth/login' && method === 'POST') {
      const { email, password } = body;
      const profile = email ? db.getProfileByEmail(email) : undefined;
      if (!profile || !verifyPassword(password || '', profile.password_hash, profile.password_salt)) {
        return res.status(401).json({ error: 'Email atau kata sandi tidak cocok.' });
      }
      const token = db.createSession(profile.id);
      return res.status(200).json({ token, user: safeUser(profile) });
    }

    if (path === '/api/auth/me' && method === 'GET') {
      const auth = req.headers?.authorization || '';
      const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
      const profile = db.getUserFromSession(token);
      if (!profile) return res.status(401).json({ error: 'Sesi login telah kedaluwarsa atau tidak valid.' });
      return res.status(200).json({ user: safeUser(profile) });
    }

    if (path === '/api/auth/logout' && method === 'POST') {
      const auth = req.headers?.authorization || '';
      if (auth.startsWith('Bearer ')) db.deleteSession(auth.slice(7));
      return res.status(200).json({ success: true });
    }

    if (path === '/api/auth/profile' && method === 'PUT') {
      const auth = req.headers?.authorization || '';
      const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
      const profile = db.getUserFromSession(token);
      if (!profile) return res.status(401).json({ error: 'Akses ditolak.' });
      const updated = db.updateProfile(profile.id, {
        full_name: body.full_name?.trim() || profile.full_name,
        school_name: body.school_name?.trim() || profile.school_name,
        teacher_identifier: body.teacher_identifier?.trim() || profile.teacher_identifier
      });
      return res.status(200).json({ user: safeUser(updated || profile) });
    }

    if (path === '/api/chat' && method === 'POST') {
      const { processStudentChat } = await import('../server/rag.ts');
      const message = typeof body.message === 'string' ? body.message.trim() : '';
      if (!message) return res.status(400).json({ error: 'Pesan pertanyaan tidak boleh kosong.' });
      const history = Array.isArray(body.history) ? body.history.slice(-6) : [];
      const result = await processStudentChat(message, history);
      return res.status(200).json(result);
    }

    if (path === '/api/quizzes' && method === 'GET') {
      return res.status(200).json(db.getQuizzes(true));
    }

    if (/^\/api\/quizzes\/[^/]+$/.test(path) && method === 'GET') {
      const id = path.split('/').pop();
      const quiz = db.getQuizById(id!);
      return quiz ? res.status(200).json(quiz) : res.status(404).json({ error: 'Kuis tidak ditemukan.' });
    }

    if (path === '/api/materials' && method === 'GET') {
      const auth = req.headers?.authorization || '';
      const profile = auth.startsWith('Bearer ') ? db.getUserFromSession(auth.slice(7)) : null;
      return res.status(200).json(profile ? db.getMaterials() : db.getMaterials('published'));
    }

    if (path === '/api/questions' && method === 'GET') {
      const auth = req.headers?.authorization || '';
      const profile = auth.startsWith('Bearer ') ? db.getUserFromSession(auth.slice(7)) : null;
      return res.status(200).json(db.getQuestions(!profile));
    }

    if (path === '/api/stats' && method === 'GET') {
      return res.status(200).json({
        totalMaterials: db.getMaterials().length,
        publishedMaterials: db.getMaterials('published').length,
        totalQuestions: db.getQuestions().length,
        totalQuizzes: db.getQuizzes().length,
        totalChunks: db.getChunks().length
      });
    }

    return res.status(404).json({ error: 'Endpoint tidak ditemukan.' });
  } catch (error: any) {
    console.error('Vercel API error:', error);
    return res.status(500).json({ error: error?.message || 'Terjadi kesalahan sistem pada server.' });
  }
}
