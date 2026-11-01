/**
 * INFORA — Main Teacher Portal Coordinator (/adminguru/)
 * Manages authentication, navigation between panels, and real-time stats.
 */

import { getCurrentTeacher, loginTeacher, registerTeacher, logoutTeacher, getAuthToken } from './auth.js';
import { TeacherMaterialsManager } from './teacher-materials.js';
import { TeacherQuestionsManager } from './teacher-questions.js';
import { TeacherQuizzesManager } from './teacher-quizzes.js';
import { escapeHtml, showToast } from './utils.js';
import { validatePasswordReset, validateTeacherLogin, validateTeacherRegistration } from './validation.js';
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
    const authScreen = document.getElementById('teacher-auth-screen');
    const dashboardScreen = document.getElementById('teacher-dashboard-screen');
    if (authScreen) authScreen.style.display = 'flex';
    if (dashboardScreen) dashboardScreen.style.display = 'none';

    const loginForm = document.getElementById('form-login');
    const registerForm = document.getElementById('form-register');
    const loginTab = document.getElementById('tab-btn-login');
    const registerTab = document.getElementById('tab-btn-register');
    if (loginForm) loginForm.reset();
    if (registerForm) registerForm.reset();
    if (loginForm) loginForm.style.display = 'flex';
    if (registerForm) registerForm.style.display = 'none';
    if (loginTab) loginTab.classList.add('active');
    if (registerTab) registerTab.classList.remove('active');
  }

  openPasswordResetModal(identifier = '') {
    const existing = document.getElementById('password-reset-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.id = 'password-reset-modal';
    modal.innerHTML = `
      <div class="modal-content" style="max-width:460px;">
        <div class="modal-header">
          <h2 class="modal-title">Buat Kata Sandi Baru</h2>
          <button type="button" class="modal-close" id="password-reset-close">&times;</button>
        </div>
        <div class="modal-body">
          <form id="password-reset-form">
            <div class="form-group">
              <label class="form-label" for="reset-identifier">Email atau NIP / ID Guru</label>
              <input type="text" id="reset-identifier" class="form-input" value="${escapeHtml(identifier)}" placeholder="Masukkan email atau NIP / ID guru" autocomplete="username" required />
            </div>
            <div class="form-group">
              <label class="form-label" for="reset-new-password">Kata sandi baru</label>
              <div style="position:relative;">
                <input type="password" id="reset-new-password" class="form-input" autocomplete="new-password" required style="padding-right:44px;" />
                <button type="button" id="reset-password-toggle" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);border:0;background:transparent;cursor:pointer;">Lihat</button>
              </div>
            </div>
            <div style="display:grid;gap:6px;font-size:0.82rem;color:var(--color-text-secondary);">
              <span data-reset-rule="length">○ Minimal 8 karakter</span>
              <span data-reset-rule="upper">○ Ada huruf besar</span>
              <span data-reset-rule="lower">○ Ada huruf kecil</span>
              <span data-reset-rule="number">○ Ada angka</span>
              <span data-reset-rule="symbol">○ Ada simbol</span>
            </div>
            <p id="reset-same-password-message" style="display:none;color:var(--color-danger);font-size:0.82rem;margin:10px 0 0;">Kata sandi baru tidak boleh sama dengan kata sandi lama.</p>
            <button type="submit" id="password-reset-submit" class="btn btn-primary" style="width:100%;margin-top:16px;" disabled>Selesai</button>
          </form>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const close = () => modal.remove();
    document.getElementById('password-reset-close').addEventListener('click', close);
    modal.addEventListener('click', event => {
      if (event.target === modal) close();
    });

    const identifierInput = document.getElementById('reset-identifier');
    const input = document.getElementById('reset-new-password');
    const submit = document.getElementById('password-reset-submit');
    const toggle = document.getElementById('reset-password-toggle');
    const samePasswordMessage = document.getElementById('reset-same-password-message');
    let resetCheckTimer = 0;

    const checkSamePassword = async () => {
      const resetIdentifier = identifierInput.value.trim();
      const validation = validatePasswordReset(input.value);
      samePasswordMessage.style.display = 'none';
      submit.disabled = !resetIdentifier || !validation.isValid;
      if (!resetIdentifier || !validation.isValid) return;

      submit.disabled = true;
      submit.textContent = 'Memeriksa...';
      try {
        const res = await fetch(apiUrl('/api/auth-reset'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            resetIdentifier.includes('@')
              ? { email: resetIdentifier, newPassword: input.value, checkOnly: true }
              : { nip: resetIdentifier, newPassword: input.value, checkOnly: true }
          )
        });
        const data = await res.json().catch(() => ({}));
        const samePassword = res.ok && data.samePassword === true;
        samePasswordMessage.style.display = samePassword ? 'block' : 'none';
        submit.disabled = samePassword || !validation.isValid;
      } catch {
        submit.disabled = false;
      } finally {
        submit.textContent = 'Selesai';
      }
    };

    const schedulePasswordCheck = () => {
      window.clearTimeout(resetCheckTimer);
      resetCheckTimer = window.setTimeout(checkSamePassword, 450);
    };
    toggle.addEventListener('click', () => {
      const visible = input.type === 'text';
      input.type = visible ? 'password' : 'text';
      toggle.textContent = visible ? 'Lihat' : 'Sembunyikan';
    });

    input.addEventListener('input', () => {
      const validation = validatePasswordReset(input.value);
      Object.entries(validation.rules).forEach(([rule, valid]) => {
        const element = modal.querySelector(`[data-reset-rule="${rule}"]`);
        if (!element) return;
        element.textContent = `${valid ? '✓' : '○'} ${element.textContent.replace(/^[✓○]\s*/, '')}`;
        element.style.color = valid ? '#16a34a' : '#64748b';
      });
      submit.disabled = !identifierInput.value.trim() || !validation.isValid;
      schedulePasswordCheck();
    });

    identifierInput.addEventListener('input', () => {
      submit.disabled = !identifierInput.value.trim() || !validatePasswordReset(input.value).isValid;
      schedulePasswordCheck();
    });

    document.getElementById('password-reset-form').addEventListener('submit', async event => {
      event.preventDefault();
      const resetIdentifier = identifierInput.value.trim();
      if (!resetIdentifier) {
        showToast('Email atau NIP / ID Guru wajib diisi.', 'error');
        identifierInput.focus();
        return;
      }
      const validation = validatePasswordReset(input.value);
      if (!validation.isValid) {
        showToast('Kata sandi belum memenuhi semua persyaratan.', 'error');
        return;
      }

      submit.disabled = true;
      submit.textContent = 'Memproses...';
      let samePassword = false;
      try {
        const res = await fetch(apiUrl('/api/auth-reset'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            resetIdentifier.includes('@')
              ? { email: resetIdentifier, newPassword: input.value }
              : { nip: resetIdentifier, newPassword: input.value }
          )
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          samePassword = data.code === 'SAME_PASSWORD';
          throw new Error(data.error || 'Gagal memperbarui kata sandi.');
        }
        close();
        this.showAuth();
        window.alert('Kata sandi berhasil diperbarui. Silakan masuk dengan kata sandi baru.');
      } catch (err) {
        showToast(err.message, 'error');
        submit.disabled = samePassword || !validatePasswordReset(input.value).isValid;
      } finally {
        submit.textContent = 'Selesai';
      }
    });
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
      forgotButton.addEventListener('click', () => {
        const loginNip = document.getElementById('login-nip')?.value?.trim() || '';
        this.openPasswordResetModal(loginNip);
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
          this.user = null;
          try {
            await logoutTeacher();
          } catch (err) {
            console.error('Logout API gagal, sesi lokal tetap dibersihkan:', err);
          } finally {
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
