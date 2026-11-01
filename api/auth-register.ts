import { db, hashPassword } from '../server/db.js';
export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', req.headers?.origin || '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method tidak diizinkan.' });
  const body = req.body || {};
  if (!body.fullName || !body.email || !body.password || !body.teacherIdentifier) {
    return res.status(400).json({ error: 'Nama, email, NIP, dan kata sandi wajib diisi.' });
  }
  const password = String(body.password);
  if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    return res.status(400).json({ error: 'Kata sandi harus 8+ karakter dengan huruf besar, huruf kecil, angka, dan simbol.' });
  }
  if (db.getProfileByEmail(String(body.email).trim())) return res.status(409).json({ error: 'Email sudah terdaftar.' });
  if (db.getProfileByNip(String(body.teacherIdentifier).trim())) return res.status(409).json({ error: 'NIP / ID Guru sudah terdaftar.' });
  const hashed = hashPassword(body.password);
  const profile = db.createProfile({
    email: String(body.email).toLowerCase().trim(), full_name: String(body.fullName).trim(),
    school_name: body.schoolName?.trim(), teacher_identifier: body.teacherIdentifier?.trim(),
    password_hash: hashed.hash, password_salt: hashed.salt, role: 'teacher'
  });
  const { password_hash, password_salt, ...user } = profile;
  return res.status(201).json({ token: db.createSession(profile.id), user });
}
