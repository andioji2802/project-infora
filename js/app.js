/**
 * INFORA — Main Student App
 * Initializes ChatUI, QuizController, suggestion chips, input handling, and session state.
 */

import { ChatUI } from './chat-ui.js';
import { QuizController } from './quiz-ui.js';
import { sendChatMessage } from './chat-api.js';
import { validateChatMessage } from './validation.js';
import { showToast } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
  const messagesContainer = document.getElementById('chat-messages');
  const chatForm = document.getElementById('chat-form');
  const chatInput = document.getElementById('chat-input');
  const sendBtn = document.getElementById('send-btn');
  const chips = document.querySelectorAll('.chip');

  let sessionHistory = [];
  let isSending = false;

  // Initialize Chat UI & Quiz Controller
  const chatUi = new ChatUI(
    messagesContainer,
    (msg) => handleUserPrompt(msg),
    (prompt) => handleUserPrompt(prompt)
  );

  const quizCtrl = new QuizController(chatUi);

  // Auto-resize textarea as user types
  chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = `${Math.min(chatInput.scrollHeight, 120)}px`;
    sendBtn.disabled = chatInput.value.trim().length === 0;
  });

  // Handle Enter (Send) and Shift+Enter (Newline)
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isSending && chatInput.value.trim().length > 0) {
        chatForm.requestSubmit();
      }
    }
  });

  // Handle Form Submission
  chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (isSending) return;

    const rawText = chatInput.value;
    const validation = validateChatMessage(rawText);
    if (!validation.valid) {
      showToast(validation.error, 'error');
      return;
    }

    const message = validation.value;
    chatInput.value = '';
    chatInput.style.height = 'auto';
    sendBtn.disabled = true;

    await handleUserPrompt(message);
  });

  // Handle Suggestion Chips (Bagian 4)
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      const chipAction = chip.getAttribute('data-action');
      const chipText = chip.getAttribute('data-prompt') || chip.textContent.trim();

      if (chipAction === 'quiz') {
        quizCtrl.startQuizFlow();
      } else if (chipAction === 'network') {
        handleUserPrompt('Jelaskan materi jaringan komputer, subnetting, dan fungsinya dalam Informatika SMK');
      } else if (chipAction === 'code') {
        handleUserPrompt('Bagaimana cara menulis perulangan for dan while dalam pemrograman JavaScript serta contohnya?');
      } else if (chipAction === 'terms') {
        handleUserPrompt('Apa saja istilah penting dalam basis data seperti Primary Key, Foreign Key, dan Normalisasi?');
      } else {
        handleUserPrompt(chipText);
      }
    });
  });

  async function handleUserPrompt(userText) {
    if (isSending) return;

    // Check if user specifically requested a quiz / latihan
    const lower = userText.toLowerCase();
    if (lower.includes('mulai kuis') || lower.includes('latihan soal') || lower.includes('paket kuis')) {
      chatUi.appendUserMessage(userText);
      await quizCtrl.startQuizFlow();
      return;
    }

    // Append student message to chat UI
    chatUi.appendUserMessage(userText);
    chatUi.appendTypingIndicator();
    isSending = true;
    sendBtn.disabled = true;

    try {
      const response = await sendChatMessage(userText, sessionHistory);

      // Keep recent conversation context
      sessionHistory.push({ role: 'user', content: userText });
      sessionHistory.push({ role: 'assistant', content: response.answer });
      if (sessionHistory.length > 8) {
        sessionHistory = sessionHistory.slice(-8);
      }

      chatUi.appendBotMessage({
        text: response.answer,
        sources: response.sources || [],
        followups: response.followups || []
      });

    } catch (err) {
      chatUi.removeTypingIndicator();
      chatUi.appendBotMessage({
        text: `Terjadi kendala dalam memproses pertanyaan kamu: ${err.message}`,
        sources: []
      });
    } finally {
      isSending = false;
      sendBtn.disabled = chatInput.value.trim().length === 0;
      chatInput.focus();
    }
  }
});
