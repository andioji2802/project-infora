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

  if (!data.teacherIdentifier || !data.teacherIdentifier.trim()) {
    errors.teacherIdentifier = 'NIP / ID Guru wajib diisi.';
  }

  const password = data.password || '';
  if (password.length < 8) {
    errors.password = 'Kata sandi minimal 8 karakter.';
  } else if (!/[A-Z]/.test(password)) {
    errors.password = 'Kata sandi harus memiliki huruf besar.';
  } else if (!/[a-z]/.test(password)) {
    errors.password = 'Kata sandi harus memiliki huruf kecil.';
  } else if (!/[0-9]/.test(password)) {
    errors.password = 'Kata sandi harus memiliki angka.';
  } else if (!/[^A-Za-z0-9]/.test(password)) {
    errors.password = 'Kata sandi harus memiliki simbol.';
  }

  if (data.password !== data.confirmPassword) {
    errors.confirmPassword = 'Konfirmasi kata sandi tidak cocok.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

export function validatePasswordReset(password) {
  const rules = {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password)
  };
  return {
    isValid: Object.values(rules).every(Boolean),
    rules
  };
}

export function validateTeacherLogin(data) {
  const errors = {};
  if (!data.nip || !data.nip.trim()) {
    errors.nip = 'NIP / ID Guru wajib diisi.';
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
