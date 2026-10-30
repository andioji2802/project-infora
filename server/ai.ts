/**
 * INFORA — AI Provider Client (@google/genai SDK)
 * Connects to Gemini models for generation and embeddings.
 */

import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY;

export const ai = apiKey
  ? new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    })
  : null;

export const GENERATIVE_MODEL_NAME =
  process.env.GEMINI_MODEL_NAME?.trim() || 'gemini-2.5-flash';
export const EMBEDDING_MODEL_NAME = 'gemini-embedding-2-preview';

function withTimeout<T>(promise: Promise<T>, ms = 30000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms))
  ]);
}

/**
 * Generates an answer from Gemini given the system instruction and user prompt with context.
 */
export async function generateGeminiResponse(systemInstruction: string, prompt: string): Promise<string> {
  if (!ai) {
    throw new Error('API Key tidak dikonfigurasi pada environment server.');
  }

  const response = await withTimeout(
    ai.models.generateContent({
      model: GENERATIVE_MODEL_NAME,
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.25,
        topP: 0.95,
        maxOutputTokens: 8192
      }
    }),
    30000
  );

  return response.text || '';
}

/**
 * Creates an embedding vector using normalized term-frequency vectorizer
 * Compatible with pgvector cosine distance operations
 */
export async function createEmbeddingVector(text: string): Promise<number[]> {
  return generateDeterministicFallbackVector(text);
}

/**
 * Deterministic term-frequency vectorizer fallback (ensures offline resilience and high testability).
 * Produces a normalized vector of fixed dimension 64.
 */
export function generateDeterministicFallbackVector(text: string, dimensions = 64): number[] {
  const vec = new Array(dimensions).fill(0);
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);

  for (const word of words) {
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = (hash << 5) - hash + word.charCodeAt(i);
      hash |= 0;
    }
    const idx = Math.abs(hash) % dimensions;
    vec[idx] += 1;
  }

  // Normalize to unit vector
  let norm = 0;
  for (let i = 0; i < dimensions; i++) {
    norm += vec[i] * vec[i];
  }
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < dimensions; i++) {
      vec[i] /= norm;
    }
  }

  return vec;
}
