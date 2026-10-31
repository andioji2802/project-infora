/**
 * INFORA — Server Entry Point (Full-Stack Node.js & Express)
 * Serves vanilla frontend and API endpoints for student chatbot RAG and teacher portal.
 */

import express, { Request, Response, NextFunction } from 'express';
import path from 'node:path';
import { db, hashPassword, verifyPassword, TeacherProfile } from './server/db.js';
import { processStudentChat, ensurePublishedMaterialsIndexed, indexMaterial } from './server/rag.ts';
import { GENERATIVE_MODEL_NAME } from './server/ai.ts';

// Extend Express Request to include authenticated user
interface AuthenticatedRequest extends Request {
  user?: TeacherProfile;
}

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT_DIR = process.cwd();

app.use(express.json({ limit: '2mb' }));

// Security Headers
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const frontendUrl = process.env.FRONTEND_URL?.trim().replace(/\/$/, '');
  if (!frontendUrl || origin === frontendUrl) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Simple in-memory rate limiter for Chat endpoint
const requestCounts = new Map<string, { count: number; resetAt: number }>();
function rateLimiter(limit = 40, windowMs = 60000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown-ip';
    const now = Date.now();
    const client = requestCounts.get(ip);

    if (!client || client.resetAt < now) {
      requestCounts.set(ip, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (client.count >= limit) {
      return res.status(429).json({
        error: 'Terlalu banyak permintaan. Silakan tunggu sebentar sebelum mengirim pertanyaan lagi.'
      });
    }

    client.count++;
    next();
  };
}

// Authentication Middleware for Teacher endpoints
function requireTeacherAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Akses ditolak. Token autentikasi guru diperlukan.' });
  }

  const token = authHeader.substring(7);
  const user = db.getUserFromSession(token);
  if (!user) {
    return res.status(401).json({ error: 'Sesi login telah kedaluwarsa atau tidak valid.' });
  }

  req.user = user;
  next();
}

function optionalTeacherAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    req.user = db.getUserFromSession(token) || undefined;
  }
  next();
}

// ==========================================
// 1. STUDENT CHATBOT API (No Login Required)
// ==========================================
app.post('/api/chat', rateLimiter(40, 60000), async (req: Request, res: Response) => {
  try {
    const { message, history } = req.body;
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Pesan pertanyaan tidak boleh kosong.' });
    }

    const safeHistory = Array.isArray(history)
      ? history.slice(-6).filter((item: any) =>
          item &&
          (item.role === 'user' || item.role === 'assistant') &&
          typeof item.content === 'string' &&
          item.content.trim().length > 0
        ).map((item: any) => ({
          role: item.role,
          content: item.content.trim().slice(0, 2500)
        }))
      : [];

    const result = await processStudentChat(message, safeHistory);
    res.json(result);
  } catch (err: any) {
    console.error('Error in /api/chat:', err);
    res.status(500).json({
      error: 'Terjadi kesalahan sistem saat memproses jawaban AI. Silakan coba lagi.'
    });
  }
});

// ==========================================
// 2. TEACHER AUTHENTICATION APIS
// ==========================================
app.post('/api/auth/register', (req: Request, res: Response) => {
  try {
    const { fullName, email, password, schoolName, teacherIdentifier } = req.body;

    if (!fullName || !email || !password) {
      return res.status(400).json({ error: 'Nama, email, dan kata sandi wajib diisi.' });
    }

    const existing = db.getProfileByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'Email sudah terdaftar. Silakan gunakan email lain atau masuk.' });
    }

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
    const safeUser = {
      id: profile.id,
      email: profile.email,
      full_name: profile.full_name,
      school_name: profile.school_name,
      teacher_identifier: profile.teacher_identifier,
      role: profile.role
    };

    res.status(201).json({ token, user: safeUser });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Pendaftaran gagal' });
  }
});

app.post('/api/auth/login', (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email dan kata sandi wajib diisi.' });
    }

    const profile = db.getProfileByEmail(email);
    if (!profile || !verifyPassword(password, profile.password_hash, profile.password_salt)) {
      return res.status(401).json({ error: 'Email atau kata sandi tidak cocok.' });
    }

    const token = db.createSession(profile.id);
    const safeUser = {
      id: profile.id,
      email: profile.email,
      full_name: profile.full_name,
      school_name: profile.school_name,
      teacher_identifier: profile.teacher_identifier,
      role: profile.role
    };

    res.json({ token, user: safeUser });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Login gagal' });
  }
});

app.get('/api/auth/me', requireTeacherAuth, (req: AuthenticatedRequest, res: Response) => {
  const profile = req.user!;
  res.json({
    user: {
      id: profile.id,
      email: profile.email,
      full_name: profile.full_name,
      school_name: profile.school_name,
      teacher_identifier: profile.teacher_identifier,
      role: profile.role
    }
  });
});

app.put('/api/auth/profile', requireTeacherAuth, (req: AuthenticatedRequest, res: Response) => {
  const { full_name, school_name, teacher_identifier } = req.body;
  const updated = db.updateProfile(req.user!.id, {
    full_name: full_name?.trim() || req.user!.full_name,
    school_name: school_name?.trim() || req.user!.school_name,
    teacher_identifier: teacher_identifier?.trim() || req.user!.teacher_identifier
  });
  if (!updated) return res.status(404).json({ error: 'Profil tidak ditemukan' });

  res.json({
    user: {
      id: updated.id,
      email: updated.email,
      full_name: updated.full_name,
      school_name: updated.school_name,
      teacher_identifier: updated.teacher_identifier,
      role: updated.role
    }
  });
});

app.post('/api/auth/logout', (req: Request, res: Response) => {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    db.deleteSession(authHeader.substring(7));
  }
  res.json({ success: true });
});

// ==========================================
// 3. MATERIALS MANAGEMENT APIS
// ==========================================
app.get('/api/materials', optionalTeacherAuth, (req: AuthenticatedRequest, res: Response) => {
  if (req.user) {
    // Authenticated teachers see all materials (or their own drafts)
    const list = db.getMaterials();
    return res.json(list);
  }
  // Public students only see published materials
  const published = db.getMaterials('published');
  res.json(published);
});

app.get('/api/materials/:id', optionalTeacherAuth, (req: AuthenticatedRequest, res: Response) => {
  const mat = db.getMaterialById(req.params.id);
  if (!mat) return res.status(404).json({ error: 'Materi tidak ditemukan' });

  if (mat.status !== 'published' && (!req.user || req.user.id !== mat.owner_id)) {
    return res.status(403).json({ error: 'Materi draf hanya dapat diakses oleh guru pembuat.' });
  }

  res.json(mat);
});

app.post('/api/materials', requireTeacherAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { title, category, grade_level, status, learning_objectives, summary, content, keywords, practice_steps, faq, references } = req.body;

    if (!title || !category || !content) {
      return res.status(400).json({ error: 'Judul, kategori, dan isi materi wajib diisi.' });
    }

    const id = `mat-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const newMaterial = db.upsertMaterial({
      id,
      owner_id: req.user!.id,
      teacher_name: req.user!.full_name,
      title: title.trim(),
      slug,
      category,
      grade_level: grade_level || 'Kelas X SMK',
      learning_objectives: learning_objectives?.trim(),
      summary: summary?.trim(),
      content: content.trim(),
      keywords: keywords?.trim(),
      practice_steps: practice_steps?.trim(),
      faq: faq?.trim(),
      references: references?.trim(),
      status: status || 'published',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      chunk_count: 0
    });

    // If published, generate vector chunks for RAG
    if (newMaterial.status === 'published') {
      await indexMaterial(newMaterial);
    }

    res.status(201).json(newMaterial);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Gagal menyimpan materi' });
  }
});

app.put('/api/materials/:id', requireTeacherAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const existing = db.getMaterialById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Materi tidak ditemukan' });

    // Bagian 1 Principle 6: "Guru tidak boleh mengubah konten milik guru lain tanpa izin."
    if (existing.owner_id !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Anda hanya berhak mengedit materi milik Anda sendiri.' });
    }

    const { title, category, grade_level, status, learning_objectives, summary, content, keywords, practice_steps, faq, references } = req.body;

    const updated = db.upsertMaterial({
      ...existing,
      title: title?.trim() || existing.title,
      category: category || existing.category,
      grade_level: grade_level || existing.grade_level,
      status: status || existing.status,
      learning_objectives: learning_objectives !== undefined ? learning_objectives.trim() : existing.learning_objectives,
      summary: summary !== undefined ? summary.trim() : existing.summary,
      content: content?.trim() || existing.content,
      keywords: keywords !== undefined ? keywords.trim() : existing.keywords,
      practice_steps: practice_steps !== undefined ? practice_steps.trim() : existing.practice_steps,
      faq: faq !== undefined ? faq.trim() : existing.faq,
      references: references !== undefined ? references.trim() : existing.references,
      updated_at: new Date().toISOString()
    });

    if (updated.status === 'published') {
      await indexMaterial(updated);
    } else {
      // If changed to draft or archived, remove chunks from student RAG
      db.deleteChunksByMaterialId(updated.id);
    }

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Gagal memperbarui materi' });
  }
});

app.delete('/api/materials/:id', requireTeacherAuth, (req: AuthenticatedRequest, res: Response) => {
  const existing = db.getMaterialById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Materi tidak ditemukan' });

  if (existing.owner_id !== req.user!.id && req.user!.role !== 'admin') {
    return res.status(403).json({ error: 'Anda hanya berhak menghapus materi milik Anda sendiri.' });
  }

  db.deleteMaterial(req.params.id);
  res.json({ success: true, message: 'Materi berhasil dihapus dari database dan RAG.' });
});

// ==========================================
// 4. QUESTIONS MANAGEMENT APIS
// ==========================================
app.get('/api/questions', optionalTeacherAuth, (req: AuthenticatedRequest, res: Response) => {
  const isTeacher = !!req.user;
  const list = db.getQuestions(!isTeacher);

  if (!isTeacher) {
    // Bagian 6: "Jaga kunci jawaban agar tidak bocor melalui endpoint publik yang digunakan untuk menampilkan soal."
    const safeQuestions = list.map(q => {
      const { correct_answer, explanation, ...safe } = q;
      return safe;
    });
    return res.json(safeQuestions);
  }

  res.json(list);
});

app.post('/api/questions', requireTeacherAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { question_text, category, difficulty, question_type, options, correct_answer, explanation, competency } = req.body;

    if (!question_text || !category) {
      return res.status(400).json({ error: 'Teks pertanyaan dan kategori wajib diisi.' });
    }

    const id = `q-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newQ = db.upsertQuestion({
      id,
      owner_id: req.user!.id,
      category,
      difficulty: difficulty || 'Sedang',
      question_type: question_type || 'multiple_choice',
      question_text: question_text.trim(),
      options: options || [],
      correct_answer,
      explanation: explanation?.trim() || '',
      competency: competency?.trim() || '',
      status: 'published',
      created_at: new Date().toISOString()
    });

    res.status(201).json(newQ);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Gagal menyimpan soal' });
  }
});

app.put('/api/questions/:id', requireTeacherAuth, (req: AuthenticatedRequest, res: Response) => {
  const existing = db.getQuestionById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Soal tidak ditemukan' });

  if (existing.owner_id !== req.user!.id && req.user!.role !== 'admin') {
    return res.status(403).json({ error: 'Anda hanya berhak mengedit soal milik Anda sendiri.' });
  }

  const { question_text, category, difficulty, question_type, options, correct_answer, explanation, competency } = req.body;
  const updated = db.upsertQuestion({
    ...existing,
    question_text: question_text?.trim() || existing.question_text,
    category: category || existing.category,
    difficulty: difficulty || existing.difficulty,
    question_type: question_type || existing.question_type,
    options: options !== undefined ? options : existing.options,
    correct_answer: correct_answer !== undefined ? correct_answer : existing.correct_answer,
    explanation: explanation !== undefined ? explanation.trim() : existing.explanation,
    competency: competency !== undefined ? competency.trim() : existing.competency,
    updated_at: new Date().toISOString()
  });

  res.json(updated);
});

app.delete('/api/questions/:id', requireTeacherAuth, (req: AuthenticatedRequest, res: Response) => {
  const existing = db.getQuestionById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Soal tidak ditemukan' });

  if (existing.owner_id !== req.user!.id && req.user!.role !== 'admin') {
    return res.status(403).json({ error: 'Anda hanya berhak menghapus soal milik Anda sendiri.' });
  }

  db.deleteQuestion(req.params.id);
  res.json({ success: true });
});

// ==========================================
// 5. QUIZZES MANAGEMENT & SAFE GRADING APIS
// ==========================================
app.get('/api/quizzes', optionalTeacherAuth, (req: AuthenticatedRequest, res: Response) => {
  const isTeacher = !!req.user;
  const quizzes = db.getQuizzes(!isTeacher);

  const populated = quizzes.map(q => {
    const qObjects = (q.question_ids || [])
      .map(id => db.getQuestionById(id))
      .filter(Boolean)
      .map(fullQ => {
        if (!isTeacher) {
          const { correct_answer, explanation, ...safeQ } = fullQ!;
          return safeQ;
        }
        return fullQ;
      });
    return { ...q, questions: qObjects };
  });

  res.json(populated);
});

app.get('/api/quizzes/:id', optionalTeacherAuth, (req: AuthenticatedRequest, res: Response) => {
  const quiz = db.getQuizById(req.params.id);
  if (!quiz) return res.status(404).json({ error: 'Paket kuis tidak ditemukan' });

  const isTeacher = !!req.user;
  const qObjects = (quiz.question_ids || [])
    .map(id => db.getQuestionById(id))
    .filter(Boolean)
    .map(fullQ => {
      if (!isTeacher) {
        // Strip answer and explanation to prevent student inspection
        const { correct_answer, explanation, ...safeQ } = fullQ!;
        return safeQ;
      }
      return fullQ;
    });

  res.json({ ...quiz, questions: qObjects });
});

app.post('/api/quizzes', requireTeacherAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { title, category, difficulty, description, question_ids, status } = req.body;
    if (!title) return res.status(400).json({ error: 'Judul kuis wajib diisi.' });

    const id = `quiz-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newQuiz = db.upsertQuiz({
      id,
      owner_id: req.user!.id,
      title: title.trim(),
      category: category || 'Informatika',
      difficulty: difficulty || 'Sedang',
      description: description?.trim() || '',
      question_ids: question_ids || [],
      status: status || 'published',
      created_at: new Date().toISOString()
    });

    res.status(201).json(newQuiz);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Gagal menyimpan paket kuis' });
  }
});

app.put('/api/quizzes/:id', requireTeacherAuth, (req: AuthenticatedRequest, res: Response) => {
  const existing = db.getQuizById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Kuis tidak ditemukan' });

  if (existing.owner_id !== req.user!.id && req.user!.role !== 'admin') {
    return res.status(403).json({ error: 'Anda hanya berhak mengedit kuis milik Anda sendiri.' });
  }

  const { title, category, difficulty, description, question_ids, status } = req.body;
  const updated = db.upsertQuiz({
    ...existing,
    title: title?.trim() || existing.title,
    category: category || existing.category,
    difficulty: difficulty || existing.difficulty,
    description: description !== undefined ? description.trim() : existing.description,
    question_ids: question_ids !== undefined ? question_ids : existing.question_ids,
    status: status || existing.status,
    updated_at: new Date().toISOString()
  });

  res.json(updated);
});

app.delete('/api/quizzes/:id', requireTeacherAuth, (req: AuthenticatedRequest, res: Response) => {
  const existing = db.getQuizById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Kuis tidak ditemukan' });

  if (existing.owner_id !== req.user!.id && req.user!.role !== 'admin') {
    return res.status(403).json({ error: 'Anda hanya berhak menghapus kuis milik Anda sendiri.' });
  }

  db.deleteQuiz(req.params.id);
  res.json({ success: true });
});

/**
 * Safe Server-Side Grading Endpoint (Bagian 13)
 * Evaluates student answers against protected correct answers in the database.
 */
app.post('/api/quizzes/:id/grade', (req: Request, res: Response) => {
  const quiz = db.getQuizById(req.params.id);
  if (!quiz) return res.status(404).json({ error: 'Kuis tidak ditemukan' });

  const { answers } = req.body; // Map: { [questionId]: selectedOptionIndex }
  if (!answers || typeof answers !== 'object') {
    return res.status(400).json({ error: 'Jawaban kuis tidak valid.' });
  }

  let correctCount = 0;
  const total = quiz.question_ids.length;
  const results: any[] = [];

  for (const qId of quiz.question_ids) {
    const qObj = db.getQuestionById(qId);
    if (!qObj) continue;

    const userAnswer = answers[qId];
    const isCorrect = Number(userAnswer) === Number(qObj.correct_answer);
    if (isCorrect) correctCount++;

    results.push({
      question_id: qId,
      user_answer: userAnswer,
      correct_answer: qObj.correct_answer,
      is_correct: isCorrect,
      explanation: qObj.explanation
    });
  }

  res.json({
    quiz_id: quiz.id,
    title: quiz.title,
    total,
    correct_count: correctCount,
    score: correctCount,
    results
  });
});

// ==========================================
// 6. DASHBOARD STATS & HEALTH APIS
// ==========================================
app.get('/api/stats', (req: Request, res: Response) => {
  const allMat = db.getMaterials();
  const pubMat = db.getMaterials('published');
  const allQ = db.getQuestions();
  const chunks = db.getChunks();
  const quizzes = db.getQuizzes();

  res.json({
    totalMaterials: allMat.length,
    publishedMaterials: pubMat.length,
    totalQuestions: allQ.length,
    totalQuizzes: quizzes.length,
    totalChunks: chunks.length
  });
});

app.get('/api/health', (req: Request, res: Response) => {
  const chunks = db.getChunks();
  res.json({
    status: 'ok',
    database: 'connected',
    totalChunks: chunks.length,
    model: GENERATIVE_MODEL_NAME,
    embedding: 'gemini-embedding-2-preview'
  });
});

// ==========================================
// 7. STATIC FILES SERVING & PAGE ROUTES
// ==========================================
// Static assets
app.use('/css', express.static(path.join(ROOT_DIR, 'css')));
app.use('/js', express.static(path.join(ROOT_DIR, 'js')));
app.use('/public', express.static(path.join(ROOT_DIR, 'public')));

// Teacher Portal URL: /adminguru/ and /adminguru
app.get(['/adminguru', '/adminguru/'], (req: Request, res: Response) => {
  res.sendFile(path.join(ROOT_DIR, 'adminguru', 'index.html'));
});

// Student Chatbot Homepage: /
app.get('/', (req: Request, res: Response) => {
  res.sendFile(path.join(ROOT_DIR, 'index.html'));
});

// Catch-all route
app.get('*', (req: Request, res: Response) => {
  if (req.path.startsWith('/adminguru')) {
    return res.sendFile(path.join(ROOT_DIR, 'adminguru', 'index.html'));
  }
  res.sendFile(path.join(ROOT_DIR, 'index.html'));
});

// Convert malformed JSON and request-body errors into a clean API response
// instead of allowing body-parser stack traces to be printed on the server.
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({
      error: 'Format JSON permintaan tidak valid.'
    });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({
      error: 'Ukuran data permintaan terlalu besar.'
    });
  }
  console.error('Unhandled server error:', err);
  return res.status(500).json({
    error: 'Terjadi kesalahan sistem pada server.'
  });
});

export default app;

if (process.env.VERCEL !== '1') {
  const server = app.listen(PORT, async () => {
    console.log(`[INFORA] Server running on http://localhost:${PORT}`);

    try {
      await ensurePublishedMaterialsIndexed();
      console.log(
        `[INFORA] RAG Vector Index ready with ${db.getChunks().length} chunks.`
      );
    } catch (err) {
      console.error('[INFORA] Warning warming RAG chunks:', err);
    }
  });

  server.on('error', (err) => {
    console.error('[INFORA] Server error:', err);
  });
}