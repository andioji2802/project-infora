import { db } from '../server/db.js';
import { parseRequestBody } from '../server/http.js';
import { getSupabaseConfig, supabaseRequest } from '../server/supabase.js';

function normalizeQuery(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

type ChatIntent = 'material' | 'question' | 'quiz' | 'question_quiz';

export function classifyChatIntent(text: string): ChatIntent {
  const lower = text.toLowerCase();
  if (/\b(soal|latihan)\b/.test(lower) && /\bkuis\b/.test(lower)) return 'question_quiz';
  if (/^\s*(beri|berikan|kasih|bikin|buat)?\s*(dong\s*)?(contoh|contohin)?\s*(soal|latihan)\b/.test(lower)) return 'material';
  if (/^(mulai|mau|ikut|kerjakan|uji aku dengan)\b.*\bkuis\b/.test(lower) ||
      /\b(paket kuis|latihan kuis|nilai kuis)\b/.test(lower)) return 'quiz';
  if (/\b(bank soal|soal nomor|nomor \d|jawaban benar|jawab soal|kunci jawaban|pembahasan soal)\b/.test(lower)) return 'question';
  return 'material';
}

function rankPublicContent(query: string, rows: any[], fields: string[]): any[] {
  const stop = new Set(['apa', 'yang', 'untuk', 'dengan', 'tentang', 'bagaimana', 'cara', 'jelaskan', 'materi', 'soal', 'kuis', 'latihan', 'paket']);
  const words = normalizeQuery(query)
    .replace(/[^a-z0-9\s+-]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stop.has(word));
  return rows.map(row => {
    const text = fields.map(field => String(row[field] || '')).join(' ').toLowerCase();
    let score = 0;
    for (const word of words) if (text.includes(word)) score += text.includes(word) ? 2 : 0;
    return { row, score };
  }).filter(item => item.score > 0).sort((a, b) => b.score - a.score).map(item => item.row);
}

const CHAT_STOP_WORDS = new Set([
  'apa', 'itu', 'ini', 'yang', 'untuk', 'dengan', 'tentang', 'bagaimana',
  'cara', 'jelaskan', 'materi', 'konsep', 'dasar', 'gimana', 'nih', 'dong',
  'sih', 'ya', 'bro', 'maksud', 'tolong', 'beri', 'berikan', 'kasih'
]);

export function getChatTokens(text: string): string[] {
  return [...new Set(normalizeQuery(text)
    .replace(/[^a-z0-9+\-\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !CHAT_STOP_WORDS.has(word)))];
}

function getMaterialSearchText(material: any): string {
  return [
    material.title, material.category, material.summary, material.keywords,
    material.aliases, material.learning_objectives, material.content,
    material.examples, material.practice_steps, material.faq
  ].filter(Boolean).join(' ').toLowerCase();
}

export function rankMaterialsForChat(message: string, materials: any[]): Array<{ material: any; score: number }> {
  const tokens = getChatTokens(message);
  return materials.map(material => {
    const text = getMaterialSearchText(material);
    let score = 0;
    for (const token of tokens) {
      if (String(material.title || '').toLowerCase().includes(token)) score += 8;
      if (String(material.keywords || '').toLowerCase().includes(token)) score += 6;
      if (String(material.aliases || '').toLowerCase().includes(token)) score += 5;
      if (String(material.summary || '').toLowerCase().includes(token)) score += 3;
      if (String(material.content || '').toLowerCase().includes(token)) score += 1;
    }
    return { material, score };
  }).filter(item => item.score > 0).sort((a, b) => b.score - a.score);
}

export function resolveChatQuery(message: string, history: Array<{ role: string; content: string }> = [], materials: any[] = []): string {
  const latest = message.trim();
  const recentUsers = history.filter(item => item.role === 'user').map(item => item.content.trim()).filter(Boolean).slice(-2);
  const explicitMaterial = materials.find(material => {
    const tokens = getChatTokens(latest);
    const metadata = `${material.title || ''} ${material.category || ''} ${material.keywords || ''} ${material.aliases || ''}`.toLowerCase();
    return tokens.length > 0 && tokens.some(token => token.length >= 4 && metadata.includes(token));
  });
  if (explicitMaterial) return latest;

  const isReference = /^(lanjut|lanjutkan|terusin|jelaskan lagi)\b/i.test(latest) ||
    /\b(itu|tersebut|lanjutannya|rumusnya|fungsinya|contohnya)\b/i.test(latest);
  if (!isReference || recentUsers.length === 0) return latest;
  return `${recentUsers[recentUsers.length - 1]} ${latest}`;
}

function extractRelevantSections(material: any, message: string, limit = 1800): string {
  const source = [
    material.content || '',
    material.examples || '',
    material.practice_steps || '',
    material.faq || ''
  ].filter(Boolean).join('\n\n');
  const headingPattern = /(?=^#{1,4}\s+)/m;
  const sections = source
    .split(headingPattern)
    .map((block: string) => block.replace(/^\s+|\s+$/g, ''))
    .filter(Boolean);
  const blocks = sections.flatMap(section =>
    section.split(/\n\s*\n/)
      .map((block: string) => block.replace(/^\s+|\s+$/g, ''))
      .filter(Boolean)
  );
  const stopWords = new Set(['apa','yang','untuk','dengan','tentang','bagaimana','cara','jelaskan','perbedaan','dan','atau','materi','konsep','dasar','contoh','kode','itu','ini','dalam','serta','kenapa','mengapa','nih','dong','sih','gimana']);
  const normalized = message.toLowerCase();
  const tokens = [...new Set(normalized.replace(/[^a-z0-9\s+-]/g, ' ').split(/\s+/).filter(word => word.length > 2 && !stopWords.has(word)))];
  const ranked = blocks.map(block => {
    const lower = block.toLowerCase();
    let score = 0;
    if (tokens.length > 0 && lower.includes(tokens.join(' '))) score += 20;
    tokens.forEach(token => {
      if (lower.includes(token)) score += 3;
      if (/^#{1,4}\s/.test(block) && lower.includes(token)) score += 8;
    });
    return { block, score };
  }).filter(item => item.score > 0).sort((a, b) => b.score - a.score);

  let output = '';
  for (const item of ranked) {
    if (output.length + item.block.length > limit) {
      const remaining = limit - output.length;
      if (remaining > 300) output += `${output ? '\n\n' : ''}${item.block.slice(0, remaining).trim()}`;
      break;
    }
    output += `${output ? '\n\n' : ''}${item.block}`;
  }
  return output.slice(0, limit).trim();
}

function buildSpecificFallback(message: string, material: any): string {
  const relevant = extractRelevantSections(material, message, 600);
  if (!relevant) return `Materi **${material.title}** dari guru belum memuat penjelasan yang cukup untuk pertanyaan tersebut secara spesifik.`;
  return `Berdasarkan materi guru:\n\n${relevant}`;
}

function buildDefinitionAnswer(message: string, material: any): string | null {
  const normalized = message.toLowerCase();
  const source = [
    material.summary || '',
    material.content || '',
    material.faq || ''
  ].filter(Boolean).join('\n\n');
  const definitionMatch = normalized.match(/\bapa itu\s+([a-z][a-z0-9 +_-]{2,40})\??$/i);
  if (definitionMatch) {
    const concept = definitionMatch[1]
      .replace(/\s+(bro|sih|dong|nih|ya|tolong)$/i, '')
      .trim();
    const paragraph = source.split(/\n\s*\n/)
      .map((item: string) => item.replace(/\s+/g, ' ').trim())
      .find((item: string) => {
        const lower = item.toLowerCase();
        return lower.includes(concept) && (
          lower.includes(`${concept} adalah`) ||
          lower.includes(`${concept} merupakan`) ||
          lower.startsWith(concept)
        );
      });
    if (paragraph) return `Berdasarkan materi guru:\n\n${paragraph}`;
  }

  return null;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', req.headers?.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method tidak diizinkan.' });
  try {
    const body = parseRequestBody(req);
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (!message) return res.status(400).json({ error: 'Pesan pertanyaan tidak boleh kosong.' });

    let materials: any[] = db.getMaterials('published');
    if (getSupabaseConfig()) {
      const result = await supabaseRequest('materials', { query: { status: 'eq.published', select: '*' } });
      if (result.data.length) materials = result.data.map((row: any) => ({ ...row, content: row.content || '' }));
    }
    const intent = classifyChatIntent(message);

    if (intent === 'question_quiz') {
      let questions: any[] = db.getQuestions(true);
      let quizzes: any[] = db.getQuizzes(true);
      if (getSupabaseConfig()) {
        const questionResult = await supabaseRequest('questions', { query: { status: 'eq.published', select: '*', order: 'updated_at.desc' } });
        const quizResult = await supabaseRequest('quizzes', { query: { status: 'eq.published', select: '*', order: 'updated_at.desc' } });
        if (questionResult.data.length) questions = questionResult.data;
        if (quizResult.data.length) quizzes = quizResult.data;
      }
      const questionMatches = rankPublicContent(message.replace(/\bkuis\b/gi, ''), questions, ['question_text', 'category', 'competency', 'explanation']);
      const quizMatches = rankPublicContent(message.replace(/\bsoal\b/gi, ''), quizzes, ['title', 'description', 'category']);
      const parts: string[] = [];
      if (questionMatches.length) {
        const question = questionMatches[0];
        const options = Array.isArray(question.options) ? question.options : [];
        parts.push(`**Contoh soal terbitkan guru:**\n${question.question_text}${options.length ? '\n\n' + options.map((option: string, index: number) => `${String.fromCharCode(65 + index)}. ${option}`).join('\n') : ''}`);
      } else {
        parts.push('Guru belum menerbitkan bank soal untuk topik tersebut.');
      }
      if (quizMatches.length) {
        const quiz = quizMatches[0];
        parts.push(`**Kuis yang tersedia:** ${quiz.title}${quiz.description ? `\n${quiz.description}` : ''}`);
      } else {
        parts.push('Guru belum menerbitkan kuis untuk topik tersebut.');
      }
      return res.status(200).json({
        answer: parts.join('\n\n'),
        isRefusal: false,
        sources: []
      });
    }

    if (intent === 'question') {
      let questions: any[] = db.getQuestions(true);
      if (getSupabaseConfig()) {
        const result = await supabaseRequest('questions', { query: { status: 'eq.published', select: '*', order: 'updated_at.desc' } });
        if (result.data.length) questions = result.data;
      }
      const matches = rankPublicContent(message, questions, ['question_text', 'category', 'competency', 'explanation']);
      if (matches.length === 0) {
        return res.status(200).json({
          answer: 'Guru belum memberikan soal untuk pertanyaan atau kompetensi tersebut.',
          isRefusal: true,
          sources: []
        });
      }
      const question = matches[0];
      const options = Array.isArray(question.options)
        ? question.options
        : (typeof question.options === 'string' ? (() => { try { return JSON.parse(question.options); } catch { return []; } })() : []);
      const answerIndex = typeof question.correct_answer === 'number'
        ? question.correct_answer
        : Number.parseInt(String(question.correct_answer), 10);
      let answerText = '';
      if (Number.isInteger(answerIndex) && options[answerIndex] !== undefined) {
        answerText = `\nJawaban yang tepat: **${String.fromCharCode(65 + answerIndex)}. ${options[answerIndex]}**`;
      } else if (question.correct_answer !== undefined && question.correct_answer !== null && question.correct_answer !== '') {
        answerText = `\nJawaban yang tepat: **${String(question.correct_answer)}**`;
      }
      const explanation = question.explanation ? `\nPembahasan: ${question.explanation}` : '';
      return res.status(200).json({
        answer: `Berdasarkan soal terbitkan guru:\n\n**Soal:** ${question.question_text}${options.length ? '\n\nPilihan:\n' + options.map((option: string, index: number) => `${String.fromCharCode(65 + index)}. ${option}`).join('\n') : ''}${answerText}${explanation}`,
        isRefusal: false,
        sources: [{
          title: question.question_text,
          category: question.category,
          teacher_name: 'Guru Informatika',
          summary: question.competency || question.explanation || ''
        }]
      });
    }

    if (intent === 'quiz') {
      let quizzes: any[] = db.getQuizzes(true);
      let questions: any[] = db.getQuestions(true);
      if (getSupabaseConfig()) {
        const quizResult = await supabaseRequest('quizzes', { query: { status: 'eq.published', select: '*', order: 'updated_at.desc' } });
        const questionResult = await supabaseRequest('questions', { query: { status: 'eq.published', select: '*' } });
        if (quizResult.data.length) quizzes = quizResult.data;
        if (questionResult.data.length) questions = questionResult.data;
      }
      const matches = rankPublicContent(message, quizzes, ['title', 'description', 'category', 'difficulty']);
      if (matches.length === 0) {
        return res.status(200).json({
          answer: 'Guru belum menerbitkan paket kuis untuk topik tersebut.',
          isRefusal: true,
          sources: []
        });
      }
      const quiz = matches[0];
      const linkedIds = Array.isArray(quiz.question_ids)
        ? quiz.question_ids
        : (typeof quiz.question_ids === 'string' ? (() => { try { return JSON.parse(quiz.question_ids || '[]'); } catch { return []; } })() : []);
      let resolvedIds = linkedIds;
      if (!resolvedIds.length && getSupabaseConfig()) {
        const pivot = await supabaseRequest('quiz_questions', { query: { quiz_id: `eq.${quiz.id}`, select: 'question_id,position', order: 'position.asc' } });
        resolvedIds = pivot.data.map((item: any) => item.question_id).filter(Boolean);
      }
      const linkedQuestions = questions.filter((question: any) => resolvedIds.includes(question.id));
      const answer = `Berdasarkan kuis terbitkan guru:\n\n**${quiz.title}**\nKategori: ${quiz.category || '-'}\nJumlah soal: ${linkedQuestions.length || resolvedIds.length || 0}\n\n${quiz.description || 'Gunakan paket kuis ini untuk latihan berdasarkan materi yang telah dipelajari.'}`;
      return res.status(200).json({
        answer,
        isRefusal: false,
        sources: [{
          title: quiz.title,
          category: quiz.category,
          teacher_name: 'Guru Informatika',
          summary: quiz.description || ''
        }]
      });
    }
    const history = Array.isArray(body.history) ? body.history.slice(-6) : [];
    const resolvedMessage = resolveChatQuery(message, history, materials);
    const scored = rankMaterialsForChat(resolvedMessage, materials).slice(0, 3);

    if (scored.length === 0) {
      return res.status(200).json({
        answer: 'Guru belum memberikan materi untuk pertanyaan ini. Silakan pilih materi atau tanyakan pada kategori yang sudah diunggah guru.',
        isRefusal: true,
        sources: []
      });
    }

    const relevantContexts = scored.filter(({ material }: any) => extractRelevantSections(material, resolvedMessage).length > 0);
    if (relevantContexts.length === 0) {
      return res.status(200).json({
        answer: 'Guru belum memberikan materi untuk pertanyaan ini.',
        isRefusal: true,
        sources: []
      });
    }
    const strongestContexts = relevantContexts.slice(0, 1);
    const context = strongestContexts.map(({ material }: any, index: number) => {
      const relevantSection = extractRelevantSections(material, resolvedMessage);
      return `SUMBER ${index + 1}: ${material.title}\nKategori: ${material.category}\nRingkasan: ${material.summary || ''}\nKUTIPAN RELEVAN:\n${relevantSection}`;
    }).join('\n\n');
    const sources = strongestContexts.map(({ material }: any) => ({
      title: material.title,
      category: material.category,
      teacher_name: material.teacher_name || 'Guru Informatika',
      summary: material.summary
    }));

    const primaryMaterial = strongestContexts[0].material;
    const sourceContent = [
      primaryMaterial.summary || '',
      primaryMaterial.content || '',
      primaryMaterial.examples || '',
      primaryMaterial.practice_steps || '',
      primaryMaterial.faq || ''
    ].filter(Boolean).join('\n\n');

    const definitionAnswer = buildDefinitionAnswer(message, primaryMaterial);
    if (definitionAnswer) {
      return res.status(200).json({
        answer: definitionAnswer,
        isRefusal: false,
        sources
      });
    }

    const apiKey = process.env.GEMINI_API_KEY?.trim() || process.env.GEMINI_API_INFORA?.trim();
    if (!apiKey) {
      const fallbackSection = buildSpecificFallback(resolvedMessage, relevantContexts[0].material);
      return res.status(200).json({
        answer: fallbackSection,
        isRefusal: false,
        sources
      });
    }
    const conversationSnippet = history
      .map((item: any) => `${item?.role === 'user' ? 'SISWA' : 'INFORA'}: ${String(item?.content || '')}`)
      .join('\n');
    const configured = process.env.GEMINI_MODEL_NAME?.trim();
    const model = !configured || configured === 'gemini-2.5-flash' ? 'gemini-3.8-flash' : configured;
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5000),
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: 'Kamu adalah tutor Informatika SMK. Jawab HANYA dari kutipan relevan yang diberikan. Jangan menampilkan seluruh materi, ringkasan umum, atau bagian yang tidak ditanyakan. Susun jawaban singkat dan spesifik untuk pertanyaan terakhir. Jangan mencari kaitan yang hanya kabur. Jika pertanyaan tidak dibahas secara spesifik pada kutipan, katakan materi guru belum mencakup pertanyaan tersebut. Jangan memakai pengetahuan internet atau umum. Sertakan contoh kode hanya jika contoh atau bahasa itu benar-benar ada pada sumber.' }]
          },
          contents: [{ role: 'user', parts: [{ text: `${conversationSnippet ? `RIWAYAT PERCAKAPAN:\n${conversationSnippet}\n\n` : ''}PERTANYAAN SISWA TERAKHIR:\n${message}\n\nSUMBER MATERI GURU:\n${context}\n\nJawab hanya pertanyaan terakhir siswa dan gunakan materi sumber di atas.` }] }],
          generationConfig: { temperature: 0.15, maxOutputTokens: 768 }
        })
      }
    );
    const responseText = await response.text();
    let payload: any;
    try {
      payload = JSON.parse(responseText);
    } catch {
      const fallbackSection = buildSpecificFallback(resolvedMessage, relevantContexts[0].material);
      return res.status(200).json({
        answer: fallbackSection,
        isRefusal: false,
        sources
      });
    }
    if (!response.ok) {
      const fallbackSection = buildSpecificFallback(resolvedMessage, relevantContexts[0].material);
      return res.status(200).json({
        answer: fallbackSection,
        isRefusal: false,
        sources
      });
    }
    const answer = payload?.candidates?.[0]?.content?.parts?.map((part: any) => part.text || '').join('').trim();
    return res.status(200).json({
      answer: answer || buildSpecificFallback(resolvedMessage, relevantContexts[0].material),
      isRefusal: false,
      sources
    });
  } catch (error: any) {
    console.error('Chat error:', error);
    const materials = db.getMaterials('published');
    const fallbackBody = parseRequestBody(req);
    const words = String(typeof fallbackBody.message === 'string' ? fallbackBody.message : '').toLowerCase().split(/\s+/).filter(Boolean);
    const match = materials.find(material =>
      words.some(word => word.length > 3 && `${material.title} ${material.summary || ''} ${material.keywords || ''} ${material.content}`.toLowerCase().includes(word))
    );
    if (match) {
      const fallbackSection = buildSpecificFallback(String(fallbackBody.message || ''), match);
      if (!fallbackSection) {
        return res.status(200).json({
          answer: 'Guru belum memberikan materi untuk pertanyaan ini.',
          isRefusal: true,
          sources: []
        });
      }
      return res.status(200).json({
        answer: fallbackSection,
        isRefusal: false,
        sources: [{ title: match.title, category: match.category, teacher_name: match.teacher_name || 'Guru Informatika', summary: match.summary }]
      });
    }
    return res.status(200).json({
      answer: 'Guru belum memberikan materi untuk pertanyaan ini.',
      isRefusal: true,
      sources: []
    });
  }
}
