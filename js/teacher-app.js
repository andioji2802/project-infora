/**
 * INFORA — Main Teacher Portal Coordinator (/adminguru/)
 * Manages authentication, navigation between panels, and real-time stats.
 */

import { getCurrentTeacher, loginTeacher, registerTeacher, logoutTeacher, getAuthToken } from './auth.js';
import { TeacherMaterialsManager } from './teacher-materials.js';
import { TeacherQuestionsManager } from './teacher-questions.js';
import { TeacherQuizzesManager } from './teacher-quizzes.js';
import { escapeHtml, showToast } from './utils.js';
import { validateTeacherLogin, validateTeacherRegistration } from './validation.js';
import { apiUrl } from './api-config.js';

class TeacherApp {
  constructor() {
    this.user = null;
    this.materialsMgr = new TeacherMaterialsManager(this);
    this.questionsMgr = new TeacherQuestionsManager(this);
    this.quizzesMgr = new TeacherQuizzesManager(this);
    this.currentView = 'overview';
  }

  async init() {
    this.bindAuthEvents();

    // Check if teacher is already logged in
    this.user = await getCurrentTeacher();
    if (this.user) {
      this.showDashboard();
    } else {
      this.showAuth();
    }
  }

  showAuth() {
    document.getElementById('teacher-auth-screen').style.display = 'flex';
    document.getElementById('teacher-dashboard-screen').style.display = 'none';
  }

  showDashboard() {
    document.getElementById('teacher-auth-screen').style.display = 'none';
    document.getElementById('teacher-dashboard-screen').style.display = 'flex';

    // Populate user profile info in sidebar
    const nameEl = document.getElementById('sidebar-user-name');
    const roleEl = document.getElementById('sidebar-user-role');
    if (nameEl) nameEl.textContent = this.user.full_name || 'Guru Informatika';
    if (roleEl) roleEl.textContent = `${this.user.school_name || 'SMK'} • ${this.user.role || 'Teacher'}`;

    this.bindDashboardEvents();
    this.switchView('overview');
    this.refreshStats();
  }

  bindAuthEvents() {
    const tabLogin = document.getElementById('tab-btn-login');
    const tabRegister = document.getElementById('tab-btn-register');
    const formLogin = document.getElementById('form-login');
    const formRegister = document.getElementById('form-register');
    const forgotButton = document.getElementById('btn-forgot-password');

    if (forgotButton) {
      forgotButton.addEventListener('click', async () => {
        const identifier = window.prompt('Masukkan email atau NIP/ID guru yang terdaftar:');
        if (!identifier?.trim()) return;
        forgotButton.disabled = true;
        try {
          const res = await fetch(apiUrl('/api/auth-reset'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(identifier.includes('@') ? { email: identifier.trim() } : { nip: identifier.trim() })
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || 'Permintaan reset gagal.');
          window.alert(`Kata sandi sementara: ${data.temporaryPassword}\nSegera ubah setelah masuk.`);
        } catch (err) {
          showToast(err.message, 'error');
        } finally {
          forgotButton.disabled = false;
        }
      });
    }

    document.querySelectorAll('.password-toggle').forEach(button => {
      button.addEventListener('click', () => {
        const input = document.getElementById(button.dataset.target);
        if (!input) return;
        const visible = input.type === 'text';
        input.type = visible ? 'password' : 'text';
        button.textContent = visible ? 'Lihat' : 'Sembunyikan';
        button.setAttribute('aria-label', visible ? 'Tampilkan kata sandi' : 'Sembunyikan kata sandi');
      });
    });

    const passwordInput = document.getElementById('reg-password');
    if (passwordInput) {
      passwordInput.addEventListener('input', () => {
        const value = passwordInput.value;
        const rules = {
          length: value.length >= 8,
          upper: /[A-Z]/.test(value),
          lower: /[a-z]/.test(value),
          number: /[0-9]/.test(value),
          symbol: /[^A-Za-z0-9]/.test(value)
        };
        Object.entries(rules).forEach(([rule, valid]) => {
          const element = document.querySelector(`[data-password-rule="${rule}"]`);
          if (element) {
            element.textContent = `${valid ? '✓' : '○'} ${element.textContent.replace(/^[✓○]\s*/, '')}`;
            element.style.color = valid ? '#16a34a' : '#64748b';
          }
        });
      });
    }

    if (tabLogin && tabRegister) {
      tabLogin.addEventListener('click', () => {
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
        formLogin.style.display = 'flex';
        formRegister.style.display = 'none';
      });

      tabRegister.addEventListener('click', () => {
        tabRegister.classList.add('active');
        tabLogin.classList.remove('active');
        formRegister.style.display = 'flex';
        formLogin.style.display = 'none';
      });
    }

    if (formLogin) {
      formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nip = document.getElementById('login-nip').value;
        const password = document.getElementById('login-password').value;

        const val = validateTeacherLogin({ nip, password });
        if (!val.isValid) {
          showToast(Object.values(val.errors)[0], 'error');
          return;
        }

        const submitBtn = formLogin.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Memverifikasi...';

        try {
          this.user = await loginTeacher(nip, password);
          showToast(`Selamat datang kembali, ${this.user.full_name}!`, 'success');
          this.showDashboard();
        } catch (err) {
          showToast(err.message, 'error');
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Masuk Portal Guru';
        }
      });
    }

    if (formRegister) {
      formRegister.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
          fullName: document.getElementById('reg-name').value,
          email: document.getElementById('reg-email').value,
          schoolName: document.getElementById('reg-school').value,
          teacherIdentifier: document.getElementById('reg-nip').value,
          password: document.getElementById('reg-password').value,
          confirmPassword: document.getElementById('reg-confirm-password').value
        };

        const val = validateTeacherRegistration(payload);
        if (!val.isValid) {
          showToast(Object.values(val.errors)[0], 'error');
          return;
        }

        const submitBtn = formRegister.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Mendaftarkan akun...';

        try {
          this.user = await registerTeacher(payload);
          showToast(`Akun guru berhasil dibuat! Selamat datang, ${this.user.full_name}`, 'success');
          this.showDashboard();
        } catch (err) {
          showToast(err.message, 'error');
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Daftar Akun Guru';
        }
      });
    }
  }

  bindDashboardEvents() {
    // Navigation items
    document.querySelectorAll('.teacher-nav-item[data-view]').forEach(item => {
      item.addEventListener('click', () => {
        const view = item.getAttribute('data-view');
        this.switchView(view);
      });
    });

    // Logout
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        if (confirm('Keluar dari portal guru?')) {
          try {
            await logoutTeacher();
          } catch (err) {
            console.error('Logout API gagal, sesi lokal tetap dibersihkan:', err);
          } finally {
            this.user = null;
            showToast('Anda telah keluar.', 'info');
            this.showAuth();
          }
        }
      });
    }

    // Material search & category filters
    const matSearch = document.getElementById('mat-search-input');
    const matCatFilter = document.getElementById('mat-cat-filter');
    const matStatusFilter = document.getElementById('mat-status-filter');

    if (matSearch) {
      matSearch.addEventListener('input', (e) => {
        this.materialsMgr.currentFilter.search = e.target.value;
        this.materialsMgr.render();
      });
    }
    if (matCatFilter) {
      matCatFilter.addEventListener('change', (e) => {
        this.materialsMgr.currentFilter.category = e.target.value;
        this.materialsMgr.render();
      });
    }
    if (matStatusFilter) {
      matStatusFilter.addEventListener('change', (e) => {
        this.materialsMgr.currentFilter.status = e.target.value;
        this.materialsMgr.render();
      });
    }

    // Add Material Button
    const addMatBtn = document.getElementById('btn-add-material');
    if (addMatBtn) {
      addMatBtn.addEventListener('click', () => {
        this.materialsMgr.openMaterialModal();
      });
    }

    // Export / Import
    const exportBtn = document.getElementById('btn-export-materials');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.materialsMgr.exportJson());
    }
    const importInput = document.getElementById('import-materials-file');
    if (importInput) {
      importInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          this.materialsMgr.importJson(e.target.files[0]);
        }
      });
    }

    // Add Question Button
    const addQBtn = document.getElementById('btn-add-question');
    if (addQBtn) {
      addQBtn.addEventListener('click', () => {
        this.questionsMgr.openQuestionModal();
      });
    }

    // Add Quiz Button
    const addQuizBtn = document.getElementById('btn-add-quiz');
    if (addQuizBtn) {
      addQuizBtn.addEventListener('click', () => {
        this.quizzesMgr.openQuizModal();
      });
    }

    // Profile Save Form
    const profileForm = document.getElementById('profile-form');
    if (profileForm) {
      profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleSaveProfile();
      });
    }
  }

  switchView(viewName) {
    this.currentView = viewName;

    const titles = {
      overview: 'Ringkasan Portal Guru',
      materials: 'Kelola Materi Pembelajaran Informatika',
      questions: 'Kelola Bank Soal Informatika',
      quizzes: 'Kelola Paket Latihan & Kuis',
      'rag-status': 'Status Sistem RAG & Model AI',
      profile: 'Profil Guru Pengampu'
    };
    const titleEl = document.getElementById('page-title');
    if (titleEl && titles[viewName]) {
      titleEl.textContent = titles[viewName];
    }

    // Update active nav item
    document.querySelectorAll('.teacher-nav-item').forEach(item => {
      if (item.getAttribute('data-view') === viewName) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Hide all view panels
    document.querySelectorAll('.view-panel').forEach(panel => {
      panel.style.display = 'none';
    });

    // Show target view panel
    const targetPanel = document.getElementById(`panel-${viewName}`);
    if (targetPanel) {
      targetPanel.style.display = 'block';
    }

    // Load data for specific view
    if (viewName === 'materials') {
      this.materialsMgr.loadMaterials();
    } else if (viewName === 'questions') {
      this.questionsMgr.loadQuestions();
    } else if (viewName === 'quizzes') {
      this.quizzesMgr.loadQuizzes();
    } else if (viewName === 'profile') {
      this.loadProfileForm();
    } else if (viewName === 'rag-status') {
      this.loadRagStatus();
    } else if (viewName === 'overview') {
      this.refreshStats();
    }
  }

  async refreshStats() {
    try {
      const token = getAuthToken();
      const res = await fetch(apiUrl('/api/stats'), {
        headers: { 'Authorization': 'Bearer ' + token },
        cache: 'no-store'
      });
      if (res.ok) {
        const stats = await res.json();
        const statMat = document.getElementById('stat-materials');
        const statPub = document.getElementById('stat-published');
        const statQ = document.getElementById('stat-questions');
        const statChunks = document.getElementById('stat-chunks');

        if (statMat) statMat.textContent = stats.totalMaterials || 0;
        if (statPub) statPub.textContent = stats.publishedMaterials || 0;
        if (statQ) statQ.textContent = stats.totalQuestions || 0;
        if (statChunks) statChunks.textContent = stats.totalChunks || 0;
      } else {
        const data = await res.json().catch(() => ({}));
        console.error('Gagal memuat statistik dashboard:', data.error || res.status);
      }
    } catch (error) {
      console.error('Dashboard tidak dapat mengambil statistik:', error);
    }
  }

  loadProfileForm() {
    if (!this.user) return;
    const nameInp = document.getElementById('profile-name');
    const emailInp = document.getElementById('profile-email');
    const schoolInp = document.getElementById('profile-school');
    const nipInp = document.getElementById('profile-nip');

    if (nameInp) nameInp.value = this.user.full_name || '';
    if (emailInp) emailInp.value = this.user.email || '';
    if (schoolInp) schoolInp.value = this.user.school_name || '';
    if (nipInp) nipInp.value = this.user.teacher_identifier || '';
  }

  async handleSaveProfile() {
    try {
      const token = getAuthToken();
      const payload = {
        full_name: document.getElementById('profile-name').value.trim(),
        school_name: document.getElementById('profile-school').value.trim(),
        teacher_identifier: document.getElementById('profile-nip').value.trim()
      };

      const res = await fetch(apiUrl('/api/auth-profile'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan profil');

      this.user = data.user;
      showToast('Profil guru berhasil diperbarui!', 'success');
      const nameEl = document.getElementById('sidebar-user-name');
      const roleEl = document.getElementById('sidebar-user-role');
      if (nameEl) nameEl.textContent = this.user.full_name || 'Guru Informatika';
      if (roleEl) roleEl.textContent = `${this.user.school_name || 'SMK'} • ${this.user.role || 'Teacher'}`;
      this.loadProfileForm();
      await this.refreshStats();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async loadRagStatus() {
    const statusBox = document.getElementById('rag-health-info');
    if (!statusBox) return;

    statusBox.innerHTML = '<p style="color:var(--color-text-secondary);">Memeriksa status AI dan embedding...</p>';

    try {
      const res = await fetch(apiUrl('/api/health'));
      const health = await res.json();

      statusBox.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:12px;">
          <div style="display:flex; align-items:center; justify-content:space-between; padding:12px; background:var(--color-surface); border-radius:var(--radius-md);">
            <span>Model Generatif AI (Tutor):</span>
            <span class="badge badge-published">${escapeHtml(health.hasGeminiKey ? `${health.model || 'Gemini 2.5 Flash'} (Aktif)` : 'API Key Belum Dikonfigurasi')}</span>
          </div>
          <div style="display:flex; align-items:center; justify-content:space-between; padding:12px; background:var(--color-surface); border-radius:var(--radius-md);">
            <span>Model Vektor Embedding:</span>
            <span class="badge badge-published">${escapeHtml(health.embeddingModel || 'gemini-embedding-2-preview')} (Multilingual)</span>
          </div>
          <div style="display:flex; align-items:center; justify-content:space-between; padding:12px; background:var(--color-surface); border-radius:var(--radius-md);">
            <span>Penyimpanan Vektor (pgvector/Database):</span>
            <span class="badge ${health.hasSupabase ? 'badge-published' : 'badge-draft'}">${health.hasSupabase ? `Terhubung (${health.totalChunks || 0} Chunks Tersimpan)` : 'Mode Lokal / Supabase Belum Dikonfigurasi'}</span>
          </div>
          <div style="display:flex; align-items:center; justify-content:space-between; padding:12px; background:var(--color-surface); border-radius:var(--radius-md);">
            <span>Filter Topik SMK:</span>
            <span class="badge badge-published">Ketat & Aktif (1 Kalimat Penolakan Tetap)</span>
          </div>
        </div>
      `;
    } catch (err) {
      statusBox.innerHTML = `<p style="color:var(--color-danger);">Gagal memuat status RAG: ${escapeHtml(err.message)}</p>`;
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new TeacherApp();
  app.init();
});
