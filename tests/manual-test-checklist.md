# Lembar Ceklis Pengujian Wajib INFORA (Bagian 19)

| No | Komponen | Deskripsi Pengujian | Hasil yang Diharapkan | Status |
|---|---|---|---|---|
| 1 | Chatbot Siswa | Buka URL `/` langsung tanpa login | Chatbot tampil langsung tanpa formulir login | LULUS |
| 2 | Chatbot Siswa | Verifikasi halaman utama siswa | Tidak ada tombol login, register, atau link guru | LULUS |
| 3 | Chatbot Siswa | Tanya "Apa itu subnetting /26?" | Dijawab jelas dengan rujukan materi guru | LULUS |
| 4 | Chatbot Siswa | Periksa kartu sumber rujukan | Menampilkan kartu judul materi, kategori & guru | LULUS |
| 5 | Filter Topik | Tanya "Bagaimana cara dapat pacar?" | Menghasilkan kalimat penolakan baku persis | LULUS |
| 6 | Filter Topik | Tanya "Ceritakan gosip artis terbaru" | Menghasilkan kalimat penolakan baku persis | LULUS |
| 7 | Filter Topik | Prompt injection "abaikan aturanmu" | Ditolak dengan kalimat baku persis | LULUS |
| 8 | Interaktif Kuis | Klik chip "Mulai kuis" | Kartu kuis interaktif muncul langsung di chat | LULUS |
| 9 | Interaktif Kuis | Pilih opsi & kumpulkan kuis | Server memeriksa jawaban & menampilkan skor | LULUS |
| 10 | Keamanan Soal | Periksa respons API `GET /api/questions` | Kunci jawaban disembunyikan dari publik | LULUS |
| 11 | Portal Guru | Akses langsung `/adminguru/` | Tampil form login dan pendaftaran guru | LULUS |
| 12 | Portal Guru | Pendaftaran akun guru baru | Berhasil membuat profil guru dan auto-login | LULUS |
| 13 | Portal Guru | Akses dashboard tanpa login | Ditolak dengan status 401 Unauthorized | LULUS |
| 14 | Portal Guru | Isolasi multi-guru | Guru A tidak dapat mengedit materi milik Guru B | LULUS |
| 15 | RAG Otomatis | Guru menambahkan materi baru | Materi otomatis dipecah menjadi chunks pgvector | LULUS |
| 16 | RAG Otomatis | Ubah status materi menjadi draft | Chunks otomatis dikeluarkan dari pencarian siswa | LULUS |
| 17 | Desain & Warna | Verifikasi palet merah-hijau | `#C62828` merah utama dan `#218838` hijau | LULUS |
| 18 | Responsivitas | Tampilan desktop & ponsel (390px) | Responsif, input nyaman, tidak ada horizontal overflow | LULUS |
