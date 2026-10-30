/**
 * INFORA — Utility functions
 * Client-side DOM, escaping, markdown formatting, clipboard, and helpers.
 */

export function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Safe limited markdown parser for educational tutor responses
 * Supports: code blocks, inline code, bold, italic, blockquotes, lists, paragraphs
 */
export function renderSafeMarkdown(markdown) {
  if (!markdown) return '';

  let html = '';
  // Split by code blocks first ```language ... ```
  const codeBlockRegex = /```([a-zA-Z0-9_\-\+]*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(markdown)) !== null) {
    const textBefore = markdown.substring(lastIndex, match.index);
    html += parseInlineAndBlocks(textBefore);

    const lang = escapeHtml(match[1] || 'code');
    const code = escapeHtml(match[2].trim());
    html += `
      <div class="code-block-wrap">
        <div class="code-header">
          <span>${lang}</span>
          <button type="button" class="btn-copy-code" data-code="${escapeHtml(match[2].trim())}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            Salin Kode
          </button>
        </div>
        <pre class="code-pre"><code>${code}</code></pre>
      </div>
    `;
    lastIndex = match.index + match[0].length;
  }

  const remainingText = markdown.substring(lastIndex);
  html += parseInlineAndBlocks(remainingText);

  return html;
}

function parseInlineAndBlocks(text) {
  if (!text) return '';

  const lines = text.split('\n');
  let result = '';
  let inList = false;
  let listType = 'ul';

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      if (inList) {
        result += `</${listType}>`;
        inList = false;
      }
      continue;
    }

    // Unordered list (* or -)
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      if (!inList || listType !== 'ul') {
        if (inList) result += `</${listType}>`;
        result += '<ul>';
        inList = true;
        listType = 'ul';
      }
      const itemContent = formatInline(trimmed.substring(2));
      result += `<li>${itemContent}</li>`;
      continue;
    }

    // Ordered list (1. 2. etc)
    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
    if (numMatch) {
      if (!inList || listType !== 'ol') {
        if (inList) result += `</${listType}>`;
        result += '<ol>';
        inList = true;
        listType = 'ol';
      }
      const itemContent = formatInline(numMatch[2]);
      result += `<li>${itemContent}</li>`;
      continue;
    }

    // End list if ongoing
    if (inList) {
      result += `</${listType}>`;
      inList = false;
    }

    // Headings
    if (trimmed.startsWith('### ')) {
      result += `<h4>${formatInline(trimmed.substring(4))}</h4>`;
      continue;
    }
    if (trimmed.startsWith('## ') || trimmed.startsWith('# ')) {
      result += `<h3>${formatInline(trimmed.replace(/^#+\s*/, ''))}</h3>`;
      continue;
    }

    // Blockquote
    if (trimmed.startsWith('> ')) {
      result += `<blockquote>${formatInline(trimmed.substring(2))}</blockquote>`;
      continue;
    }

    // Standard paragraph
    result += `<p>${formatInline(trimmed)}</p>`;
  }

  if (inList) {
    result += `</${listType}>`;
  }

  return result;
}

function formatInline(str) {
  let s = escapeHtml(str);
  // Inline code: `code`
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Bold: **text**
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // Italic: *text* or _text_
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  return s;
}

export function formatTimestamp(date = new Date()) {
  const d = new Date(date);
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

export function showToast(message, type = 'info', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span>${escapeHtml(message)}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

export async function copyText(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      showToast('Kode berhasil disalin!', 'success');
      return true;
    }
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    textArea.remove();
    showToast('Kode berhasil disalin!', 'success');
    return true;
  } catch (err) {
    showToast('Gagal menyalin kode', 'error');
    return false;
  }
}
