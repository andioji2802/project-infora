/**
 * INFORA - Teacher Authentication Client
 */
import { apiUrl } from './api-config.js';

const TOKEN_KEY = 'infora_teacher_token';

export function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function clearAuthToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export async function loginTeacher(nip, password) {
  const res = await fetch(apiUrl('/api/auth-login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nip, password })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Gagal masuk ke portal guru');
  if (!data.token) throw new Error('Server tidak mengembalikan sesi login.');
  setAuthToken(data.token);
  return data.user;
}

export async function registerTeacher(userData) {
  const res = await fetch(apiUrl('/api/auth-register'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Pendaftaran guru gagal');
  if (!data.token) throw new Error('Server tidak mengembalikan sesi akun baru.');
  setAuthToken(data.token);
  return data.user;
}

export async function getCurrentTeacher() {
  const token = getAuthToken();
  if (!token) return null;
  try {
    const res = await fetch(apiUrl('/api/auth-me'), {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      clearAuthToken();
      return null;
    }
    const data = await res.json();
    return data.user;
  } catch {
    clearAuthToken();
    return null;
  }
}

export async function logoutTeacher() {
  const token = getAuthToken();
  if (token) {
    await fetch(apiUrl('/api/auth-logout'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    }).catch(() => {});
  }
  clearAuthToken();
}
