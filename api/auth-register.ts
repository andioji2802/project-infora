import { db, hashPassword } from '../server/db.js';

export default function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', req.headers?.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method tidak diizinkan.' });

  const { fullName, email, password, schoolName, teacherIdentifier } = req.body || {};
  if (!fullName || !email || !password) return res.status(400).json({ error: 'Nama, email, dan kata sandi wajib diisi.' });
  if (db.getProfileByEmail(String(email))) return res.status(409).json({ error: 'Email sudah terdaftar.' });

  const { hash, salt } = hashPassword(String(password));
  const profile = db.createProfile({
    email: String(email).toLowerCase().trim(),
    full_name: String(fullName).trim(),
    school_name: schoolName ? String(schoolName).trim() : undefined,
    teacher_identifier: teacherIdentifier ? String(teacherIdentifier).trim() : undefined,
    password_hash: hash,
    password_salt: salt,
    role: 'teacher'
  });
  const token = db.createSession(profile.id);
  const { password_hash, password_salt, ...user } = profile;
  return res.status(201).json({ token, user });
}
