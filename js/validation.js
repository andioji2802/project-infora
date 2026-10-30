/**
 * INFORA — Validation Module
 * Client-side validation routines for chat inputs, teacher registration, materials, and questions.
 */

export function validateChatMessage(text) {
  if (!text || typeof text !== 'string') {
    return { valid: false, error: 'Pesan tidak boleh kosong.' };
  }
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Pesan tidak boleh hanya berisi spasi.' };
  }
  if (trimmed.length > 2000) {
    return { valid: false, error: 'Pesan terlalu panjang (maksimal 2000 karakter).' };
  }
  return { valid: true, value: trimmed };
}

export function validateTeacherRegistration(data) {
  const errors = {};

  if (!data.fullName || data.fullName.trim().length < 3) {
    errors.fullName = 'Nama lengkap minimal 3 karakter.';
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!data.email || !emailRegex.test(data.email.trim())) {
    errors.email = 'Format email tidak valid.';
  }

  if (!data.password || data.password.length < 6) {
    errors.password = 'Kata sandi minimal 6 karakter.';
  }

  if (data.password !== data.confirmPassword) {
    errors.confirmPassword = 'Konfirmasi kata sandi tidak cocok.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

export function validateTeacherLogin(data) {
  const errors = {};
  if (!data.email || !data.email.trim()) {
    errors.email = 'Email wajib diisi.';
  }
  if (!data.password) {
    errors.password = 'Kata sandi wajib diisi.';
  }
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

export function validateMaterialForm(data) {
  const errors = {};
  if (!data.title || data.title.trim().length < 4) {
    errors.title = 'Judul materi minimal 4 karakter.';
  }
  if (!data.category || !data.category.trim()) {
    errors.category = 'Kategori materi wajib dipilih.';
  }
  if (!data.content || data.content.trim().length < 30) {
    errors.content = 'Isi materi pembelajaran minimal 30 karakter agar dapat diproses oleh RAG.';
  }
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

export function validateQuestionForm(data) {
  const errors = {};
  if (!data.question_text || data.question_text.trim().length < 10) {
    errors.question_text = 'Teks pertanyaan minimal 10 karakter.';
  }
  if (!data.category || !data.category.trim()) {
    errors.category = 'Kategori soal wajib dipilih.';
  }
  if (data.question_type === 'multiple_choice') {
    if (!data.options || !Array.isArray(data.options) || data.options.length < 2) {
      errors.options = 'Pilihan ganda harus memiliki minimal 2 opsi jawaban.';
    } else {
      const emptyOpt = data.options.some(opt => !opt || !opt.trim());
      if (emptyOpt) {
        errors.options = 'Semua opsi pilihan ganda harus terisi.';
      }
    }
  }
  if (data.correct_answer === undefined || data.correct_answer === null || data.correct_answer === '') {
    errors.correct_answer = 'Kunci jawaban wajib ditentukan.';
  }
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}
