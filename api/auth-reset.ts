import { hashPassword } from '../server/db.js';
import { parseRequestBody } from '../server/http.js';
import { getSupabaseConfig, supabaseRequest } from '../server/supabase.js';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', req.headers?.origin || '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method tidak diizinkan.' });
  const body = parseRequestBody(req);
  const identifier = String(body.email || body.nip || '').trim().toLowerCase();
  const config = getSupabaseConfig();
  if (!config || !identifier) {
    return res.status(400).json({ error: 'Masukkan email atau NIP/ID guru yang terdaftar.' });
  }
  const isEmail = identifier.includes('@');
  const result = await supabaseRequest('profiles', {
    query: isEmail
      ? { email: `eq.${identifier}`, select: '*' }
      : { teacher_identifier: `eq.${identifier}`, select: '*' }
  });
  if (!result.data.length) {
    return res.status(404).json({ error: 'Akun guru tidak ditemukan.' });
  }
  const profile = result.data[0];
  const temporaryPassword = `Guru${cryptoRandom()}!`;
  const hashed = hashPassword(temporaryPassword);
  const update = await supabaseRequest('profiles', {
    method: 'PATCH',
    query: { id: `eq.${profile.id}` },
    body: { password_hash: hashed.hash, password_salt: hashed.salt }
  });
  if (update.error) return res.status(500).json({ error: 'Gagal memperbarui kata sandi.' });
  return res.status(200).json({
    success: true,
    temporaryPassword,
    message: 'Kata sandi sementara berhasil dibuat. Segera ubah setelah masuk.'
  });
}

function cryptoRandom(): string {
  const bytes = new Uint32Array(2);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    bytes[0] = Math.floor(Math.random() * 0xffffffff);
    bytes[1] = Math.floor(Math.random() * 0xffffffff);
  }
  return bytes[0].toString(36).slice(-4).padStart(4, '0') + bytes[1].toString(36).slice(-4).padStart(4, '0');
}
