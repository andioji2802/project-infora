-- ====================================================================
-- INFORA — MIGRATION 004: SEED CONTENT FOR INFORMATIKA SMK
-- Seed curriculum units, initial question bank, and quizzes
-- ====================================================================

-- Insert sample teacher profile (UUID placeholder for demo)
DO $$
DECLARE
    teacher_id UUID := 'a0000000-0000-0000-0000-000000000001';
    mat_net_id UUID := 'b0000000-0000-0000-0000-000000000001';
    mat_algo_id UUID := 'b0000000-0000-0000-0000-000000000002';
    q_net_id UUID := 'c0000000-0000-0000-0000-000000000001';
    q_algo_id UUID := 'c0000000-0000-0000-0000-000000000002';
    quiz_id UUID := 'd0000000-0000-0000-0000-000000000001';
BEGIN
    -- Profiles
    INSERT INTO public.profiles (id, full_name, school_name, teacher_identifier, role)
    VALUES (
        teacher_id,
        'Drs. H. Ahmad Fauzi, M.Kom.',
        'SMK Negeri 1 Bidang Keahlian TKI',
        '197505122000031002',
        'teacher'
    ) ON CONFLICT (id) DO NOTHING;

    -- Materials
    INSERT INTO public.materials (
        id, owner_id, title, slug, category, grade_level,
        learning_objectives, summary, content, keywords, status
    ) VALUES (
        mat_net_id,
        teacher_id,
        'Jaringan Komputer: Subnetting IP Address dan Notasi CIDR',
        'jaringan-komputer-subnetting-ip-dan-cidr',
        'Jaringan Komputer',
        'Kelas XI SMK',
        'Siswa mampu memahami struktur IP Address v4 dan menghitung pembagian subnet menggunakan notasi CIDR.',
        'Subnetting adalah teknik memecah satu jaringan besar menjadi sub-jaringan yang lebih kecil dan efisien untuk mengoptimalkan alokasi IP Address.',
        'IPv4 terdiri dari 32 bit yang dibagi menjadi 4 oktet. Notasi CIDR menunjukkan bit network. Contoh /24 memiliki 254 host valid, sedangkan /26 memiliki 62 host valid.',
        'subnetting, cidr, ip address, ipv4, subnet mask, host valid',
        'published'
    ) ON CONFLICT (slug) DO NOTHING;

    INSERT INTO public.materials (
        id, owner_id, title, slug, category, grade_level,
        learning_objectives, summary, content, keywords, status
    ) VALUES (
        mat_algo_id,
        teacher_id,
        'Berpikir Komputasional dan Logika Algoritma Dasar',
        'berpikir-komputasional-dan-logika-algoritma-dasar',
        'Berpikir Komputasional',
        'Kelas X SMK',
        'Siswa mampu memahami empat pilar berpikir komputasional serta menulis algoritma dalam bentuk pseudocode dan flowchart.',
        'Berpikir komputasional adalah metode penyelesaian masalah menggunakan pendekatan dekomposisi, pengenalan pola, abstraksi, dan perancangan algoritma.',
        'Empat pilar: Dekomposisi, Pengenalan Pola, Abstraksi, dan Perancangan Algoritma. Struktur kontrol meliputi runtunan (sequence), percabangan (selection), dan perulangan (looping).',
        'berpikir komputasional, algoritma, dekomposisi, abstraksi, pseudocode, flowchart',
        'published'
    ) ON CONFLICT (slug) DO NOTHING;

    -- Questions
    INSERT INTO public.questions (
        id, owner_id, material_id, category, difficulty, question_type,
        question_text, options, correct_answer, explanation, competency, status
    ) VALUES (
        q_net_id,
        teacher_id,
        mat_net_id,
        'Jaringan Komputer',
        'Sedang',
        'multiple_choice',
        'Berapa jumlah host valid yang dapat digunakan pada subnet dengan notasi CIDR /26?',
        '["30 host", "62 host", "64 host", "126 host"]'::jsonb,
        '1'::jsonb,
        'Pada notasi /26 tersisa 6 bit host. Jumlah total alamat adalah 2^6 = 64. Dikurangi 2 untuk Network ID dan Broadcast ID menjadi 62 host valid.',
        'Menghitung jumlah host valid subnet CIDR',
        'published'
    ) ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.questions (
        id, owner_id, material_id, category, difficulty, question_type,
        question_text, options, correct_answer, explanation, competency, status
    ) VALUES (
        q_algo_id,
        teacher_id,
        mat_algo_id,
        'Berpikir Komputasional',
        'Mudah',
        'multiple_choice',
        'Pilar berpikir komputasional yang bertugas memecah masalah besar menjadi bagian-bagian yang lebih kecil dan mudah dikelola disebut...',
        '["Abstraksi", "Pengenalan Pola", "Dekomposisi", "Algoritma"]'::jsonb,
        '2'::jsonb,
        'Dekomposisi adalah teknik memecah masalah kompleks menjadi masalah-masalah kecil yang lebih sederhana.',
        'Mengidentifikasi pilar berpikir komputasional',
        'published'
    ) ON CONFLICT (id) DO NOTHING;

    -- Quizzes
    INSERT INTO public.quizzes (
        id, owner_id, title, description, category, difficulty, status
    ) VALUES (
        quiz_id,
        teacher_id,
        'Kuis Pemahaman Dasar Jaringan Komputer & Algoritma',
        'Latihan mandiri interaktif untuk menguji subnetting IP dan berpikir komputasional.',
        'Jaringan Komputer',
        'Menengah',
        'published'
    ) ON CONFLICT (id) DO NOTHING;

    -- Quiz Questions
    INSERT INTO public.quiz_questions (quiz_id, question_id, position, points)
    VALUES 
        (quiz_id, q_net_id, 1, 10),
        (quiz_id, q_algo_id, 2, 10)
    ON CONFLICT (quiz_id, question_id) DO NOTHING;
END $$;
