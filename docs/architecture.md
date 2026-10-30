# Arsitektur Sistem INFORA — AI Pembelajaran Informatika SMK

## 1. Ikhtisar Sistem
INFORA (*Informatika Interaktif, Reflektif, dan Adaptif*) dirancang sebagai platform pembelajaran berbantuan AI berbasis **Retrieval-Augmented Generation (RAG)** yang memfasilitasi pembelajaran mandiri bagi siswa SMK tanpa mewajibkan akun atau login siswa, didukung portal guru multi-pengguna di `/adminguru/`.

```text
+-----------------------------------------------------------------------------------+
|                                SISWA (Tanpa Login)                                |
|   URL: /                                                                          |
|   - Tampilan Percakapan Interaktif (HTML5 + CSS3 + Vanilla JS)                    |
|   - Suggestion Chips: Konsep, Jaringan, Kuis, Latihan, Kode                       |
|   - Kartu Sumber Belajar Guru & Interaktif Kuis di dalam chat                      |
+-----------------------------------------------------------------------------------+
                                         |
                                (HTTP POST /api/chat)
                                         v
+-----------------------------------------------------------------------------------+
|                            LAPISAN SERVER & SECURITY                              |
|   - Rate Limiter (Anti-DDoS / Token Abuse)                                        |
|   - Filter Topik Ketat (Mengecek ruang lingkup Informatika SMK)                    |
|     => Jika di luar topik / prompt injection: kembalikan KALIMAT PENOLAKAN TETAP  |
|     => Jika lolos: lanjutkan ke RAG Pipeline                                      |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                               MESIN RAG & EMBEDDING                               |
|   - Input Query diubah menjadi Vektor Embedding (gemini-embedding-2-preview)     |
|   - Pencarian Kemiripan Kosinus (Cosine Similarity) pada tabel material_chunks    |
|   - Filter Relevansi (Ambang batas kemiripan + Keyword Boost)                     |
|     => Jika tidak ada materi relevan yang diterbitkan: TOLAK DENGAN KALIMAT TETAP |
|     => Jika relevan: Rakit prompt dengan kutipan materi guru                      |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                             GENERASI JAWABAN AI (TUTOR)                           |
|   - Model: gemini-3.8-flash                                                       |
|   - Persona: Tutor ramah, terstruktur, mendidik untuk SMK                         |
|   - Menyertakan referensi judul materi, kategori, & guru pengampu                 |
+-----------------------------------------------------------------------------------+

+-----------------------------------------------------------------------------------+
|                         PORTAL GURU (Multi-Pengajar)                              |
|   URL: /adminguru/                                                                |
|   - Autentikasi Guru (Register / Login aman via PBKDF2 / Supabase Auth)           |
|   - Dashboard Statistik Riil                                                      |
|   - Kelola Materi (CRUD, Status Draft/Published/Archived, Impor/Ekspor JSON)      |
|   - Otomasi Pemotongan Teks (Chunking) & Pembuatan Vektor saat Diterbitkan         |
|   - Kelola Bank Soal & Paket Kuis                                                 |
|   - Penilaian Kuis Aman (Kunci jawaban terlindungi di sisi server)                |
+-----------------------------------------------------------------------------------+
```

## 2. Pemilihan Model AI
1. **Model Generatif (`gemini-3.8-flash`)**:
   - Memiliki pemahaman bahasa Indonesia yang sangat baik.
   - Mengikuti instruksi sistem secara konsisten dan patuh pada konteks sumber.
   - Latensi rendah (< 1.5s) dan hemat token untuk lingkungan pendidikan.
2. **Model Embedding (`gemini-embedding-2-preview`)**:
   - Menghasilkan vektor padat berdimensi tinggi yang mendukung representasi semantik multibahasa (termasuk istilah teknis Informatika).
   - Dilengkapi fallback term-frequency vectorizer untuk menjamin keandalan 100% saat offline atau terkena batas kuota API.

## 3. Alur Filter Topik Ketat
Pertanyaan di luar cakupan kurikulum Informatika SMK (curhat, asmara, gosip, film, politik) tidak diteruskan ke model generatif untuk mencegah halusinasi. Sistem mengembalikan kalimat tetap persis:
`“Maaf, INFORA hanya melayani pertanyaan seputar pembelajaran Informatika dan materi pendidikan yang tersedia.”`
