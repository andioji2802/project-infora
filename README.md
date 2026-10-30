# INFORA — Informatika Interaktif, Reflektif, dan Adaptif

> **Karya Inovasi Pendidikan:**  
> *“Pengembangan INFORA sebagai Chatbot Pembelajaran Informatika Berbasis Retrieval-Augmented Generation (RAG) untuk Mendukung Pembelajaran Mandiri Siswa SMK.”*

---

## 📖 Ringkasan Aplikasi
INFORA adalah platform pembelajaran mandiri khusus mata pelajaran Informatika untuk siswa SMK. Aplikasi ini menghubungkan bank materi yang disusun dan diterbitkan oleh guru-guru SMK langsung ke chatbot AI siswa menggunakan arsitektur **Retrieval-Augmented Generation (RAG)**.

### 🌟 Fitur Utama Siswa (URL: `/`)
- **Tanpa Login Siswa:** Siswa langsung membuka halaman utama dan dapat langsung bertanya tanpa akun atau pendaftaran.
- **Antarmuka Percakapan Murni:** Tanpa tombol login, tanpa menu hamburger, tanpa sidebar yang mengganggu.
- **Identitas Merah-Hijau:** Menggunakan palet `#C62828` (merah utama) dan `#218838` (hijau utama).
- **RAG Terverifikasi:** Setiap jawaban menyertakan kartu sumber belajar asli (judul modul, kategori kurikulum, dan nama guru pembuat).
- **Interactive In-Chat Quiz:** Siswa dapat mengerjakan latihan dan kuis langsung di dalam gelembung percakapan dengan penilaian otomatis yang aman di sisi server.
- **Blok Kode & Salin:** Blok kode teknis dengan tombol salin cepat.
- **Filter Topik Ketat:** Menolak pertanyaan di luar topik pembelajaran Informatika SMK dengan satu kalimat tetap persis:
  > **“Maaf, INFORA hanya melayani pertanyaan seputar pembelajaran Informatika dan materi pendidikan yang tersedia.”**

### 👨‍🏫 Fitur Utama Guru (URL: `/adminguru/`)
- **Portal Khusus Guru:** Tidak ditautkan dari halaman utama siswa; diakses langsung via `/adminguru/`.
- **Multi-Guru & Autentikasi:** Guru mendaftar dengan nama lengkap, email resmi, sekolah, dan NIP.
- **Manajemen Materi:** Tambah, edit, simpan draf, terbitkan, arsipkan, hapus, dan cari materi.
- **Otomasi RAG:** Materi yang diterbitkan otomatis dipecah menjadi chunks dan diubah menjadi vektor embedding.
- **Impor & Ekspor JSON:** Memudahkan guru mendistribusikan bank modul ajar.
- **Bank Soal & Paket Kuis:** Menyusun pertanyaan pilihan ganda, menentukan kunci jawaban dan pembahasan, serta membundelnya menjadi kuis mandiri siswa.
- **Isolasi Kepemilikan:** Guru hanya dapat memodifikasi materi dan soal miliknya sendiri.

---

## 🛠️ Tumpukan Teknologi
- **Frontend:** HTML5, CSS3 kustom, JavaScript vanilla ES modules (tanpa framework/library pihak ketiga).
- **Backend:** Node.js Express full-stack (`server.ts`).
- **Database & RAG:** PostgreSQL schema dengan ekstensi `pgvector`, Row Level Security (RLS), dan persistent shared database.
- **Model AI:** 
  - Generatif: `gemini-3.8-flash` via `@google/genai`
  - Embedding: `gemini-embedding-2-preview` (dengan fallback deterministic cosine vectorizer)

---

## 🚀 Panduan Menjalankan Aplikasi
1. Jalankan server:
   ```bash
   npm run dev
   ```
2. Buka di browser:
   - Siswa: `http://localhost:3000/`
   - Portal Guru: `http://localhost:3000/adminguru/`

3. Akun Guru Demo:
   - Email: `fauzi@smkn1.sch.id`
   - Kata Sandi: `guru123456`
   (Atau daftar akun guru baru melalui tab "Daftar Guru Baru")
