# Skema Database Bersama INFORA

Database INFORA dirancang untuk PostgreSQL dengan ekstensi `pgvector` dan proteksi Row Level Security (RLS).

## 1. Tabel `profiles`
Menyimpan profil guru terdaftar:
- `id` (UUID, Primary Key, referensi auth.users)
- `full_name` (TEXT, wajib)
- `school_name` (TEXT)
- `teacher_identifier` (TEXT, NIP atau ID)
- `role` (TEXT, default 'teacher', 'admin')
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

## 2. Tabel `materials`
Menyimpan modul ajar Informatika dari para guru:
- `id` (UUID, Primary Key)
- `owner_id` (UUID, FK -> profiles.id)
- `title` (TEXT, judul materi)
- `slug` (TEXT, unik)
- `category` (TEXT, kategori kurikulum)
- `grade_level` (TEXT, kelas X, XI, XII SMK)
- `learning_objectives` (TEXT, tujuan pembelajaran)
- `summary` (TEXT, ringkasan konsep)
- `content` (TEXT, isi modul lengkap format markdown)
- `keywords` (TEXT, kata kunci teknis)
- `aliases` (TEXT, sinonim istilah)
- `practice_steps` (TEXT, langkah lab / praktik)
- `faq` (TEXT, pertanyaan sering diajukan & miskonsepsi)
- `references` (TEXT, referensi rujukan guru)
- `status` (TEXT, 'draft' | 'published' | 'archived')
- `created_at`, `updated_at`, `published_at` (TIMESTAMPTZ)

## 3. Tabel `material_chunks`
Menyimpan potongan teks dan representasi vektor untuk pencarian RAG:
- `id` (UUID, Primary Key)
- `material_id` (UUID, FK -> materials.id ON DELETE CASCADE)
- `chunk_index` (INT, urutan potongan dalam materi)
- `chunk_text` (TEXT, isi potongan paragraf)
- `embedding` (VECTOR(768), vektor representasi semantik)
- `embedding_model` (TEXT, 'gemini-embedding-2-preview')
- `created_at` (TIMESTAMPTZ)
- *Indeks: HNSW cosine index `idx_material_chunks_embedding`*

## 4. Tabel `questions`
Menyimpan bank soal latihan dan ujian:
- `id` (UUID, Primary Key)
- `owner_id` (UUID, FK -> profiles.id)
- `material_id` (UUID, FK -> materials.id)
- `category` (TEXT)
- `difficulty` (TEXT: 'Mudah', 'Sedang', 'Sulit')
- `question_type` (TEXT: 'multiple_choice', 'true_false', dll)
- `question_text` (TEXT)
- `options` (JSONB, array opsi jawaban A, B, C, D)
- `correct_answer` (JSONB, index jawaban yang benar - dirahasiakan dari publik)
- `explanation` (TEXT, pembahasan guru)
- `competency` (TEXT, indikator capaian)
- `status` (TEXT: 'published', 'draft')

## 5. Tabel `quizzes` & `quiz_questions`
Menyimpan paket latihan terstruktur:
- `quizzes`: `id`, `owner_id`, `title`, `description`, `category`, `difficulty`, `status`, `created_at`
- `quiz_questions`: `quiz_id`, `question_id`, `position`, `points` (Composite PK)
