import { db, hashPassword, verifyPassword } from '../server/db.js';
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
  const newPassword = String(body.newPassword || '');
  if (!newPassword) return res.status(400).json({ error: 'Kata sandi baru wajib diisi.' });
  const passwordValid =
    newPassword.length >= 8 &&
    /[A-Z]/.test(newPassword) &&
    /[a-z]/.test(newPassword) &&
    /[0-9]/.test(newPassword) &&
    /[^A-Za-z0-9]/.test(newPassword);
  if (!passwordValid) {
    return res.status(400).json({ error: 'Kata sandi harus 8 karakter dan memiliki huruf besar, huruf kecil, angka, serta simbol.' });
  }
  const config = getSupabaseConfig();
  if (!identifier) {
    return res.status(400).json({ error: 'Masukkan email atau NIP/ID guru yang terdaftar.' });
  }
  const isEmail = identifier.includes('@');
  if (!config) {
    const profile = isEmail ? db.getProfileByEmail(identifier) : db.getProfileByNip(identifier);
    if (!profile) return res.status(404).json({ error: 'Akun guru tidak ditemukan.' });
    if (verifyPassword(newPassword, profile.password_hash, profile.password_salt)) {
      return res.status(400).json({ code: 'SAME_PASSWORD', error: 'Kata sandi baru tidak boleh sama dengan kata sandi lama.' });
    }
    const hashed = hashPassword(newPassword);
    const updated = db.updateProfile(profile.id, {
      password_hash: hashed.hash,
      password_salt: hashed.salt
    });
    if (!updated) return res.status(500).json({ error: 'Gagal memperbarui kata sandi.' });
    return res.status(200).json({ success: true, message: 'Kata sandi berhasil diperbarui.' });
  }
  const result = await supabaseRequest('profiles', {
    query: isEmail
      ? { email: `eq.${identifier}`, select: '*' }
      : { teacher_identifier: `eq.${identifier}`, select: '*' }
  });
  if (!result.data.length) {
    return res.status(404).json({ error: 'Akun guru tidak ditemukan.' });
  }
  const profile = result.data[0];
  if (verifyPassword(newPassword, profile.password_hash, profile.password_salt)) {
    return res.status(400).json({ code: 'SAME_PASSWORD', error: 'Kata sandi baru tidak boleh sama dengan kata sandi lama.' });
  }
  const hashed = hashPassword(newPassword);
  const update = await supabaseRequest('profiles', {
    method: 'PATCH',
    query: { id: `eq.${profile.id}` },
    body: { password_hash: hashed.hash, password_salt: hashed.salt }
  });
  if (update.error) return res.status(500).json({ error: 'Gagal memperbarui kata sandi.' });
  return res.status(200).json({
    success: true,
    message: 'Kata sandi berhasil diperbarui.'
  });
}
