import { db } from '../server/db.js';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', req.headers?.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method tidak diizinkan.' });
  try {
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    if (!message) return res.status(400).json({ error: 'Pesan pertanyaan tidak boleh kosong.' });

    const materials = db.getMaterials('published');
    const stopWords = new Set(['apa','yang','untuk','dengan','tentang','bagaimana','cara','jelaskan','perbedaan','dan','atau','materi','konsep','dasar']);
    const words: string[] = message.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter((w: string) => w.length > 2 && !stopWords.has(w));
    const scored = materials.map(material => {
      const haystack = `${material.title} ${material.summary || ''} ${material.keywords || ''} ${material.content}`.toLowerCase();
      const score = words.reduce((total: number, word: string) => total + (haystack.includes(word) ? 1 : 0), 0);
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
          contents: [{ role: 'user', parts: [{ text: `PERTANYAAN SISWA:\n${message}\n\nSUMBER MATERI GURU:\n${context}` }] }],
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
    const words = String(typeof req.body?.message === 'string' ? req.body.message : '').toLowerCase().split(/\s+/).filter(Boolean);
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
