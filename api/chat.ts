import { GoogleGenAI } from '@google/genai';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', req.headers?.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method tidak diizinkan.' });
  try {
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    if (!message) return res.status(400).json({ error: 'Pesan pertanyaan tidak boleh kosong.' });
    const apiKey = process.env.GEMINI_API_KEY?.trim() || process.env.GEMINI_API_INFORA?.trim();
    if (!apiKey) return res.status(500).json({ error: 'API Key Gemini belum dikonfigurasi.' });
    const configured = process.env.GEMINI_MODEL_NAME?.trim();
    const model = !configured || configured === 'gemini-2.5-flash' ? 'gemini-3.8-flash' : configured;
    const ai = new GoogleGenAI({ apiKey });
    const result = await ai.models.generateContent({
      model,
      contents: message,
      config: {
        systemInstruction: 'Jawab sebagai tutor Informatika untuk siswa SMK dalam bahasa Indonesia yang jelas dan edukatif.',
        temperature: 0.25,
        maxOutputTokens: 2048
      }
    });
    return res.status(200).json({ answer: result.text || 'Maaf, jawaban belum dapat dibuat.', isRefusal: false, sources: [] });
  } catch (error: any) {
    console.error('Chat error:', error);
    return res.status(500).json({ error: error?.message || 'Gagal memproses pertanyaan.' });
  }
}
