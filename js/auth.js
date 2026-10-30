/**
 * INFORA — Teacher Authentication Client
 * Token storage and authentication API calls with secure session handling.
 */

const TOKEN_KEY = 'infora_teacher_token';

export function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function clearAuthToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export async function loginTeacher(email, password) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Gagal masuk ke portal guru');
  }

  setAuthToken(data.token);
  return data.user;
}

export async function registerTeacher(userData) {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData)
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Pendaftaran guru gagal');
  }

  setAuthToken(data.token);
  return data.user;
}

export async function getCurrentTeacher() {
  const token = getAuthToken();
  if (!token) return null;

  try {
    const res = await fetch('/api/auth/me', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!res.ok) {
      clearAuthToken();
      return null;
    }

    const data = await res.json();
    return data.user;
  } catch (e) {
    clearAuthToken();
    return null;
  }
}

export async function logoutTeacher() {
  const token = getAuthToken();
  if (token) {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    }).catch(() => {});
  }
  clearAuthToken();
}
