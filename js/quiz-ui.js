/**
 * INFORA — Quiz & Practice UI Component for Chat
 * Allows students to solve quizzes directly inside chat bubbles without navigating away.
 */

import { escapeHtml } from './utils.js';
import { fetchPublicQuizzes, fetchQuizDetail, submitQuizAnswers } from './chat-api.js';

export class QuizController {
  constructor(chatUiInstance) {
    this.chatUi = chatUiInstance;
    this.activeQuiz = null;
    this.userAnswers = {};
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
      const result = await submitQuizAnswers(quiz.id, this.userAnswers);

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
      const percentage = Math.round((result.score / result.total) * 100);
      let summaryText = `### 📊 Hasil Latihan: ${quiz.title}\n`;
      summaryText += `- **Skor kamu:** ${result.score} / ${result.total} (${percentage}%)\n`;
      summaryText += `- **Jumlah Benar:** ${result.correct_count} dari ${result.total} soal\n\n`;

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
