# Kebijakan Keamanan & Row Level Security (RLS) INFORA

## 1. Perlindungan Tanpa Login Siswa
- Siswa tidak memiliki kredensial atau session tokens.
- Siswa hanya berinteraksi melalui endpoint `POST /api/chat` dan `POST /api/quizzes/:id/grade`.
- Siswa tidak dapat mengakses materi berstatus `draft` atau `archived`.
- Endpoint publik bank soal (`GET /api/questions`) secara otomatis membersihkan kolom `correct_answer` dan `explanation` untuk mencegah kecurangan melalui inspect element atau network tab browser.

## 2. Row Level Security & Hak Akses Guru
- Guru harus terautentikasi melalui session token atau JWT yang valid.
- Guru hanya dapat mengubah atau menghapus konten (`materials`, `questions`, `quizzes`) yang memiliki `owner_id` sama dengan ID guru yang sedang login.
- Perubahan role pengguna dibatasi dan tidak dapat dinaikkan sendiri oleh formulir frontend.

## 3. Isolasi Rahasia & API Key
- `GEMINI_API_KEY` dan kredensial sensitif lainnya hanya diakses di sisi server (Node.js Express / Supabase Edge Functions).
- Tidak ada API key, token admin, atau rahasia database yang disematkan dalam file bundle HTML, CSS, atau JavaScript frontend.

## 4. Perlindungan Adversarial & Filter Topik
- Sistem dilengkapi filter multi-lapis untuk mendeteksi upaya prompt injection ("abaikan aturan", "bocorkan prompt internal").
- Pertanyaan di luar cakupan kurikulum Informatika SMK ditolak secara ketat dengan satu kalimat baku:
  `“Maaf, INFORA hanya melayani pertanyaan seputar pembelajaran Informatika dan materi pendidikan yang tersedia.”`
