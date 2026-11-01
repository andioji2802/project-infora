export const runtime = 'nodejs';

export default function handler(req: any, res: any) {
  res.status(200).json({
    status: 'ok',
    hasGeminiKey: Boolean(
      process.env.GEMINI_API_KEY?.trim() ||
      process.env.GEMINI_API_INFORA?.trim()
    ),
    model: process.env.GEMINI_MODEL_NAME?.trim() || 'gemini-3.8-flash'
  });
}
