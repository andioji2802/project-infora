import { GoogleGenAI } from '@google/genai';
import { db, hashPassword, verifyPassword } from '../server/db.js';

export const config = {
  api: {
    bodyParser: false
  }
};

function cors(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', req.headers?.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
}

function user(req: any) {
  const auth = req.headers?.authorization || '';
  return auth.startsWith('Bearer ') ? db.getUserFromSession(auth.slice(7)) : null;
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

function geminiModel() {
  const configured = process.env.GEMINI_MODEL_NAME?.trim();
  return !configured || configured === 'gemini-2.5-flash'
    ? 'gemini-3.8-flash'
    : configured;
}

export default async function handler(req: any, res: any) {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  const path = new URL(req.url || '/', 'https://project-infora.vercel.app').pathname.replace(/\/$/, '');
  const method = req.method || 'GET';
  let body = req.body || {};
  if (!req.body && ['POST', 'PUT'].includes(method) && typeof req[Symbol.asyncIterator] === 'function') {
    let rawBody = '';
    for await (const chunk of req) {
      rawBody += Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
    }
    if (rawBody.trim()) {
      try {
        body = JSON.parse(rawBody);
      } catch {
        return res.status(400).json({ error: 'Format JSON tidak valid.' });
      }
    }
  }
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: 'Format JSON tidak valid.' });
    }
  } else if (Buffer.isBuffer(body)) {
    try {
      body = JSON.parse(body.toString('utf8'));
    } catch {
      return res.status(400).json({ error: 'Format JSON tidak valid.' });
    }
  } else if (req.rawBody) {
    try {
      body = JSON.parse(Buffer.isBuffer(req.rawBody) ? req.rawBody.toString('utf8') : String(req.rawBody));
    } catch {
      // Use the parsed object when Vercel has already parsed the body.
    }
  }

  try {
    if (path === '/api/health' && method === 'GET') {
      return res.status(200).json({
        status: 'ok',
        hasGeminiKey: Boolean(process.env.GEMINI_API_KEY?.trim() || process.env.GEMINI_API_INFORA?.trim()),
        model: geminiModel()
      });
    }

    if (path === '/api/chat' && method === 'POST') {
      const message = typeof body.message === 'string' ? body.message.trim() : '';
      if (!message) return res.status(400).json({ error: 'Pesan pertanyaan tidak boleh kosong.' });
      const apiKey = process.env.GEMINI_API_KEY?.trim() || process.env.GEMINI_API_INFORA?.trim();
      if (!apiKey) return res.status(500).json({ error: 'API Key Gemini belum dikonfigurasi pada server.' });
      const ai = new GoogleGenAI({ apiKey });
      const result = await ai.models.generateContent({
        model: geminiModel(),
        contents: message,
        config: {
          systemInstruction: 'Jawab sebagai tutor Informatika untuk siswa SMK dalam bahasa Indonesia yang jelas dan edukatif.',
          temperature: 0.25,
          maxOutputTokens: 2048
        }
      });
      return res.status(200).json({ answer: result.text || 'Maaf, jawaban belum dapat dibuat.', isRefusal: false, sources: [] });
    }

    if (path === '/api/auth/register' && method === 'POST') {
      const { fullName, email, password, schoolName, teacherIdentifier } = body;
      if (!fullName || !email || !password) return res.status(400).json({ error: 'Nama, email, dan kata sandi wajib diisi.' });
      if (db.getProfileByEmail(String(email).trim())) return res.status(409).json({ error: 'Email sudah terdaftar.' });
      const hashed = hashPassword(password);
      const profile = db.createProfile({
        email: String(email).toLowerCase().trim(),
        password_hash: hashed.hash,
        password_salt: hashed.salt,
        full_name: String(fullName).trim(),
        school_name: schoolName?.trim(),
        teacher_identifier: teacherIdentifier?.trim(),
        role: 'teacher'
      });
      return res.status(201).json({ token: db.createSession(profile.id), user: safeUser(profile) });
    }

    if (path === '/api/auth/login' && method === 'POST') {
      const profile = db.getProfileByEmail(String(body.email || '').trim());
      if (!profile || !verifyPassword(String(body.password || ''), profile.password_hash, profile.password_salt)) {
        return res.status(401).json({ error: 'Email atau kata sandi tidak cocok.' });
      }
      return res.status(200).json({ token: db.createSession(profile.id), user: safeUser(profile) });
    }

    if (path === '/api/auth/me' && method === 'GET') {
      const profile = user(req);
      if (!profile) return res.status(401).json({ error: 'Sesi login tidak valid.' });
      return res.status(200).json({ user: safeUser(profile) });
    }

    if (path === '/api/auth/logout' && method === 'POST') {
      const auth = req.headers?.authorization || '';
      if (auth.startsWith('Bearer ')) db.deleteSession(auth.slice(7));
      return res.status(200).json({ success: true });
    }

    if (path === '/api/auth/profile' && method === 'PUT') {
      const profile = user(req);
      if (!profile) return res.status(401).json({ error: 'Sesi login tidak valid.' });
      const updated = db.updateProfile(profile.id, {
        full_name: body.full_name?.trim() || profile.full_name,
        school_name: body.school_name?.trim() || profile.school_name,
        teacher_identifier: body.teacher_identifier?.trim() || profile.teacher_identifier
      });
      return res.status(200).json({ user: safeUser(updated || profile) });
    }

    if (path === '/api/materials' && method === 'GET') {
      const profile = user(req);
      return res.status(200).json(profile ? db.getMaterials() : db.getMaterials('published'));
    }
    if (path === '/api/materials' && method === 'POST') {
      const profile = user(req);
      if (!profile) return res.status(401).json({ error: 'Sesi guru diperlukan.' });
      if (!body.title || !body.category || !body.content) return res.status(400).json({ error: 'Judul, kategori, dan isi materi wajib diisi.' });
      const now = new Date().toISOString();
      const item = db.upsertMaterial({
        id: `mat-${Date.now()}`, owner_id: profile.id, teacher_name: profile.full_name,
        title: String(body.title).trim(),
        slug: String(body.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
        category: body.category, grade_level: body.grade_level || 'Kelas X SMK',
        learning_objectives: body.learning_objectives, summary: body.summary, content: body.content,
        keywords: body.keywords, practice_steps: body.practice_steps, faq: body.faq, references: body.references,
        status: body.status || 'published', created_at: now, updated_at: now, chunk_count: 0
      });
      return res.status(201).json(item);
    }
    const materialMatch = path.match(/^\/api\/materials\/([^/]+)$/);
    if (materialMatch) {
      const id = decodeURIComponent(materialMatch[1]);
      const existing = db.getMaterialById(id);
      if (method === 'GET') return existing ? res.status(200).json(existing) : res.status(404).json({ error: 'Materi tidak ditemukan.' });
      const profile = user(req);
      if (!profile) return res.status(401).json({ error: 'Sesi guru diperlukan.' });
      if (method === 'DELETE') return db.deleteMaterial(id) ? res.status(200).json({ success: true }) : res.status(404).json({ error: 'Materi tidak ditemukan.' });
      if (method === 'PUT' && existing) {
        const updated = db.upsertMaterial({
          ...existing, title: body.title?.trim() || existing.title,
          category: body.category || existing.category, grade_level: body.grade_level || existing.grade_level,
          learning_objectives: body.learning_objectives ?? existing.learning_objectives,
          summary: body.summary ?? existing.summary, content: body.content ?? existing.content,
          keywords: body.keywords ?? existing.keywords, practice_steps: body.practice_steps ?? existing.practice_steps,
          faq: body.faq ?? existing.faq, references: body.references ?? existing.references,
          status: body.status || existing.status, updated_at: new Date().toISOString()
        });
        return res.status(200).json(updated);
      }
    }

    if (path === '/api/questions' && method === 'GET') {
      return res.status(200).json(db.getQuestions(!user(req)));
    }
    if (path === '/api/questions' && method === 'POST') {
      const profile = user(req);
      if (!profile) return res.status(401).json({ error: 'Sesi guru diperlukan.' });
      if (!body.question_text || !body.category) return res.status(400).json({ error: 'Teks pertanyaan dan kategori wajib diisi.' });
      const now = new Date().toISOString();
      return res.status(201).json(db.upsertQuestion({
        id: `q-${Date.now()}`, owner_id: profile.id, question_text: String(body.question_text).trim(),
        category: body.category, difficulty: body.difficulty || 'Sedang',
        question_type: body.question_type || 'multiple_choice', options: body.options || [],
        correct_answer: body.correct_answer, explanation: body.explanation || '',
        competency: body.competency || '', status: body.status || 'published', created_at: now, updated_at: now
      }));
    }
    const questionMatch = path.match(/^\/api\/questions\/([^/]+)$/);
    if (questionMatch) {
      const id = decodeURIComponent(questionMatch[1]);
      const profile = user(req);
      const existing = db.getQuestionById(id);
      if (method === 'DELETE' && profile) return db.deleteQuestion(id) ? res.status(200).json({ success: true }) : res.status(404).json({ error: 'Soal tidak ditemukan.' });
      if (method === 'PUT' && profile && existing) return res.status(200).json(db.upsertQuestion({
        ...existing, ...body, question_text: body.question_text?.trim() || existing.question_text,
        updated_at: new Date().toISOString()
      }));
    }

    if (path === '/api/quizzes' && method === 'GET') return res.status(200).json(db.getQuizzes(true));
    if (path === '/api/quizzes' && method === 'POST') {
      const profile = user(req);
      if (!profile) return res.status(401).json({ error: 'Sesi guru diperlukan.' });
      if (!body.title || !body.category || !Array.isArray(body.question_ids)) return res.status(400).json({ error: 'Judul, kategori, dan soal kuis wajib diisi.' });
      const now = new Date().toISOString();
      return res.status(201).json(db.upsertQuiz({
        id: `quiz-${Date.now()}`, owner_id: profile.id, title: String(body.title).trim(),
        description: body.description || '', category: body.category, difficulty: body.difficulty || 'Sedang',
        status: body.status || 'published', question_ids: body.question_ids, created_at: now, updated_at: now
      }));
    }
    const quizMatch = path.match(/^\/api\/quizzes\/([^/]+)$/);
    if (quizMatch) {
      const id = decodeURIComponent(quizMatch[1]);
      const existing = db.getQuizById(id);
      if (method === 'GET') return existing ? res.status(200).json(existing) : res.status(404).json({ error: 'Kuis tidak ditemukan.' });
      const profile = user(req);
      if (method === 'DELETE' && profile) return db.deleteQuiz(id) ? res.status(200).json({ success: true }) : res.status(404).json({ error: 'Kuis tidak ditemukan.' });
      if (method === 'PUT' && profile && existing) return res.status(200).json(db.upsertQuiz({
        ...existing, ...body, title: body.title?.trim() || existing.title, updated_at: new Date().toISOString()
      }));
    }

    const gradeMatch = path.match(/^\/api\/quizzes\/([^/]+)\/grade$/);
    if (gradeMatch && method === 'POST') {
      const quiz = db.getQuizById(decodeURIComponent(gradeMatch[1]));
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
    return res.status(500).json({ error: error?.message || 'Terjadi kesalahan pada server.' });
  }
}
