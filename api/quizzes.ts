import crypto from 'node:crypto';
import { db, QuizAttemptItem, QuizItem } from '../server/db.js';
import { parseRequestBody } from '../server/http.js';
import { getSupabaseConfig, supabaseRequest } from '../server/supabase.js';
import { getSessionProfile } from '../server/auth.js';

function teacherFromLocal(req: any) {
  const auth = req.headers?.authorization || '';
  return auth.startsWith('Bearer ') ? db.getUserFromSession(auth.slice(7)) : null;
}

export function normalizeQuizRubric(questionIds: string[], maxScore: unknown, rubric: unknown): { maxScore: number; rubric: Record<string, number> } {
  const total = Number(maxScore);
  const normalizedMaxScore = Number.isFinite(total) && total > 0 ? Math.min(1000, Math.round(total * 100) / 100) : 100;
  const source = rubric && typeof rubric === 'object' ? rubric as Record<string, unknown> : {};
  const explicit = questionIds.map(id => Number(source[id])).filter(value => Number.isFinite(value) && value >= 0);
  if (explicit.length === questionIds.length && explicit.some(value => value > 0)) {
    return {
      maxScore: normalizedMaxScore,
      rubric: Object.fromEntries(questionIds.map(id => [id, Number(source[id] || 0)]))
    };
  }
  const equalPoint = questionIds.length ? normalizedMaxScore / questionIds.length : 0;
  const equalRubric = Object.fromEntries(questionIds.map((id, index) =>
    [id, index === questionIds.length - 1 ? 0 : Math.round(equalPoint * 100) / 100]
  ));
  if (questionIds.length) {
    const priorTotal = Object.entries(equalRubric)
      .slice(0, -1)
      .reduce((sum, [, value]) => sum + Number(value || 0), 0);
    equalRubric[questionIds[questionIds.length - 1]] =
      Math.round((normalizedMaxScore - priorTotal) * 100) / 100;
  }
  return {
    maxScore: normalizedMaxScore,
    rubric: equalRubric
  };
}

export function validateStudentIdentity(name: unknown, nis: unknown): { valid: boolean; name: string; nis: string; error?: string } {
  const normalizedName = String(name || '').trim().replace(/\s+/g, ' ');
  const normalizedNis = String(nis || '').trim();
  if (normalizedName.length < 2) return { valid: false, name: normalizedName, nis: normalizedNis, error: 'Nama lengkap wajib diisi.' };
  if (!/^\d{4,20}$/.test(normalizedNis)) return { valid: false, name: normalizedName, nis: normalizedNis, error: 'NIS wajib berisi 4-20 angka.' };
  return { valid: true, name: normalizedName, nis: normalizedNis };
}

async function resolveQuizQuestionsSupabase(quiz: any) {
  const ids = Array.isArray(quiz.question_ids)
    ? quiz.question_ids
    : (typeof quiz.question_ids === 'string' ? (() => { try { return JSON.parse(quiz.question_ids || '[]'); } catch { return []; } })() : []);
  let resolvedIds = ids;
  if (!resolvedIds.length) {
    const pivot = await supabaseRequest('quiz_questions', {
      query: { quiz_id: `eq.${quiz.id}`, select: 'question_id,position', order: 'position.asc' }
    });
    resolvedIds = pivot.data.map((item: any) => item.question_id).filter(Boolean);
  }
  const questionsResult = resolvedIds.length
    ? await supabaseRequest('questions', { query: { id: `in.(${resolvedIds.join(',')})`, status: 'eq.published', select: '*' } })
    : { data: [] };
  const questions = resolvedIds.map((id: string) => questionsResult.data.find((question: any) => question.id === id)).filter(Boolean);
  return { ids: resolvedIds, questions };
}

function gradeQuestions(quiz: any, resolvedQuestions: any[], answers: Record<string, unknown>) {
  const maxScore = Number(quiz.max_score) > 0 ? Number(quiz.max_score) : 100;
  const normalizedRubric = normalizeQuizRubric(
    resolvedQuestions.map(question => question.id),
    maxScore,
    quiz.rubric || {}
  );
  const rubricTotal = Object.values(normalizedRubric.rubric).reduce((sum, points) => sum + Number(points || 0), 0);
  let earnedRaw = 0;
  let correctCount = 0;
  const results = resolvedQuestions.map((question: any, position: number) => {
    const rawAnswer = answers?.[question.id];
    const userAnswer = rawAnswer === null || rawAnswer === undefined || rawAnswer === '' ? null : Number(rawAnswer);
    const correctAnswer = typeof question.correct_answer === 'number'
      ? Number(question.correct_answer)
      : Number(question.correct_answer?.value ?? question.correct_answer);
    const isCorrect = Number.isInteger(userAnswer) && userAnswer === correctAnswer;
    const pointsPossible = Number(normalizedRubric.rubric[question.id] || 0);
    const pointsEarned = isCorrect ? pointsPossible : 0;
    if (isCorrect) {
      correctCount++;
      earnedRaw += pointsEarned;
    }
    return {
      question_id: question.id,
      position: position + 1,
      is_correct: isCorrect,
      user_answer: Number.isInteger(userAnswer) ? userAnswer : null,
      correct_answer: correctAnswer,
      points_possible: pointsPossible,
      points_earned: pointsEarned,
      explanation: question.explanation || ''
    };
  });
  const scaledScore = rubricTotal > 0 ? (earnedRaw / rubricTotal) * maxScore : 0;
  const score = Math.round(scaledScore * 100) / 100;
  const total = resolvedQuestions.length;
  return {
    score,
    max_score: maxScore,
    correct: correctCount,
    correct_count: correctCount,
    wrong_count: Math.max(0, total - correctCount),
    total,
    results,
    rubric: normalizedRubric.rubric
  };
}

async function saveSupabaseAttempt(quiz: any, identity: { name: string; nis: string }, grading: any, body: any) {
  const existingKey = String(body.idempotencyKey || '').trim();
  if (existingKey) {
    const existing = await supabaseRequest('quiz_attempts', {
      query: { quiz_id: `eq.${quiz.id}`, idempotency_key: `eq.${existingKey}`, select: '*' }
    });
    if (existing.data[0]) {
      const savedAnswers = await supabaseRequest('quiz_attempt_answers', {
        query: { attempt_id: `eq.${existing.data[0].id}`, select: '*', order: 'position.asc' }
      });
      return {
        ...existing.data[0],
        score: Number(existing.data[0].score),
        correct_count: existing.data[0].correct_count,
        total: existing.data[0].total_questions,
        wrong_count: existing.data[0].wrong_count,
        results: savedAnswers.data.map((row: any) => ({
          question_id: row.question_id,
          position: row.position,
          is_correct: row.is_correct,
          user_answer: row.user_answer,
          correct_answer: row.correct_answer,
          points_possible: Number(row.points_possible),
          points_earned: Number(row.points_earned),
          explanation: row.explanation || ''
        }))
      };
    }
  }
  const key = existingKey || crypto.randomUUID();
  const attemptResult = await supabaseRequest('quiz_attempts', {
    method: 'POST',
    body: {
      quiz_id: quiz.id,
      quiz_owner_id: quiz.owner_id,
      student_name: identity.name,
      student_nis: identity.nis,
      answers: body.answers || {},
      correct_count: grading.correct_count,
      wrong_count: grading.wrong_count,
      total_questions: grading.total,
      score: grading.score,
      max_score: grading.max_score,
      rubric_snapshot: grading.rubric,
      idempotency_key: key,
      started_at: body.startedAt ? String(body.startedAt) : null
    }
  });
  const attempt = attemptResult.data[0];
  if (!attempt) throw new Error(attemptResult.error || 'Gagal menyimpan hasil kuis.');
  await supabaseRequest('quiz_attempt_answers', {
    method: 'POST',
    body: grading.results.map((result: any) => ({
      attempt_id: attempt.id,
      quiz_id: quiz.id,
      question_id: result.question_id,
      user_answer: result.user_answer,
      correct_answer: result.correct_answer,
      is_correct: result.is_correct,
      points_possible: result.points_possible,
      points_earned: result.points_earned,
      explanation: result.explanation,
      position: result.position
    }))
  });
  return {
    ...attempt,
    score: grading.score,
    max_score: grading.max_score,
    correct_count: grading.correct_count,
    wrong_count: grading.wrong_count,
    total: grading.total,
    results: grading.results
  };
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', req.headers?.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  if (req.method === 'OPTIONS') return res.status(204).end();
  const body = parseRequestBody(req);

  if (getSupabaseConfig()) {
    if (req.method === 'GET' && String(req.query?.results || '') === 'true') {
      const profile = await getSessionProfile(req);
      if (!profile) return res.status(401).json({ error: 'Sesi guru diperlukan.' });
      const quizId = String(req.query?.id || '');
      const quizResult = await supabaseRequest('quizzes', { query: { id: `eq.${quizId}`, owner_id: `eq.${profile.id}`, select: '*' } });
      const quiz = quizResult.data[0];
      if (!quiz) return res.status(404).json({ error: 'Kuis tidak ditemukan atau bukan milik Anda.' });
      const attemptResult = await supabaseRequest('quiz_attempts', {
        query: { quiz_id: `eq.${quizId}`, select: '*', order: 'finished_at.desc' }
      });
      const attempts = attemptResult.data;
      const scores = attempts.map((attempt: any) => Number(attempt.score) || 0);
      const statistics = {
        count: attempts.length,
        highest: scores.length ? Math.max(...scores) : 0,
        lowest: scores.length ? Math.min(...scores) : 0,
        average: scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100 : 0
      };
      return res.status(200).json({ quiz, attempts, statistics });
    }

    if (req.method === 'GET') {
      const id = String(req.query?.id || '');
      const query: Record<string, string> = id
        ? { id: `eq.${id}`, select: '*' }
        : { status: 'eq.published', select: '*', order: 'updated_at.desc' };
      const result = await supabaseRequest('quizzes', { query });
      if (!id) {
        const quizzes = await Promise.all(result.data.map(async (quiz: any) => {
          const resolved = await resolveQuizQuestionsSupabase(quiz);
          return {
            ...quiz,
            max_score: Number(quiz.max_score) || 100,
            rubric: quiz.rubric || {},
            questions: resolved.questions.map((question: any) => {
              const { correct_answer, explanation, ...publicQuestion } = question;
              return publicQuestion;
            })
          };
        }));
        return res.status(result.status === 200 ? 200 : result.status).json(quizzes);
      }
      const quiz = result.data[0];
      if (!quiz) return res.status(404).json({ error: 'Kuis tidak ditemukan.' });
      const resolved = await resolveQuizQuestionsSupabase(quiz);
      const publicQuestions = resolved.questions.map((question: any) => {
        const { correct_answer, ...publicQuestion } = question;
        const { explanation, ...questionWithoutAnswerDisclosure } = publicQuestion;
        return questionWithoutAnswerDisclosure;
      });
      return res.status(200).json({ ...quiz, max_score: Number(quiz.max_score) || 100, rubric: quiz.rubric || {}, questions: publicQuestions });
    }

    if (req.method === 'POST' && String(req.query?.grade || '') === 'true') {
      const quizId = String(req.query?.id || body.quizId || '');
      const quizResult = await supabaseRequest('quizzes', { query: { id: `eq.${quizId}`, status: 'eq.published', select: '*' } });
      const quiz = quizResult.data[0];
      if (!quiz) return res.status(404).json({ error: 'Kuis tidak ditemukan atau belum diterbitkan.' });
      const identity = validateStudentIdentity(body.studentName, body.studentNis);
      if (!identity.valid) return res.status(400).json({ error: identity.error });
      const resolved = await resolveQuizQuestionsSupabase(quiz);
      if (!resolved.questions.length) return res.status(400).json({ error: 'Kuis belum memiliki soal yang diterbitkan.' });
      const grading = gradeQuestions(quiz, resolved.questions, body.answers || {});
      try {
        const attempt = await saveSupabaseAttempt(quiz, identity, grading, body);
        return res.status(200).json(attempt);
      } catch (error: any) {
        return res.status(500).json({ error: error.message || 'Gagal menyimpan hasil kuis.' });
      }
    }

    const profile = await getSessionProfile(req);
    if (!profile) return res.status(401).json({ error: 'Sesi guru diperlukan.' });
    const id = String(req.query?.id || body.id || '');
    if (req.method === 'DELETE') {
      await supabaseRequest('quizzes', { method: 'DELETE', query: { id: `eq.${id}`, owner_id: `eq.${profile.id}` } });
      return res.status(200).json({ success: true });
    }
    if (req.method === 'POST' || req.method === 'PUT') {
      const title = String(body.title || '').trim();
      const questionIds = Array.isArray(body.question_ids) ? body.question_ids.map((item: unknown) => String(item)) : [];
      if (!title || !body.category || !questionIds.length) return res.status(400).json({ error: 'Judul, kategori, dan soal kuis wajib diisi.' });
      const normalized = normalizeQuizRubric(questionIds, body.max_score, body.rubric);
      const payload = {
        title,
        category: body.category,
        difficulty: body.difficulty || 'Sedang',
        status: body.status || 'published',
        description: body.description || '',
        question_ids: questionIds,
        max_score: normalized.maxScore,
        rubric: normalized.rubric,
        owner_id: profile.id
      };
      const result = req.method === 'PUT'
        ? await supabaseRequest('quizzes', { method: 'PATCH', query: { id: `eq.${id}`, owner_id: `eq.${profile.id}` }, body: payload })
        : await supabaseRequest('quizzes', { method: 'POST', body: payload });
      const quiz = result.data[0];
      if (!quiz) return res.status(result.status || 400).json({ error: result.error || 'Gagal menyimpan kuis.' });
      if (req.method === 'PUT') {
        await supabaseRequest('quiz_questions', { method: 'DELETE', query: { quiz_id: `eq.${quiz.id}` } });
      }
      await Promise.all(questionIds.map((questionId, position) =>
        supabaseRequest('quiz_questions', {
          method: 'POST',
          body: {
            quiz_id: quiz.id,
            question_id: questionId,
            position: position + 1,
            points: normalized.rubric[questionId] || 0
          }
        })
      ));
      return res.status(req.method === 'POST' ? 201 : 200).json(quiz);
    }
    return res.status(405).json({ error: 'Method tidak diizinkan.' });
  }

  if (req.method === 'GET' && String(req.query?.results || '') === 'true') {
    const profile = teacherFromLocal(req);
    if (!profile) return res.status(401).json({ error: 'Sesi guru diperlukan.' });
    const quizId = String(req.query?.id || '');
    const quiz = db.getQuizById(quizId);
    if (!quiz || quiz.owner_id !== profile.id) return res.status(404).json({ error: 'Kuis tidak ditemukan atau bukan milik Anda.' });
    const attempts = db.getQuizAttempts(quizId, profile.id);
    const scores = attempts.map(attempt => Number(attempt.score) || 0);
    const statistics = {
      count: attempts.length,
      highest: scores.length ? Math.max(...scores) : 0,
      lowest: scores.length ? Math.min(...scores) : 0,
      average: scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100 : 0
    };
    return res.status(200).json({ quiz, attempts, statistics });
  }
  if (req.method === 'GET') {
    const id = String(req.query?.id || '');
    if (!id) return res.status(200).json(db.getQuizzes(true));
    const quiz = db.getQuizById(id);
    if (!quiz || quiz.status !== 'published') return res.status(404).json({ error: 'Kuis tidak ditemukan.' });
    const questions = quiz.question_ids.map((id: string) => {
      const question = db.getQuestionById(id);
      if (!question) return null;
      const { correct_answer, ...publicQuestion } = question as any;
      return publicQuestion;
    }).filter(Boolean);
    return res.status(200).json({ ...quiz, questions });
  }
  if (req.method === 'POST' && String(req.query?.grade || '') === 'true') {
    const quiz = db.getQuizById(String(req.query?.id || body.quizId || ''));
    if (!quiz || quiz.status !== 'published') return res.status(404).json({ error: 'Kuis tidak ditemukan atau belum diterbitkan.' });
    const identity = validateStudentIdentity(body.studentName, body.studentNis);
    if (!identity.valid) return res.status(400).json({ error: identity.error });
    const questions = quiz.question_ids.map((id: string) => db.getQuestionById(id)).filter(Boolean) as any[];
    const grading = gradeQuestions(quiz, questions, body.answers || {});
    const idempotencyKey = String(body.idempotencyKey || '').trim() || crypto.randomUUID();
    const existing = db.getQuizAttemptByIdempotency(quiz.id, idempotencyKey);
    if (existing) return res.status(200).json(existing);
    const attempt: QuizAttemptItem = {
      id: `attempt-${crypto.randomUUID()}`,
      quiz_id: quiz.id,
      quiz_owner_id: quiz.owner_id,
      student_name: identity.name,
      student_nis: identity.nis,
      answers: body.answers || {},
      correct_count: grading.correct_count,
      wrong_count: grading.wrong_count,
      total_questions: grading.total,
      score: grading.score,
      max_score: grading.max_score,
      rubric_snapshot: grading.rubric,
      idempotency_key: idempotencyKey,
      results: grading.results,
      started_at: body.startedAt ? String(body.startedAt) : undefined,
      finished_at: new Date().toISOString()
    };
    return res.status(200).json(db.saveQuizAttempt(attempt));
  }
  const profile = teacherFromLocal(req);
  if (!profile) return res.status(401).json({ error: 'Sesi guru diperlukan.' });
  const id = String(req.query?.id || body.id || '');
  if (req.method === 'DELETE') {
    const quiz = db.getQuizById(id);
    if (!quiz || quiz.owner_id !== profile.id) return res.status(404).json({ error: 'Kuis tidak ditemukan atau bukan milik Anda.' });
    return db.deleteQuiz(id) ? res.status(200).json({ success: true }) : res.status(404).json({ error: 'Kuis tidak ditemukan.' });
  }
  if (req.method === 'POST' || req.method === 'PUT') {
    const questionIds = Array.isArray(body.question_ids) ? body.question_ids.map((item: unknown) => String(item)) : [];
    if (!body.title?.trim() || !body.category || !questionIds.length) return res.status(400).json({ error: 'Judul, kategori, dan soal kuis wajib diisi.' });
    const normalized = normalizeQuizRubric(questionIds, body.max_score, body.rubric);
    if (req.method === 'PUT') {
      const existing = db.getQuizById(id);
      if (!existing || existing.owner_id !== profile.id) return res.status(404).json({ error: 'Kuis tidak ditemukan atau bukan milik Anda.' });
      const updated: QuizItem = { ...existing, ...body, title: body.title.trim(), question_ids: questionIds, max_score: normalized.maxScore, rubric: normalized.rubric, updated_at: new Date().toISOString() };
      return res.status(200).json(db.upsertQuiz(updated));
    }
    const now = new Date().toISOString();
    const quiz: QuizItem = {
      id: `quiz-${Date.now()}`,
      owner_id: profile.id,
      title: String(body.title).trim(),
      description: body.description || '',
      category: body.category,
      difficulty: body.difficulty || 'Sedang',
      status: body.status || 'published',
      question_ids: questionIds,
      max_score: normalized.maxScore,
      rubric: normalized.rubric,
      created_at: now,
      updated_at: now
    };
    return res.status(201).json(db.upsertQuiz(quiz));
  }
  return res.status(405).json({ error: 'Method tidak diizinkan.' });
}
