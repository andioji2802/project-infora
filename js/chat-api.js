/**
 * INFORA — Chat API Client
 * Secure communication layer calling backend endpoints without exposing secrets.
 */

import { apiUrl } from './api-config.js';

export async function sendChatMessage(message, history = []) {
  const payload = {
    message,
    history: history.slice(-6) // Send recent context only
  };

  const response = await fetch(apiUrl('/api/chat'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Gagal menghubungi server (${response.status})`);
  }

  return await response.json();
}

export async function fetchPublicQuizzes() {
  const res = await fetch(apiUrl('/api/quizzes'));
  if (!res.ok) throw new Error('Gagal memuat daftar kuis');
  return await res.json();
}

export async function fetchQuizDetail(quizId) {
  const res = await fetch(apiUrl(`/api/quizzes/${quizId}`));
  if (!res.ok) throw new Error('Gagal memuat detail kuis');
  return await res.json();
}

export async function submitQuizAnswers(quizId, answers) {
  const res = await fetch(apiUrl(`/api/quizzes/${quizId}/grade`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Gagal menilai kuis');
  }
  return await res.json();
}

export async function fetchSystemHealth() {
  try {
    const res = await fetch(apiUrl('/api/health'));
    return await res.json();
  } catch (e) {
    return { status: 'down' };
  }
}
