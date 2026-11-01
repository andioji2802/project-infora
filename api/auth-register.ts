import { db, hashPassword } from '../server/db.js';
export default function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', req.headers?.origin || '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method tidak diizinkan.' });
  const body = req.body || {};
  if (!body.fullName || !body.email || !body.password) return res.status(400).json({ error: 'Nama, email, dan kata sandi wajib diisi.' });
  if (db.getProfileByEmail(String(body.email).trim())) return res.status(409).json({ error: 'Email sudah terdaftar.' });
  const hashed = hashPassword(body.password);
  const profile = db.createProfile({
    email: String(body.email).toLowerCase().trim(), full_name: String(body.fullName).trim(),
    school_name: body.schoolName?.trim(), teacher_identifier: body.teacherIdentifier?.trim(),
    password_hash: hashed.hash, password_salt: hashed.salt, role: 'teacher'
  });
  const { password_hash, password_salt, ...user } = profile;
  return res.status(201).json({ token: db.createSession(profile.id), user });
}
