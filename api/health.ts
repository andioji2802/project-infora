export default function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', req.headers?.origin || '*');
  if (req.method === 'OPTIONS') return res.status(204).end();
  const configured = process.env.GEMINI_MODEL_NAME?.trim();
  const model = !configured || configured === 'gemini-2.5-flash' ? 'gemini-3.8-flash' : configured;
  res.status(200).json({
    status: 'ok',
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY?.trim() || process.env.GEMINI_API_INFORA?.trim()),
    hasSupabase: Boolean(process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
    model
  });
}
