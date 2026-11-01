/**
 * INFORA — Teacher Materials Management Module
 * Handles CRUD operations, searching, filtering, import/export, and previewing learning materials.
 */

import { getAuthToken } from './auth.js';
import { escapeHtml, showToast, renderSafeMarkdown } from './utils.js';
import { validateMaterialForm } from './validation.js';
import { apiUrl } from './api-config.js';

export class TeacherMaterialsManager {
  constructor(appContext) {
    this.ctx = appContext;
    this.materials = [];
    this.currentFilter = { category: '', search: '', status: '' };
  }

  async loadMaterials() {
    try {
      const token = getAuthToken();
      const res = await fetch(apiUrl('/api/materials'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Gagal memuat materi');
      this.materials = await res.json();
      this.render();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  render() {
    const container = document.getElementById('materials-table-body');
    if (!container) return;

    let filtered = this.materials.filter(m => {
      const matchCat = !this.currentFilter.category || m.category === this.currentFilter.category;
      const matchStatus = !this.currentFilter.status || m.status === this.currentFilter.status;
      const matchSearch = !this.currentFilter.search || 
        m.title.toLowerCase().includes(this.currentFilter.search.toLowerCase()) ||
        (m.summary && m.summary.toLowerCase().includes(this.currentFilter.search.toLowerCase())) ||
        (m.keywords && m.keywords.toLowerCase().includes(this.currentFilter.search.toLowerCase()));
      return matchCat && matchStatus && matchSearch;
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="6">
            <div class="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
              <h3>Belum ada materi ditemukan</h3>
              <p>Mulai tambahkan materi pembelajaran Informatika SMK untuk diindeks oleh sistem RAG INFORA.</p>
              <button class="btn btn-primary btn-sm btn-create-material-empty">➕ Tambah Materi Baru</button>
            </div>
          </td>
        </tr>
      `;
      const emptyBtn = container.querySelector('.btn-create-material-empty');
      if (emptyBtn) emptyBtn.addEventListener('click', () => this.openMaterialModal());
      return;
    }

    container.innerHTML = filtered.map(m => {
      const statusBadge = m.status === 'published' 
        ? `<span class="badge badge-published">Diterbitkan</span>`
        : m.status === 'draft'
        ? `<span class="badge badge-draft">Draf</span>`
        : `<span class="badge badge-archived">Diarsipkan</span>`;

      const chunkCount = m.chunk_count || 0;
      const isOwner = m.owner_id === this.ctx.user?.id;

      return `
        <tr data-id="${m.id}">
          <td>
            <div style="font-weight: 700; color: var(--color-text-main);">${escapeHtml(m.title)}</div>
            <div style="font-size: 0.76rem; color: var(--color-text-secondary);">${escapeHtml(m.grade_level || 'Kelas X SMK')} • Slug: <code>${escapeHtml(m.slug || '-')}</code></div>
          </td>
          <td><span class="badge badge-cat">${escapeHtml(m.category)}</span></td>
          <td>${statusBadge}</td>
          <td>
            <span style="font-weight: 600; color: var(--color-success-dark);">${chunkCount} Chunks</span>
            <span style="font-size:0.74rem; display:block; color:var(--color-text-muted);">pgvector siap</span>
          </td>
          <td>
            <div style="font-size: 0.8rem; color: var(--color-text-secondary);">
              ${new Date(m.updated_at || m.created_at).toLocaleDateString('id-ID')}
            </div>
          </td>
          <td>
            <div class="table-actions">
              <button class="btn-icon btn-preview-mat" title="Lihat Pratinjau" data-id="${m.id}">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              </button>
              ${isOwner ? `
                <button class="btn-icon btn-edit-mat" title="Edit Materi" data-id="${m.id}">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
                <button class="btn-icon danger btn-delete-mat" title="Hapus Materi" data-id="${m.id}">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
              ` : `
                <span style="font-size: 0.72rem; color: var(--color-text-muted);">(Milik Guru Lain)</span>
              `}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    this.bindTableActions();
  }

  bindTableActions() {
    document.querySelectorAll('.btn-preview-mat').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const mat = this.materials.find(m => m.id === id);
        if (mat) this.openPreviewModal(mat);
      });
    });

    document.querySelectorAll('.btn-edit-mat').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const mat = this.materials.find(m => m.id === id);
        if (mat) this.openMaterialModal(mat);
      });
    });

    document.querySelectorAll('.btn-delete-mat').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const mat = this.materials.find(m => m.id === id);
        if (!mat) return;
        if (confirm(`Yakin ingin menghapus materi "${mat.title}"? Semua potongan embedding RAG materi ini juga akan dihapus dari pencarian siswa.`)) {
          await this.deleteMaterial(id);
        }
      });
    });
  }

  openMaterialModal(material = null) {
    const isEdit = !!material;
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.id = 'material-modal';

    modal.innerHTML = `
      <div class="modal-content" style="max-width: 820px;">
        <div class="modal-header">
          <h2 class="modal-title">${isEdit ? 'Edit Materi Pembelajaran' : 'Tambah Materi Pembelajaran Baru'}</h2>
          <button type="button" class="modal-close" id="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <form id="material-form">
            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 14px;">
              <div class="form-group">
                <label class="form-label">Judul Materi <span class="req">*</span></label>
                <input type="text" class="form-input" id="mat-title" value="${escapeHtml(material?.title || '')}" placeholder="Contoh: Jaringan Komputer dan Subnetting IP Address" required />
              </div>
              <div class="form-group">
                <label class="form-label">Kategori <span class="req">*</span></label>
                <select class="form-select" id="mat-category" required>
                  <option value="Jaringan Komputer" ${material?.category === 'Jaringan Komputer' ? 'selected' : ''}>Jaringan Komputer</option>
                  <option value="Pemrograman" ${material?.category === 'Pemrograman' ? 'selected' : ''}>Pemrograman</option>
                  <option value="Pengembangan Web" ${material?.category === 'Pengembangan Web' ? 'selected' : ''}>Pengembangan Web</option>
                  <option value="Basis Data" ${material?.category === 'Basis Data' ? 'selected' : ''}>Basis Data</option>
                  <option value="Sistem Komputer" ${material?.category === 'Sistem Komputer' ? 'selected' : ''}>Sistem Komputer</option>
                  <option value="Keamanan Digital" ${material?.category === 'Keamanan Digital' ? 'selected' : ''}>Keamanan Digital</option>
                  <option value="Berpikir Komputasional" ${material?.category === 'Berpikir Komputasional' ? 'selected' : ''}>Berpikir Komputasional</option>
                  <option value="Kecerdasan Buatan (AI)" ${material?.category === 'Kecerdasan Buatan (AI)' ? 'selected' : ''}>Kecerdasan Buatan (AI)</option>
                  <option value="Internet of Things (IoT)" ${material?.category === 'Internet of Things (IoT)' ? 'selected' : ''}>Internet of Things (IoT)</option>
                  <option value="Analisis Data" ${material?.category === 'Analisis Data' ? 'selected' : ''}>Analisis Data</option>
                </select>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
              <div class="form-group">
                <label class="form-label">Jenjang Kelas</label>
                <select class="form-select" id="mat-grade">
                  <option value="Kelas X SMK" ${material?.grade_level === 'Kelas X SMK' ? 'selected' : ''}>Kelas X SMK</option>
                  <option value="Kelas XI SMK" ${material?.grade_level === 'Kelas XI SMK' ? 'selected' : ''}>Kelas XI SMK</option>
                  <option value="Kelas XII SMK" ${material?.grade_level === 'Kelas XII SMK' ? 'selected' : ''}>Kelas XII SMK</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Status Publikasi</label>
                <select class="form-select" id="mat-status">
                  <option value="published" ${material?.status === 'published' ? 'selected' : ''}>Diterbitkan (Tersedia untuk Siswa & RAG)</option>
                  <option value="draft" ${material?.status === 'draft' ? 'selected' : ''}>Draf (Hanya Guru Pemilik)</option>
                  <option value="archived" ${material?.status === 'archived' ? 'selected' : ''}>Diarsipkan</option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Tujuan Pembelajaran</label>
              <textarea class="form-textarea" style="min-height: 60px;" id="mat-objectives" placeholder="Contoh: Siswa mampu menghitung subnet mask dan mendesain pembagian IP address">${escapeHtml(material?.learning_objectives || '')}</textarea>
            </div>

            <div class="form-group">
              <label class="form-label">Ringkasan Materi Singkat</label>
              <textarea class="form-textarea" style="min-height: 60px;" id="mat-summary" placeholder="Ringkasan singkat 2-3 kalimat...">${escapeHtml(material?.summary || '')}</textarea>
            </div>

            <div class="form-group">
              <label class="form-label">Isi Materi Lengkap (Format Markdown Didukung) <span class="req">*</span></label>
              <textarea class="form-textarea" style="min-height: 200px; font-family: var(--font-mono); font-size: 0.9rem;" id="mat-content" placeholder="Tulis materi pembelajaran, penjelasan konsep, blok kode, daftar poin, dan langkah teknis..." required>${escapeHtml(material?.content || '')}</textarea>
              <span class="form-help">Materi ini akan dipecah otomatis menjadi potongan teks (chunks) dan dikonversi ke vektor embedding pgvector saat diterbitkan.</span>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
              <div class="form-group">
                <label class="form-label">Kata Kunci (Dipisahkan koma)</label>
                <input type="text" class="form-input" id="mat-keywords" value="${escapeHtml(material?.keywords || '')}" placeholder="subnetting, CIDR, netmask, IP, router" />
              </div>
              <div class="form-group">
                <label class="form-label">Contoh & Langkah Praktik</label>
                <textarea class="form-textarea" style="min-height: 60px;" id="mat-practice" placeholder="Langkah konfigurasi atau contoh soal...">${escapeHtml(material?.practice_steps || '')}</textarea>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Miskonsepsi Umum & FAQ Siswa</label>
              <textarea class="form-textarea" style="min-height: 60px;" id="mat-faq" placeholder="Kesalahan yang sering dilakukan siswa dan solusinya...">${escapeHtml(material?.faq || '')}</textarea>
            </div>

            <div class="form-group">
              <label class="form-label">Sumber & Referensi Guru</label>
              <input type="text" class="form-input" id="mat-references" value="${escapeHtml(material?.references || '')}" placeholder="Contoh: Modul Ajar Informatika Kemdikbud, Dokumentasi Cisco" />
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline" id="btn-cancel-mat">Batal</button>
          <button type="button" class="btn btn-primary" id="btn-save-mat">
            ${isEdit ? '💾 Simpan Perubahan' : '➕ Terbitkan Materi'}
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const closeModal = () => modal.remove();
    modal.querySelector('#modal-close-btn').addEventListener('click', closeModal);
    modal.querySelector('#btn-cancel-mat').addEventListener('click', closeModal);

    modal.querySelector('#btn-save-mat').addEventListener('click', async () => {
      const payload = {
        title: modal.querySelector('#mat-title').value.trim(),
        category: modal.querySelector('#mat-category').value,
        grade_level: modal.querySelector('#mat-grade').value,
        status: modal.querySelector('#mat-status').value,
        learning_objectives: modal.querySelector('#mat-objectives').value.trim(),
        summary: modal.querySelector('#mat-summary').value.trim(),
        content: modal.querySelector('#mat-content').value.trim(),
        keywords: modal.querySelector('#mat-keywords').value.trim(),
        practice_steps: modal.querySelector('#mat-practice').value.trim(),
        faq: modal.querySelector('#mat-faq').value.trim(),
        references: modal.querySelector('#mat-references').value.trim(),
      };

      const val = validateMaterialForm(payload);
      if (!val.isValid) {
        showToast(Object.values(val.errors)[0], 'error');
        return;
      }

      await this.saveMaterial(payload, material?.id);
      closeModal();
    });
  }

  async saveMaterial(data, materialId = null) {
    try {
      const token = getAuthToken();
      const url = materialId ? `/api/materials?id=${encodeURIComponent(materialId)}` : '/api/materials';
      const method = materialId ? 'PUT' : 'POST';

      const res = await fetch(apiUrl(url), {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Gagal menyimpan materi');

      showToast(materialId ? 'Materi berhasil diperbarui!' : 'Materi baru berhasil diterbitkan & diindeks ke RAG!', 'success');
      await this.loadMaterials();
      this.ctx.refreshStats();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async deleteMaterial(materialId) {
    try {
      const token = getAuthToken();
      const res = await fetch(apiUrl(`/api/materials?id=${encodeURIComponent(materialId)}`), {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Gagal menghapus materi');

      showToast('Materi berhasil dihapus dan dikeluarkan dari RAG.', 'success');
      await this.loadMaterials();
      this.ctx.refreshStats();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  openPreviewModal(mat) {
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 760px;">
        <div class="modal-header">
          <div>
            <h2 class="modal-title">${escapeHtml(mat.title)}</h2>
            <div style="font-size:0.8rem; color:var(--color-text-secondary); margin-top:2px;">
              ${escapeHtml(mat.category)} • ${escapeHtml(mat.grade_level || 'Kelas X SMK')} • Pengampu: ${escapeHtml(mat.teacher_name || 'Guru')}
            </div>
          </div>
          <button type="button" class="modal-close">&times;</button>
        </div>
        <div class="modal-body" style="line-height: 1.65;">
          ${mat.summary ? `
            <div style="background:var(--color-surface); padding:12px 16px; border-radius:var(--radius-md); margin-bottom:16px;">
              <strong>Ringkasan:</strong> ${escapeHtml(mat.summary)}
            </div>
          ` : ''}
          <div class="bot-markdown">
            ${renderSafeMarkdown(mat.content)}
          </div>
          ${mat.practice_steps ? `
            <div style="margin-top:20px; border-top:1px solid var(--color-border); padding-top:14px;">
              <h4 style="color:var(--color-primary-dark); font-weight:700; margin-bottom:6px;">Langkah Praktik / Contoh:</h4>
              <p>${escapeHtml(mat.practice_steps)}</p>
            </div>
          ` : ''}
          ${mat.faq ? `
            <div style="margin-top:14px; border-top:1px solid var(--color-border); padding-top:14px;">
              <h4 style="color:var(--color-primary-dark); font-weight:700; margin-bottom:6px;">Miskonsepsi / FAQ:</h4>
              <p>${escapeHtml(mat.faq)}</p>
            </div>
          ` : ''}
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline modal-close-action">Tutup Pratinjau</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector('.modal-close').addEventListener('click', close);
    modal.querySelector('.modal-close-action').addEventListener('click', close);
  }

  exportJson() {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(this.materials, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', `infora_materi_${new Date().toISOString().slice(0,10)}.json`);
    dlAnchor.click();
    dlAnchor.remove();
    showToast('Materi berhasil diekspor ke JSON', 'success');
  }

  async importJson(file) {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) throw new Error('Format JSON harus berupa array materi.');

      let imported = 0;
      for (const item of parsed) {
        if (item.title && item.content) {
          await this.saveMaterial(item);
          imported++;
        }
      }
      showToast(`Berhasil mengimpor ${imported} materi!`, 'success');
    } catch (err) {
      showToast(`Gagal mengimpor JSON: ${err.message}`, 'error');
    }
  }
}
