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
    const stopWords = new Set(['apa','yang','untuk','dengan','tentang','bagaimana','cara','jelaskan','perbedaan','dan','atau','materi','konsep','dasar','contoh','kode','itu','ini']);
    const history = Array.isArray(body.history) ? body.history.slice(-6) : [];
    const lastUserQuestion = [...history].reverse().find((item: any) => item?.role === 'user' && typeof item.content === 'string')?.content;
    const queryTopic = detectTopic(normalizeQuery(message));
    const resolvedMessage = queryTopic || message.split(/\s+/).length >= 4
      ? message
      : `${lastUserQuestion ? `${lastUserQuestion}\n` : ''}${message}`;
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

    const context = scored.map(({ material }, index) =>
      `SUMBER ${index + 1}: ${material.title}\nKategori: ${material.category}\nRingkasan: ${material.summary || ''}\nIsi: ${material.content.slice(0, 3500)}`
    ).join('\n\n');
    const sources = scored.map(({ material }) => ({
      title: material.title,
      category: material.category,
      teacher_name: material.teacher_name || 'Guru Informatika',
      summary: material.summary
    }));

    const apiKey = process.env.GEMINI_API_KEY?.trim() || process.env.GEMINI_API_INFORA?.trim();
    if (!apiKey) {
      return res.status(200).json({
        answer: `${scored[0].material.summary ? scored[0].material.summary + '\n\n' : ''}${scored[0].material.content.slice(0, 1800)}`,
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
            parts: [{ text: 'Kamu adalah tutor Informatika SMK. Jawab HANYA dari sumber materi di bawah. Jika detail tidak ada di sumber, katakan bahwa materi guru belum mencakupnya. Jangan gunakan pengetahuan internet atau umum. Jawab ringkas dalam bahasa Indonesia.' }]
          },
          contents: [{ role: 'user', parts: [{ text: `${conversationSnippet ? `RIWAYAT PERCAKAPAN:\n${conversationSnippet}\n\n` : ''}PERTANYAAN SISWA TERAKHIR:\n${message}\n\nSUMBER MATERI GURU:\n${context}\n\nJawab hanya pertanyaan terakhir siswa dan gunakan materi sumber di atas.` }] }],
          generationConfig: { temperature: 0.25, maxOutputTokens: 2048 }
        })
      }
    );
    const responseText = await response.text();
    let payload: any;
    try {
      payload = JSON.parse(responseText);
    } catch {
      return res.status(200).json({
        answer: `${scored[0].material.summary ? scored[0].material.summary + '\n\n' : ''}${scored[0].material.content.slice(0, 1800)}`,
        isRefusal: false,
        sources
      });
    }
    if (!response.ok) {
      return res.status(200).json({
        answer: `${scored[0].material.summary ? scored[0].material.summary + '\n\n' : ''}${scored[0].material.content.slice(0, 1800)}`,
        isRefusal: false,
        sources
      });
    }
    const answer = payload?.candidates?.[0]?.content?.parts?.map((part: any) => part.text || '').join('').trim();
    return res.status(200).json({ answer: answer || 'Maaf, jawaban belum dapat dibuat.', isRefusal: false, sources });
  } catch (error: any) {
    console.error('Chat error:', error);
    const materials = db.getMaterials('published');
    const fallbackBody = parseRequestBody(req);
    const words = String(typeof fallbackBody.message === 'string' ? fallbackBody.message : '').toLowerCase().split(/\s+/).filter(Boolean);
    const match = materials.find(material =>
      words.some(word => word.length > 3 && `${material.title} ${material.summary || ''} ${material.keywords || ''} ${material.content}`.toLowerCase().includes(word))
    );
    if (match) {
      return res.status(200).json({
        answer: `${match.summary ? match.summary + '\n\n' : ''}${match.content.slice(0, 1800)}`,
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
