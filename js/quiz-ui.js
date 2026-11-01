/**
 * INFORA — Quiz & Practice UI Component for Chat
 * Allows students to solve quizzes directly inside chat bubbles without navigating away.
 */

import { escapeHtml } from './utils.js';
import { fetchPublicQuizzes, fetchQuizDetail, submitQuizAnswers } from './chat-api.js';

function cryptoRandomId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export class QuizController {
  constructor(chatUiInstance) {
    this.chatUi = chatUiInstance;
    this.activeQuiz = null;
    this.userAnswers = {};
    this.studentIdentity = null;
    this.startedAt = null;
    this.submissionKey = '';
  }

  async startQuizFlow(category = null) {
    try {
      this.chatUi.appendTypingIndicator();
      const quizzes = await fetchPublicQuizzes();
      this.chatUi.removeTypingIndicator();

      let targetQuizzes = quizzes;
      if (category) {
        targetQuizzes = quizzes.filter(q => q.category.toLowerCase().includes(category.toLowerCase()));
        if (targetQuizzes.length === 0) targetQuizzes = quizzes;
      }

      if (targetQuizzes.length === 0) {
        this.chatUi.appendBotMessage({
          text: 'Saat ini belum ada paket kuis atau latihan yang diterbitkan oleh Bapak/Ibu Guru. Kamu tetap bisa bertanya langsung seputar materi Informatika!',
          sources: []
        });
        return;
      }

      // If multiple, show choices
      const listHtml = targetQuizzes.slice(0, 4).map(q => `
        <button class="btn btn-outline btn-sm quiz-select-btn" data-quiz-id="${q.id}" style="text-align:left; justify-content: flex-start; margin-bottom: 6px; width: 100%;">
          🎯 <strong>${escapeHtml(q.title)}</strong> (${escapeHtml(q.category)} • ${escapeHtml(q.difficulty)})
        </button>
      `).join('');

      this.chatUi.appendBotMessage({
        text: `Silakan pilih paket latihan / kuis Informatika yang ingin kamu kerjakan:\n\n${listHtml}`,
        rawHtml: true
      });

      // Bind selection buttons
      setTimeout(() => {
        document.querySelectorAll('.quiz-select-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const qId = e.currentTarget.getAttribute('data-quiz-id');
            this.loadQuiz(qId);
          });
        });
      }, 100);

    } catch (err) {
      this.chatUi.removeTypingIndicator();
      this.chatUi.appendBotMessage({
        text: `Terjadi kendala saat memuat kuis: ${err.message}`,
        sources: []
      });
    }
  }

  async loadQuiz(quizId) {
    try {
      this.chatUi.appendTypingIndicator();
      const quiz = await fetchQuizDetail(quizId);
      this.chatUi.removeTypingIndicator();

      if (!quiz || !quiz.questions || quiz.questions.length === 0) {
        this.chatUi.appendBotMessage({
          text: 'Paket kuis ini belum memiliki daftar pertanyaan yang diterbitkan.',
          sources: []
        });
        return;
      }

      this.activeQuiz = quiz;
      this.userAnswers = {};
      const identity = await this.requestStudentIdentity(quiz);
      if (!identity) return;
      this.studentIdentity = identity;
      this.startedAt = new Date().toISOString();
      this.submissionKey = `${quiz.id}-${cryptoRandomId()}`;

      let questionsHtml = quiz.questions.map((q, idx) => {
        const optionsHtml = (q.options || []).map((opt, optIdx) => `
          <button type="button" class="quiz-option-btn" data-qid="${q.id}" data-idx="${optIdx}">
            <span style="font-weight:700; width:20px;">${String.fromCharCode(65 + optIdx)}.</span>
            <span>${escapeHtml(opt)}</span>
          </button>
        `).join('');

        return `
          <div class="quiz-card" id="quiz-card-${q.id}" data-qid="${q.id}">
            <span class="quiz-badge">Soal ${idx + 1} dari ${quiz.questions.length} • ${escapeHtml(q.difficulty || 'Sedang')}</span>
            <div class="quiz-question-text">${escapeHtml(q.question_text)}</div>
            <div class="quiz-options">
              ${optionsHtml}
            </div>
            <div class="quiz-feedback-box" id="feedback-${q.id}" style="display:none;"></div>
          </div>
        `;
      }).join('');

      const submitButtonHtml = `
        <div style="margin-top: 14px; text-align: right;">
          <button type="button" class="btn btn-success btn-submit-quiz" data-quiz-id="${quiz.id}">
            ✅ Kumpulkan & Periksa Jawaban
          </button>
        </div>
      `;

      this.chatUi.appendBotMessage({
        text: `### 📝 ${escapeHtml(quiz.title)}\n*${escapeHtml(quiz.description || '')}*\n\nKerjakan latihan berikut langsung di bawah ini:`,
        additionalHtml: questionsHtml + submitButtonHtml
      });

      this.bindQuizInteraction(quiz);

    } catch (err) {
      this.chatUi.removeTypingIndicator();
      this.chatUi.appendBotMessage({
        text: `Gagal membuka kuis: ${err.message}`
      });
    }
  }

  requestStudentIdentity(quiz) {
    return new Promise(resolve => {
      const modal = document.createElement('div');
      modal.className = 'modal-backdrop';
      modal.innerHTML = `
        <div class="modal-content" style="max-width:520px;">
          <div class="modal-header">
            <h2 class="modal-title">Identitas Sebelum Mengerjakan</h2>
          </div>
          <div class="modal-body">
            <p style="margin-bottom:14px;color:var(--color-text-secondary);">Isi identitas untuk menyimpan hasil kuis <strong>${escapeHtml(quiz.title)}</strong>.</p>
            <form id="student-identity-form">
              <div class="form-group">
                <label class="form-label">Nama Lengkap Siswa <span class="req">*</span></label>
                <input id="student-name" class="form-input" type="text" autocomplete="name" minlength="2" required placeholder="Masukkan nama lengkap" />
              </div>
              <div class="form-group">
                <label class="form-label">NIS (4-20 angka) <span class="req">*</span></label>
                <input id="student-nis" class="form-input" type="text" inputmode="numeric" pattern="[0-9]{4,20}" minlength="4" maxlength="20" required placeholder="Masukkan NIS" />
                <small id="student-identity-error" style="display:none;color:var(--color-danger,#c62828);"></small>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-primary" id="start-student-quiz">Mulai Kuis</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      const nameInput = modal.querySelector('#student-name');
      const nisInput = modal.querySelector('#student-nis');
      const error = modal.querySelector('#student-identity-error');
      modal.querySelector('#start-student-quiz').addEventListener('click', () => {
        const studentName = nameInput.value.trim().replace(/\s+/g, ' ');
        const studentNis = nisInput.value.trim();
        if (studentName.length < 2) {
          error.textContent = 'Nama lengkap wajib diisi.';
          error.style.display = 'block';
          nameInput.focus();
          return;
        }
        if (!/^\d{4,20}$/.test(studentNis)) {
          error.textContent = 'NIS wajib berisi 4-20 angka.';
          error.style.display = 'block';
          nisInput.focus();
          return;
        }
        modal.remove();
        resolve({ studentName, studentNis });
      });
      nameInput.focus();
    });
  }

  bindQuizInteraction(quiz) {
    // Option selection
    const cards = document.querySelectorAll(`[id^="quiz-card-"]`);
    cards.forEach(card => {
      const qid = card.getAttribute('data-qid');
      const optButtons = card.querySelectorAll('.quiz-option-btn');

      optButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          const optIdx = parseInt(btn.getAttribute('data-idx'), 10);
          this.userAnswers[qid] = optIdx;

          // Highlight selected
          optButtons.forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
        });
      });
    });

    // Submit button
    const submitBtn = document.querySelector(`.btn-submit-quiz[data-quiz-id="${quiz.id}"]`);
    if (submitBtn) {
      submitBtn.addEventListener('click', async () => {
        submitBtn.disabled = true;
        submitBtn.innerHTML = 'Memeriksa jawaban...';
        await this.handleGradeQuiz(quiz);
      });
    }
  }

  async handleGradeQuiz(quiz) {
    try {
      const result = await submitQuizAnswers(
        quiz.id,
        this.userAnswers,
        { ...this.studentIdentity, startedAt: this.startedAt },
        this.submissionKey
      );

      // Disable all option buttons
      document.querySelectorAll(`[id^="quiz-card-"] .quiz-option-btn`).forEach(b => {
        b.disabled = true;
      });

      // Show feedback per question
      result.results.forEach(res => {
        const feedbackBox = document.getElementById(`feedback-${res.question_id}`);
        const card = document.getElementById(`quiz-card-${res.question_id}`);
        if (!feedbackBox || !card) return;

        const optButtons = card.querySelectorAll('.quiz-option-btn');
        optButtons.forEach(btn => {
          const idx = parseInt(btn.getAttribute('data-idx'), 10);
          if (idx === res.correct_answer) {
            btn.classList.add('correct');
          } else if (idx === res.user_answer && !res.is_correct) {
            btn.classList.add('incorrect');
          }
        });

        feedbackBox.style.display = 'block';
        feedbackBox.className = `quiz-feedback ${res.is_correct ? 'success' : 'error'}`;
        feedbackBox.innerHTML = `
          <strong>${res.is_correct ? '🎉 Jawaban Tepat!' : '❌ Jawaban Kurang Tepat'}</strong>
          <p style="margin-top:4px;">${escapeHtml(res.explanation || 'Pembahasan telah disediakan guru.')}</p>
        `;
      });

      // Update submit button text
      const submitBtn = document.querySelector(`.btn-submit-quiz[data-quiz-id="${quiz.id}"]`);
      if (submitBtn) {
        submitBtn.innerHTML = '✅ Selesai Dinilai';
      }

      // Append summary message
      const maxScore = Number(result.max_score) || 100;
      const percentage = maxScore ? Math.round((Number(result.score) / maxScore) * 100) : 0;
      let summaryText = `### 📊 Hasil Latihan: ${quiz.title}\n`;
      summaryText += `- **Nama:** ${escapeHtml(result.student_name || this.studentIdentity.studentName)}\n`;
      summaryText += `- **NIS:** ${escapeHtml(result.student_nis || this.studentIdentity.studentNis)}\n`;
      summaryText += `- **Nilai akhir:** ${result.score} / ${maxScore} (${percentage}%)\n`;
      summaryText += `- **Jumlah Benar:** ${result.correct_count} dari ${result.total} soal\n\n`;
      summaryText += `- **Jumlah Salah:** ${Number(result.wrong_count ?? (result.total - result.correct_count))} dari ${result.total} soal\n\n`;

      if (percentage >= 80) {
        summaryText += `Luar biasa! Pemahaman kamu terhadap topik ini sudah sangat matang. Mau lanjut ke topik lainnya? 🚀`;
      } else if (percentage >= 60) {
        summaryText += `Bagus! Pemahaman dasar kamu sudah cukup baik. Coba pelajari kembali pembahasan pada soal yang belum tepat, atau tanyakan konsepnya ke saya!`;
      } else {
        summaryText += `Tetap semangat! Jangan berkecil hati. Kamu bisa bertanya konsep materi ini ke saya agar lebih paham, lalu coba latihan lagi.`;
      }

      this.chatUi.appendBotMessage({
        text: summaryText,
        followups: [
          'Jelaskan materi yang salah di kuis tadi',
          'Latihan soal lainnya',
          'Tanya konsep Informatika'
        ]
      });

    } catch (err) {
      this.chatUi.appendBotMessage({
        text: `Terjadi kendala saat memeriksa jawaban kuis: ${err.message}`
      });
    }
  }
}
