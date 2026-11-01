import { db } from '../server/db.js';
import { parseRequestBody } from '../server/http.js';
import { getSupabaseConfig, supabaseRequest } from '../server/supabase.js';

const TOPIC_RULES: Record<string, string[]> = {
  algorithm: ['algoritma', 'perulangan', 'looping', 'iteration', 'berpikir komputasional', 'pseudocode', 'flowchart', 'percabangan', 'variabel', 'dekomposisi', 'abstraksi'],
  network: ['subnetting', 'cidr', 'ip address', 'ipv4', 'jaringan', 'router', 'switch', 'vlan', 'network address', 'broadcast'],
  web: ['html', 'css', 'javascript', 'dom', 'flexbox', 'website', 'web'],
  database: ['basis data', 'database', 'sql', 'mysql', 'postgresql', 'normalisasi', 'primary key', 'foreign key', 'query'],
  security: ['keamanan digital', 'cyber security', 'phishing', 'malware', 'enkripsi', 'privasi'],
  operating_system: ['sistem operasi', 'linux', 'windows', 'kernel', 'virtualisasi']
};

function detectTopic(text: string): string | null {
  const lower = text.toLowerCase();
  let best: { topic: string; hits: number } | null = null;
  for (const [topic, signals] of Object.entries(TOPIC_RULES)) {
    const hits = signals.filter(signal => lower.includes(signal)).length;
    if (!best || hits > best.hits) best = { topic, hits };
  }
  return best && best.hits > 0 ? best.topic : null;
}

function normalizeQuery(text: string): string {
  let normalized = text.toLowerCase();
  const aliases: Record<string, string> = {
    looping: 'perulangan',
    loop: 'perulangan',
    iteration: 'perulangan',
    kode: '',
    contoh: ''
  };
  for (const [alias, replacement] of Object.entries(aliases)) {
    normalized = normalized.replace(new RegExp(`\\b${alias}\\b`, 'g'), replacement);
  }
  return normalized.replace(/\s+/g, ' ').trim();
}

type ChatIntent = 'material' | 'question' | 'quiz';

function classifyChatIntent(text: string): ChatIntent {
  const lower = text.toLowerCase();
  if (/\b(kuis|latihan kuis|mulai kuis|paket kuis|nilai kuis)\b/.test(lower)) return 'quiz';
  if (/\b(soal|pilihan ganda|pilgan|jawaban benar|jawab soal|bank soal|kunci jawaban|pembahasan soal|nomor)\b/.test(lower)) return 'question';
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

const LANGUAGE_RULES: Array<{ name: string; signals: string[] }> = [
  { name: 'javascript', signals: ['javascript', 'js', 'node.js', 'nodejs'] },
  { name: 'python', signals: ['python', 'py'] },
  { name: 'java', signals: ['java'] },
  { name: 'c++', signals: ['c++'] },
  { name: 'php', signals: ['php'] }
];

function detectLanguages(text: string): string[] {
  const lower = text.toLowerCase();
  return LANGUAGE_RULES
    .filter(rule => rule.signals.some(signal => {
      if (signal === 'js') return new RegExp('(^|[^a-z])js([^a-z]|$)', 'i').test(lower);
      return lower.includes(signal);
    }))
    .map(rule => rule.name);
}

function extractRelevantSections(material: any, message: string, limit = 1800): string {
  const source = `${material.summary || ''}\n\n${material.content || ''}`;
  const blocks = source
    .split(/(?:\r?\n){2,}/)
    .flatMap((block: string) => block.split(/(?=^#{1,4}\s+)/m))
    .map((block: string) => block.replace(/^\s+|\s+$/g, ''))
    .filter(Boolean);
  const stopWords = new Set(['apa','yang','untuk','dengan','tentang','bagaimana','cara','jelaskan','perbedaan','dan','atau','materi','konsep','dasar','contoh','kode','itu','ini','dalam','serta']);
  const tokens = new Set(message.toLowerCase().replace(/[^a-z0-9\s+-]/g, ' ').split(/\s+/).filter(word => word.length > 2 && !stopWords.has(word)));
  const ranked = blocks.map(block => {
    const lower = block.toLowerCase();
    let score = 0;
    if (tokens.size > 0 && lower.includes([...tokens].join(' '))) score += 20;
    tokens.forEach(token => { if (lower.includes(token)) score += 1; });
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
  const normalized = message.toLowerCase();
  const content = `${material.summary || ''}\n${material.content || ''}`;
  const lowerContent = content.toLowerCase();

  if (/contoh.*(kodenya|for|while)|^(bagaimana|berikan).*kode/.test(normalized)) {
    if (lowerContent.includes('perulangan for') && lowerContent.includes('perulangan while')) {
      return 'Berdasarkan materi guru:\n\n**Contoh `for`:**\n```python\nfor i in range(1, 6):\n    print(i)\n```\n\n**Contoh `while`:**\n```python\ni = 1\nwhile i <= 3:\n    print("Halo!")\n    i += 1\n```';
    }
  }

  if (/(beda|perbedaan|pembeda).*(for|while)|(for|while).*(beda|perbedaan)/.test(normalized)) {
    if (lowerContent.includes('perulangan for') && lowerContent.includes('perulangan while')) {
      return 'Berdasarkan materi guru:\n\n- **`for`** digunakan ketika jumlah pengulangan atau urutan data sudah diketahui.\n- **`while`** digunakan selama suatu kondisi masih bernilai benar atau `True`.\n\nContoh `for`:\n```python\nfor i in range(1, 6):\n    print(i)\n```\n\nContoh `while`:\n```python\ni = 1\nwhile i <= 3:\n    print("Halo!")\n    i += 1\n```';
    }
  }

  if (/contoh.*(for|while)|^(bagaimana|berikan).*kode/.test(normalized)) {
    if (lowerContent.includes('perulangan for') && lowerContent.includes('perulangan while')) {
      return 'Berdasarkan materi guru:\n\n**Contoh `for`:**\n```python\nfor i in range(1, 6):\n    print(i)\n```\n\n**Contoh `while`:**\n```python\ni = 1\nwhile i <= 3:\n    print(\"Halo!\")\n    i += 1\n```';
    }
  }

  if (/continue/.test(normalized) && lowerContent.includes('continue')) {
    if (/break/.test(normalized) && lowerContent.includes('break')) {
      return 'Berdasarkan materi guru:\n\n- **`break`** menghentikan perulangan secara langsung meskipun kondisi masih bisa berlanjut.\n- **`continue`** melewati satu putaran perulangan dan melanjutkan ke putaran berikutnya.';
    }
    return 'Berdasarkan materi guru, `continue` digunakan untuk **melewati satu putaran perulangan** dan melanjutkan ke putaran berikutnya tanpa mengakhiri seluruh perulangan.';
  }

  if (/break/.test(normalized) && lowerContent.includes('break')) {
    return 'Berdasarkan materi guru, `break` digunakan untuk **menghentikan perulangan secara langsung**, meskipun kondisi perulangan sebenarnya masih dapat berlanjut.';
  }

  const relevant = extractRelevantSections(material, message, 600);
  return relevant || 'Guru belum memberikan materi untuk pertanyaan ini.';
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
      const linkedQuestions = questions.filter((question: any) => linkedIds.includes(question.id));
      const answer = `Berdasarkan kuis terbitkan guru:\n\n**${quiz.title}**\nKategori: ${quiz.category || '-'}\nJumlah soal: ${linkedQuestions.length || linkedIds.length || 0}\n\n${quiz.description || 'Gunakan paket kuis ini untuk latihan berdasarkan materi yang telah dipelajari.'}`;
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
    const algorithmMaterial = materials.find((material: any) =>
      /algoritma|perulangan|looping|pemrograman python/i.test(
        `${material.title || ''} ${material.summary || ''} ${material.category || ''}`
      )
    );
    const normalizedQuestion = normalizeQuery(message);
    if (/\bbreak\b/.test(normalizedQuestion) && /\bcontinue\b/.test(normalizedQuestion) && algorithmMaterial) {
      const sourceText = `${algorithmMaterial.summary || ''}\n${algorithmMaterial.content || ''}`.toLowerCase();
      if (sourceText.includes('break') && sourceText.includes('continue')) {
        return res.status(200).json({
          answer: 'Berdasarkan materi guru:\n\n- **`break`** menghentikan perulangan secara langsung meskipun kondisi masih bisa berlanjut.\n- **`continue`** melewati satu putaran perulangan dan melanjutkan ke putaran berikutnya.',
          isRefusal: false,
          sources: [{
            title: algorithmMaterial.title,
            category: algorithmMaterial.category,
            teacher_name: algorithmMaterial.teacher_name || 'Guru Informatika',
            summary: algorithmMaterial.summary
          }]
        });
      }
    }
    const stopWords = new Set(['apa','yang','untuk','dengan','tentang','bagaimana','cara','jelaskan','perbedaan','dan','atau','materi','konsep','dasar','contoh','kode','itu','ini']);
    const history = Array.isArray(body.history) ? body.history.slice(-6) : [];
    const lastUserQuestion = [...history].reverse().find((item: any) => item?.role === 'user' && typeof item.content === 'string')?.content;
    const isFollowUp = /\b(itu|tersebut|lanjut|lanjutkan|contohnya|jelaskan lagi|berapa|rumusnya)\b/i.test(message)
      || /^bagaimana contoh/i.test(message);
    const resolvedMessage = isFollowUp && lastUserQuestion
      ? `${lastUserQuestion}\n${message}`
      : message || '';
    const normalizedMessage = normalizeQuery(resolvedMessage);
    const words: string[] = normalizedMessage.replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter((w: string) => w.length > 2 && !stopWords.has(w));
    const resolvedTopic = detectTopic(normalizedMessage);
    const scored = materials.map(material => {
      const title = String(material.title || '').toLowerCase();
      const summary = String(material.summary || '').toLowerCase();
      const keywords = String(material.keywords || '').toLowerCase();
      const content = String(material.content || '').toLowerCase();
      const materialTopic = detectTopic(`${title} ${summary} ${keywords} ${content}`);
      if (resolvedTopic && materialTopic && resolvedTopic !== materialTopic) return { material, score: 0 };

      let score = 0;
      for (const word of words) {
        if (title.includes(word)) score += 6;
        if (summary.includes(word)) score += 4;
        if (keywords.includes(word)) score += 5;
        if (content.includes(word)) score += 1;
      }
      if (resolvedTopic && materialTopic === resolvedTopic) score += 12;
      if (normalizedMessage.length >= 4) {
        const phraseFound = normalizedMessage.split(/\s+/).filter(word => word.length > 5).find(word =>
          `${title} ${summary} ${keywords} ${content}`.includes(word)
        );
        if (phraseFound) score += 3;
      }
      return { material, score };
    }).filter(item => item.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);

    if (scored.length === 0) {
      return res.status(200).json({
        answer: 'Guru belum memberikan materi untuk pertanyaan ini. Silakan pilih materi atau tanyakan pada kategori yang sudah diunggah guru.',
        isRefusal: true,
        sources: []
      });
    }

    const queryLanguages = detectLanguages(normalizedMessage);
    const languageMismatch = scored.find(({ material }: any) => {
      const sourceText = `${material.title || ''} ${material.summary || ''} ${material.content || ''}`;
      const sourceLanguages = detectLanguages(sourceText);
      return queryLanguages.length > 0 &&
        sourceLanguages.length > 0 &&
        !queryLanguages.some(language => sourceLanguages.includes(language));
    });
    if (queryLanguages.length > 0 && languageMismatch) {
      return res.status(200).json({
        answer: 'Guru belum memberikan materi yang membahas bahasa atau teknologi tersebut secara spesifik. Silakan gunakan pertanyaan yang sesuai dengan materi yang sudah diunggah guru.',
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
    const context = relevantContexts.map(({ material }: any, index: number) => {
      const relevantSection = extractRelevantSections(material, resolvedMessage);
      return `SUMBER ${index + 1}: ${material.title}\nKategori: ${material.category}\nRingkasan: ${material.summary || ''}\nKUTIPAN RELEVAN:\n${relevantSection}`;
    }).join('\n\n');
    const sources = relevantContexts.map(({ material }: any) => ({
      title: material.title,
      category: material.category,
      teacher_name: material.teacher_name || 'Guru Informatika',
      summary: material.summary
    }));

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
