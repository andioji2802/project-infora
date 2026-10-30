/**
 * INFORA — Teacher Question Bank Management Module
 * Create, edit, and manage questions (multiple choice, true/false, short answer, case study).
 */

import { getAuthToken } from './auth.js';
import { escapeHtml, showToast } from './utils.js';
import { validateQuestionForm } from './validation.js';

export class TeacherQuestionsManager {
  constructor(appContext) {
    this.ctx = appContext;
    this.questions = [];
  }

  async loadQuestions() {
    try {
      const token = getAuthToken();
      const res = await fetch('/api/questions', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Gagal memuat bank soal');
      this.questions = await res.json();
      this.render();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  render() {
    const container = document.getElementById('questions-table-body');
    if (!container) return;

    if (this.questions.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="6">
            <div class="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
              <h3>Belum ada soal dalam bank soal</h3>
              <p>Buat soal pilihan ganda atau latihan untuk diuji kepada siswa SMK.</p>
              <button class="btn btn-primary btn-sm btn-create-q-empty">➕ Buat Soal Baru</button>
            </div>
          </td>
        </tr>
      `;
      const btn = container.querySelector('.btn-create-q-empty');
      if (btn) btn.addEventListener('click', () => this.openQuestionModal());
      return;
    }

    container.innerHTML = this.questions.map((q, idx) => {
      const isOwner = q.owner_id === this.ctx.user?.id;
      return `
        <tr>
          <td>
            <div style="font-weight: 600; color: var(--color-text-main); max-width: 380px;">${escapeHtml(q.question_text)}</div>
            <div style="font-size:0.76rem; color:var(--color-text-secondary); margin-top:2px;">
              ${(q.options || []).length} Pilihan • Kunci: <strong>${q.question_type === 'multiple_choice' ? String.fromCharCode(65 + Number(q.correct_answer)) : escapeHtml(String(q.correct_answer))}</strong>
            </div>
          </td>
          <td><span class="badge badge-cat">${escapeHtml(q.category)}</span></td>
          <td><span class="badge badge-draft">${escapeHtml(q.difficulty || 'Sedang')}</span></td>
          <td><span style="font-size:0.82rem;">${q.question_type === 'multiple_choice' ? 'Pilihan Ganda' : escapeHtml(q.question_type)}</span></td>
          <td><span class="badge badge-published">Aktif</span></td>
          <td>
            <div class="table-actions">
              ${isOwner ? `
                <button class="btn-icon btn-edit-q" title="Edit Soal" data-id="${q.id}">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
                <button class="btn-icon danger btn-delete-q" title="Hapus Soal" data-id="${q.id}">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
              ` : `
                <span style="font-size:0.72rem; color:var(--color-text-muted);">(Milik Guru Lain)</span>
              `}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    this.bindActions();
  }

  bindActions() {
    document.querySelectorAll('.btn-edit-q').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const q = this.questions.find(x => x.id === id);
        if (q) this.openQuestionModal(q);
      });
    });

    document.querySelectorAll('.btn-delete-q').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        if (confirm('Yakin ingin menghapus soal ini dari bank soal?')) {
          await this.deleteQuestion(id);
        }
      });
    });
  }

  openQuestionModal(question = null) {
    const isEdit = !!question;
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';

    const defaultOptions = question?.options || ['', '', '', ''];

    modal.innerHTML = `
      <div class="modal-content" style="max-width: 720px;">
        <div class="modal-header">
          <h2 class="modal-title">${isEdit ? 'Edit Soal Informatika' : 'Buat Soal Baru'}</h2>
          <button type="button" class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <form id="question-form">
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:14px;">
              <div class="form-group">
                <label class="form-label">Kategori Materi <span class="req">*</span></label>
                <select class="form-select" id="q-category" required>
                  <option value="Jaringan Komputer" ${question?.category === 'Jaringan Komputer' ? 'selected' : ''}>Jaringan Komputer</option>
                  <option value="Pemrograman" ${question?.category === 'Pemrograman' ? 'selected' : ''}>Pemrograman</option>
                  <option value="Pengembangan Web" ${question?.category === 'Pengembangan Web' ? 'selected' : ''}>Pengembangan Web</option>
                  <option value="Basis Data" ${question?.category === 'Basis Data' ? 'selected' : ''}>Basis Data</option>
                  <option value="Sistem Komputer" ${question?.category === 'Sistem Komputer' ? 'selected' : ''}>Sistem Komputer</option>
                  <option value="Keamanan Digital" ${question?.category === 'Keamanan Digital' ? 'selected' : ''}>Keamanan Digital</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Tingkat Kesulitan</label>
                <select class="form-select" id="q-difficulty">
                  <option value="Mudah" ${question?.difficulty === 'Mudah' ? 'selected' : ''}>Mudah</option>
                  <option value="Sedang" ${question?.difficulty === 'Sedang' ? 'selected' : ''}>Sedang</option>
                  <option value="Sulit" ${question?.difficulty === 'Sulit' ? 'selected' : ''}>Sulit (HOTS)</option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Teks Pertanyaan <span class="req">*</span></label>
              <textarea class="form-textarea" style="min-height: 80px;" id="q-text" placeholder="Tuliskan pertanyaan soal..." required>${escapeHtml(question?.question_text || '')}</textarea>
            </div>

            <div class="form-group">
              <label class="form-label">Pilihan Jawaban (A, B, C, D) & Tentukan Kunci Jawaban <span class="req">*</span></label>
              <div id="options-container" style="display:flex; flex-direction:column; gap:8px;">
                ${defaultOptions.map((opt, idx) => `
                  <div style="display:flex; align-items:center; gap:8px;">
                    <input type="radio" name="correct_opt" value="${idx}" ${Number(question?.correct_answer) === idx ? 'checked' : (idx === 0 && !question ? 'checked' : '')} title="Pilih sebagai kunci jawaban" />
                    <span style="font-weight:700; width:22px;">${String.fromCharCode(65 + idx)}.</span>
                    <input type="text" class="form-input q-opt-input" data-idx="${idx}" value="${escapeHtml(opt)}" placeholder="Opsi ${String.fromCharCode(65 + idx)}" required />
                  </div>
                `).join('')}
              </div>
              <span class="form-help">Pilih tombol radio di sebelah kiri opsi yang merupakan kunci jawaban yang benar.</span>
            </div>

            <div class="form-group">
              <label class="form-label">Pembahasan Lengkap Guru <span class="req">*</span></label>
              <textarea class="form-textarea" style="min-height: 80px;" id="q-explanation" placeholder="Jelaskan mengapa kunci jawaban tersebut benar dan konsep dasar yang melatarbelakanginya...">${escapeHtml(question?.explanation || '')}</textarea>
            </div>

            <div class="form-group">
              <label class="form-label">Indikator Kompetensi</label>
              <input type="text" class="form-input" id="q-competency" value="${escapeHtml(question?.competency || '')}" placeholder="Contoh: Menganalisis konfigurasi IP Address dan subnet mask /24" />
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline modal-cancel">Batal</button>
          <button type="button" class="btn btn-primary" id="btn-save-q">💾 Simpan Soal</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector('.modal-close').addEventListener('click', close);
    modal.querySelector('.modal-cancel').addEventListener('click', close);

    modal.querySelector('#btn-save-q').addEventListener('click', async () => {
      const optInputs = modal.querySelectorAll('.q-opt-input');
      const options = Array.from(optInputs).map(inp => inp.value.trim());
      const selectedRadio = modal.querySelector('input[name="correct_opt"]:checked');
      const correctAnswer = selectedRadio ? parseInt(selectedRadio.value, 10) : 0;

      const payload = {
        question_text: modal.querySelector('#q-text').value.trim(),
        category: modal.querySelector('#q-category').value,
        difficulty: modal.querySelector('#q-difficulty').value,
        question_type: 'multiple_choice',
        options,
        correct_answer: correctAnswer,
        explanation: modal.querySelector('#q-explanation').value.trim(),
        competency: modal.querySelector('#q-competency').value.trim(),
        status: 'published'
      };

      const val = validateQuestionForm(payload);
      if (!val.isValid) {
        showToast(Object.values(val.errors)[0], 'error');
        return;
      }

      await this.saveQuestion(payload, question?.id);
      close();
    });
  }

  async saveQuestion(data, questionId = null) {
    try {
      const token = getAuthToken();
      const url = questionId ? `/api/questions/${questionId}` : '/api/questions';
      const method = questionId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Gagal menyimpan soal');

      showToast(questionId ? 'Soal berhasil diperbarui!' : 'Soal baru berhasil ditambahkan ke bank soal!', 'success');
      await this.loadQuestions();
      this.ctx.refreshStats();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async deleteQuestion(id) {
    try {
      const token = getAuthToken();
      const res = await fetch(`/api/questions/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Gagal menghapus soal');

      showToast('Soal berhasil dihapus', 'success');
      await this.loadQuestions();
      this.ctx.refreshStats();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
}
