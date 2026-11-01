/**
 * INFORA — Teacher Quiz Package Management Module
 * Create, edit, and bundle exercises & quizzes for students to access via chat.
 */

import { getAuthToken } from './auth.js';
import { escapeHtml, showToast } from './utils.js';
import { apiUrl } from './api-config.js';

export class TeacherQuizzesManager {
  constructor(appContext) {
    this.ctx = appContext;
    this.quizzes = [];
  }

  async loadQuizzes() {
    try {
      const token = getAuthToken();
      const res = await fetch(apiUrl('/api/quizzes'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Gagal memuat paket kuis');
      this.quizzes = await res.json();
      this.render();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  render() {
    const container = document.getElementById('quizzes-table-body');
    if (!container) return;

    if (this.quizzes.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="6">
            <div class="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
              <h3>Belum ada paket kuis dibuat</h3>
              <p>Gabungkan beberapa soal dari bank soal menjadi paket kuis untuk dikerjakan siswa di chatbot.</p>
              <button class="btn btn-primary btn-sm btn-create-quiz-empty">➕ Buat Paket Kuis Baru</button>
            </div>
          </td>
        </tr>
      `;
      const btn = container.querySelector('.btn-create-quiz-empty');
      if (btn) btn.addEventListener('click', () => this.openQuizModal());
      return;
    }

    container.innerHTML = this.quizzes.map(q => {
      const isOwner = q.owner_id === this.ctx.user?.id;
      const count = (q.questions || []).length;
      return `
        <tr>
          <td>
            <div style="font-weight: 700; color: var(--color-text-main);">${escapeHtml(q.title)}</div>
            <div style="font-size:0.76rem; color:var(--color-text-secondary);">${escapeHtml(q.description || 'Tidak ada deskripsi')}</div>
          </td>
          <td><span class="badge badge-cat">${escapeHtml(q.category)}</span></td>
          <td><span class="badge badge-draft">${escapeHtml(q.difficulty || 'Sedang')}</span></td>
          <td>
            <span style="font-weight:600; color:var(--color-success-dark);">${count} Soal Terpilih</span>
          </td>
          <td><span class="badge badge-published">Diterbitkan</span></td>
          <td>
            <div class="table-actions">
              ${isOwner ? `
                <button class="btn-icon btn-edit-quiz" title="Edit Kuis" data-id="${q.id}">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
                <button class="btn-icon btn-results-quiz" title="Lihat Hasil" data-id="${q.id}">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"></path><path d="M7 16v-5"></path><path d="M12 16V8"></path><path d="M17 16v-7"></path></svg>
                </button>
                <button class="btn-icon danger btn-delete-quiz" title="Hapus Kuis" data-id="${q.id}">
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
    document.querySelectorAll('.btn-results-quiz').forEach(btn => {
      btn.addEventListener('click', () => this.openResultsModal(btn.getAttribute('data-id')));
    });
    document.querySelectorAll('.btn-edit-quiz').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const q = this.quizzes.find(x => x.id === id);
        if (q) this.openQuizModal(q);
      });
    });

    document.querySelectorAll('.btn-delete-quiz').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        if (confirm('Yakin ingin menghapus paket kuis ini?')) {
          await this.deleteQuiz(id);
        }
      });
    });
  }

  async openResultsModal(quizId) {
    try {
      const token = getAuthToken();
      const res = await fetch(apiUrl(`/api/quizzes?id=${encodeURIComponent(quizId)}&results=true`), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memuat hasil kuis');

      const modal = document.createElement('div');
      modal.className = 'modal-backdrop';
      modal.innerHTML = `
        <div class="modal-content" style="max-width:920px;">
          <div class="modal-header">
            <h2 class="modal-title">Hasil Kuis: ${escapeHtml(data.quiz.title)}</h2>
            <button type="button" class="modal-close">&times;</button>
          </div>
          <div class="modal-body">
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px;">
              <div class="stat-card"><small>Jumlah Siswa</small><strong>${data.statistics.count}</strong></div>
              <div class="stat-card"><small>Nilai Tertinggi</small><strong>${data.statistics.highest}</strong></div>
              <div class="stat-card"><small>Nilai Terendah</small><strong>${data.statistics.lowest}</strong></div>
              <div class="stat-card"><small>Nilai Rata-rata</small><strong>${data.statistics.average}</strong></div>
            </div>
            <input id="quiz-results-search" class="form-input" placeholder="Cari nama atau NIS..." style="margin-bottom:10px;" />
            <div style="overflow-x:auto;">
              <table class="table" style="min-width:720px;">
                <thead><tr><th>Nama</th><th>NIS</th><th>Nilai</th><th>Benar</th><th>Salah</th><th>Waktu</th></tr></thead>
                <tbody id="quiz-results-body">
                  ${data.attempts.length ? data.attempts.map(attempt => `
                    <tr data-search="${escapeHtml(`${attempt.student_name} ${attempt.student_nis}`.toLowerCase())}">
                      <td>${escapeHtml(attempt.student_name)}</td>
                      <td>${escapeHtml(attempt.student_nis)}</td>
                      <td><strong>${attempt.score}</strong> / ${attempt.max_score}</td>
                      <td>${attempt.correct_count}</td>
                      <td>${attempt.wrong_count}</td>
                      <td>${escapeHtml(new Date(attempt.finished_at).toLocaleString('id-ID'))}</td>
                    </tr>
                  `).join('') : '<tr><td colspan="6">Belum ada siswa yang mengerjakan kuis ini.</td></tr>'}
                </tbody>
              </table>
            </div>
          </div>
          <div class="modal-footer"><button type="button" class="btn btn-outline modal-cancel">Tutup</button></div>
        </div>
      `;
      document.body.appendChild(modal);
      const close = () => modal.remove();
      modal.querySelector('.modal-close').addEventListener('click', close);
      modal.querySelector('.modal-cancel').addEventListener('click', close);
      modal.querySelector('#quiz-results-search').addEventListener('input', event => {
        const term = event.target.value.trim().toLowerCase();
        modal.querySelectorAll('#quiz-results-body tr[data-search]').forEach(row => {
          row.style.display = row.getAttribute('data-search').includes(term) ? '' : 'none';
        });
      });
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async openQuizModal(quiz = null) {
    const isEdit = !!quiz;
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';

    // Fetch available questions from question bank
    let availableQuestions = [];
    try {
      const token = getAuthToken();
      const res = await fetch(apiUrl('/api/questions'), { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) availableQuestions = await res.json();
    } catch (e) {}

    const selectedQIds = new Set((quiz?.questions || []).map(q => q.id));

    modal.innerHTML = `
      <div class="modal-content" style="max-width: 760px;">
        <div class="modal-header">
          <h2 class="modal-title">${isEdit ? 'Edit Paket Kuis & Latihan' : 'Buat Paket Kuis Baru'}</h2>
          <button type="button" class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <form id="quiz-form">
            <div style="display:grid; grid-template-columns: 2fr 1fr; gap:14px;">
              <div class="form-group">
                <label class="form-label">Judul Paket Kuis <span class="req">*</span></label>
                <input type="text" class="form-input" id="quiz-title" value="${escapeHtml(quiz?.title || '')}" placeholder="Contoh: Kuis Pemahaman Jaringan & Subnetting IP" required />
              </div>
              <div class="form-group">
                <label class="form-label">Kategori <span class="req">*</span></label>
                <select class="form-select" id="quiz-category">
                  <option value="Jaringan Komputer" ${quiz?.category === 'Jaringan Komputer' ? 'selected' : ''}>Jaringan Komputer</option>
                  <option value="Pemrograman" ${quiz?.category === 'Pemrograman' ? 'selected' : ''}>Pemrograman</option>
                  <option value="Pengembangan Web" ${quiz?.category === 'Pengembangan Web' ? 'selected' : ''}>Pengembangan Web</option>
                  <option value="Basis Data" ${quiz?.category === 'Basis Data' ? 'selected' : ''}>Basis Data</option>
                  <option value="Sistem Komputer" ${quiz?.category === 'Sistem Komputer' ? 'selected' : ''}>Sistem Komputer</option>
                </select>
              </div>
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:14px;">
              <div class="form-group">
                <label class="form-label">Tingkat Kesulitan</label>
                <select class="form-select" id="quiz-difficulty">
                  <option value="Dasar" ${quiz?.difficulty === 'Dasar' ? 'selected' : ''}>Dasar</option>
                  <option value="Menengah" ${quiz?.difficulty === 'Menengah' ? 'selected' : ''}>Menengah</option>
                  <option value="Mahir" ${quiz?.difficulty === 'Mahir' ? 'selected' : ''}>Mahir / HOTS</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Status</label>
                <select class="form-select" id="quiz-status">
                  <option value="published" ${quiz?.status !== 'draft' ? 'selected' : ''}>Diterbitkan (Dapat diakses Siswa)</option>
                  <option value="draft" ${quiz?.status === 'draft' ? 'selected' : ''}>Draf</option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Deskripsi / Petunjuk Pengerjaan</label>
              <textarea class="form-textarea" style="min-height: 60px;" id="quiz-desc" placeholder="Petunjuk pengerjaan bagi siswa...">${escapeHtml(quiz?.description || '')}</textarea>
            </div>

            <div style="display:grid;grid-template-columns:1fr auto;gap:12px;align-items:end;margin-bottom:10px;">
              <div class="form-group" style="margin-bottom:0;">
                <label class="form-label">Nilai Maksimum Kuis</label>
                <input type="number" class="form-input" id="quiz-max-score" min="1" max="1000" value="${escapeHtml(String(quiz?.max_score || 100))}" />
              </div>
              <button type="button" class="btn btn-outline" id="quiz-auto-rubric">Bagikan Bobot Otomatis</button>
            </div>

            <div class="form-group">
              <label class="form-label">Pilih Soal yang Dimasukkan ke Paket Kuis ini:</label>
              <div style="max-height: 220px; overflow-y: auto; border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 8px 12px; background: var(--color-surface);">
                ${availableQuestions.length === 0 ? '<p style="color:var(--color-text-secondary); font-size:0.85rem;">Bank soal kosong. Tambahkan soal terlebih dahulu di menu Kelola Soal.</p>' : availableQuestions.map(q => `
                  <label style="display:flex; align-items:flex-start; gap:10px; padding:6px 0; border-bottom:1px solid rgba(0,0,0,0.05); cursor:pointer;">
                    <input type="checkbox" class="quiz-q-checkbox" value="${q.id}" ${selectedQIds.has(q.id) ? 'checked' : ''} style="margin-top:3px;" />
                    <span style="font-size:0.86rem; color:var(--color-text-main);">
                      <strong>[${escapeHtml(q.category)}]</strong> ${escapeHtml(q.question_text)}
                    </span>
                    <input type="number" class="form-input quiz-q-point" data-question-id="${q.id}" min="0" max="1000" step="0.01" value="${escapeHtml(String(quiz?.rubric?.[q.id] ?? 0))}" title="Bobot soal" style="width:88px;margin-left:auto;" />
                  </label>
                `).join('')}
              </div>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline modal-cancel">Batal</button>
          <button type="button" class="btn btn-primary" id="btn-save-quiz">💾 Simpan Paket Kuis</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector('.modal-close').addEventListener('click', close);
    modal.querySelector('.modal-cancel').addEventListener('click', close);
    modal.querySelector('#quiz-auto-rubric').addEventListener('click', () => {
      const checked = Array.from(modal.querySelectorAll('.quiz-q-checkbox:checked'));
      const maxScore = Math.max(0, Number(modal.querySelector('#quiz-max-score').value) || 100);
      const point = checked.length ? Math.round((maxScore / checked.length) * 100) / 100 : 0;
      modal.querySelectorAll('.quiz-q-point').forEach((input, inputIndex) => {
        const selectedIndex = checked.findIndex(cb => cb.value === input.dataset.questionId);
        if (selectedIndex === -1) {
          input.value = '0';
        } else if (selectedIndex === checked.length - 1) {
          const prior = checked.slice(0, -1).reduce((sum, cb) => {
            return sum + Number(modal.querySelector(`.quiz-q-point[data-question-id="${CSS.escape(cb.value)}"]`)?.value || point);
          }, 0);
          input.value = String(Math.round((maxScore - prior) * 100) / 100);
        } else {
          input.value = String(point);
        }
      });
    });

    modal.querySelector('#btn-save-quiz').addEventListener('click', async () => {
      const checkedBoxes = modal.querySelectorAll('.quiz-q-checkbox:checked');
      const questionIds = Array.from(checkedBoxes).map(cb => cb.value);

      const title = modal.querySelector('#quiz-title').value.trim();
      if (!title) {
        showToast('Judul kuis wajib diisi', 'error');
        return;
      }
      if (questionIds.length === 0) {
        showToast('Pilih minimal 1 soal untuk dimasukkan ke kuis', 'error');
        return;
      }

      const payload = {
        title,
        category: modal.querySelector('#quiz-category').value,
        difficulty: modal.querySelector('#quiz-difficulty').value,
        status: modal.querySelector('#quiz-status').value,
        description: modal.querySelector('#quiz-desc').value.trim(),
        question_ids: questionIds,
        max_score: Math.max(1, Number(modal.querySelector('#quiz-max-score').value) || 100),
        rubric: Object.fromEntries(questionIds.map(id => [
          id,
          Math.max(0, Number(modal.querySelector(`.quiz-q-point[data-question-id="${CSS.escape(id)}"]`)?.value) || 0)
        ]))
      };

      await this.saveQuiz(payload, quiz?.id);
      close();
    });
  }

  async saveQuiz(data, quizId = null) {
    try {
      const token = getAuthToken();
      const url = quizId ? `/api/quizzes?id=${encodeURIComponent(quizId)}` : '/api/quizzes';
      const method = quizId ? 'PUT' : 'POST';

      const res = await fetch(apiUrl(url), {
        method,
        headers: {
          'Content-Type': 'text/plain;charset=UTF-8',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Gagal menyimpan kuis');

      showToast(quizId ? 'Paket kuis berhasil diperbarui!' : 'Paket kuis baru berhasil diterbitkan!', 'success');
      await this.loadQuizzes();
      this.ctx.refreshStats();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async deleteQuiz(id) {
    try {
      const token = getAuthToken();
      const res = await fetch(apiUrl(`/api/quizzes?id=${encodeURIComponent(id)}`), {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Gagal menghapus kuis');

      showToast('Paket kuis berhasil dihapus', 'success');
      await this.loadQuizzes();
      this.ctx.refreshStats();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
}
