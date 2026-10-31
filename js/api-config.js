// Set this to the public Render/Railway backend URL, without a trailing slash.
export const API_BASE_URL = 'https://project-infora.vercel.app';

export function apiUrl(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}
