import { db, hashPassword } from '../server/db.js';
import { parseRequestBody } from '../server/http.js';
import { getSupabaseConfig, supabaseRequest } from '../server/supabase.js';
import crypto from 'node:crypto';
export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', req.headers?.origin || '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method tidak diizinkan.' });
  const body = parseRequestBody(req);
  if (!body.fullName || !body.email || !body.password || !body.teacherIdentifier) {
    return res.status(400).json({ error: 'Nama, email, NIP, dan kata sandi wajib diisi.' });
  }
  const password = String(body.password);
  if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    return res.status(400).json({ error: 'Kata sandi harus 8+ karakter dengan huruf besar, huruf kecil, angka, dan simbol.' });
  }
  const hashed = hashPassword(body.password);
  const supabase = getSupabaseConfig();
  if (supabase) {
    const profileId = crypto.randomUUID();
    const email = String(body.email).toLowerCase().trim();
    const nip = String(body.teacherIdentifier).trim();
    const existingEmail = await supabaseRequest('profiles', { query: { email: `eq.${email}`, select: 'id' } });
    if (existingEmail.error) return res.status(500).json({ error: existingEmail.error });
    if (existingEmail.data.length) return res.status(409).json({ error: 'Email sudah terdaftar.' });
    const existingNip = await supabaseRequest('profiles', { query: { teacher_identifier: `eq.${nip}`, select: 'id' } });
    if (existingNip.error) return res.status(500).json({ error: existingNip.error });
    if (existingNip.data.length) return res.status(409).json({ error: 'NIP / ID Guru sudah terdaftar.' });
    const created = await supabaseRequest('profiles', {
      method: 'POST',
      body: {
        id: profileId, email, full_name: String(body.fullName).trim(),
        school_name: body.schoolName?.trim() || null, teacher_identifier: nip,
        password_hash: hashed.hash, password_salt: hashed.salt, role: 'teacher'
      }
    });
    if (created.error || !created.data.length) {
      return res.status(500).json({ error: created.error || 'Gagal menyimpan akun ke Supabase.' });
    }
    const token = crypto.randomBytes(32).toString('hex');
    const session = await supabaseRequest('app_sessions', {
      method: 'POST',
      body: { token, user_id: profileId, expires_at: new Date(Date.now() + 7 * 86400000).toISOString() }
    });
    if (session.error || !session.data.length) {
      return res.status(500).json({ error: session.error || 'Gagal membuat sesi Supabase.' });
    }
    const { password_hash, password_salt, ...user } = created.data[0];
    return res.status(201).json({ token, user });
  }
  if (db.getProfileByEmail(String(body.email).trim())) return res.status(409).json({ error: 'Email sudah terdaftar.' });
  if (db.getProfileByNip(String(body.teacherIdentifier).trim())) return res.status(409).json({ error: 'NIP / ID Guru sudah terdaftar.' });
  const profile = db.createProfile({
    email: String(body.email).toLowerCase().trim(), full_name: String(body.fullName).trim(),
    school_name: body.schoolName?.trim(), teacher_identifier: body.teacherIdentifier?.trim(),
    password_hash: hashed.hash, password_salt: hashed.salt, role: 'teacher'
  });
  const { password_hash, password_salt, ...user } = profile;
  return res.status(201).json({ token: db.createSession(profile.id), user });
}
