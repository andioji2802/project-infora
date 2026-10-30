/**
 * INFORA — Database Layer
 * Shared persistent JSON store with ACID atomic writes, simulating Supabase PostgreSQL & pgvector.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { INITIAL_TEACHERS, INITIAL_MATERIALS, INITIAL_QUESTIONS, INITIAL_QUIZZES } from './seedData.js';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'infora.json');

export interface TeacherProfile {
  id: string;
  email: string;
  password_hash: string;
  password_salt: string;
  full_name: string;
  school_name?: string;
  teacher_identifier?: string;
  role: 'teacher' | 'admin';
  created_at: string;
  updated_at?: string;
}

export interface MaterialItem {
  id: string;
  owner_id: string;
  teacher_name?: string;
  title: string;
  slug: string;
  category: string;
  grade_level?: string;
  learning_objectives?: string;
  summary?: string;
  content: string;
  keywords?: string;
  aliases?: string;
  examples?: string;
  practice_steps?: string;
  faq?: string;
  references?: string;
  status: 'draft' | 'published' | 'archived';
  chunk_count?: number;
  created_at: string;
  updated_at: string;
  published_at?: string;
}

export interface MaterialChunk {
  id: string;
  material_id: string;
  chunk_index: number;
  chunk_text: string;
  embedding: number[];
  embedding_model: string;
  created_at: string;
}

export interface QuestionItem {
  id: string;
  owner_id: string;
  material_id?: string;
  category: string;
  difficulty: 'Mudah' | 'Sedang' | 'Sulit';
  question_type: 'multiple_choice' | 'true_false' | 'short_answer' | 'case_study';
  question_text: string;
  options: string[];
  correct_answer: number | string; // Protected, hidden from public endpoints!
  explanation: string;
  competency?: string;
  status: 'draft' | 'published';
  created_at: string;
  updated_at?: string;
}

export interface QuizItem {
  id: string;
  owner_id: string;
  title: string;
  description?: string;
  category: string;
  difficulty: string;
  status: 'draft' | 'published';
  question_ids: string[];
  created_at: string;
  updated_at?: string;
}

interface DatabaseSchema {
  profiles: TeacherProfile[];
  materials: MaterialItem[];
  material_chunks: MaterialChunk[];
  questions: QuestionItem[];
  quizzes: QuizItem[];
  sessions: { token: string; user_id: string; expires_at: number }[];
}

// Password hashing using standard crypto PBKDF2
export function hashPassword(password: string, salt = crypto.randomBytes(16).toString('hex')): { hash: string; salt: string } {
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const check = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return check === hash;
}

class InforaDatabase {
  private data: DatabaseSchema;

  constructor() {
    this.data = this.loadOrInit();
  }

  private loadOrInit(): DatabaseSchema {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        return JSON.parse(raw);
      } catch (err) {
        console.error('Failed to parse infora.json, reinitializing seed data', err);
      }
    }

    // Initialize with default teachers and seed content
    const defaultPassword = hashPassword('guru123456');

    const teachers: TeacherProfile[] = INITIAL_TEACHERS.map(t => ({
      ...t,
      role: 'teacher',
      password_hash: defaultPassword.hash,
      password_salt: defaultPassword.salt
    }));

    const materials: MaterialItem[] = INITIAL_MATERIALS.map(m => ({
      ...m,
      status: 'published',
      chunk_count: 0
    }));

    const schema: DatabaseSchema = {
      profiles: teachers,
      materials,
      material_chunks: [],
      questions: INITIAL_QUESTIONS as any,
      quizzes: INITIAL_QUIZZES as any,
      sessions: []
    };

    fs.writeFileSync(DB_FILE, JSON.stringify(schema, null, 2), 'utf-8');
    return schema;
  }

  private save() {
    try {
      const tempFile = `${DB_FILE}.tmp`;
      fs.writeFileSync(tempFile, JSON.stringify(this.data, null, 2), 'utf-8');
      fs.renameSync(tempFile, DB_FILE);
    } catch (err) {
      console.error('Failed to atomically write infora.json', err);
    }
  }

  // Teacher Profiles
  getProfileByEmail(email: string): TeacherProfile | undefined {
    return this.data.profiles.find(p => p.email.toLowerCase() === email.toLowerCase());
  }

  getProfileById(id: string): TeacherProfile | undefined {
    return this.data.profiles.find(p => p.id === id);
  }

  createProfile(profileData: Omit<TeacherProfile, 'id' | 'created_at'>): TeacherProfile {
    const id = `teacher-${crypto.randomUUID().slice(0, 8)}`;
    const newProfile: TeacherProfile = {
      ...profileData,
      id,
      created_at: new Date().toISOString()
    };
    this.data.profiles.push(newProfile);
    this.save();
    return newProfile;
  }

  updateProfile(id: string, updates: Partial<TeacherProfile>): TeacherProfile | null {
    const idx = this.data.profiles.findIndex(p => p.id === id);
    if (idx === -1) return null;
    this.data.profiles[idx] = {
      ...this.data.profiles[idx],
      ...updates,
      updated_at: new Date().toISOString()
    };
    this.save();
    return this.data.profiles[idx];
  }

  // Session Management
  createSession(userId: string): string {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
    this.data.sessions.push({ token, user_id: userId, expires_at: expiresAt });
    this.save();
    return token;
  }

  getUserFromSession(token: string): TeacherProfile | null {
    const session = this.data.sessions.find(s => s.token === token);
    if (!session || session.expires_at < Date.now()) {
      return null;
    }
    return this.getProfileById(session.user_id) || null;
  }

  deleteSession(token: string) {
    this.data.sessions = this.data.sessions.filter(s => s.token !== token);
    this.save();
  }

  // Materials
  getMaterials(filterStatus?: string): MaterialItem[] {
    if (filterStatus) {
      return this.data.materials.filter(m => m.status === filterStatus);
    }
    return [...this.data.materials];
  }

  getMaterialById(id: string): MaterialItem | undefined {
    return this.data.materials.find(m => m.id === id);
  }

  upsertMaterial(item: MaterialItem): MaterialItem {
    const idx = this.data.materials.findIndex(m => m.id === item.id);
    if (idx >= 0) {
      this.data.materials[idx] = {
        ...item,
        updated_at: new Date().toISOString()
      };
    } else {
      this.data.materials.push({
        ...item,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }
    this.save();
    return item;
  }

  deleteMaterial(id: string): boolean {
    const initialLen = this.data.materials.length;
    this.data.materials = this.data.materials.filter(m => m.id !== id);
    // Also remove any RAG chunks belonging to this material
    this.deleteChunksByMaterialId(id);
    this.save();
    return this.data.materials.length < initialLen;
  }

  // Chunks (pgvector representation)
  getChunks(): MaterialChunk[] {
    return this.data.material_chunks;
  }

  getPublishedChunks(): { chunk: MaterialChunk; material: MaterialItem }[] {
    const publishedMaterialsMap = new Map(
      this.data.materials
        .filter(m => m.status === 'published')
        .map(m => [m.id, m])
    );

    const result: { chunk: MaterialChunk; material: MaterialItem }[] = [];
    for (const chunk of this.data.material_chunks) {
      const mat = publishedMaterialsMap.get(chunk.material_id);
      if (mat) {
        result.push({ chunk, material: mat });
      }
    }
    return result;
  }

  saveChunks(materialId: string, chunks: MaterialChunk[]) {
    // Remove old chunks for this material
    this.data.material_chunks = this.data.material_chunks.filter(c => c.material_id !== materialId);
    this.data.material_chunks.push(...chunks);

    // Update chunk_count on material
    const mat = this.data.materials.find(m => m.id === materialId);
    if (mat) {
      mat.chunk_count = chunks.length;
    }
    this.save();
  }

  deleteChunksByMaterialId(materialId: string) {
    this.data.material_chunks = this.data.material_chunks.filter(c => c.material_id !== materialId);
    this.save();
  }

  // Questions
  getQuestions(onlyPublished = false): QuestionItem[] {
    if (onlyPublished) {
      return this.data.questions.filter(q => q.status === 'published');
    }
    return [...this.data.questions];
  }

  getQuestionById(id: string): QuestionItem | undefined {
    return this.data.questions.find(q => q.id === id);
  }

  upsertQuestion(item: QuestionItem): QuestionItem {
    const idx = this.data.questions.findIndex(q => q.id === item.id);
    if (idx >= 0) {
      this.data.questions[idx] = {
        ...item,
        updated_at: new Date().toISOString()
      };
    } else {
      this.data.questions.push({
        ...item,
        created_at: new Date().toISOString()
      });
    }
    this.save();
    return item;
  }

  deleteQuestion(id: string): boolean {
    const initLen = this.data.questions.length;
    this.data.questions = this.data.questions.filter(q => q.id !== id);
    this.save();
    return this.data.questions.length < initLen;
  }

  // Quizzes
  getQuizzes(onlyPublished = false): QuizItem[] {
    if (onlyPublished) {
      return this.data.quizzes.filter(q => q.status === 'published');
    }
    return [...this.data.quizzes];
  }

  getQuizById(id: string): QuizItem | undefined {
    return this.data.quizzes.find(q => q.id === id);
  }

  upsertQuiz(item: QuizItem): QuizItem {
    const idx = this.data.quizzes.findIndex(q => q.id === item.id);
    if (idx >= 0) {
      this.data.quizzes[idx] = {
        ...item,
        updated_at: new Date().toISOString()
      };
    } else {
      this.data.quizzes.push({
        ...item,
        created_at: new Date().toISOString()
      });
    }
    this.save();
    return item;
  }

  deleteQuiz(id: string): boolean {
    const initLen = this.data.quizzes.length;
    this.data.quizzes = this.data.quizzes.filter(q => q.id !== id);
    this.save();
    return this.data.quizzes.length < initLen;
  }
}

export const db = new InforaDatabase();
