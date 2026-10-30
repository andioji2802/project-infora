/**
 * INFORA — Pre-seeded SMK Informatika Curriculum Data (Bagian 12)
 * Comprehensive seed content for RAG, question bank, and quizzes.
 */

export const INITIAL_TEACHERS = [
  {
    id: 'teacher-fauzi-01',
    email: 'fauzi@smkn1.sch.id',
    full_name: 'Drs. H. Ahmad Fauzi, M.Kom.',
    school_name: 'SMK Negeri 1 Bidang Keahlian TKI',
    teacher_identifier: '197505122000031002',
    role: 'teacher',
    created_at: new Date('2026-01-10').toISOString()
  },
  {
    id: 'teacher-siti-02',
    email: 'siti.aminah@smk.belajar.id',
    full_name: 'Siti Aminah, S.Pd., M.T.',
    school_name: 'SMK Pusat Keunggulan Informatika',
    teacher_identifier: '198803152011012009',
    role: 'teacher',
    created_at: new Date('2026-02-01').toISOString()
  }
];

export const INITIAL_MATERIALS = [
  {
    id: 'mat-jaringan-01',
    owner_id: 'teacher-fauzi-01',
    teacher_name: 'Drs. H. Ahmad Fauzi, M.Kom.',
    title: 'Jaringan Komputer: Subnetting IP Address dan CIDR',
    slug: 'jaringan-komputer-subnetting-ip-dan-cidr',
    category: 'Jaringan Komputer',
    grade_level: 'Kelas XI SMK',
    learning_objectives: 'Siswa mampu memahami struktur IP Address v4, menghitung pembagian subnet menggunakan notasi CIDR, menentukan Network Address, Broadcast Address, serta jumlah Host yang valid.',
    summary: 'Subnetting adalah teknik memecah satu jaringan besar menjadi sub-jaringan yang lebih kecil dan efisien untuk mengoptimalkan alokasi IP Address dan mengurangi broadcast domain.',
    content: `### Pengertian Subnetting dan Notasi CIDR

Dalam jaringan komputer, **IP Address versi 4 (IPv4)** terdiri dari 32 bit yang dibagi menjadi 4 oktet. Setiap oktet berukuran 8 bit (1 byte), ditulis dalam format desimal bertitik, misalnya \`192.168.1.1\`.

Subnetting merupakan teknik membagi sebuah jaringan fisik menjadi beberapa sub-jaringan logis (*subnet*). Tujuannya adalah:
1. **Efisiensi Alokasi IP**: Mencegah pemborosan alamat IP publik maupun privat.
2. **Pengurangan Lalu Lintas Jaringan**: Membatasi domain *broadcast* sehingga performa jaringan lebih cepat.
3. **Meningkatkan Keamanan**: Menerapkan segmentasi akses antar divisi atau laboratorium komputer SMK.

### Notasi CIDR (Classless Inter-Domain Routing)

Notasi CIDR dituliskan dengan tanda garis miring di belakang IP, misalnya \`/24\`, yang menunjukkan berapa bit bernilai 1 (*network bit*) pada subnet mask.

Sebagai contoh:
- \`/24\` memiliki subnet mask \`255.255.255.0\` (24 bit network, 8 bit host). Jumlah host = $2^8 - 2 = 254$ host valid.
- \`/25\` memiliki subnet mask \`255.255.255.128\` (25 bit network, 7 bit host). Jumlah host = $2^7 - 2 = 126$ host valid.
- \`/26\` memiliki subnet mask \`255.255.255.192\` (26 bit network, 6 bit host). Jumlah host = $2^6 - 2 = 62$ host valid.
- \`/28\` memiliki subnet mask \`255.255.255.240\` (28 bit network, 4 bit host). Jumlah host = $2^4 - 2 = 14$ host valid.

### Contoh Perhitungan Subnetting /26

Diberikan network: \`192.168.10.0/26\`
- **Subnet Mask**: \`255.255.255.192\`
- **Jumlah Subnet**: $2^{2} = 4$ subnet (karena 26 - 24 = 2 bit subnet).
- **Blok Subnet**: $256 - 192 = 64$. Maka bloknya adalah kelipatan 64: 0, 64, 128, 192.
- **Subnet 1**:
  - Network Address: \`192.168.10.0\`
  - Host Pertama: \`192.168.10.1\`
  - Host Terakhir: \`192.168.10.62\`
  - Broadcast Address: \`192.168.10.63\`
- **Subnet 2**:
  - Network Address: \`192.168.10.64\`
  - Host Pertama: \`192.168.10.65\`
  - Host Terakhir: \`192.168.10.126\`
  - Broadcast Address: \`192.168.10.127\``,
    keywords: 'subnetting, cidr, ip address, ipv4, subnet mask, broadcast, network address, host valid, tkj, smk',
    practice_steps: '1. Buka Cisco Packet Tracer. 2. Pasang 1 Router dan 2 Switch. 3. Hubungkan ke PC Lab A (Subnet 1) dan PC Lab B (Subnet 2). 4. Atur IP static dan uji ping.',
    faq: 'Mengapa jumlah host selalu dikurangi 2? Karena 1 alamat pertama dipakai sebagai Network ID dan alamat terakhir dipakai sebagai Broadcast ID.',
    references: 'Modul Ajar Konsentrasi Keahlian Teknik Komputer dan Jaringan SMK Kurikulum Merdeka.',
    status: 'published',
    created_at: new Date('2026-02-10').toISOString(),
    updated_at: new Date('2026-02-10').toISOString()
  },
  {
    id: 'mat-algo-02',
    owner_id: 'teacher-siti-02',
    teacher_name: 'Siti Aminah, S.Pd., M.T.',
    title: 'Berpikir Komputasional dan Logika Algoritma Dasar',
    slug: 'berpikir-komputasional-dan-logika-algoritma-dasar',
    category: 'Berpikir Komputasional',
    grade_level: 'Kelas X SMK',
    learning_objectives: 'Siswa mampu memahami empat pilar berpikir komputasional serta menulis algoritma dalam bentuk pseudocode dan flowchart.',
    summary: 'Berpikir komputasional adalah metode penyelesaian masalah menggunakan pendekatan dekomposisi, pengenalan pola, abstraksi, dan perancangan algoritma.',
    content: `### Empat Pilar Berpikir Komputasional

Berpikir komputasional (*computational thinking*) adalah kemampuan memecahkan masalah kompleks secara efektif dan sistematis:
1. **Dekomposisi (*Decomposition*)**: Memecah masalah besar dan rumit menjadi bagian-bagian kecil yang lebih mudah dikelola. Contoh: merancang aplikasi e-commerce dipecah menjadi modul katalog, keranjang belanja, dan pembayaran.
2. **Pengenalan Pola (*Pattern Recognition*)**: Menemukan kesamaan atau pola berulang pada masalah untuk memanfaatkan solusi yang pernah berhasil sebelumnya.
3. **Abstraksi (*Abstraction*)**: Memfokuskan perhatian hanya pada informasi penting dan mengabaikan detail-detail yang tidak relevan.
4. **Perancangan Algoritma (*Algorithm Design*)**: Menyusun langkah-langkah terurut, logis, dan terdefinisi dengan jelas untuk menyelesaikan persoalan.

### Struktur Dasar Algoritma

Setiap algoritma komputer dibangun dari tiga struktur kontrol fundamental:
- **Runtunan (*Sequence*)**: Langkah-langkah dieksekusi baris demi baris dari atas ke bawah.
- **Percabangan / Pemilihan (*Selection*)**: Pengambilan keputusan berdasarkan kondisi logika tertentu (IF-ELSE, SWITCH).
- **Perulangan (*Iteration / Looping*)**: Pengulangan satu atau beberapa instruksi selama kondisi terpenuhi (FOR, WHILE, DO-WHILE).`,
    keywords: 'berpikir komputasional, algoritma, dekomposisi, abstraksi, pseudocode, flowchart, logika pemrograman',
    practice_steps: 'Latihan membuat diagram alur (flowchart) menghitung kelulusan nilai siswa: Mulai -> Input Nilai -> Cek Nilai >= 75 -> Cetak Lulus/Remedial -> Selesai.',
    faq: 'Apakah algoritma harus selalu ditulis dalam bahasa pemrograman? Tidak, algoritma dapat dinyatakan dalam bahasa natural, pseudocode, atau flowchart sebelum diterjemahkan ke kode bahasa pemrograman.',
    references: 'Buku Informatika Kelas X SMK/MAK Kementerian Pendidikan, Kebudayaan, Riset, dan Teknologi.',
    status: 'published',
    created_at: new Date('2026-02-12').toISOString(),
    updated_at: new Date('2026-02-12').toISOString()
  },
  {
    id: 'mat-web-03',
    owner_id: 'teacher-fauzi-01',
    teacher_name: 'Drs. H. Ahmad Fauzi, M.Kom.',
    title: 'Pengembangan Web: HTML5 Semantik, CSS Flexbox, dan DOM JavaScript',
    slug: 'pengembangan-web-html5-flexbox-dom-javascript',
    category: 'Pengembangan Web',
    grade_level: 'Kelas XI SMK',
    learning_objectives: 'Siswa mampu membangun antarmuka web modern dengan elemen HTML5 semantik, tata letak responsif CSS Flexbox, serta manipulasi interaktif DOM JavaScript.',
    summary: 'Fondasi utama web modern terdiri dari HTML untuk struktur, CSS untuk tampilan dan tata letak, serta JavaScript untuk interaktivitas pengguna.',
    content: `### HTML5 Semantik

Elemen semantik memberikan arti (*meaning*) yang jelas kepada browser, pembaca layar (*screen reader*), dan mesin pencari:
- \`<header>\`: Memuat logo, identitas web, dan menu atas.
- \`<nav>\`: Navigasi utama halaman.
- \`<main>\`: Konten inti yang unik pada halaman tersebut.
- \`<article>\`: Bagian konten mandiri (misal postingan blog, berita).
- \`<section>\`: Bagian tematik dari dokumen.
- \`<footer>\`: Catatan kaki, hak cipta, atau kontak.

### CSS Flexbox

CSS Flexible Box Layout memudahkan pengaturan tata letak elemen secara dinamis:
\`\`\`css
.container {
  display: flex;
  justify-content: space-between; /* Pengaturan sumbu utama */
  align-items: center;            /* Pengaturan sumbu silang */
  gap: 16px;                      /* Jarak antar item */
}
\`\`\`

### Manipulasi DOM (Document Object Model) dengan JavaScript

DOM adalah representasi pohon objek dari dokumen HTML. JavaScript dapat mengakses dan memodifikasi elemen HTML secara dinamis:
\`\`\`javascript
// Memilih elemen berdasarkan ID
const submitBtn = document.getElementById('btn-kirim');
const outputText = document.getElementById('hasil');

// Menambahkan event listener
submitBtn.addEventListener('click', () => {
  outputText.textContent = 'Data berhasil diproses!';
  outputText.classList.add('aktif');
});
\`\`\``,
    keywords: 'html5, semantic tags, css, flexbox, javascript, dom manipulation, web development, rpl, smk',
    practice_steps: 'Buat file index.html dan style.css, implementasikan kartu produk responsif dengan flexbox dan tombol "Beli" yang menampilkan alert menggunakan JavaScript.',
    faq: 'Kapan sebaiknya menggunakan Flexbox vs Grid? Gunakan Flexbox untuk tata letak satu dimensi (baris ATAU kolom), dan gunakan CSS Grid untuk tata letak dua dimensi (baris DAN kolom sekaligus).',
    references: 'Dokumentasi Resmi MDN Web Docs dan Kurikulum Rekayasa Perangkat Lunak SMK.',
    status: 'published',
    created_at: new Date('2026-02-15').toISOString(),
    updated_at: new Date('2026-02-15').toISOString()
  },
  {
    id: 'mat-db-04',
    owner_id: 'teacher-siti-02',
    teacher_name: 'Siti Aminah, S.Pd., M.T.',
    title: 'Basis Data Relasional: Perancangan ERD, Normalisasi, dan Query SQL',
    slug: 'basis-data-relasional-erd-normalisasi-dan-query-sql',
    category: 'Basis Data',
    grade_level: 'Kelas XI SMK',
    learning_objectives: 'Siswa mampu merancang Entity Relationship Diagram (ERD), menerapkan aturan normalisasi 1NF hingga 3NF, serta mengeksekusi perintah SQL DDL dan DML.',
    summary: 'Basis data relasional mengorganisasikan data dalam tabel yang memiliki relasi melalui Primary Key dan Foreign Key untuk menjaga integritas data.',
    content: `### Konsep Kunci Basis Data Relasional

1. **Primary Key (Kunci Utama)**: Kolom atau kombinasi kolom yang nilainya unik untuk mengidentifikasi setiap baris rekaman dalam tabel secara pasti (contoh: \`nis\` pada tabel siswa).
2. **Foreign Key (Kunci Tamu)**: Kolom pada suatu tabel yang merujuk pada Primary Key di tabel lain untuk membentuk hubungan relasi antar tabel (contoh: \`id_jurusan\` pada tabel siswa).

### Normalisasi Data

Normalisasi bertujuan menghilangkan redundansi (duplikasi) data dan anomali insert, update, serta delete:
- **1NF (Bentuk Normal Pertama)**: Setiap sel hanya boleh memuat satu nilai (*atomic value*) dan tidak ada kolom berulang.
- **2NF (Bentuk Normal Kedua)**: Memenuhi 1NF dan setiap atribut non-kunci bergantung secara fungsional penuh pada Primary Key.
- **3NF (Bentuk Normal Ketiga)**: Memenuhi 2NF dan tidak ada ketergantungan transitif (atribut non-kunci tidak boleh bergantung pada atribut non-kunci lainnya).

### Perintah Penting SQL DML (Data Manipulation Language)

\`\`\`sql
-- Mengambil data siswa jurusan RPL yang nilainya di atas 80
SELECT siswa.nama, siswa.nis, jurusan.nama_jurusan, nilai.skor
FROM siswa
JOIN jurusan ON siswa.id_jurusan = jurusan.id
JOIN nilai ON siswa.nis = nilai.nis_siswa
WHERE jurusan.kode = 'RPL' AND nilai.skor >= 80
ORDER BY nilai.skor DESC;
\`\`\``,
    keywords: 'basis data, sql, mysql, relasional, primary key, foreign key, normalisasi, 1nf, 2nf, 3nf, join, query',
    practice_steps: '1. Desain tabel siswa dan tabel kelas di phpMyAdmin/PostgreSQL. 2. Hubungkan dengan foreign key. 3. Masukkan 5 data contoh dan jalankan INNER JOIN.',
    faq: 'Apa bedanya INNER JOIN dan LEFT JOIN? INNER JOIN hanya menampilkan baris yang memiliki kecocokan di kedua tabel, sedangkan LEFT JOIN menampilkan semua baris dari tabel kiri meskipun tidak ada pasangan di tabel kanan.',
    references: 'Buku Basis Data SMK/MAK Kelas XI Rekayasa Perangkat Lunak.',
    status: 'published',
    created_at: new Date('2026-02-18').toISOString(),
    updated_at: new Date('2026-02-18').toISOString()
  },
  {
    id: 'mat-sec-05',
    owner_id: 'teacher-fauzi-01',
    teacher_name: 'Drs. H. Ahmad Fauzi, M.Kom.',
    title: 'Keamanan Digital: Prinsip CIA Triad, Phishing, dan Pengamanan Akun',
    slug: 'keamanan-digital-cia-triad-phishing-dan-pengamanan-akun',
    category: 'Keamanan Digital',
    grade_level: 'Kelas X SMK',
    learning_objectives: 'Siswa mampu memahami prinsip kerahasiaan, integritas, dan ketersediaan (CIA Triad), mengenali ancaman rekayasa sosial seperti phishing, serta menerapkan autentikasi multifaktor.',
    summary: 'Keamanan informasi berfokus pada perlindungan aset data dan sistem digital dari akses tidak sah, kerusakan, atau pencurian identitas.',
    content: `### Prinsip CIA Triad

Tiga pilar fundamental keamanan informasi:
1. **Confidentiality (Kerahasiaan)**: Memastikan informasi hanya dapat diakses oleh pihak yang berwenang (contoh: enkripsi password dengan bcrypt, kontrol akses role).
2. **Integrity (Integritas)**: Menjamin data tidak diubah, dirusak, atau dipalsukan selama penyimpanan maupun transmisi (contoh: checksum, hash SHA-256).
3. **Availability (Ketersediaan)**: Memastikan data dan layanan sistem dapat diakses saat dibutuhkan oleh pengguna yang sah (contoh: cadangan data/backup, proteksi serangan DDoS).

### Mengenali dan Mencegah Serangan Phishing

Phishing adalah metode penipuan rekayasa sosial di mana penyerang menyamar sebagai entitas tepercaya untuk memancing korban memberikan kredensial rahasia (password, OTP, nomor kartu).

Ciri-ciri umum pesan phishing:
- Menggunakan domain atau URL palsu yang mirip (misal: \`www.faceb00k-login.com\`).
- Menciptakan rasa panik atau urgensi palsu ("Akun Anda akan diblokir dalam 2 jam jika tidak verifikasi").
- Meminta kata sandi atau kode OTP melalui formulir tidak resmi.

Langkah mitigasi:
- Selalu periksa sertifikat SSL dan nama domain resmi pada bilah alamat browser.
- Aktifkan **Two-Factor Authentication (2FA)** pada semua akun digital penting.
- Gunakan pengelola kata sandi (*password manager*) dan buat kata sandi unik yang kuat.`,
    keywords: 'keamanan digital, cyber security, cia triad, phishing, malware, 2fa, enkripsi, privasi, keamanan siber',
    practice_steps: 'Simulasikan pengecekan URL mencurigakan menggunakan VirusTotal dan aktifkan verifikasi 2 langkah pada akun Google belajar.id.',
    faq: 'Mengapa password tidak boleh disimpan dalam bentuk teks biasa (plaintext) di database? Karena jika database bocor, penyerang langsung mengetahui semua password pengguna. Password harus selalu di-hash satu arah dengan algoritma aman (seperti bcrypt atau argon2) beserta salt.',
    references: 'Panduan Keamanan Siber Badan Siber dan Sandi Negara (BSSN) untuk Pendidikan.',
    status: 'published',
    created_at: new Date('2026-02-20').toISOString(),
    updated_at: new Date('2026-02-20').toISOString()
  }
];

export const INITIAL_QUESTIONS = [
  {
    id: 'q-net-01',
    owner_id: 'teacher-fauzi-01',
    material_id: 'mat-jaringan-01',
    category: 'Jaringan Komputer',
    difficulty: 'Sedang',
    question_type: 'multiple_choice',
    question_text: 'Berapa jumlah host valid yang dapat digunakan pada subnet dengan notasi CIDR /26?',
    options: ['30 host', '62 host', '64 host', '126 host'],
    correct_answer: 1, // index 1 -> 62 host
    explanation: 'Pada notasi /26, bit host tersisa adalah 32 - 26 = 6 bit. Jumlah alamat total adalah 2^6 = 64 alamat. Karena 1 alamat digunakan untuk Network ID dan 1 alamat untuk Broadcast ID, maka jumlah host valid adalah 64 - 2 = 62 host.',
    competency: 'Menghitung jumlah host valid berdasarkan notasi CIDR subnet mask',
    status: 'published',
    created_at: new Date('2026-02-10').toISOString()
  },
  {
    id: 'q-net-02',
    owner_id: 'teacher-fauzi-01',
    material_id: 'mat-jaringan-01',
    category: 'Jaringan Komputer',
    difficulty: 'Sedang',
    question_type: 'multiple_choice',
    question_text: 'Jika sebuah jaringan memiliki alamat IP 192.168.1.65 dengan subnet mask 255.255.255.192 (/26), berapakah Network Address dari jaringan tersebut?',
    options: ['192.168.1.0', '192.168.1.64', '192.168.1.65', '192.168.1.127'],
    correct_answer: 1, // index 1 -> 192.168.1.64
    explanation: 'Dengan subnet mask 255.255.255.192, blok subnet adalah kelipatan 64 (0, 64, 128, 192). IP 192.168.1.65 berada pada rentang 64 sampai 127. Oleh karena itu, Network Address-nya adalah 192.168.1.64 dan Broadcast Address-nya adalah 192.168.1.127.',
    competency: 'Menentukan Network Address dari alamat IP dan subnet mask tertentu',
    status: 'published',
    created_at: new Date('2026-02-10').toISOString()
  },
  {
    id: 'q-algo-03',
    owner_id: 'teacher-siti-02',
    material_id: 'mat-algo-02',
    category: 'Berpikir Komputasional',
    difficulty: 'Mudah',
    question_type: 'multiple_choice',
    question_text: 'Pilar berpikir komputasional yang bertugas memecah masalah besar menjadi bagian-bagian yang lebih kecil dan mudah dikelola disebut...',
    options: ['Abstraksi', 'Pengenalan Pola', 'Dekomposisi', 'Algoritma'],
    correct_answer: 2, // index 2 -> Dekomposisi
    explanation: 'Dekomposisi adalah teknik memecah masalah kompleks menjadi masalah-masalah kecil yang lebih sederhana sehingga memudahkan analisis dan penyelesaian masalah.',
    competency: 'Mengidentifikasi pilar-pilar berpikir komputasional',
    status: 'published',
    created_at: new Date('2026-02-12').toISOString()
  },
  {
    id: 'q-web-04',
    owner_id: 'teacher-fauzi-01',
    material_id: 'mat-web-03',
    category: 'Pengembangan Web',
    difficulty: 'Sedang',
    question_type: 'multiple_choice',
    question_text: 'Manakah properti CSS Flexbox yang digunakan untuk mengatur perataan elemen di sepanjang sumbu utama (main axis)?',
    options: ['align-items', 'justify-content', 'flex-direction', 'align-content'],
    correct_answer: 1, // index 1 -> justify-content
    explanation: 'justify-content digunakan untuk mengatur posisi item di sepanjang sumbu utama (main axis), sedangkan align-items digunakan untuk mengatur perataan di sepanjang sumbu silang (cross axis).',
    competency: 'Menerapkan properti CSS Flexbox untuk tata letak halaman web',
    status: 'published',
    created_at: new Date('2026-02-15').toISOString()
  },
  {
    id: 'q-db-05',
    owner_id: 'teacher-siti-02',
    material_id: 'mat-db-04',
    category: 'Basis Data',
    difficulty: 'Sedang',
    question_type: 'multiple_choice',
    question_text: 'Perintah SQL manakah yang benar untuk mengambil data siswa yang memiliki nilai lebih besar atau sama dengan 80 secara terurut dari nilai tertinggi ke terendah?',
    options: [
      'SELECT * FROM siswa WHERE nilai >= 80 GROUP BY nilai;',
      'SELECT * FROM siswa WHERE nilai >= 80 ORDER BY nilai DESC;',
      'SELECT * FROM siswa HAVING nilai >= 80 SORT BY nilai ASC;',
      'SELECT * FROM siswa WHERE nilai > 80 ORDER BY nilai ASC;'
    ],
    correct_answer: 1, // index 1
    explanation: 'Klausa WHERE digunakan untuk memfilter nilai >= 80, dan klausa ORDER BY nilai DESC mengurutkan hasil dari yang terbesar ke terkecil (descending).',
    competency: 'Menulis query SELECT dengan klausa WHERE dan ORDER BY',
    status: 'published',
    created_at: new Date('2026-02-18').toISOString()
  },
  {
    id: 'q-sec-06',
    owner_id: 'teacher-fauzi-01',
    material_id: 'mat-sec-05',
    category: 'Keamanan Digital',
    difficulty: 'Mudah',
    question_type: 'multiple_choice',
    question_text: 'Dalam prinsip CIA Triad, pilar yang memastikan bahwa data tidak dapat diubah atau dimanipulasi oleh pihak yang tidak sah disebut...',
    options: ['Confidentiality', 'Integrity', 'Availability', 'Authentication'],
    correct_answer: 1, // index 1 -> Integrity
    explanation: 'Integrity (Integritas) menjamin bahwa data tetap utuh, akurat, dan tidak mengalami modifikasi tidak sah selama transmisi maupun penyimpanan.',
    competency: 'Menjelaskan komponen CIA Triad dalam keamanan informasi',
    status: 'published',
    created_at: new Date('2026-02-20').toISOString()
  }
];

export const INITIAL_QUIZZES = [
  {
    id: 'quiz-jaringan-dasar',
    owner_id: 'teacher-fauzi-01',
    title: 'Kuis Pemahaman Jaringan Komputer & Subnetting IP',
    description: 'Uji kemampuan kamu dalam menghitung notasi CIDR, subnet mask, dan menentukan network address pada jaringan IPv4.',
    category: 'Jaringan Komputer',
    difficulty: 'Menengah',
    status: 'published',
    question_ids: ['q-net-01', 'q-net-02'],
    created_at: new Date('2026-02-10').toISOString()
  },
  {
    id: 'quiz-informatika-komprehensif',
    owner_id: 'teacher-siti-02',
    title: 'Latihan Terpadu Informatika SMK (Algoritma, Web & Database)',
    description: 'Latihan mandiri mencakup berpikir komputasional, styling flexbox web, query SQL, dan prinsip keamanan digital CIA Triad.',
    category: 'Berpikir Komputasional',
    difficulty: 'Menengah',
    status: 'published',
    question_ids: ['q-algo-03', 'q-web-04', 'q-db-05', 'q-sec-06'],
    created_at: new Date('2026-02-18').toISOString()
  }
];
