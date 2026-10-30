/**
 * INFORA — Chat UI Module
 * Renders user and bot message bubbles, RAG source citations, typing indicator, copy code buttons.
 */

import { renderSafeMarkdown, formatTimestamp, escapeHtml, copyText } from './utils.js';

export class ChatUI {
  constructor(containerElement, onSendCallback, onFollowupCallback) {
    this.container = containerElement;
    this.onSend = onSendCallback;
    this.onFollowup = onFollowupCallback;
    this.typingIndicatorElement = null;
    this.initGlobalListeners();
  }

  initGlobalListeners() {
    // Delegate copy code button clicks
    this.container.addEventListener('click', (e) => {
      const copyBtn = e.target.closest('.btn-copy-code');
      if (copyBtn) {
        const code = copyBtn.getAttribute('data-code');
        if (code) copyText(code);
      }

      const followupBtn = e.target.closest('.btn-followup');
      if (followupBtn && this.onFollowup) {
        const text = followupBtn.getAttribute('data-prompt');
        if (text) this.onFollowup(text);
      }
    });
  }

  appendUserMessage(text) {
    const time = formatTimestamp();
    const row = document.createElement('div');
    row.className = 'msg-row user';
    row.innerHTML = `
      <div class="msg-avatar" title="Siswa">S</div>
      <div class="msg-bubble-wrap">
        <div class="msg-bubble">${escapeHtml(text)}</div>
        <div class="msg-time">${time}</div>
      </div>
    `;
    this.container.appendChild(row);
    this.scrollToBottom();
  }

  appendBotMessage({ text = '', sources = [], followups = [], additionalHtml = '', rawHtml = false }) {
    this.removeTypingIndicator();
    const time = formatTimestamp();
    const row = document.createElement('div');
    row.className = 'msg-row bot';

    let contentHtml = '';
    if (rawHtml) {
      contentHtml = `<div class="bot-markdown">${text}</div>`;
    } else {
      contentHtml = `<div class="bot-markdown">${renderSafeMarkdown(text)}</div>`;
    }

    if (additionalHtml) {
      contentHtml += additionalHtml;
    }

    // RAG Source Citation Card (Bagian 11)
    if (sources && Array.isArray(sources) && sources.length > 0) {
      const sourcesList = sources.map(src => `
        <div class="rag-source-item">
          <div class="rag-source-meta">
            <span class="rag-source-title">📖 ${escapeHtml(src.title)}</span>
            <span class="rag-source-teacher">${escapeHtml(src.category || 'Informatika')} • Pengampu: ${escapeHtml(src.teacher_name || 'Guru Informatika')}</span>
          </div>
          ${src.summary ? `<span class="rag-source-teacher" style="max-width:240px; font-style:italic;">"${escapeHtml(src.summary.substring(0, 80))}..."</span>` : ''}
        </div>
      `).join('');

      contentHtml += `
        <div class="rag-sources">
          <div class="rag-sources-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
            Sumber Belajar Guru Terverifikasi
          </div>
          ${sourcesList}
        </div>
      `;
    }

    // Follow-up suggestions
    if (followups && followups.length > 0) {
      const followupBtns = followups.map(f => `
        <button type="button" class="btn-followup" data-prompt="${escapeHtml(f)}">
          💡 ${escapeHtml(f)}
        </button>
      `).join('');

      contentHtml += `
        <div class="followup-suggestions">
          ${followupBtns}
        </div>
      `;
    }

    row.innerHTML = `
      <div class="msg-avatar" title="INFORA Tutor">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a4 4 0 0 0-4 4v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2h-2V6a4 4 0 0 0-4-4z"></path><circle cx="9" cy="14" r="1"></circle><circle cx="15" cy="14" r="1"></circle></svg>
      </div>
      <div class="msg-bubble-wrap">
        <div class="msg-bubble">${contentHtml}</div>
        <div class="msg-time">${time}</div>
      </div>
    `;

    this.container.appendChild(row);
    this.scrollToBottom();
  }

  appendTypingIndicator() {
    this.removeTypingIndicator();
    const row = document.createElement('div');
    row.className = 'msg-row bot typing-row';
    row.innerHTML = `
      <div class="msg-avatar">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
      </div>
      <div class="msg-bubble-wrap">
        <div class="typing-indicator">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
      </div>
    `;
    this.container.appendChild(row);
    this.typingIndicatorElement = row;
    this.scrollToBottom();
  }

  removeTypingIndicator() {
    if (this.typingIndicatorElement) {
      this.typingIndicatorElement.remove();
      this.typingIndicatorElement = null;
    }
  }

  scrollToBottom() {
    requestAnimationFrame(() => {
      this.container.scrollTop = this.container.scrollHeight;
    });
  }
}
