# Petunjuk Deployment & Instalasi INFORA

Panduan langkah demi langkah untuk menguji secara lokal dan menyebarkan INFORA ke lingkungan produksi.

## 1. Menjalankan Server Lokal (AI Studio / Node.js)
1. Pastikan Node.js v18+ terinstal.
2. Pasang dependensi:
   ```bash
   npm install
   ```
3. Set environment variable (opsional untuk Gemini API Key):
   ```bash
   export GEMINI_API_KEY="your-gemini-api-key"
   ```
4. Jalankan server pengembangan:
   ```bash
   npm run dev
   ```
5. Akses:
   - Chatbot Siswa: `http://localhost:3000/`
   - Portal Admin Guru: `http://localhost:3000/adminguru/`

## 2. Deployment ke Supabase & Hosting Statis
1. **Buat Proyek Supabase**: Buka [database.new](https://database.new) dan buat proyek baru.
2. **Jalankan Migrasi Database**:
   - Jalankan `supabase/migrations/001_initial_schema.sql` di SQL Editor Supabase.
   - Jalankan `supabase/migrations/002_rls_policies.sql` untuk mengaktifkan RLS.
   - Jalankan `supabase/migrations/003_vector_search.sql` untuk membuat fungsi pgvector.
   - Jalankan `supabase/migrations/004_seed_content.sql` untuk memasukkan kurikulum awal.
3. **Deploy Edge Functions**:
   ```bash
   supabase functions deploy chat
   supabase functions deploy upsert-material
   supabase functions deploy process-material
   supabase functions deploy grade-quiz
   ```
4. **Deploy Frontend Statis**:
   - Salin direktori `index.html`, `/adminguru/`, `/css/`, dan `/js/` ke penyedia hosting statis seperti Cloudflare Pages, Vercel, atau GitHub Pages.
   - Pastikan URL `/adminguru/` dapat diakses secara langsung.
