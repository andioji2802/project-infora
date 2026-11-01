export function parseRequestBody(req: any): Record<string, any> {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  const candidates = [
    typeof req.body === 'string' ? req.body : undefined,
    Buffer.isBuffer(req.body) ? req.body.toString('utf8') : undefined,
    typeof req.rawBody === 'string' ? req.rawBody : undefined,
    Buffer.isBuffer(req.rawBody) ? req.rawBody.toString('utf8') : undefined,
    typeof req.query?.body === 'string' ? req.query.body : undefined
  ];
  const raw = candidates.find(value => value && value.trim());
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
